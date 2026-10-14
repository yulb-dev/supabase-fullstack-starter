import { buildApp } from './app.js';
import { closeDatabase } from './db/index.js';
import { env } from './env.js';

const app = buildApp();

try {
  await app.listen({ port: env.port, host: env.host });
  app.log.info(`API listening on http://${env.host}:${env.port}`);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down API');
  await app.close();
  await closeDatabase();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
