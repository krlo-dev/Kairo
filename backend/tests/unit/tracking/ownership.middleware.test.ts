import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ownership } from '../../../src/middleware/ownership.middleware.js';
import { createContainer } from '../../../src/config/di.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildTrackedProduct } from '../../fixtures/trackedProductFactory.js';

// `createContainer` es un singleton (config/di.ts) — se crea una sola vez
// por archivo de test con el prisma mockeado, y se reutiliza en todos los
// casos reseteando sus mocks entre tests.
const prisma: PrismaMock = createPrismaMock();
createContainer({ prisma: asPrisma(prisma) });

function makeApp(userId: string | null) {
  const app = express();
  app.use((req, _res, next) => {
    if (userId) {
      req.user = { id: userId, plan: 'FREE' };
    }
    next();
  });
  app.get('/tracking/:id', ownership('trackedProduct'), (req, res) => {
    res.status(200).json({ data: req.trackedProduct });
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

describe('ownership middleware', () => {
  beforeEach(() => {
    prisma.trackedProduct.findUnique.mockReset();
  });

  it('deja pasar y adjunta el recurso cuando pertenece al usuario', async () => {
    const userId = 'user-1';
    const product = buildTrackedProduct({ userId });
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(product);

    const res = await request(makeApp(userId)).get(`/tracking/${product.id}`);

    expect(res.status).toBe(200);
    expect((res.body as { data: { id: string } }).data.id).toBe(product.id);
  });

  it('devuelve 404 (no 403) si el recurso es de otro usuario', async () => {
    const product = buildTrackedProduct({ userId: 'owner-real' });
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(product);

    const res = await request(makeApp('otro-user')).get(`/tracking/${product.id}`);

    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el recurso no existe', async () => {
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(null);

    const res = await request(makeApp('user-1')).get('/tracking/no-existe');

    expect(res.status).toBe(404);
  });

  it('devuelve 401 si no hay usuario autenticado', async () => {
    const res = await request(makeApp(null)).get('/tracking/algun-id');

    expect(res.status).toBe(401);
    expect(prisma.trackedProduct.findUnique).not.toHaveBeenCalled();
  });
});
