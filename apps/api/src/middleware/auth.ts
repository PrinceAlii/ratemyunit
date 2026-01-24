import type { FastifyRequest, FastifyReply } from 'fastify';
import { lucia } from '../lib/auth.js';

// Extend Fastify request type to include user.
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      displayName: string | null;
      role: 'student' | 'admin' | 'moderator';
      universityId: string;
      emailVerified: boolean;
      banned: boolean;
    } | null;
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
    return reply.status(401).send({
      success: false,
      error: 'Authentication required',
    });
  }

  if (request.user.banned) {
    return reply.status(403).send({
      success: false,
      error: 'Your account has been banned',
    });
  }

  if (!request.user.emailVerified) {
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

  if (request.user?.role !== 'admin') {
    return reply.status(403).send({
      success: false,
      error: 'Admin access required',
    });
  }
}
