# Kairo

> El momento exacto para comprar.

SaaS LATAM de inteligencia de precios. Rastrea productos en **Mercado Libre** y **AliExpress**, recibe alertas configurables cuando el precio baja, descubre trending y compara márgenes.

- **Dominio:** kairo.com.co
- **Estado:** v.1 en desarrollo (Fase 0 — Setup)
- **Stack:** TypeScript · Node.js 20 · Express · Prisma · MySQL · React · Vite · Tailwind · shadcn/ui

## Estructura del repo

```
kairo/
├── backend/           Node.js + Express + Prisma API
├── frontend/          React + Vite SPA
├── docs/              Arquitectura, deployment, runbook
├── scripts/           Deploy, backups
├── .github/workflows/ CI: lint + test + build
├── SPEC.md            Especificación técnica (leer primero)
└── kairo-design-brief.md  Identidad visual
```

## Quick start

```bash
# Backend
cd backend
cp .env.example .env       # completar valores
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev                # puerto 3000

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev                # puerto 5173
```

## Comandos útiles

```bash
npm run lint               # ESLint
npm run format             # Prettier
npm run typecheck          # tsc --noEmit
npm test                   # Vitest
npm run build              # build de producción
```

## Documentación

- **[SPEC.md](./SPEC.md)** — especificación técnica completa (schema, integraciones, seguridad, fases)
- **[kairo-design-brief.md](./kairo-design-brief.md)** — identidad visual (paleta, tipografía, componentes)
- **[docs/architecture.md](./docs/architecture.md)** — decisiones arquitectónicas
- **[docs/deployment.md](./docs/deployment.md)** — guía de deploy a Hostinger
- **[docs/runbook.md](./docs/runbook.md)** — manual de incidentes

## Estado de integraciones externas

| Servicio | Estado |
|---|---|
| Dominio kairo.com.co | ⏳ por comprar |
| Mercado Libre OAuth | ⏳ aplicación enviada |
| AliExpress Affiliate | ⏳ por aplicar |
| Meta Business + WhatsApp | ⏳ por aplicar |
| MercadoPago | ⏳ por crear cuenta |
| Resend | ⏳ por crear cuenta |
| Sentry, Uptime Robot, Cloudflare | ⏳ por crear cuentas |

## Licencia

Proprietary © 2026 Kairo. Todos los derechos reservados.
