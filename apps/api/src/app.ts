import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './env.js';
import { auth } from './plugins/auth.js';
import { registerTodoRoutes } from './modules/todos/routes.js';

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function buildApp() {
  const app = Fastify({
    logger: env.nodeEnv !== 'test',
    bodyLimit: 1_048_576,
    requestTimeout: 30_000,
  });
  app.decorateRequest('currentUser', null);

  // Register plugins before application routes so they apply to the whole API.
  app.register(helmet, {
    // Swagger UI enables a nonce-based static CSP; keep Helmet's other headers.
    contentSecurityPolicy: false,
  });
  app.register(cors, {
    origin: env.webOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
    maxAge: 86_400,
  });
  // This in-memory limiter is suitable for a single API instance. Multi-instance
  // deployments should configure a shared store (for example Redis).
  app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
    }),
  });
  app.register(swagger, {
    openapi: {
      info: {
        title: 'Full-Stack Starter API',
        version: '0.3.0',
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
    },
  });
  app.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: true,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
      persistAuthorization: true,
    },
  });

  // Cookie-authenticated writes must originate from the configured frontend.
  // Better Auth has its own trusted-origin validation for the /api/auth routes.
  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/v1/') || !mutationMethods.has(request.method)) return;
    const origin = request.headers.origin;
    if (!origin || !env.webOrigins.includes(origin)) {
      return reply.code(403).send({
        error: { code: 'UNTRUSTED_ORIGIN', message: 'This request origin is not allowed.' },
      });
    }
  });

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
    schema: { hide: true },
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

  app.get('/health', {
    schema: {
      hide: false,
      tags: ['system'],
      summary: 'Health check',
      security: [],
      response: {
        200: {
          type: 'object',
          required: ['status', 'service', 'databaseConfigured', 'authConfigured'],
          properties: {
            status: { type: 'string', enum: ['ok'] },
            service: { type: 'string', enum: ['api'] },
            databaseConfigured: { type: 'boolean' },
            authConfigured: { type: 'boolean' },
          },
        },
      },
    },
  }, async () => ({
    status: 'ok',
    service: 'api',
    databaseConfigured: Boolean(env.databaseUrl),
    authConfigured: Boolean(auth),
  }));

  app.get('/openapi.json', {
    schema: { hide: true },
  }, async () => app.swagger());

  app.register(registerTodoRoutes, { prefix: '/api/v1/todos' });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload.' },
      });
    }
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: { code: 'REQUEST_ERROR', message: error.message },
      });
    }
    request.log.error({ err: error }, 'Unhandled API error');
    return reply.code(500).send({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected server error.' },
    });
  });

  return app;
}
