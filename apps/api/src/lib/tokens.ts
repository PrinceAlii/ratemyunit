import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { db } from '@ratemyunit/db/client';
import { emailVerificationTokens, passwordResetTokens } from '@ratemyunit/db/schema';
import { eq } from 'drizzle-orm';

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate a random token (UUID-like).
 */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash a token for storage/lookup.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function tokensMatch(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Create an email verification token for a user.
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.insert(emailVerificationTokens).values({
    userId,
    token: tokenHash,
    expiresAt,
  });

  return token;
}

/**
 * Verify an email verification token.
 */
export async function verifyEmailToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const [record] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, tokenHash))
    .limit(1);

  if (!record) {
    return null;
  }

  if (!tokensMatch(record.token, tokenHash)) {
    return null;
  }

  if (record.expiresAt < new Date()) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, record.id));
    return null;
  }

  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, record.id));

  return record.userId;
}

/**
 * Create a password reset token for a user.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

  await db.insert(passwordResetTokens).values({
    userId,
    token: tokenHash,
    expiresAt,
  });

  return token;
}

/**
 * Verify a password reset token.
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, tokenHash))
    .limit(1);

  if (!record) {
    return null;
  }

  if (!tokensMatch(record.token, tokenHash)) {
    return null;
  }

  if (record.expiresAt < new Date()) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));
    return null;
  }

  // Single-use token logic handled by the caller after password reset
  return record.userId;
}

/**
 * Delete a password reset token after use.
 */
export async function deletePasswordResetToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, tokenHash));
}
