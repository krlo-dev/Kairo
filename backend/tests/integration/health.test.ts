import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Test de smoke del endpoint /api/health.
// Requiere DB accesible (sino el check de database fallará pero el endpoint sigue respondiendo).

describe('GET /api/health', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app.js');
    const { createContainer } = await import('../../src/config/di.js');
    createContainer();
    app = createApp();
  });

  afterAll(async () => {
    const { disposeContainer } = await import('../../src/config/di.js');
    await disposeContainer();
  });

  it('responde con json y estructura esperada', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
    const body = res.body as {
      status: string;
      env: string;
      version: string;
      checks: Record<string, string>;
    };
    expect(body.status).toBeDefined();
    expect(body.env).toBeDefined();
    expect(body.version).toBeDefined();
    expect(body.checks).toBeDefined();
    expect(body.checks.api).toBe('ok');
  });

  it('incluye un X-Request-ID en la respuesta', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toMatch(/[0-9a-f-]{36}/i);
  });
});
