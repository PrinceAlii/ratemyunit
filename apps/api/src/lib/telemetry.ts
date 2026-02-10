import { FastifyRequest } from 'fastify';
import { UAParser } from 'ua-parser-js';
import { db } from '@ratemyunit/db/client';
import { users, userTelemetry } from '@ratemyunit/db/schema';
import { eq } from 'drizzle-orm';
import pino from 'pino';

const logger = pino();

/**
 * Record telemetry for a user.
 * Captures IP, User Agent, and parses device/browser information.
 */
export async function recordTelemetry(userId: string, request: FastifyRequest) {
  try {
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ipAddress = request.ip || 'unknown';
    
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    const browser = result.browser.name ? `${result.browser.name} ${result.browser.version || ''}`.trim() : 'Unknown Browser';
    const os = result.os.name ? `${result.os.name} ${result.os.version || ''}`.trim() : 'Unknown OS';
    const device = result.device.model || result.device.vendor || 'Desktop/Unknown';
    const deviceType = result.device.type || 'desktop';

    // 1. Create a log entry
    await db.insert(userTelemetry).values({
      userId,
      ipAddress,
      userAgent,
      browser,
      os,
      device,
      deviceType,
    });

    // 2. Update user's "last seen" info
    await db.update(users)
      .set({
        lastLoginAt: new Date(),
        lastIp: ipAddress,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

  } catch (error) {
    logger.error({ error, userId }, 'Failed to record user telemetry');
  }
}
