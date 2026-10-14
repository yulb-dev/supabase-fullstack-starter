import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { auth } from './plugins/auth.js';
import { registerTodoRoutes } from './modules/todos/routes.js';

export function buildApp() {
  const app = Fastify({ logger: env.nodeEnv !== 'test' });
  app.decorateRequest('currentUser', null);

  app.register(cors, {
    origin: env.webOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
  });

  // Better Auth runs in Fastify and stores users/sessions in Supabase PostgreSQL.
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      if (!auth) {
        return reply.code(503).send({
          error: {
            code: 'AUTH_NOT_CONFIGURED',
            message: 'Configure DATABASE_URL and BETTER_AUTH_SECRET in apps/api/.env.',
          },
        });
      }

      try {
        const url = new URL(request.url, env.betterAuthUrl);
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
          if (name.toLowerCase() === 'content-length' || value === undefined) continue;
          if (Array.isArray(value)) headers.set(name, value.join(', '));
          else headers.set(name, value);
        }

        const authRequest = new Request(url, {
          method: request.method,
          headers,
          ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        });
        const response = await auth.handler(authRequest);

        reply.code(response.status);
        const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
        response.headers.forEach((value, name) => {
          if (name.toLowerCase() !== 'set-cookie') reply.header(name, value);
        });
        const cookies = responseHeaders.getSetCookie?.();
        if (cookies?.length) reply.header('set-cookie', cookies);

        const body = await response.text();
        return reply.send(body.length ? body : null);
      } catch (error) {
        request.log.error({ err: error }, 'Authentication request failed');
        return reply.code(500).send({
          error: { code: 'AUTH_FAILURE', message: 'Authentication request failed.' },
        });
      }
    },
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'api',
    databaseConfigured: Boolean(env.databaseUrl),
    authConfigured: Boolean(auth),
  }));

  app.get('/openapi.json', async () => ({
    openapi: '3.1.0',
    info: {
      title: 'Full-Stack Starter API',
      version: '0.2.0',
      description: 'Fastify REST API with Better Auth cookie sessions and Supabase PostgreSQL.',
    },
    servers: [{ url: env.betterAuthUrl }],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description: 'HTTP-only Better Auth session cookie.',
        },
      },
    },
    security: [{ sessionCookie: [] }],
    paths: {
      '/health': { get: { security: [], summary: 'API health check', responses: { 200: { description: 'Service is running' } } } },
      '/api/auth/sign-in/email': { post: { security: [], summary: 'Sign in using email and password', responses: { 200: { description: 'Signed in; session cookie set' }, 401: { description: 'Invalid credentials' } } } },
      '/api/auth/sign-up/email': { post: { security: [], summary: 'Register using email and password', responses: { 200: { description: 'Account created' }, 400: { description: 'Invalid request' } } } },
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
