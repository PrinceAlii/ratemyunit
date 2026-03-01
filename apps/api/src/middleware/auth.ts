import type { FastifyRequest, FastifyReply } from 'fastify';
import { lucia, type DatabaseUserAttributes } from '../lib/auth.js';

// Extend Fastify request type to include user.
declare module 'fastify' {
  interface FastifyRequest {
    user: DatabaseUserAttributes | null;
  }
}

/**
 * Middleware to check if user is authenticated.
 * Reads session cookie and validates it with Lucia.
 */
export async function authenticateUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = request.cookies['auth_session'];

  if (!sessionId) {
    request.user = null;
    return;
  }

  const { session, user } = await lucia.validateSession(sessionId);

  if (session && session.fresh) {
    // Refresh session cookie if needed.
    const sessionCookie = lucia.createSessionCookie(session.id);
    reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  }

  if (!session) {
    // Clear invalid session cookie.
    const sessionCookie = lucia.createBlankSessionCookie();
    reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    request.user = null;
    return;
  }

  // TypeScript now knows the type through DatabaseUserAttributes
  request.user = user;
}

/**
 * Middleware to require authentication.
 * Returns 401 if user is not authenticated.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authenticateUser(request, reply);

  if (!request.user) {
    request.log?.warn?.(
      {
        event: 'security.auth_required_denied',
        path: request.url,
        ip: request.ip,
      },
      'Rejected request without authenticated user'
    );
    return reply.status(401).send({
      success: false,
      error: 'Authentication required',
    });
  }

  if (request.user.banned) {
    request.log?.warn?.(
      {
        event: 'security.banned_user_denied',
        userId: request.user.id,
        path: request.url,
        ip: request.ip,
      },
      'Rejected request from banned user'
    );
    return reply.status(403).send({
      success: false,
      error: 'Your account has been banned',
    });
  }

  if (!request.user.emailVerified) {
    request.log?.warn?.(
      {
        event: 'security.unverified_user_denied',
        userId: request.user.id,
        path: request.url,
        ip: request.ip,
      },
      'Rejected request from unverified user'
    );
    return reply.status(403).send({
      success: false,
      error: 'Please verify your email address',
    });
  }
}

/**
 * Middleware to require admin role.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);

  // If requireAuth already sent a response (401/403), don't try to send another one.
  if (reply.sent) return;

  if (request.user?.role !== 'admin') {
    request.log?.warn?.(
      {
        event: 'security.admin_access_denied',
        userId: request.user?.id ?? null,
        role: request.user?.role ?? null,
        path: request.url,
        ip: request.ip,
      },
      'Rejected admin-only request'
    );
    return reply.status(403).send({
      success: false,
      error: 'Admin access required',
    });
  }
}
