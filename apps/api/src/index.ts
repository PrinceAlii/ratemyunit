import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';
import { setupWorker, scraperQueue, browserPool } from './lib/queue.js';
import { dbClient } from '@ratemyunit/db/client';
import { sql } from 'drizzle-orm';
import { db } from '@ratemyunit/db';
import { createLogger } from './lib/logger.js';

const logger = createLogger('server');

async function verifyDatabaseMigrations() {
  try {
    // Check if the drizzle migrations table exists
    const result = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '__drizzle_migrations'
      );
    `);

    const migrationsTableExists = result[0]?.exists;

    if (!migrationsTableExists) {
      logger.warn('⚠️  WARNING: Migrations table not found. Database may not be initialized.');
      logger.warn('   Run migrations with: npm run db:migrate');
      return false;
    }

    // Get count of applied migrations
    const migrationsResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*) as count FROM __drizzle_migrations;
    `);

    const migrationsCount = Number(migrationsResult[0]?.count || 0);
    logger.info(`✅ Database migrations verified: ${migrationsCount} migration(s) applied`);

    return true;
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to verify database migrations');
    throw error;
  }
}

async function start() {
  try {
    // Verify database migrations before starting
    await verifyDatabaseMigrations();

    const worker = setupWorker();

    const app = await buildApp();

    await app.listen({
      port: parseInt(config.PORT, 10),
      host: '0.0.0.0',
    });

    logger.info(`RateMyUnit API Server started`);
    logger.info(`API: http://localhost:${config.PORT}`);
    logger.info(`Docs: http://localhost:${config.PORT}/documentation`);
    logger.info(`Health: http://localhost:${config.PORT}/health`);
    logger.info(`Environment: ${config.NODE_ENV}`);

    // Graceful Shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Force shutdown after 30 seconds
      const timeout = setTimeout(() => {
        logger.error('Shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, 30000);

      try {
        await app.close();
        logger.info('HTTP server closed');

        await worker.close();
        logger.info('Worker stopped');

        await scraperQueue.close();
        logger.info('Queue connection closed');

        await browserPool.drain().then(() => browserPool.clear());
        logger.info('Browser pool drained');

        await dbClient.end();
        logger.info('Database connections closed');

        clearTimeout(timeout);
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
