import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';
import { setupWorker } from './lib/queue.js';

async function start() {
  try {
    // Start worker
    setupWorker();

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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
