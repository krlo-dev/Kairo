import { Router } from 'express';
import { z } from 'zod';
import { getContainer } from '../config/di.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Errors, AppError } from '../utils/errors.js';
import { logger } from '../logger/pino.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { MercadoLibreService } from '../services/mercadolibre/mercadolibre.service.js';
import { AliExpressService } from '../services/aliexpress/aliexpress.service.js';
import type { SearchParams, SearchResult, UnifiedProduct } from '../services/search/types.js';

export const searchRouter = Router();

const querySchema = z.object({
  q: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  country: z.string().length(2).optional(),
  source: z.enum(['ML', 'ALIEXPRESS', 'both']).optional().default('ML'),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().min(1).max(100).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
});

searchRouter.get(
  '/search',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw Errors.validation('Parámetros de búsqueda inválidos', parsed.error.flatten());
    }
    const params = parsed.data;

    if (
      params.minPrice !== undefined &&
      params.maxPrice !== undefined &&
      params.minPrice > params.maxPrice
    ) {
      throw Errors.validation('minPrice no puede ser mayor que maxPrice');
    }

    const { cache } = getContainer();
    const ml = new MercadoLibreService({ cache });
    const ae = new AliExpressService({ cache });

    const searchParams: SearchParams = {
      q: params.q,
      country: params.country ?? 'CO',
      page: params.page,
      limit: params.limit,
      ...(params.minPrice !== undefined ? { minPrice: params.minPrice } : {}),
      ...(params.maxPrice !== undefined ? { maxPrice: params.maxPrice } : {}),
    };

    let result: SearchResult;
    switch (params.source) {
      case 'ML': {
        result = await ml.searchItems(searchParams);
        break;
      }
      case 'ALIEXPRESS': {
        result = await ae.searchItems(searchParams);
        break;
      }
      case 'both': {
        // Combina ML + AE. Si una fuente falla (ej. AE sin credenciales
        // configuradas todavía) no tumba la búsqueda entera — se loguea y
        // se devuelven los resultados de la fuente que sí respondió.
        const [mlOutcome, aeOutcome] = await Promise.allSettled([
          ml.searchItems(searchParams),
          ae.searchItems(searchParams),
        ]);

        const data: UnifiedProduct[] = [
          ...(mlOutcome.status === 'fulfilled' ? mlOutcome.value.data : []),
          ...(aeOutcome.status === 'fulfilled' ? aeOutcome.value.data : []),
        ];
        if (mlOutcome.status === 'rejected') {
          logger.warn({ err: describeError(mlOutcome.reason) }, 'search both: ML falló');
        }
        if (aeOutcome.status === 'rejected') {
          logger.warn({ err: describeError(aeOutcome.reason) }, 'search both: AliExpress falló');
        }
        if (mlOutcome.status === 'rejected' && aeOutcome.status === 'rejected') {
          throw Errors.internal('No se pudo buscar en ninguna fuente');
        }

        const total =
          (mlOutcome.status === 'fulfilled' ? mlOutcome.value.pagination.total : 0) +
          (aeOutcome.status === 'fulfilled' ? aeOutcome.value.pagination.total : 0);

        result = {
          data,
          pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / params.limit)),
          },
        };
        break;
      }
    }

    res.status(200).json(result);
  }),
);

function describeError(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  if (err instanceof Error) return { code: 'unknown_error', message: err.message };
  return { code: 'unknown_error', message: String(err) };
}
