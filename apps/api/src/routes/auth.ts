import type { FastifyInstance } from 'fastify';
import { hash, verify } from '@node-rs/argon2';
import { db } from '@ratemyunit/db/client';
import { users, universities, siteBannerSettings, emailVerificationTokens } from '@ratemyunit/db/schema';
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
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { sendEmail, generateVerificationEmail, generatePasswordResetEmail } from '../lib/email.js';
import { recordTelemetry } from '../lib/telemetry.js';

const SITE_BANNER_ROW_ID = 1;

export async function authRoutes(app: FastifyInstance) {
  const registrationSuccessMessage =
    'Account created. Please check your email to verify your account.';

  const buildRegistrationSuccessResponse = (email: string) => ({
    success: true,
    message: registrationSuccessMessage,
    data: {
      email,
    },
  });

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

    const [registrationPolicy] = await db
      .select({
        enforceEduAuEmail: siteBannerSettings.enforceEduAuEmail,
      })
      .from(siteBannerSettings)
      .where(eq(siteBannerSettings.id, SITE_BANNER_ROW_ID))
      .limit(1);

    const enforceEduAuEmail = registrationPolicy?.enforceEduAuEmail ?? false;
    const emailDomain = body.email.split('@')[1];
    if (enforceEduAuEmail && !emailDomain.endsWith('.edu.au')) {
      return reply.status(400).send({
        success: false,
        error: 'Registration requires an Australian educational email (.edu.au)',
      });
    }

    const [matchedUniversity] = await db
      .select()
      .from(universities)
      .where(eq(universities.emailDomain, emailDomain))
      .limit(1);

    const [selectedUniversity] = await db
      .select()
      .from(universities)
      .where(eq(universities.id, body.universityId))
      .limit(1);

    if (!selectedUniversity || !selectedUniversity.active) {
      return reply.status(400).send({
        success: false,
        error: 'Selected university is not valid or supported.',
      });
    }

    // Check existence before hashing (expensive)
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (existingUser) {
      // Return a generic success response to prevent registration email enumeration.
      return reply.status(201).send(buildRegistrationSuccessResponse(body.email));
    }

    const passwordHash = await hash(body.password, {
      memoryCost: 47104,
      timeCost: 3,
      outputLen: 32,
      parallelism: 1,
    });

    const domainVerified = matchedUniversity && matchedUniversity.id === selectedUniversity.id;

    const [newUser] = await db
      .insert(users)
      .values({
        email: body.email,
        passwordHash,
        displayName: body.displayName,
        universityId: body.universityId,
        role: 'student',
        emailVerified: false,
        domainVerified: domainVerified,
        banned: false,
      })
      .returning();

    const verificationToken = await createEmailVerificationToken(newUser.id);
    const verificationLink = `${config.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await recordTelemetry(newUser.id, request);
    try {
      const emailResult = await sendEmail({
        to: newUser.email,
        subject: 'Verify Your Email - RateMyUnit',
        html: generateVerificationEmail(verificationLink),
      });
      request.log.info(
        { userId: newUser.id, email: newUser.email, emailMessageId: emailResult?.messageId },
        'Sent verification email after registration'
      );
    } catch (error) {
      request.log.error(
        { error, userId: newUser.id, email: newUser.email },
        'Failed to send verification email after registration. Rolling back account creation.'
      );

      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, newUser.id));
      await db.delete(users).where(eq(users.id, newUser.id));

      return reply.status(502).send({
        success: false,
        error: 'Could not send verification email. Please try again.',
      });
    }

    return reply.status(201).send(buildRegistrationSuccessResponse(newUser.email));
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
      request.log.warn(
        {
          event: 'security.failed_login',
          email: body.email,
          ip: request.ip,
        },
        'Failed login attempt'
      );
      return reply.status(401).send({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    if (user.banned) {
      request.log.warn(
        {
          event: 'security.banned_login_attempt',
          userId: user.id,
          email: user.email,
          ip: request.ip,
        },
        'Blocked login attempt for banned user'
      );
      return reply.status(403).send({
        success: false,
        error: 'Your account has been banned.',
      });
    }

    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    await recordTelemetry(user.id, request);

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
  app.post('/logout', async (request, reply) => {
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
   * POST /api/auth/resend-verification
   * Resend verification email for unverified users.
   */
  app.post('/resend-verification', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour'
      }
    }
  }, async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    // Generic success response prevents email enumeration.
    if (!user || user.emailVerified) {
      return reply.send({
        success: true,
        message: 'If your account exists and is unverified, a new verification link has been sent.',
      });
    }

    const verificationToken = await createEmailVerificationToken(user.id);
    const verificationLink = `${config.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - RateMyUnit',
      html: generateVerificationEmail(verificationLink),
    });

    return reply.send({
      success: true,
      message: 'If your account exists and is unverified, a new verification link has been sent.',
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
    const resetLink = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset Your Password - RateMyUnit',
      html: generatePasswordResetEmail(resetLink),
    });

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

    const passwordHash = await hash(body.password, {
      memoryCost: 47104,
      timeCost: 3,
      outputLen: 32,
      parallelism: 1,
    });

    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await deletePasswordResetToken(body.token);

    return reply.send({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  });

  /**
   * GET /api/auth/csrf
   * Generate a CSRF token for the frontend.
   */
  app.get('/csrf', async (_request, reply) => {
    const token = await reply.generateCsrf();
    return reply.send({
      success: true,
      data: { token },
    });
  });
}
