# Arquitectura — Kairo v.1

> Referencia rápida. Especificación detallada: [`../SPEC.md`](../SPEC.md).

## Diagrama de alto nivel

```
                    ┌──────────────────┐
                    │  Cloudflare CDN  │  (WAF + DDoS básico, free tier)
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Hostinger CDN +  │  (estáticos)
                    │ Managed Node.js  │  (Passenger keepalive)
                    │ ┌──────────────┐ │
                    │ │ Express API  │ │
                    │ │  + frontend  │ │
                    │ │   buildeado  │ │
                    │ │ + node-cron  │ │
                    │ │ + worker     │ │
                    │ │   in-proc    │ │
                    │ └──────┬───────┘ │
                    └────────┼─────────┘
                             │
                ┌────────────┼─────────────┐
                │            │             │
        ┌───────▼────┐ ┌─────▼─────┐ ┌─────▼──────┐
        │ MySQL 8    │ │ lru-cache │ │ outbound:  │
        │ Hostinger  │ │ (in-mem)  │ │ ML, AE, MP,│
        │            │ │           │ │ WA, Resend │
        └────────────┘ └───────────┘ └────────────┘
```

## Decisiones clave

| Tema | Decisión | Razón | Alternativa v.2 |
|---|---|---|---|
| Lenguaje | TypeScript estricto | Seguridad de tipos en integraciones críticas | — |
| Cola de jobs | Tabla `Job` en MySQL + worker in-proc | Hostinger Managed Node.js no permite procesos separados ni Redis | BullMQ + Redis + workers PM2 separados |
| Caché | `lru-cache` in-memory | Sin Redis disponible | Redis 7 |
| Auth | JWT en cookies httpOnly + CSRF | Defensa contra XSS robo de sesión | — |
| Cifrado tokens OAuth | AES-256-GCM | Tokens ML deben estar cifrados at-rest | KMS managed |
| Polling | `node-cron` cada 1h con dedup por producto | Limitaciones Hostinger | BullMQ con priority queues |
| Pagos | MercadoPago | Mejor conversión LATAM | Multi-provider |
| Email | Resend + react-email | Templates con escape automático | — |
| WhatsApp | Meta Cloud API + templates aprobadas | Único canal oficial | — |
| Logger | Pino structured JSON | Performance + redacción PII | + Grafana Loki |
| Errors | Sentry free tier | Suficiente para arrancar | Sentry Performance paid |

## Interfaces para migración v.1 → v.2

Las interfaces `CacheService` y `JobQueue` (en `backend/src/interfaces/`) abstraen las implementaciones. La migración a Redis/BullMQ es un swap de bindings en `backend/src/config/di.ts`, no requiere reescritura.

## Capas del backend

```
HTTP request
    ↓
Middlewares (auth, ownership, csrf, rateLimit, plan, validation)
    ↓
Controller (thin: valida con zod, delega a service)
    ↓
Service (lógica de negocio, sin Express, testeable)
    ↓
Repository (única capa que toca Prisma)
    ↓
Prisma → MySQL
```

## Triggers de migración a v.2

Migrar a VPS + Redis + BullMQ cuando se cumpla **cualquiera**:
- >500 DAU
- >5.000 productos rastreados activos
- CPU/RAM Hostinger >70% sostenido
- Retraso de polling >30 min vs schedule
- Necesidad validada de Amazon u otra integración nueva
