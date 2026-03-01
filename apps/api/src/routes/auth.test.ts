import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockRequest, createMockReply } from '../__tests__/helpers/auth-mock';
import {
  createMockQueryBuilder,
  createMockInsertBuilder,
  createMockUpdateBuilder,
  createMockDeleteBuilder,
} from '../__tests__/helpers/db-mock';
import { TEST_IDS, mockUser, mockUniversity, mockSession } from '../__tests__/helpers/fixtures';

// --- Mocks ------------------------------------------------------------------

const {
  mockSelect, mockInsert, mockUpdate, mockDelete,
  mockHash, mockVerify,
  mockLucia,
  mockCreateEmailVerificationToken, mockVerifyEmailToken,
  mockCreatePasswordResetToken, mockVerifyPasswordResetToken, mockDeletePasswordResetToken,
  mockSendEmail, mockGenerateVerificationEmail, mockGeneratePasswordResetEmail,
  mockRecordTelemetry,
} = vi.hoisted(() => {
  const createMockLuciaFn = () => ({
    createSession: vi.fn().mockResolvedValue({ id: 'session-id' }),
    createSessionCookie: vi.fn().mockReturnValue({
      name: 'auth_session',
      value: 'session-cookie-value',
      attributes: { path: '/' },
    }),
    invalidateSession: vi.fn().mockResolvedValue(undefined),
    invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
    createBlankSessionCookie: vi.fn().mockReturnValue({
      name: 'auth_session',
      value: '',
      attributes: { path: '/', maxAge: 0 },
    }),
  });
  return {
    mockSelect: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockHash: vi.fn(),
    mockVerify: vi.fn(),
    mockLucia: createMockLuciaFn(),
    mockCreateEmailVerificationToken: vi.fn(),
    mockVerifyEmailToken: vi.fn(),
    mockCreatePasswordResetToken: vi.fn(),
    mockVerifyPasswordResetToken: vi.fn(),
    mockDeletePasswordResetToken: vi.fn(),
    mockSendEmail: vi.fn(),
    mockGenerateVerificationEmail: vi.fn(),
    mockGeneratePasswordResetEmail: vi.fn(),
    mockRecordTelemetry: vi.fn(),
  };
});

vi.mock('@ratemyunit/db/client', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

vi.mock('@ratemyunit/db/schema', () => ({
  users: {
    id: 'id',
    email: 'email',
    passwordHash: 'passwordHash',
    displayName: 'displayName',
    universityId: 'universityId',
    role: 'role',
    emailVerified: 'emailVerified',
    domainVerified: 'domainVerified',
    banned: 'banned',
  },
  universities: {
    id: 'id',
    emailDomain: 'emailDomain',
    active: 'active',
  },
  siteBannerSettings: {
    id: 'id',
    enforceEduAuEmail: 'enforceEduAuEmail',
  },
  emailVerificationTokens: {
    userId: 'userId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

vi.mock('@ratemyunit/validators', () => ({
  registerSchema: { parse: vi.fn((body: unknown) => body) },
  loginSchema: { parse: vi.fn((body: unknown) => body) },
  forgotPasswordSchema: { parse: vi.fn((body: unknown) => body) },
  resetPasswordSchema: { parse: vi.fn((body: unknown) => body) },
  verifyEmailSchema: { parse: vi.fn((body: unknown) => body) },
}));

vi.mock('@node-rs/argon2', () => ({
  hash: mockHash,
  verify: mockVerify,
}));

vi.mock('../lib/auth.js', () => ({
  lucia: mockLucia,
}));

vi.mock('../lib/tokens.js', () => ({
  createEmailVerificationToken: mockCreateEmailVerificationToken,
  verifyEmailToken: mockVerifyEmailToken,
  createPasswordResetToken: mockCreatePasswordResetToken,
  verifyPasswordResetToken: mockVerifyPasswordResetToken,
  deletePasswordResetToken: mockDeletePasswordResetToken,
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('../config.js', () => ({
  config: { FRONTEND_URL: 'http://localhost:5173' },
}));

vi.mock('../lib/email.js', () => ({
  sendEmail: mockSendEmail,
  generateVerificationEmail: mockGenerateVerificationEmail,
  generatePasswordResetEmail: mockGeneratePasswordResetEmail,
}));

vi.mock('../lib/telemetry.js', () => ({
  recordTelemetry: mockRecordTelemetry,
}));

import { authRoutes } from './auth';

// --- Handler capture --------------------------------------------------------

type Handler = (req: unknown, reply: unknown) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

function captureApp() {
  return {
    get: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`GET ${path}`] = args[args.length - 1] as Handler;
    }),
    post: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`POST ${path}`] = args[args.length - 1] as Handler;
    }),
    put: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`PUT ${path}`] = args[args.length - 1] as Handler;
    }),
    delete: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`DELETE ${path}`] = args[args.length - 1] as Handler;
    }),
    addHook: vi.fn(),
  } as unknown as FastifyInstance;
}

// --- Tests ------------------------------------------------------------------

describe('authRoutes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
    mockSendEmail.mockResolvedValue(undefined);
    mockRecordTelemetry.mockResolvedValue(undefined);
    mockGenerateVerificationEmail.mockReturnValue('<html>verify</html>');
    mockGeneratePasswordResetEmail.mockReturnValue('<html>reset</html>');
    await authRoutes(captureApp());
  });

  // ---- POST /register -----------------------------------------------------

  describe('POST /register', () => {
    it('registers user successfully', async () => {
      const newUser = {
        ...mockUser,
        id: TEST_IDS.user,
        email: 'student@student.uts.edu.au',
      };

      // 1st select: registration policy
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{ enforceEduAuEmail: false }]));
      // 2nd select: matchedUniversity by emailDomain
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 3rd select: selectedUniversity by id
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 4th select: existingUser check
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      mockHash.mockResolvedValue('hashed-password');
      mockInsert.mockReturnValue(createMockInsertBuilder([newUser]));
      mockCreateEmailVerificationToken.mockResolvedValue('test-token');

      const request = createMockRequest({
        body: {
          email: 'student@student.uts.edu.au',
          password: 'SecureP@ss123',
          displayName: 'Test Student',
          universityId: TEST_IDS.university,
        },
      });
      const reply = createMockReply();
      await handlers['POST /register'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Account created. Please check your email to verify your account.',
        }),
      );
      expect(mockSendEmail).toHaveBeenCalled();
      expect(mockRecordTelemetry).toHaveBeenCalledWith(TEST_IDS.user, request);
    });

    it('rejects non-.edu.au email when enforcement is enabled', async () => {
      // 1st select: registration policy
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{ enforceEduAuEmail: true }]));

      const request = createMockRequest({
        body: {
          email: 'student@gmail.com',
          password: 'SecureP@ss123',
          displayName: 'Test Student',
          universityId: TEST_IDS.university,
        },
      });
      const reply = createMockReply();
      await handlers['POST /register'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Registration requires an Australian educational email (.edu.au)',
        }),
      );
    });

    it('allows non-.edu.au email when enforcement is disabled', async () => {
      const newUser = {
        ...mockUser,
        id: TEST_IDS.user,
        email: 'student@gmail.com',
      };

      // 1st select: registration policy
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{ enforceEduAuEmail: false }]));
      // 2nd select: matchedUniversity by emailDomain
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));
      // 3rd select: selectedUniversity by id
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 4th select: existingUser check
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      mockHash.mockResolvedValue('hashed-password');
      mockInsert.mockReturnValue(createMockInsertBuilder([newUser]));
      mockCreateEmailVerificationToken.mockResolvedValue('test-token');

      const request = createMockRequest({
        body: {
          email: 'student@gmail.com',
          password: 'SecureP@ss123',
          displayName: 'Test Student',
          universityId: TEST_IDS.university,
        },
      });
      const reply = createMockReply();
      await handlers['POST /register'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
    });

    it('rejects invalid university', async () => {
      // 1st select: registration policy
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{ enforceEduAuEmail: false }]));
      // 2nd select: matchedUniversity (none found)
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));
      // 3rd select: selectedUniversity (not found)
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        body: {
          email: 'student@other.edu.au',
          password: 'SecureP@ss123',
          displayName: 'Test Student',
          universityId: 'nonexistent-id',
        },
      });
      const reply = createMockReply();
      await handlers['POST /register'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Selected university is not valid or supported.',
        }),
      );
    });

    it('rejects inactive university', async () => {
      const inactiveUni = { ...mockUniversity, active: false };
      // 1st select: registration policy
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{ enforceEduAuEmail: false }]));
      // 2nd select: matchedUniversity
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));
      // 3rd select: selectedUniversity (inactive)
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([inactiveUni]));

      const request = createMockRequest({
        body: {
          email: 'student@other.edu.au',
          password: 'SecureP@ss123',
          displayName: 'Test Student',
          universityId: TEST_IDS.university,
        },
      });
      const reply = createMockReply();
      await handlers['POST /register'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Selected university is not valid or supported.',
        }),
      );
    });

    it('returns generic success for duplicate email without side-effects', async () => {
      // 1st select: registration policy
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{ enforceEduAuEmail: false }]));
      // 2nd select: matchedUniversity
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 3rd select: selectedUniversity
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 4th select: existingUser found
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUser]));

      const request = createMockRequest({
        body: {
          email: 'student@student.uts.edu.au',
          password: 'SecureP@ss123',
          displayName: 'Test Student',
          universityId: TEST_IDS.university,
        },
      });
      const reply = createMockReply();
      await handlers['POST /register'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(
        {
          success: true,
          message: 'Account created. Please check your email to verify your account.',
          data: {
            email: 'student@student.uts.edu.au',
          },
        },
      );
      expect(mockHash).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockCreateEmailVerificationToken).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockRecordTelemetry).not.toHaveBeenCalled();
    });

    it('sets domainVerified when email matches university', async () => {
      const newUser = {
        ...mockUser,
        domainVerified: true,
        email: 'student@student.uts.edu.au',
      };

      // 1st select: registration policy
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{ enforceEduAuEmail: false }]));
      // 2nd select: matchedUniversity (same as selected)
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 3rd select: selectedUniversity (same id as matched)
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 4th select: no existing user
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      mockHash.mockResolvedValue('hashed-password');
      mockInsert.mockReturnValue(createMockInsertBuilder([newUser]));
      mockCreateEmailVerificationToken.mockResolvedValue('test-token');

      const request = createMockRequest({
        body: {
          email: 'student@student.uts.edu.au',
          password: 'SecureP@ss123',
          displayName: 'Test Student',
          universityId: TEST_IDS.university,
        },
      });
      const reply = createMockReply();
      await handlers['POST /register'](request, reply);

      expect(mockInsert).toHaveBeenCalled();
      // The insert builder's values should have been called with domainVerified: true
      const insertBuilder = mockInsert.mock.results[0].value;
      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          domainVerified: true,
        }),
      );
    });

    it('sets domainVerified false when email does not match university', async () => {
      const differentUni = {
        ...mockUniversity,
        id: TEST_IDS.university2,
        emailDomain: 'other.edu.au',
      };
      const newUser = {
        ...mockUser,
        domainVerified: false,
        email: 'student@other.edu.au',
      };

      // 1st select: registration policy
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{ enforceEduAuEmail: false }]));
      // 2nd select: matchedUniversity (different uni)
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([differentUni]));
      // 3rd select: selectedUniversity (original uni)
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 4th select: no existing user
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      mockHash.mockResolvedValue('hashed-password');
      mockInsert.mockReturnValue(createMockInsertBuilder([newUser]));
      mockCreateEmailVerificationToken.mockResolvedValue('test-token');

      const request = createMockRequest({
        body: {
          email: 'student@other.edu.au',
          password: 'SecureP@ss123',
          displayName: 'Test Student',
          universityId: TEST_IDS.university,
        },
      });
      const reply = createMockReply();
      await handlers['POST /register'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      const insertBuilder = mockInsert.mock.results[0].value;
      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          domainVerified: false,
        }),
      );
    });

    it('rolls back user creation if verification email fails to send', async () => {
      const newUser = {
        ...mockUser,
        id: TEST_IDS.user,
        email: 'student@student.uts.edu.au',
      };

      // 1st select: registration policy
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{ enforceEduAuEmail: false }]));
      // 2nd select: matchedUniversity by emailDomain
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 3rd select: selectedUniversity by id
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUniversity]));
      // 4th select: existingUser check
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      mockHash.mockResolvedValue('hashed-password');
      mockInsert.mockReturnValue(createMockInsertBuilder([newUser]));
      mockCreateEmailVerificationToken.mockResolvedValue('test-token');
      mockSendEmail.mockRejectedValue(new Error('SMTP down'));
      mockDelete.mockReturnValue(createMockDeleteBuilder());

      const request = createMockRequest({
        body: {
          email: 'student@student.uts.edu.au',
          password: 'SecureP@ss123',
          displayName: 'Test Student',
          universityId: TEST_IDS.university,
        },
      });
      const reply = createMockReply();
      await handlers['POST /register'](request, reply);

      expect(mockDelete).toHaveBeenCalledTimes(2);
      expect(reply.status).toHaveBeenCalledWith(502);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Could not send verification email. Please try again.',
        }),
      );
    });
  });

  // ---- POST /login --------------------------------------------------------

  describe('POST /login', () => {
    it('logs in successfully', async () => {
      const user = { ...mockUser, banned: false };
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([user]));
      mockVerify.mockResolvedValue(true);
      mockLucia.createSession.mockResolvedValue(mockSession);

      const request = createMockRequest({
        body: {
          email: 'student@student.uts.edu.au',
          password: 'SecureP@ss123',
        },
      });
      const reply = createMockReply();
      await handlers['POST /login'](request, reply);

      expect(reply.setCookie).toHaveBeenCalledWith(
        'auth_session',
        'session-cookie-value',
        expect.objectContaining({ path: '/' }),
      );
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
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
        }),
      );
      expect(mockRecordTelemetry).toHaveBeenCalledWith(user.id, request);
    });

    it('rejects invalid credentials when user not found', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));
      // Dummy hash verify returns false (timing-safe path)
      mockVerify.mockResolvedValue(false);

      const request = createMockRequest({
        body: {
          email: 'nobody@student.uts.edu.au',
          password: 'WrongPassword',
        },
      });
      const reply = createMockReply();
      await handlers['POST /login'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid email or password.',
        }),
      );
    });

    it('rejects invalid credentials when password is wrong', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUser]));
      mockVerify.mockResolvedValue(false);

      const request = createMockRequest({
        body: {
          email: 'student@student.uts.edu.au',
          password: 'WrongPassword',
        },
      });
      const reply = createMockReply();
      await handlers['POST /login'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid email or password.',
        }),
      );
    });

    it('rejects banned user', async () => {
      const bannedUser = { ...mockUser, banned: true };
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([bannedUser]));
      mockVerify.mockResolvedValue(true);

      const request = createMockRequest({
        body: {
          email: 'student@student.uts.edu.au',
          password: 'SecureP@ss123',
        },
      });
      const reply = createMockReply();
      await handlers['POST /login'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Your account has been banned.',
        }),
      );
    });
  });

  // ---- POST /logout -------------------------------------------------------

  describe('POST /logout', () => {
    it('invalidates session and clears cookie', async () => {
      const request = createMockRequest({
        cookies: { auth_session: TEST_IDS.session },
      });
      const reply = createMockReply();
      await handlers['POST /logout'](request, reply);

      expect(mockLucia.invalidateSession).toHaveBeenCalledWith(TEST_IDS.session);
      expect(reply.setCookie).toHaveBeenCalledWith(
        'auth_session',
        '',
        expect.objectContaining({ maxAge: 0 }),
      );
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logged out successfully.',
        }),
      );
    });

    it('handles missing session gracefully', async () => {
      const request = createMockRequest({ cookies: {} });
      const reply = createMockReply();
      await handlers['POST /logout'](request, reply);

      expect(mockLucia.invalidateSession).not.toHaveBeenCalled();
      expect(reply.setCookie).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logged out successfully.',
        }),
      );
    });
  });

  // ---- GET /me ------------------------------------------------------------

  describe('GET /me', () => {
    it('returns current user', async () => {
      const request = createMockRequest({ user: mockUser });
      const reply = createMockReply();
      await handlers['GET /me'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { user: mockUser },
        }),
      );
    });
  });

  // ---- POST /verify-email -------------------------------------------------

  describe('POST /verify-email', () => {
    it('verifies email successfully', async () => {
      mockVerifyEmailToken.mockResolvedValue(TEST_IDS.user);
      mockUpdate.mockReturnValue(createMockUpdateBuilder());

      const request = createMockRequest({
        body: { token: 'valid-token' },
      });
      const reply = createMockReply();
      await handlers['POST /verify-email'](request, reply);

      expect(mockVerifyEmailToken).toHaveBeenCalledWith('valid-token');
      expect(mockUpdate).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Email verified successfully. You can now log in.',
        }),
      );
    });

    it('rejects invalid token', async () => {
      mockVerifyEmailToken.mockResolvedValue(null);

      const request = createMockRequest({
        body: { token: 'invalid-token' },
      });
      const reply = createMockReply();
      await handlers['POST /verify-email'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid or expired verification token.',
        }),
      );
    });
  });

  // ---- POST /resend-verification ------------------------------------------

  describe('POST /resend-verification', () => {
    it('resends verification for an unverified user', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{
        id: TEST_IDS.user,
        email: mockUser.email,
        emailVerified: false,
      }]));
      mockCreateEmailVerificationToken.mockResolvedValue('new-verify-token');

      const request = createMockRequest({
        body: { email: mockUser.email },
      });
      const reply = createMockReply();
      await handlers['POST /resend-verification'](request, reply);

      expect(mockCreateEmailVerificationToken).toHaveBeenCalledWith(TEST_IDS.user);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Verify Your Email - RateMyUnit',
        }),
      );
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'If your account exists and is unverified, a new verification link has been sent.',
      });
    });

    it('returns generic success when user does not exist', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        body: { email: 'missing@example.com' },
      });
      const reply = createMockReply();
      await handlers['POST /resend-verification'](request, reply);

      expect(mockCreateEmailVerificationToken).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'If your account exists and is unverified, a new verification link has been sent.',
      });
    });
  });

  // ---- POST /forgot-password ----------------------------------------------

  describe('POST /forgot-password', () => {
    it('sends reset email for existing user', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUser]));
      mockCreatePasswordResetToken.mockResolvedValue('reset-token');

      const request = createMockRequest({
        body: { email: 'student@student.uts.edu.au' },
      });
      const reply = createMockReply();
      await handlers['POST /forgot-password'](request, reply);

      expect(mockCreatePasswordResetToken).toHaveBeenCalledWith(TEST_IDS.user);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Reset Your Password - RateMyUnit',
        }),
      );
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        }),
      );
    });

    it('returns success even for non-existent email', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        body: { email: 'nobody@student.uts.edu.au' },
      });
      const reply = createMockReply();
      await handlers['POST /forgot-password'](request, reply);

      expect(mockCreatePasswordResetToken).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        }),
      );
    });
  });

  // ---- POST /reset-password -----------------------------------------------

  describe('POST /reset-password', () => {
    it('resets password successfully', async () => {
      mockVerifyPasswordResetToken.mockResolvedValue(TEST_IDS.user);
      mockHash.mockResolvedValue('new-hashed-password');
      mockUpdate.mockReturnValue(createMockUpdateBuilder());
      mockDeletePasswordResetToken.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: { token: 'valid-reset-token', password: 'NewSecureP@ss456' },
      });
      const reply = createMockReply();
      await handlers['POST /reset-password'](request, reply);

      expect(mockVerifyPasswordResetToken).toHaveBeenCalledWith('valid-reset-token');
      expect(mockLucia.invalidateUserSessions).toHaveBeenCalledWith(TEST_IDS.user);
      expect(mockHash).toHaveBeenCalledWith('NewSecureP@ss456', expect.objectContaining({
        memoryCost: 47104,
        timeCost: 3,
        outputLen: 32,
        parallelism: 1,
      }));
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockDeletePasswordResetToken).toHaveBeenCalledWith('valid-reset-token');
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password reset successfully. Please log in with your new password.',
        }),
      );
    });

    it('rejects invalid reset token', async () => {
      mockVerifyPasswordResetToken.mockResolvedValue(null);

      const request = createMockRequest({
        body: { token: 'invalid-reset-token', password: 'NewSecureP@ss456' },
      });
      const reply = createMockReply();
      await handlers['POST /reset-password'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid or expired reset token.',
        }),
      );
      expect(mockLucia.invalidateUserSessions).not.toHaveBeenCalled();
      expect(mockHash).not.toHaveBeenCalled();
    });
  });

  // ---- GET /csrf ----------------------------------------------------------

  describe('GET /csrf', () => {
    it('returns CSRF token', async () => {
      const request = createMockRequest();
      const reply = createMockReply();
      await handlers['GET /csrf'](request, reply);

      expect(reply.generateCsrf).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { token: 'mock-csrf-token' },
        }),
      );
    });
  });
});
