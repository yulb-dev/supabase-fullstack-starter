import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { registerTodoRoutes } from './modules/todos/routes.js';

export function buildApp() {
  const app = Fastify({ logger: env.nodeEnv !== 'test' });
  app.decorateRequest('currentUser', null);

  app.register(cors, {
    origin: env.webOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'api',
    databaseConfigured: Boolean(env.databaseUrl),
    authConfigured: Boolean(env.supabaseUrl && env.supabasePublishableKey),
  }));

  app.get('/openapi.json', async () => ({
    openapi: '3.1.0',
    info: {
      title: 'Supabase Full-Stack Starter API',
      version: '0.1.0',
      description: 'Fastify REST API protected by Supabase Auth access tokens.',
    },
    servers: [{ url: 'http://localhost:4000' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/health': { get: { security: [], summary: 'API health check', responses: { 200: { description: 'Service is running' } } } },
      '/api/v1/todos': {
        get: { tags: ['todos'], summary: 'List current user todos', responses: { 200: { description: 'Todo list' }, 401: { description: 'Unauthorized' } } },
        post: {
          tags: ['todos'],
          summary: 'Create a todo',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title'],
                  properties: { title: { type: 'string', maxLength: 200 } },
                },
              },
            },
          },
          responses: { 201: { description: 'Created' } },
        },
      },
      '/api/v1/todos/{id}': {
        patch: { tags: ['todos'], summary: 'Update a todo', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } } },
        delete: { tags: ['todos'], summary: 'Delete a todo', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } } },
      },
    },
  }));

  app.register(registerTodoRoutes, { prefix: '/api/v1/todos' });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload.' } });
    }
    request.log.error({ err: error }, 'Unhandled API error');
    return reply.code(500).send({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected server error.' } });
  });

  return app;
}
