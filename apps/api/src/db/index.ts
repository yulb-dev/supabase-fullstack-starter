import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../env.js';
import * as schema from './schema.js';

// Disable named prepared statements for connection-mode compatibility.
// This sample targets Supabase Session Pooler for a long-running Node.js API; see README before choosing Transaction pooler.
export const sqlClient = env.databaseUrl
  ? postgres(env.databaseUrl, {
      prepare: false,
      max: 10,
      connect_timeout: 10,
      idle_timeout: 20,
    })
  : null;

export const db = sqlClient ? drizzle(sqlClient, { schema }) : null;

export async function closeDatabase() {
  if (sqlClient) await sqlClient.end({ timeout: 5 });
}
