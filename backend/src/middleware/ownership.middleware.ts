import type { RequestHandler } from 'express';
import type { TrackedProduct, Alert } from '@prisma/client';
import { getContainer } from '../config/di.js';
import { Errors } from '../utils/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    trackedProduct?: TrackedProduct;
    alert?: Alert;
  }
}

type OwnableResource = 'trackedProduct' | 'alert';

/**
 * Verifica que el recurso :id de la ruta exista y pertenezca al usuario
 * autenticado, y lo deja en `req.trackedProduct` / `req.alert` para que el
 * handler no tenga que volver a pedirlo.
 *
 * Devuelve 404 tanto si el recurso no existe como si es de otro usuario —
 * nunca 403 en ese caso, para no revelarle a un atacante que el recurso
 * existe pero no es suyo (SPEC §9.9).
 *
 * Patrón: router.delete('/tracking/:id', requireAuth, ownership('trackedProduct'), handler)
 */
export function ownership(resource: OwnableResource): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(Errors.unauthorized());
      return;
    }
    const { id } = req.params;
    if (!id) {
      next(Errors.notFound());
      return;
    }
    const userId = req.user.id;
    const { prisma } = getContainer();

    const run = async (): Promise<void> => {
      if (resource === 'trackedProduct') {
        const found = await prisma.trackedProduct.findUnique({ where: { id } });
        if (!found || found.userId !== userId) {
          throw Errors.notFound('Producto rastreado no encontrado');
        }
        req.trackedProduct = found;
      } else {
        const found = await prisma.alert.findUnique({ where: { id } });
        if (!found || found.userId !== userId) {
          throw Errors.notFound('Alerta no encontrada');
        }
        req.alert = found;
      }
    };

    run()
      .then(() => next())
      .catch(next);
  };
}
