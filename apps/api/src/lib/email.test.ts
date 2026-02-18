import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'development',
    RESEND_API_KEY: '',
  },
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null }),
    },
  })),
}));

vi.mock('pino', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { sendEmail, generateVerificationEmail, generatePasswordResetEmail } from './email';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendEmail', () => {
  it('logs in development mode instead of sending', async () => {
    await expect(sendEmail({
      to: 'test@test.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })).resolves.toBeUndefined();
  });
});

describe('generateVerificationEmail', () => {
  it('returns HTML containing the verification link', () => {
    const link = 'https://example.com/verify?token=abc';
    const html = generateVerificationEmail(link);
    expect(html).toContain(link);
  });

  it('contains expected structure elements', () => {
    const link = 'https://example.com/verify?token=abc';
    const html = generateVerificationEmail(link);
    expect(html).toContain('Verify Your Email');
    expect(html).toContain('RateMyUnit');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('contains the link in both button and text format', () => {
    const link = 'https://example.com/verify?token=abc';
    const html = generateVerificationEmail(link);
    const linkCount = (html.match(new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    expect(linkCount).toBeGreaterThanOrEqual(2);
  });
});

describe('generatePasswordResetEmail', () => {
  it('returns HTML containing the reset link', () => {
    const link = 'https://example.com/reset?token=abc';
    const html = generatePasswordResetEmail(link);
    expect(html).toContain(link);
  });

  it('contains expected structure elements', () => {
    const link = 'https://example.com/reset?token=abc';
    const html = generatePasswordResetEmail(link);
    expect(html).toContain('Reset Your Password');
    expect(html).toContain('RateMyUnit');
  });
});
