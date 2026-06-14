import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { csrfProtect } from '../../src/middleware/csrf.middleware.js';

// Verifica que el middleware CSRF lee req.originalUrl (no req.path
// relativo al mount point) para que las paths exentas funcionen cuando
// el middleware se monta con app.use('/api', csrfProtect).

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', csrfProtect);
  app.post('/api/auth/register', (_req, res) => {
    res.status(201).json({ ok: true });
  });
  app.post('/api/tracking', (_req, res) => {
    res.status(201).json({ ok: true });
  });
  app.use(
    (
      err: { statusCode?: number; code?: string; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(err.statusCode ?? 500).json({ error: { code: err.code, message: err.message } });
    },
  );
  return app;
}

describe('csrfProtect middleware', () => {
  const app = makeApp();

  it('deja pasar POST /api/auth/register sin CSRF (exempt)', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(201);
  });

  it('exige CSRF en mutations no exentas', async () => {
    const res = await request(app).post('/api/tracking').send({});
    expect(res.status).toBe(403);
    expect((res.body as { error: { code: string } }).error.code).toBe('forbidden');
  });

  it('acepta mutations con cookie+header CSRF matcheando', async () => {
    const token = 'a'.repeat(64);
    const res = await request(app)
      .post('/api/tracking')
      .set('Cookie', `csrfToken=${token}`)
      .set('X-CSRF-Token', token)
      .send({});
    expect(res.status).toBe(201);
  });

  it('GETs no requieren CSRF', async () => {
    const app2 = makeApp();
    app2.get('/api/anything', (_req, res) => {
      res.json({ ok: true });
    });
    const res = await request(app2).get('/api/anything');
    expect(res.status).toBe(200);
  });
});
