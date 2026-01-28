import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';
import { setupWorker, scraperQueue, browserPool } from './lib/queue.js';
import { dbClient } from '@ratemyunit/db/client';

async function start() {
  try {
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
