import { randomBytes } from 'crypto';
import { db } from '@ratemyunit/db/client';
import { emailVerificationTokens, passwordResetTokens } from '@ratemyunit/db/schema';
import { eq } from 'drizzle-orm';

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate a random token (UUID-like).
 */
function generateToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Create an email verification token for a user.
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.insert(emailVerificationTokens).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

/**
 * Verify an email verification token.
 */
export async function verifyEmailToken(token: string): Promise<string | null> {
  const [record] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
    .limit(1);

  if (!record) {
    return null;
  }

  if (record.expiresAt < new Date()) {
    // Token expired, delete it.
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, record.id));
    return null;
  }

  // Delete token after successful verification (single-use).
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, record.id));

  return record.userId;
}

/**
 * Create a password reset token for a user.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Delete any existing tokens for this user.
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

  await db.insert(passwordResetTokens).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

/**
 * Verify a password reset token.
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!record) {
    return null;
  }

  if (record.expiresAt < new Date()) {
    // Token expired, delete it.
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));
    return null;
  }

  // Don't delete token yet - wait until password is actually reset.
  return record.userId;
}

/**
 * Delete a password reset token after use.
 */
export async function deletePasswordResetToken(token: string): Promise<void> {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
}
