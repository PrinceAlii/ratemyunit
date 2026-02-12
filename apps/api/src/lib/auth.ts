import { Lucia } from 'lucia';
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';
import type { Adapter } from 'lucia';
import { db } from '@ratemyunit/db/client';
import { users, sessions } from '@ratemyunit/db/schema';
import { config } from '../config.js';

// Use controlled type assertion at adapter boundary
const adapter: Adapter = new DrizzlePostgreSQLAdapter(db, sessions, users) as Adapter;

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to allow cookies in POST/DELETE requests
      path: '/',
    },
  },
  getUserAttributes: (attributes) => {
    return {
      id: attributes.id,
      email: attributes.email,
      displayName: attributes.displayName,
      role: attributes.role,
      universityId: attributes.universityId,
      emailVerified: attributes.emailVerified,
      banned: attributes.banned,
    };
  },
});

export interface DatabaseUserAttributes {
  id: string;
  email: string;
  displayName: string | null;
  role: 'student' | 'admin' | 'moderator';
  universityId: string;
  emailVerified: boolean;
  banned: boolean;
}

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}
