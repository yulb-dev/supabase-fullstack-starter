import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { Pool } from 'pg';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';

const authPool = env.databaseUrl && env.betterAuthSecret
  ? new Pool({ connectionString: env.databaseUrl, max: 5, connectionTimeoutMillis: 10_000 })
  : null;

// Auth is self-hosted in Fastify. Supabase provides PostgreSQL only.
export const auth = authPool
  ? betterAuth({
      database: authPool,
      baseURL: env.betterAuthUrl,
      basePath: '/api/auth',
      secret: env.betterAuthSecret!,
      trustedOrigins: env.webOrigins,
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
      },
      advanced: {
        database: {
          // Keep auth IDs as UUID-formatted strings matching the SQL migration.
          generateId: () => randomUUID(),
        },
      },
    })
  : null;

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: { id: string; email: string } | null;
  }
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  // Reject anonymous requests without consulting the database.
  if (!request.headers.cookie) {
    return reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Sign in is required.' },
    });
  }

  if (!auth) {
    return reply.code(503).send({
      error: {
        code: 'AUTH_NOT_CONFIGURED',
        message: 'Configure DATABASE_URL and BETTER_AUTH_SECRET in apps/api/.env.',
      },
    });
  }

  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) {
    return reply.code(401).send({
      error: { code: 'INVALID_SESSION', message: 'The session is invalid or expired.' },
    });
  }

  request.currentUser = {
    id: session.user.id,
    email: session.user.email,
  };
}

export async function closeAuthPool() {
  if (authPool) await authPool.end();
}
