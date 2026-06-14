# Kairo

> El momento exacto para comprar.

SaaS LATAM de inteligencia de precios. Rastrea productos en **Mercado Libre** y **AliExpress**, recibe alertas configurables cuando el precio baja, descubre trending y compara márgenes.

- **Dominio:** kairo.com.co
- **Estado:** v.1 en desarrollo (Fase 1 — Auth)
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

Guía completa paso a paso: **[docs/setup-local.md](./docs/setup-local.md)** (qué instalar, cómo configurar `.env`, troubleshooting, y la lista de cuentas externas que tienes que crear tú).

Resumen para quien ya tiene Node 20 + Docker:

```powershell
npm install
Copy-Item backend/.env.example backend/.env       # rellenar secrets (ver guía)
Copy-Item frontend/.env.example frontend/.env
docker compose up -d                              # MySQL + Adminer
docker exec kairo-mysql mysql -uroot -pdev-root-password -e "GRANT ALL PRIVILEGES ON *.* TO 'kairo'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"
npx --workspace=backend prisma migrate deploy
npm run dev --workspace=backend                   # terminal 1, puerto 3000
npm run dev --workspace=frontend                  # terminal 2, puerto 5173
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
- **[docs/setup-local.md](./docs/setup-local.md)** — guía paso a paso para levantar el proyecto en local + checklist de cuentas externas
- **[kairo-design-brief.md](./kairo-design-brief.md)** — identidad visual (paleta, tipografía, componentes)
- **[docs/architecture.md](./docs/architecture.md)** — decisiones arquitectónicas
- **[docs/deployment.md](./docs/deployment.md)** — guía de deploy a Hostinger
- **[docs/runbook.md](./docs/runbook.md)** — manual de incidentes

## Estado de integraciones externas

| Servicio                         | Estado                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Dominio kairo.com.co             | ⏳ por comprar                                                                       |
| Mercado Libre OAuth              | ✅ cuenta developer creada (falta `ML_APP_ID` + `ML_CLIENT_SECRET` en `.env`)        |
| AliExpress Affiliate             | ✅ cuenta creada (falta `AE_APP_KEY` + `AE_APP_SECRET` + `AE_TRACKING_ID` en `.env`) |
| Meta Business + WhatsApp         | ⏳ por aplicar                                                                       |
| MercadoPago                      | ⏳ por crear cuenta                                                                  |
| Resend                           | ⏳ por crear cuenta                                                                  |
| Sentry, Uptime Robot, Cloudflare | ⏳ por crear cuentas                                                                 |

## Licencia

Proprietary © 2026 Kairo. Todos los derechos reservados.
