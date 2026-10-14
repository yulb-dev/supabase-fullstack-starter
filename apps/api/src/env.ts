import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid API environment:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid API environment variables');
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  host: parsed.data.HOST,
  port: parsed.data.PORT,
  webOrigins: parsed.data.WEB_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  supabaseUrl: parsed.data.SUPABASE_URL,
  supabasePublishableKey: parsed.data.SUPABASE_PUBLISHABLE_KEY,
  databaseUrl: parsed.data.DATABASE_URL,
};
