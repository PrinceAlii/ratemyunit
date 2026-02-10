import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://ratemyunit:devpassword@localhost:5432/ratemyunit';

// For query purposes
export const dbClient = postgres(connectionString, {
    max: 50,                      // Increased from 20 for better concurrency
    idle_timeout: 30,             // Increased from 20 seconds
    max_lifetime: 1800,           // 30 minutes
    connect_timeout: 10,          // 10 seconds timeout for new connections
    prepare: false,               // Disable prepared statements for better compatibility
    onnotice: () => {},           // Suppress notice messages
    connection: {
        application_name: 'ratemyunit-api',
    },
    transform: {
        undefined: null,          // Transform undefined to null for cleaner queries
    },
});
export const db = drizzle(dbClient, { schema });

// For migrations
export const migrationClient = postgres(connectionString, { max: 1 });
