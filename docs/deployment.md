# Deployment — Kairo v.1

## Stack de hosting

- **Hostinger Business + Managed Node.js** (single Passenger process)
- **MySQL 8** en Hostinger
- **Cloudflare free tier** delante del dominio (DNS + WAF + SSL edge)
- **Resend** para email (DNS DKIM/SPF/DMARC en Cloudflare)
- **Sentry + Uptime Robot** para observabilidad

## Setup inicial (una sola vez)

### 1. Dominio

1. Comprar `kairo.com.co` (registrar nacional o internacional).
2. En Cloudflare: agregar el sitio en free plan, copiar los 2 nameservers.
3. En el registrar: cambiar nameservers a los de Cloudflare.
4. Esperar propagación (15min - 24h).

### 2. Cloudflare DNS

- `A` record `@` → IP del servidor Hostinger
- `CNAME` `www` → `kairo.com.co`
- `CNAME` `api` → `kairo.com.co` (si se separa subdominio API)
- Activar **SSL/TLS mode: Full (strict)**
- Activar **Always Use HTTPS**
- WAF: dejar managed rules + bot fight mode

### 3. DNS para Resend

Una vez creada la cuenta Resend y agregado el dominio, copiar a Cloudflare DNS:

- `TXT` `_dmarc` → `v=DMARC1; p=quarantine; rua=mailto:dmarc@kairo.com.co`
- `TXT` `@` SPF → `v=spf1 include:spf.resend.com -all`
- `CNAME` DKIM (3 records provistos por Resend)

### 4. Hostinger Managed Node.js

1. Panel Hostinger → Avanzado → Managed Node.js.
2. Crear app: Node 20, directorio `/public_html/kairo`.
3. Conectar git: clonar `https://github.com/krlo-dev/Kairo`.
4. Cargar variables de entorno (panel) — usar `.env.example` como referencia.
5. Comando de start: `node backend/dist/server.js`
6. Reload on file change: no (manejado por deploy script).

### 5. MySQL

1. Panel Hostinger → MySQL Databases → crear DB `kairo` + usuario.
2. `DATABASE_URL` apunta al host privado de Hostinger.
3. Conectar SSH y correr: `cd backend && npx prisma migrate deploy`.

## Deploy flow

```bash
# Desde local (después del primer setup manual)
./scripts/deploy.sh
```

Internamente:

1. `git push origin main` (CI corre lint + test + build)
2. SSH a Hostinger
3. `cd /public_html/kairo && git pull origin main`
4. `cd backend && npm ci --omit=dev && npm run build`
5. `cd frontend && npm ci && npm run build && cp -r dist/* ../public_html/`
6. `cd backend && npx prisma migrate deploy`
7. Restart Passenger (touch `tmp/restart.txt` o panel)
8. Verificar `https://kairo.com.co/api/health` → 200

## Variables de entorno en Hostinger

Cargar TODAS las de `backend/.env.example` con sus valores reales en el panel:

- Secretos generados con `openssl rand -hex 32`
- `NODE_ENV=production`
- `APP_URL=https://kairo.com.co`
- `FRONTEND_URL=https://kairo.com.co`
- `COOKIE_DOMAIN=kairo.com.co`

## Backups

- Hostinger daily backups: **verificar que incluye MySQL** en el panel.
- Backup semanal extra manual o cron: `scripts/backup.sh` (TODO en Fase 9).
- **Restore probado mensualmente** — política obligatoria.

## Health checks

- `GET https://kairo.com.co/api/health` → debe devolver `{ status: "ok", checks: { api: "ok", database: "ok" } }`
- Uptime Robot pinguea cada 1 min, alerta vía email si falla 2 veces seguidas.

## Rollback

```bash
ssh hostinger
cd /public_html/kairo
git log --oneline  # encontrar commit estable
git checkout <commit-hash>
cd backend && npm ci --omit=dev && npm run build
# Restart Passenger
```

Migración rollback: `prisma migrate resolve --rolled-back <migration_name>` (cuidadoso, solo si la migration no está aplicada en otros entornos).

## Monitoring

| Servicio                   | Función                    | Plan                            |
| -------------------------- | -------------------------- | ------------------------------- |
| Sentry                     | Errores backend + frontend | Free                            |
| Uptime Robot               | Uptime + alertas email     | Free (5min check)               |
| Cloudflare Analytics       | Tráfico edge               | Free                            |
| Plausible                  | Analytics product          | Paid (~USD 9/mes) o self-hosted |
| (futuro v.2) Grafana Cloud | Métricas APM               | Free tier                       |
