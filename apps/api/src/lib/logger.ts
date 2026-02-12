import pino from 'pino';
import { config } from '../config.js';

/**
 * Create a logger instance with environment-aware configuration
 * @param name - Name identifier for the logger (e.g., 'scraper', 'queue')
 */
export function createLogger(name: string) {
  return pino({
    name,
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    ...(config.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }),
  });
}
