import { createClient } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';

const authClient = env.supabaseUrl && env.supabasePublishableKey
  ? createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
  : null;

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: { id: string; email: string | null } | null;
  }
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'A Supabase access token is required.' } });
  }

  if (!authClient) {
    return reply.code(503).send({
      error: { code: 'AUTH_NOT_CONFIGURED', message: 'Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in apps/api/.env.' },
    });
  }

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return reply.code(401).send({ error: { code: 'INVALID_TOKEN', message: 'The access token is invalid or expired.' } });
  }

  request.currentUser = { id: data.user.id, email: data.user.email ?? null };
}
