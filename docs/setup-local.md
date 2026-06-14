# Setup local — Kairo

Guía paso a paso para levantar Kairo en tu máquina (Windows / macOS / Linux). Pensada para alguien que arranca de cero; si una sección ya la tienes hecha, sáltatela.

Si algo no funciona y no aparece en "Troubleshooting" al final, abre un issue antes de improvisar — varios pasos tienen razones de seguridad detrás (cifrado de tokens OAuth, CSRF double-submit, etc.).

---

## 1. Qué necesitas instalado (una sola vez)

| Herramienta            | Para qué sirve                                        | Cómo instalar                                                                        |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Node.js 20 LTS**     | Backend (Express + Prisma) y frontend (Vite)          | [nodejs.org](https://nodejs.org) → instalar 20 LTS                                   |
| **Git**                | Versionar código + Husky hooks                        | [git-scm.com](https://git-scm.com)                                                   |
| **Docker Desktop**     | Levantar MySQL local sin instalar MySQL en tu máquina | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| **VS Code** (opcional) | Editor recomendado                                    | [code.visualstudio.com](https://code.visualstudio.com)                               |

Verifica que están listos:

```powershell
node --version          # debe decir v20.x.x o superior
npm --version
git --version
docker --version
docker compose version
```

> Si `docker --version` funciona pero `docker compose up` dice "cannot find docker daemon", abre **Docker Desktop** desde el menú de inicio y espera a que diga "Docker Desktop is running" antes de seguir.

---

## 2. Clonar y instalar dependencias

```powershell
git clone https://github.com/krlo-dev/Kairo.git
cd Kairo
npm install         # instala backend + frontend (npm workspaces)
```

`npm install` levanta tanto `backend/node_modules` como `frontend/node_modules` porque el root `package.json` define workspaces.

---

## 3. Configurar variables de entorno (`.env`)

Tienes que crear **dos archivos** que NO se commitean al repo (están en `.gitignore`).

### 3.1 `backend/.env`

Copia el ejemplo:

```powershell
Copy-Item backend/.env.example backend/.env
```

Edita `backend/.env` y rellena estos campos. Los **secrets criptográficos** los generas tú mismo en tu terminal:

```powershell
# Generar uno (repite el comando para cada secret)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Te devuelve un string hex de 64 caracteres. Úsalo para:

| Variable             | Qué es                                                | Cómo generar                                                               |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`  | Firma del access token JWT (15 min)                   | `node -e "..."` (64 hex chars)                                             |
| `JWT_REFRESH_SECRET` | Reservado (refresh actual es opaco)                   | `node -e "..."` (64 hex chars)                                             |
| `ENCRYPTION_KEY`     | AES-256-GCM para cifrar tokens OAuth de Mercado Libre | `node -e "..."` (debe ser **exactamente** 64 hex chars)                    |
| `CSRF_SECRET`        | Reservado (CSRF actual es double-submit por token)    | `node -e "..."` (64 hex chars)                                             |
| `METRICS_TOKEN`      | Bearer token para proteger `/metrics` (Prometheus)    | `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"` |

**`DATABASE_URL`** ya viene apuntando al Docker local — no la cambies hasta producción:

```
DATABASE_URL="mysql://kairo:kairo-dev@localhost:3306/kairo"
```

Las **integraciones externas** (`ML_APP_ID`, `RESEND_API_KEY`, `MP_ACCESS_TOKEN`, etc.) déjalas vacías por ahora. La app funciona sin ellas en dev:

- **Sin `RESEND_API_KEY`** → los emails de verificación / reset / cuenta bloqueada se imprimen en la consola del backend (`ConsoleEmailService`). El link aparece como `verifyUrl: "http://localhost:5173/verify-email?token=..."` — copia y pégalo en el navegador.
- **Sin `SENTRY_DSN`** → no se reporta nada a Sentry (silencioso).
- **Sin credenciales ML/AE/WA/MP** → los flujos de esas integraciones devolverán error si los tocas; auth y dashboard funcionan sin problema.

Pon `LOG_LEVEL="debug"` mientras desarrollas (más información en la consola).

### 3.2 `frontend/.env`

```powershell
Copy-Item frontend/.env.example frontend/.env
```

El default (`VITE_API_URL="http://localhost:3000"`) ya apunta al backend local — no cambies nada.

---

## 4. Levantar MySQL local (Docker)

`docker-compose.yml` en la raíz define dos servicios:

- **kairo-mysql** — MySQL 8.0 en `localhost:3306`, database `kairo`, user `kairo`, password `kairo-dev`. Datos persistentes en el volumen `kairo-mysql-data`.
- **kairo-adminer** — UI web para inspeccionar tablas en `http://localhost:8080` (server `mysql`, user `kairo`, pass `kairo-dev`).

Levanta ambos:

```powershell
docker compose up -d
```

`-d` significa "detached" (en background). La primera vez baja las imágenes (~500 MB), luego es instantáneo.

Verifica que MySQL está sano:

```powershell
docker compose ps
```

`STATUS` de `kairo-mysql` debe decir `Up X seconds (healthy)`. Si dice `(unhealthy)`, mira `docker compose logs mysql`.

### 4.1 Permisos del usuario para Prisma

Prisma necesita crear una "shadow database" temporal para validar migrations. El usuario `kairo` necesita permiso para `CREATE DATABASE`. La **primera vez** ejecuta:

```powershell
docker exec kairo-mysql mysql -uroot -pdev-root-password -e "GRANT ALL PRIVILEGES ON *.* TO 'kairo'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"
```

Esto es **solo para dev**. En producción Prisma usa `migrate deploy` que no necesita shadow DB.

---

## 5. Aplicar migraciones de la base de datos

Crea las 16 tablas del schema en tu MySQL local:

```powershell
npx --workspace=backend prisma migrate deploy
```

> `migrate deploy` aplica todas las migrations existentes sin pedir nada. Es lo que se usa en CI y en producción.
> Si **vas a cambiar el schema** (`prisma/schema.prisma`), usa `npx --workspace=backend prisma migrate dev --name nombre_descriptivo` — Prisma genera una nueva migration, la aplica, y regenera el Prisma Client.

Verifica que las tablas existen:

```powershell
docker exec kairo-mysql mysql -ukairo -pkairo-dev -e "USE kairo; SHOW TABLES;"
```

Deberías ver `User`, `RefreshToken`, `EmailVerification`, etc. más `_prisma_migrations` (16 + 1).

O abre **http://localhost:8080** (Adminer) → server: `mysql`, user: `kairo`, password: `kairo-dev`, database: `kairo`.

---

## 6. Arrancar la app

Abre dos terminales:

### Terminal 1 — Backend

```powershell
npm run dev --workspace=backend
```

Debe quedar escuchando en `http://localhost:3000`. Health check:

```powershell
curl http://localhost:3000/api/health
```

Debe devolver `{"status":"ok",...,"checks":{"api":"ok","database":"ok"},...}`.

### Terminal 2 — Frontend

```powershell
npm run dev --workspace=frontend
```

Abre `http://localhost:5173`. Verás la landing.

---

## 7. Probar el flow de auth completo

1. **Registro** → http://localhost:5173/register
   - Llena nombre, email, password (mínimo 8 chars). Submit.
   - Te redirige a `/verify-email`.
2. **Verificación de email**
   - En la consola del **backend** vas a ver un log tipo `[console-email] verify-email ... verifyUrl: "http://localhost:5173/verify-email?token=abc123..."`.
   - Copia esa URL en el navegador. La pantalla dirá "¡Listo!" y te llevará a `/login`.
3. **Login** → http://localhost:5173/login con las mismas credenciales.
   - Te lleva a `/dashboard`.
4. **Sesión persistente** — refresca la página. Debes seguir en `/dashboard` (las cookies httpOnly mantienen la sesión).
5. **Logout** — botón "Cerrar sesión".

Si quieres probar reset password:

1. Click "¿Olvidaste tu contraseña?" en /login
2. Copia la URL del log del backend
3. Crea nueva password
4. Login con la nueva

---

## 8. Comandos del día a día

Todo desde la raíz del repo:

| Comando                                               | Para qué                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `npm run dev --workspace=backend`                     | Backend en modo watch (reinicia al cambiar)                     |
| `npm run dev --workspace=frontend`                    | Frontend en modo watch + HMR                                    |
| `npm run typecheck`                                   | TypeScript sin compilar (backend + frontend)                    |
| `npm run lint`                                        | ESLint con `--max-warnings 0`                                   |
| `npm test`                                            | Vitest en backend y frontend                                    |
| `npm run build`                                       | Build de producción de ambos                                    |
| `npx --workspace=backend prisma studio`               | UI web para tu DB en `localhost:5555`                           |
| `npx --workspace=backend prisma migrate dev --name X` | Nueva migration después de tocar schema                         |
| `docker compose up -d`                                | Levantar MySQL + Adminer                                        |
| `docker compose stop`                                 | Pausar (datos persisten)                                        |
| `docker compose down`                                 | Apagar + borrar contenedores (datos persisten en volumen)       |
| `docker compose down -v`                              | Apagar + borrar **todo incluido el volumen** (empiezas de cero) |
| `docker compose logs -f mysql`                        | Ver logs de MySQL en vivo                                       |

Pre-commit hook (Husky) corre prettier + eslint sobre los archivos staged automáticamente. Si falla, mira el output y arregla.

---

## 9. Reset rápido a "estado limpio"

Cuando algo se rompe sin causa clara:

```powershell
# Backend + frontend processes: Ctrl+C
docker compose down -v       # borra DB
docker compose up -d         # MySQL fresh
docker exec kairo-mysql mysql -uroot -pdev-root-password -e "GRANT ALL PRIVILEGES ON *.* TO 'kairo'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"
npx --workspace=backend prisma migrate deploy
```

---

## 10. Lo que TÚ tienes que hacer manualmente (cuentas externas)

Estas son las cuentas que la app espera para v.1 producción. Mientras estés desarrollando local **no las necesitas** — el backend funciona sin ellas con fallbacks.

### 10.1 Dominio kairo.com.co

- **Dónde:** registrar en Hostinger, Namecheap o Cloudflare Registrar.
- **Para qué:** producción. Sin dominio no hay deploy, ni emails desde `@kairo.com.co`, ni cookies con scope correcto.
- **Después:** apuntar nameservers a Cloudflare (free tier) → activar SSL → Hostinger lee certificado.

### 10.2 Resend (emails transaccionales)

- **Dónde:** [resend.com](https://resend.com) → free tier (3000 emails/mes).
- **Para qué:** enviar email de verificación, reset password, alertas de precio (Fase 5), aviso de cuenta bloqueada. Sin esto, en dev los links se imprimen en consola; en prod **es obligatorio**.
- **Pasos:**
  1. Crear cuenta con tu email personal.
  2. Verificar el dominio `kairo.com.co` (Resend te da registros DNS — SPF, DKIM, DMARC — que pegas en Cloudflare).
  3. Generar API key.
  4. Pegar en `.env` de producción → `RESEND_API_KEY="re_..."`.

### 10.3 Mercado Libre (✅ cuenta developer creada)

- **Para qué:** OAuth de usuarios + búsqueda de productos + tracking de precios.
- **Lo que falta:**
  1. En el panel de developer ML, anotar **App ID** y **Client Secret**.
  2. Configurar redirect URI: `https://kairo.com.co/api/auth/ml/callback` (prod) y `http://localhost:3000/api/auth/ml/callback` (dev).
  3. Pegar en `.env`:
     ```
     ML_APP_ID="..."
     ML_CLIENT_SECRET="..."
     ML_REDIRECT_URI="http://localhost:3000/api/auth/ml/callback"
     ```
- Lo usaremos en Fase 2.

### 10.4 AliExpress Affiliate (✅ cuenta creada)

- **Para qué:** buscar productos AE + generar links de afiliado (cobramos comisión).
- **Lo que falta:**
  1. En el panel de afiliados AE, anotar **App Key**, **App Secret** y **Tracking ID**.
  2. Pegar en `.env`:
     ```
     AE_APP_KEY="..."
     AE_APP_SECRET="..."
     AE_TRACKING_ID="..."
     ```
- Lo usaremos en Fase 8.

### 10.5 Meta Business + WhatsApp Cloud API

- **Dónde:** [business.facebook.com](https://business.facebook.com).
- **Para qué:** alertas por WhatsApp en planes PRO y COMERCIANTE.
- **Lo que necesitas hacer:**
  1. Crear cuenta Meta Business.
  2. Crear app en developers.facebook.com → añadir producto "WhatsApp".
  3. Conseguir verificación del negocio (puede tardar **2-3 semanas**, por eso aplica ya).
  4. Crear templates aprobadas: `kairo_optin`, `kairo_price_alert`, `kairo_account_locked`.
  5. Pegar token, phone ID, business ID, webhook verify token y app secret en `.env`.
- Lo usaremos en Fase 7.

### 10.6 MercadoPago

- **Dónde:** [mercadopago.com.co/developers](https://www.mercadopago.com.co/developers).
- **Para qué:** cobrar suscripciones PRO ($X COP/mes) y COMERCIANTE.
- **Lo que necesitas:**
  1. Crear cuenta de vendedor.
  2. Crear aplicación en developers → tomar `Access Token` y `Public Key`.
  3. Configurar webhook a `https://kairo.com.co/api/billing/webhook`.
  4. Generar `MP_WEBHOOK_SECRET` (lo pones tú; MP firma con HMAC usando este secret).
  5. Pegar en `.env`.
- Lo usaremos en Fase 6.

### 10.7 Sentry (error tracking)

- **Dónde:** [sentry.io](https://sentry.io) → free tier (5K events/mes).
- **Para qué:** te avisa cuando hay un 500 en producción con stack trace.
- **Pasos:** crear proyecto Node y proyecto React → copiar DSN de cada uno → `SENTRY_DSN` (backend) y `VITE_SENTRY_DSN` (frontend).

### 10.8 Uptime Robot

- **Dónde:** [uptimerobot.com](https://uptimerobot.com) → free tier (50 monitors, ping cada 5 min).
- **Para qué:** te despierta si la app está caída.
- **Pasos:** crear monitor HTTP a `https://kairo.com.co/api/health`, alerta a tu email/WhatsApp.

### 10.9 Cloudflare (CDN + WAF)

- **Dónde:** [cloudflare.com](https://cloudflare.com) → plan gratis.
- **Para qué:** DDoS protection, WAF managed rules, bot fight mode, CDN para estáticos.
- **Pasos:** agregar el dominio kairo.com.co → cambiar nameservers en el registrador → activar SSL "Full (strict)".

### 10.10 Hostinger Business + Managed Node.js (hosting v.1)

- **Para qué:** correr backend + MySQL en producción.
- **Pasos:** comprar plan Business → habilitar Managed Node.js → configurar app vía cPanel. Ver `docs/deployment.md` (TODO).

---

## 11. Troubleshooting

### "User `kairo` was denied access on the database `kairo`" al correr migrate

Falta el GRANT del paso 4.1. Re-ejecuta el comando del paso 4.1.

### `prisma migrate dev` cuelga

Borra la última carpeta dentro de `backend/prisma/migrations/` (sin commit todavía) y reintenta.

### El backend dice "Invalid environment variables: ENCRYPTION_KEY must be 32 bytes hex (64 chars)"

Tu `ENCRYPTION_KEY` no tiene exactamente 64 caracteres hex. Re-genera con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y pega exactamente lo que devuelve.

### El frontend muestra "Sin conexión con el servidor"

- El backend no está corriendo en `localhost:3000`.
- O CORS está bloqueando — verifica que `FRONTEND_URL="http://localhost:5173"` en `backend/.env`.

### "Token CSRF inválido o ausente" en una mutation

Olvidaste el header `X-CSRF-Token` en una request manual (curl/Postman). El frontend lo manda automáticamente; en Postman copia la cookie `csrfToken` y mándala como header.

### Tests fallan con `ECONNREFUSED` al puerto 3306

MySQL no está corriendo. `docker compose up -d`.

### Quiero borrar TODO y empezar de cero

```powershell
docker compose down -v
Remove-Item -Recurse backend/prisma/migrations -Force
# luego pasos 4, 4.1, 5
```

---

## 12. Estructura del repo (referencia rápida)

```
kairo/
├── backend/                 Node + Express + Prisma
│   ├── src/
│   │   ├── config/          env (zod), DI container
│   │   ├── implementations/ Resend, ConsoleEmail, LruCache, MysqlJobQueue
│   │   ├── interfaces/      contratos para swap v.1↔v.2
│   │   ├── middleware/      auth, csrf, rateLimit, errorHandler, requestContext
│   │   ├── routes/          auth.routes, health.routes
│   │   ├── services/auth/   register, login, refresh, logout, reset, verifyEmail
│   │   └── utils/           jwt, password, csrf, cookies, crypto, errors, ...
│   ├── prisma/              schema.prisma + migrations/
│   └── tests/               unit (vitest) + integration (supertest)
├── frontend/                React 18 + Vite + Tailwind
│   ├── src/
│   │   ├── components/      AuthLayout, ProtectedRoute, ui/Field, ErrorBoundary
│   │   ├── hooks/           useMe (TanStack Query)
│   │   ├── lib/             api (axios + refresh), auth, errorMessage, cn
│   │   ├── pages/auth/      Login, Register, VerifyEmail, ForgotPassword, ResetPassword
│   │   └── store/           auth.store (zustand)
│   └── tests/
├── docs/                    architecture, deployment, runbook, api, setup-local (este)
├── docker-compose.yml       MySQL + Adminer local
├── SPEC.md                  Especificación técnica (fuente de verdad)
└── kairo-design-brief.md    Identidad visual
```
