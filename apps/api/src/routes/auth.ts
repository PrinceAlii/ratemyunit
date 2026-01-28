import type { FastifyInstance } from 'fastify';
import { hash, verify } from '@node-rs/argon2';
import { db } from '@ratemyunit/db/client';
import { users, universities } from '@ratemyunit/db/schema';
import { eq } from 'drizzle-orm';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@ratemyunit/validators';
import { lucia } from '../lib/auth.js';
import {
  createEmailVerificationToken,
  verifyEmailToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
  deletePasswordResetToken,
} from '../lib/tokens.js';
import { authenticateUser, requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import pino from 'pino';

const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/register
   * Register a new user account.
   */
  app.post('/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour'
      }
    }
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Extract email domain and verify it matches a university.
    const emailDomain = body.email.split('@')[1];
    const [university] = await db
      .select()
      .from(universities)
      .where(eq(universities.emailDomain, emailDomain))
      .limit(1);

    if (!university) {
      return reply.status(400).send({
        success: false,
        error: 'Email domain not recognized. Please use your university email.',
      });
    }

    if (!university.active) {
      return reply.status(400).send({
        success: false,
        error: 'This university is not currently supported.',
      });
    }

    // Check if user already exists.
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    const passwordHash = await hash(body.password, {
      memoryCost: 47104,
      timeCost: 3,
      outputLen: 32,
      parallelism: 1,
    });

    if (existingUser) {
      return reply.status(400).send({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    const [newUser] = await db
      .insert(users)
      .values({
        email: body.email,
        passwordHash,
        universityId: university.id,
        role: 'student',
        emailVerified: false,
        banned: false,
      })
      .returning();

    const verificationToken = await createEmailVerificationToken(newUser.id);

    if (config.NODE_ENV === 'development') {
      const verificationLink = `${config.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      logger.info('\n📧 Email Verification Link:');
      logger.info(verificationLink);
      logger.info('');
    } else {
      // TODO: Send verification email via email service (SendGrid, Resend, etc.).
    }

    return reply.status(201).send({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
      data: {
        email: newUser.email,
      },
    });
  });

  /**
   * POST /api/auth/login
   * Login with email and password.
   */
  app.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '5 minutes'
      }
    }
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

    const dummyHash = "$argon2id$v=19$m=47104,t=3,p=1$c29tZXNhbHQ$Rdesc85X6AnBl09v/No0ksW3XOn9uWpZ9HOn9uWpZ9H"; // Dummy hash for timing

    const validPassword = user 
      ? await verify(user.passwordHash, body.password, {
          memoryCost: 47104,
          timeCost: 3,
          outputLen: 32,
          parallelism: 1,
        })
      : await verify(dummyHash, body.password, {
          memoryCost: 47104,
          timeCost: 3,
          outputLen: 32,
          parallelism: 1,
        }).then(() => false);

    if (!user || !validPassword) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    if (user.banned) {
      return reply.status(403).send({
        success: false,
        error: 'Your account has been banned.',
      });
    }

    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    return reply.send({
      success: true,
      message: 'Logged in successfully.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      },
    });
  });

  /**
   * POST /api/auth/logout
   * Logout and destroy session.
   */
  app.post('/logout', { preHandler: authenticateUser }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: 'Not authenticated.',
      });
    }

    const sessionId = request.cookies['auth_session'];
    if (sessionId) {
      await lucia.invalidateSession(sessionId);
    }

    const sessionCookie = lucia.createBlankSessionCookie();
    reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    return reply.send({
      success: true,
      message: 'Logged out successfully.',
    });
  });

  /**
   * GET /api/auth/me
   * Get current authenticated user.
   */
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({
      success: true,
      data: {
        user: request.user,
      },
    });
  });

  /**
   * POST /api/auth/verify-email
   * Verify email with token.
   */
  app.post('/verify-email', async (request, reply) => {
    const { token } = verifyEmailSchema.parse(request.body);

    const userId = await verifyEmailToken(token);

    if (!userId) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid or expired verification token.',
      });
    }

    // Update user email verified status.
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));

    return reply.send({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  });

  /**
   * POST /api/auth/forgot-password
   * Request password reset token.
   */
  app.post('/forgot-password', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour'
      }
    }
  }, async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);

    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

    // Always return success to prevent email enumeration.
    if (!user) {
      return reply.send({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    const resetToken = await createPasswordResetToken(user.id);

    // In development, log the reset link to console.
    if (config.NODE_ENV === 'development') {
      const resetLink = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;
      logger.info('\n🔑 Password Reset Link:');
      logger.info(resetLink);
      logger.info('');
    } else {
      // TODO: Send password reset email via email service.
    }

    return reply.send({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  });

  /**
   * POST /api/auth/reset-password
   * Reset password with token.
   */
  app.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);

    const userId = await verifyPasswordResetToken(body.token);

    if (!userId) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid or expired reset token.',
      });
    }

    // Invalidate all sessions for this user BEFORE changing password
    await lucia.invalidateUserSessions(userId);

    // Hash new password with improved parameters.
    const passwordHash = await hash(body.password, {
      memoryCost: 47104,
      timeCost: 3,
      outputLen: 32,
      parallelism: 1,
    });

    // Update password.
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

    // Delete the reset token.
    await deletePasswordResetToken(body.token);

    return reply.send({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  });
}
