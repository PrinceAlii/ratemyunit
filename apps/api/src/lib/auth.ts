import { Lucia } from 'lucia';
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';
import { db } from '@ratemyunit/db/client';
import { users, sessions } from '@ratemyunit/db/schema';
import { config } from '../config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new DrizzlePostgreSQLAdapter(db, sessions as any, users as any);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
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

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  id: string;
  email: string;
  displayName: string | null;
  role: 'student' | 'admin' | 'moderator';
  universityId: string;
  emailVerified: boolean;
  banned: boolean;
}
