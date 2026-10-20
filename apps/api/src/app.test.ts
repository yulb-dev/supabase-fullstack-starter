import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app.js';

const app = buildApp();

after(async () => app.close());

test('GET /health reports service status without exposing secrets', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    status: string;
    service: string;
    databaseConfigured: boolean;
    authConfigured: boolean;
  };
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'api');
  assert.equal('databaseUrl' in payload, false);
  assert.equal('betterAuthSecret' in payload, false);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
});

test('GET /openapi.json returns a generated OpenAPI document', async () => {
  const response = await app.inject({ method: 'GET', url: '/openapi.json' });
  assert.equal(response.statusCode, 200);
  const document = response.json() as { openapi?: string; paths?: Record<string, unknown> };
  assert.match(document.openapi ?? '', /^3\./);
  assert.ok(document.paths && Object.keys(document.paths).length > 0);
});

test('Swagger UI is available at /docs', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs/' });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] ?? '', /text\/html/);
});

test('Todo endpoints reject requests without an auth session cookie', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/todos' });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'UNAUTHORIZED');
});

test('cookie-authenticated writes reject untrusted origins before touching the database', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/todos',
    headers: {
      origin: 'https://malicious.example',
      'content-type': 'application/json',
    },
    payload: { title: 'must be blocked' },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, 'UNTRUSTED_ORIGIN');
});
