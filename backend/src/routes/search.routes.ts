import { Router } from 'express';
import { z } from 'zod';
import { getContainer } from '../config/di.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Errors } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { MercadoLibreService } from '../services/mercadolibre/mercadolibre.service.js';
import type { SearchResult } from '../services/search/types.js';

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

    let result: SearchResult;
    switch (params.source) {
      case 'ML':
      case 'both': {
        // En Fase 8 (AliExpress) este switch hace merge ML + AE cuando source='both'.
        // Por ahora 'both' devuelve solo ML para no romper contratos.
        result = await ml.searchItems({
          q: params.q,
          country: params.country ?? 'CO',
          page: params.page,
          limit: params.limit,
          ...(params.minPrice !== undefined ? { minPrice: params.minPrice } : {}),
          ...(params.maxPrice !== undefined ? { maxPrice: params.maxPrice } : {}),
        });
        break;
      }
      case 'ALIEXPRESS': {
        throw Errors.validation('Búsqueda AliExpress estará disponible en próxima fase');
      }
    }

    res.status(200).json(result);
  }),
);
