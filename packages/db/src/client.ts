import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://ratemyunit:devpassword@localhost:5432/ratemyunit';

// For query purposes
const queryClient = postgres(connectionString, {
    max: 20,
    idle_timeout: 20,
    max_lifetime: 1800,
});
export const db = drizzle(queryClient, { schema });

// For migrations
export const migrationClient = postgres(connectionString, { max: 1 });
