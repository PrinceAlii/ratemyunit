import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import csrf from '@fastify/csrf-protection';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { unitsRoutes } from './routes/units.js';
import { reviewsRoutes } from './routes/reviews.js';
import { publicDataRoutes } from './routes/public-data.js';
import { templateRoutes } from './routes/templates.js';
import { db } from '@ratemyunit/db/client';
import { sql } from 'drizzle-orm';
import { scraperQueue } from './lib/queue.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  });

  await app.register(cookie);

  // CSRF Protection
  await app.register(csrf, {
    sessionPlugin: '@fastify/cookie',
    getToken: (req) => req.headers['x-csrf-token'] as string,
    cookieOpts: {
      signed: false,
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
    },
  });

  // Rate Limiting
  await app.register(rateLimit, {
    max: 100, // 100 requests per window
    timeWindow: '1 minute', // 1 minute window
    allowList: ['127.0.0.1', 'localhost'], // Allow local development
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://static.cloudflareinsights.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "data:"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    xssFilter: true,
  });

  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'RateMyUnit API',
        description: 'API for rating university units/subjects',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'Development server',
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  app.get('/health', async (_request, reply) => {
    const checks = {
      api: 'ok',
      database: 'unknown',
      redis: 'unknown',
      timestamp: new Date().toISOString(),
    };

    let status = 200;

    try {
      // Check database
      await db.execute(sql`SELECT 1`);
      checks.database = 'ok';
    } catch (err) {
      app.log.error({ err }, 'Health check failed: Database');
      checks.database = 'error';
      status = 503;
    }

    try {
      // Check Redis via Queue connection
      const client = await scraperQueue.client;
      await client.ping();
      checks.redis = 'ok';
    } catch (err) {
      app.log.error({ err }, 'Health check failed: Redis');
      checks.redis = 'error';
      status = 503;
    }

    return reply.status(status).send(checks);
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(unitsRoutes, { prefix: '/api/units' });
  await app.register(reviewsRoutes, { prefix: '/api/reviews' });
  await app.register(publicDataRoutes, { prefix: '/api/public' });
  await app.register(templateRoutes, { prefix: '/api/admin/templates' });

  // Serve frontend static files (built from apps/web)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const frontendPath = path.resolve(__dirname, '../../web/dist');
  
  await app.register(fastifyStatic, {
    root: frontendPath,
    prefix: '/',
  });

  // Serve index.html for all non-API routes (SPA fallback)
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ success: false, error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });

  app.setErrorHandler((error: Error | { statusCode?: number; code?: string; validation?: unknown; issues?: unknown }, request, reply) => {
    // Add request context to all errors
    const context = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      userId: request.user?.id || 'anonymous',
    };

    // Handle custom app errors
    if ('statusCode' in error && 'code' in error && error.statusCode && error.code) {
      const appError = error as { statusCode: number; code: string; message: string };
      request.log.info({ ...context, error: appError.message }, 'Application error');
      return reply.code(appError.statusCode).send({
        success: false,
        error: appError.message,
        code: appError.code,
      });
    }

    // Handle Zod validation errors
    if ('validation' in error || 'issues' in error) {
      const zodError = error as { issues?: unknown; validation?: unknown };
      request.log.info({ ...context, issues: zodError.issues || zodError.validation }, 'Validation error');
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: zodError.issues || zodError.validation,
      });
    }

    // Unexpected errors - log full stack
    const errorObj = error as Error;
    request.log.error({ ...context, error: errorObj.message, stack: errorObj.stack }, 'Unexpected error');

    return reply.code(500).send({
      success: false,
      error: config.NODE_ENV === 'production' ? 'Internal server error' : errorObj.message,
      code: 'INTERNAL_ERROR',
      requestId: request.id,  // Help user report issues
    });
  });

  return app;
}