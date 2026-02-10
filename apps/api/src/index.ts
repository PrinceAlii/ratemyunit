import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';
import { setupWorker, scraperQueue, browserPool } from './lib/queue.js';
import { dbClient } from '@ratemyunit/db/client';
import { sql } from 'drizzle-orm';
import { db } from '@ratemyunit/db';

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
      console.warn('⚠️  WARNING: Migrations table not found. Database may not be initialized.');
      console.warn('   Run migrations with: npm run db:migrate');
      return false;
    }

    // Get count of applied migrations
    const migrationsResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*) as count FROM __drizzle_migrations;
    `);

    const migrationsCount = Number(migrationsResult[0]?.count || 0);
    console.log(`✅ Database migrations verified: ${migrationsCount} migration(s) applied`);

    return true;
  } catch (error) {
    console.error('❌ Failed to verify database migrations:', error);
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

    console.log(`
    🚀 RateMyUnit API Server started!

    📍 API: http://localhost:${config.PORT}
    📚 Docs: http://localhost:${config.PORT}/documentation
    🏥 Health: http://localhost:${config.PORT}/health
    🌍 Environment: ${config.NODE_ENV}
    `);

    // Graceful Shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} received, starting graceful shutdown...`);

      // Force shutdown after 30 seconds
      const timeout = setTimeout(() => {
        console.error('Shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, 30000);

      try {
        await app.close();
        console.log('HTTP server closed');

        await worker.close();
        console.log('Worker stopped');

        await scraperQueue.close();
        console.log('Queue connection closed');

        await browserPool.drain().then(() => browserPool.clear());
        console.log('Browser pool drained');

        await dbClient.end();
        console.log('Database connections closed');

        clearTimeout(timeout);
        console.log('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
