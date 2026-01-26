import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { unitsRoutes } from './routes/units.js';
import { reviewsRoutes } from './routes/reviews.js';
import { publicDataRoutes } from './routes/public-data.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  });

  await app.register(cookie);

  await app.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production',
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

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(unitsRoutes, { prefix: '/api/units' });
  await app.register(reviewsRoutes, { prefix: '/api/reviews' });
  await app.register(publicDataRoutes, { prefix: '/api/public' });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        details: error.validation,
      });
    }

    const statusCode = error.statusCode || 500;
    const message =
      config.NODE_ENV === 'production' ? 'Internal server error' : error.message;

    return reply.status(statusCode).send({
      success: false,
      error: message,
    });
  });

  return app;
}