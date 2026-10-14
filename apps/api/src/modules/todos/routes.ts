import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { todos } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';

const todoResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    completed: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const newTodoBodySchema = {
  type: 'object',
  required: ['title'],
  additionalProperties: false,
  properties: { title: { type: 'string', minLength: 1, maxLength: 200 } },
} as const;

const updateTodoBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    completed: { type: 'boolean' },
  },
} as const;

function databaseUnavailable(reply: FastifyReply) {
  return reply.code(503).send({
    error: { code: 'DATABASE_NOT_CONFIGURED', message: 'Set DATABASE_URL in apps/api/.env and apply the Supabase migration.' },
  });
}

export async function registerTodoRoutes(app: FastifyInstance) {
  app.get('/', {
    preHandler: requireUser,
    schema: {
      tags: ['todos'], summary: 'List the current user\'s todos',
      response: { 200: { type: 'array', items: todoResponseSchema } },
    },
  }, async (request, reply) => {
    if (!db) return databaseUnavailable(reply);
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } });

    const rows = await db.select({
      id: todos.id,
      title: todos.title,
      completed: todos.completed,
      createdAt: todos.createdAt,
      updatedAt: todos.updatedAt,
    }).from(todos)
      .where(eq(todos.userId, user.id))
      .orderBy(desc(todos.createdAt));
    return rows;
  });

  app.post('/', {
    preHandler: requireUser,
    schema: {
      tags: ['todos'], summary: 'Create a todo', body: newTodoBodySchema,
      response: { 201: todoResponseSchema },
    },
  }, async (request, reply) => {
    if (!db) return databaseUnavailable(reply);
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } });
    const body = request.body as { title: string };
    const title = body.title.trim();
    if (!title) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty.' } });

    const [created] = await db.insert(todos).values({ userId: user.id, title }).returning({
      id: todos.id,
      title: todos.title,
      completed: todos.completed,
      createdAt: todos.createdAt,
      updatedAt: todos.updatedAt,
    });
    return reply.code(201).send(created);
  });

  app.patch('/:id', {
    preHandler: requireUser,
    schema: {
      tags: ['todos'], summary: 'Update a todo', params: idParamsSchema, body: updateTodoBodySchema,
      response: { 200: todoResponseSchema },
    },
  }, async (request, reply) => {
    if (!db) return databaseUnavailable(reply);
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } });
    const { id } = request.params as { id: string };
    const body = request.body as { title?: string; completed?: boolean };
    const changes: { title?: string; completed?: boolean; updatedAt: Date } = { updatedAt: new Date() };
    if (typeof body.title === 'string') {
      const title = body.title.trim();
      if (!title) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Title must not be empty.' } });
      changes.title = title;
    }
    if (typeof body.completed === 'boolean') changes.completed = body.completed;

    const [updated] = await db.update(todos).set(changes)
      .where(and(eq(todos.id, id), eq(todos.userId, user.id)))
      .returning({ id: todos.id, title: todos.title, completed: todos.completed, createdAt: todos.createdAt, updatedAt: todos.updatedAt });
    if (!updated) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Todo not found.' } });
    return updated;
  });

  app.delete('/:id', {
    preHandler: requireUser,
    schema: {
      tags: ['todos'], summary: 'Delete a todo', params: idParamsSchema,
      response: {
        200: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      },
    },
  }, async (request, reply) => {
    if (!db) return databaseUnavailable(reply);
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } });
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, user.id))).returning({ id: todos.id });
    if (!deleted) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Todo not found.' } });
    return deleted;
  });
}
