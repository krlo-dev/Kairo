# API — Kairo

Placeholder. La especificación OpenAPI/Swagger se genera en Fase 1+ a medida que se construyen los endpoints.

Referencia inmediata: [`../SPEC.md`](../SPEC.md) sección 7.

## Endpoints disponibles en Fase 0

| Método | Path          | Auth | Descripción                   |
| ------ | ------------- | ---- | ----------------------------- |
| GET    | `/api/health` | No   | Health check (api + database) |

## Próximamente (Fase 1)

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/verify-email
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me
```

## Convenciones

- Todas las mutations requieren cookie `accessToken` + header `X-CSRF-Token`.
- Responses: `{ data: ... }` o resource directo.
- Errores: `{ error: { code: 'snake_case', message: 'humano', details?: {} } }`.
- Status codes estándar.
- Pagination: `{ data: [...], pagination: { page, limit, total, totalPages } }`.
