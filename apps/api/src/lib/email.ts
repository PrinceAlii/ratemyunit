import { Resend } from 'resend';
import { config } from '../config.js';
import pino from 'pino';

const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
});

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  messageId?: string;
}

interface FlaggedReviewAlertParams {
  reviewId: string;
  unitCode: string;
  reason: string;
  description: string | null;
  flagCount: number;
  moderationUrl: string;
}


/**
 * Send an email using Resend.
 * In development without API key, logs to console instead.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) {
    logger.info('\n📧 Email (No Resend API Key configured):');
    logger.info(`To: ${to}`);
    logger.info(`Subject: ${subject}`);
    logger.info(`HTML Preview: ${html.substring(0, 200)}...`);
    logger.info('');
    return {};
  }

  try {
    const from = `${config.RESEND_FROM_NAME} <${config.RESEND_FROM_EMAIL}>`;
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error({ error }, 'Failed to send email via Resend');
      throw new Error(`Email sending failed: ${error.message || 'Unknown error'}`);
    }

    logger.info(
      {
        emailId: data?.id,
        from,
        to,
        subject,
        environment: config.NODE_ENV,
      },
      `Email sent successfully to ${to}`
    );
    return { messageId: data?.id };
  } catch (error) {
    logger.error({ error }, 'Exception while sending email');
    throw error;
  }
}

/**
 * Generate HTML for verification email
 */
export function generateVerificationEmail(verificationLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="margin-bottom: 20px;">
          <div style="display: inline-block; background: #FFD700; border: 4px solid #000; padding: 10px 20px;">
            <span style="font-size: 24px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: -1px;">RateMyUnit</span>
          </div>
        </div>
        <div style="background: #f9f9f9; border: 3px solid #000; padding: 30px; margin: 20px 0;">
          <h1 style="color: #000; margin-top: 0; font-size: 28px; font-weight: 900; text-transform: uppercase;">Verify Your Email</h1>

          <p style="font-size: 16px; margin: 20px 0;">
            Thanks for signing up to RateMyUnit! Please verify your email address by clicking the button below.
          </p>

          <a href="${verificationLink}"
             style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; font-weight: bold; border: 3px solid #000; margin: 20px 0; text-transform: uppercase;">
            Verify Email
          </a>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            Or copy and paste this link into your browser:<br>
            <a href="${verificationLink}" style="color: #0066cc; word-break: break-all;">${verificationLink}</a>
          </p>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
        </div>

        <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
          © 2026 RateMyUnit. All rights reserved.
        </p>
      </body>
    </html>
  `;
}

/**
 * Generate HTML for password reset email
 */
export function generatePasswordResetEmail(resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="margin-bottom: 20px;">
          <div style="display: inline-block; background: #FFD700; border: 4px solid #000; padding: 10px 20px;">
            <span style="font-size: 24px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: -1px;">RateMyUnit</span>
          </div>
        </div>
        <div style="background: #f9f9f9; border: 3px solid #000; padding: 30px; margin: 20px 0;">
          <h1 style="color: #000; margin-top: 0; font-size: 28px; font-weight: 900; text-transform: uppercase;">Reset Your Password</h1>

          <p style="font-size: 16px; margin: 20px 0;">
            We received a request to reset your password. Click the button below to create a new password.
          </p>

          <a href="${resetLink}"
             style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; font-weight: bold; border: 3px solid #000; margin: 20px 0; text-transform: uppercase;">
            Reset Password
          </a>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            Or copy and paste this link into your browser:<br>
            <a href="${resetLink}" style="color: #0066cc; word-break: break-all;">${resetLink}</a>
          </p>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>

        <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
          © 2026 RateMyUnit. All rights reserved.
        </p>
      </body>
    </html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateFlaggedReviewAlertEmail({
  reviewId,
  unitCode,
  reason,
  description,
  flagCount,
  moderationUrl,
}: FlaggedReviewAlertParams): string {
  const safeDescription = description?.trim().length
    ? escapeHtml(description.trim())
    : 'No additional details provided.';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Review Flag Alert</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111; max-width: 640px; margin: 0 auto; padding: 24px;">
        <div style="background: #ffe37a; border: 4px solid #000; padding: 16px 20px; margin-bottom: 18px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase;">Review Flagged</h1>
        </div>
        <div style="border: 3px solid #000; padding: 18px; background: #fff;">
          <p style="margin: 0 0 10px 0;"><strong>Unit:</strong> ${escapeHtml(unitCode)}</p>
          <p style="margin: 0 0 10px 0;"><strong>Review ID:</strong> ${escapeHtml(reviewId)}</p>
          <p style="margin: 0 0 10px 0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
          <p style="margin: 0 0 10px 0;"><strong>Pending Flags:</strong> ${flagCount}</p>
          <p style="margin: 0 0 10px 0;"><strong>Description:</strong> ${safeDescription}</p>
          <a href="${moderationUrl}" style="display: inline-block; margin-top: 12px; background: #000; color: #fff; border: 3px solid #000; padding: 10px 18px; text-decoration: none; font-weight: 700;">
            Open Moderation Queue
          </a>
        </div>
      </body>
    </html>
  `;
}
