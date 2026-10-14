import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app.js';

const app = buildApp();
after(async () => app.close());

test('GET /health reports service status without exposing secrets', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  const payload = response.json() as { status: string; service: string };
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'api');
  assert.equal('databaseUrl' in payload, false);
});

test('GET /openapi.json returns an OpenAPI document', async () => {
  const response = await app.inject({ method: 'GET', url: '/openapi.json' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().openapi, '3.1.0');
});

test('Todo endpoints reject requests without an auth session cookie', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/todos' });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'UNAUTHORIZED');
});
