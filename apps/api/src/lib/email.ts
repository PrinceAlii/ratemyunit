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

/**
 * Send an email using Resend.
 * In development without API key, logs to console instead.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!resend || config.NODE_ENV === 'development') {
    logger.info('\n📧 Email (Development Mode):');
    logger.info(`To: ${to}`);
    logger.info(`Subject: ${subject}`);
    logger.info(`HTML Preview: ${html.substring(0, 200)}...`);
    logger.info('');
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'RateMyUnit <noreply@ratemyunit.dev>',
      to,
      subject,
      html,
    });

    if (error) {
      logger.error({ error }, 'Failed to send email via Resend');
      throw new Error(`Email sending failed: ${error.message || 'Unknown error'}`);
    }

    logger.info({ emailId: data?.id }, `Email sent successfully to ${to}`);
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
          © 2025 RateMyUnit. All rights reserved.
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
          © 2025 RateMyUnit. All rights reserved.
        </p>
      </body>
    </html>
  `;
}
