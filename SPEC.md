# Kairo — Especificación técnica

> **Estado:** v.1 — listo para construir
> **Producto:** SaaS de inteligencia de precios LATAM (Mercado Libre + AliExpress)
> **Dominio:** kairo.com.co (por comprar)
> **Hosting v.1:** Hostinger Business + Managed Node.js
> **Audiencia de este documento:** desarrolladores del proyecto. Es la fuente de verdad técnica; cualquier cambio que la rompa debe actualizarla en el mismo PR.

---

## 1. Resumen del producto

Kairo permite a usuarios LATAM rastrear precios de productos en Mercado Libre y AliExpress, recibir alertas configurables cuando bajan/suben/cambian un % de precio, descubrir productos trending y comparar márgenes para decisiones de compra e importación.

**Tres planes:**

| Plan | Productos | Fuentes | Países ML | Canales alerta | Trending | CSV/Márgenes | Anuncios |
|---|---|---|---|---|---|---|---|
| FREE | 3 (bloqueados 30 días desde alta por producto) | ML | CO | email | ❌ | ❌ | ✅ |
| PRO | 50 | ML + AE | CO, MX, AR, CL, BR, PE | email + WhatsApp | ✅ por categoría | ❌ | ❌ |
| COMERCIANTE | Ilimitados | ML + AE | LATAM completo | email + WhatsApp | ✅ + LATAM cruzado | ✅ | ❌ |

---

## 2. Decisiones técnicas (locked-in)

| Decisión | Elección |
|---|---|
| Lenguaje | **TypeScript** estricto (backend + frontend) |
| Procesador de pagos | **MercadoPago** (Checkout Pro + preapproval). DIAN factura electrónica via Alegra/Siigo en v.1.5 |
| Hosting v.1 | **Hostinger Business + Managed Node.js + MySQL 8 Hostinger** |
| Auth | JWT en **httpOnly + Secure + SameSite=Lax cookies** + CSRF double-submit. **NUNCA en localStorage.** |
| Cache | `lru-cache` in-memory (Redis llega en v.2 con la migración a VPS) |
| Cola de jobs | Tabla `Job` en MySQL + worker in-proc + `node-cron` (BullMQ llega en v.2) |
| HTTP client servidor | `undici` con pool + retry + backoff |
| Email | **Resend** + templates con `react-email` (escape automático) |
| WhatsApp | **Meta Cloud API v18+** con templates aprobadas + opt-in legal |
| Logging | **Pino** structured JSON + redacción PII |
| Error tracking | **Sentry** (free tier inicial) |
| Métricas | `prom-client` + push opcional a Grafana Cloud free tier |
| Tests | **Vitest** + **Supertest** + factories + tests de integración con DB de prueba |
| Lint/format | ESLint + Prettier + Husky pre-commit |
| CDN | Cloudflare free tier delante del dominio (DDoS básico + WAF) + CDN gratis de Hostinger para estáticos |
| CI/CD | GitHub Actions: lint + test + build en cada PR. Deploy via SSH script + `prisma migrate deploy` + restart Passenger |
| Plan FREE bloqueo | `lockedUntil = addedAt + 30 días` por producto (no calendario) |
| Alertas | Configurables: `mode` (ONE_SHOT default \| RECURRING con cooldownDays) + `direction` (DOWN default \| UP \| PCT) |
| Plan v.2 / Amazon / VPS | Documentado en sección 14, NO se construye en v.1 |

---

## 3. Stack v.1 — completo

### Backend
- Node.js 20 LTS
- TypeScript 5+ (strict, noImplicitAny, exactOptionalPropertyTypes)
- Express 4
- Prisma 5 + MySQL 8
- `zod` para validación de inputs y validación de env vars al boot
- `undici` para HTTP outbound (pool + retry)
- `helmet`, `cors`, `express-rate-limit`, `cookie-parser`
- `bcrypt` (12 rounds) para passwords
- `jsonwebtoken` para JWT (access 15min + refresh 7d con rotation)
- `node-cron` para scheduling
- `lru-cache` para caché in-memory
- `pino` + `pino-pretty` (dev) + `@sentry/node` para errores
- `prom-client` para métricas
- `resend` SDK
- `mercadopago` SDK
- `libphonenumber-js` para normalización E.164
- `crypto` nativo + AES-256-GCM para cifrar tokens OAuth en DB

### Frontend
- React 18 + Vite + TypeScript
- React Router v6
- Zustand (auth + UI state) + TanStack Query (server state, cache, mutations)
- Axios con interceptors (cookies + CSRF header + retry en 401 con refresh)
- shadcn/ui + Tailwind CSS
- React Hook Form + `zod` resolver
- Recharts (gráfico historial precios)
- `react-hot-toast`
- `react-email` para templates (compartidos con backend)
- Plausible Analytics (privacy-first, sin banner intrusivo)
- `@sentry/react`

### Infraestructura v.1
- Hostinger Business + Managed Node.js (single Passenger process)
- MySQL 8 en Hostinger (misma instancia, separar en v.2)
- CDN gratis Hostinger + Cloudflare free tier delante
- SSL Hostinger automático (renovado por panel)
- Daily backups Hostinger (verificar que MySQL esté incluido + descarga semanal a S3/Backblaze)
- Sentry, Logtail/BetterStack, Uptime Robot — todos free tier al inicio
- GitHub Actions para CI

---

## 4. Estructura de carpetas

```
kairo/
├── backend/
│   ├── src/
│   │   ├── controllers/        # HTTP handlers — thin, delegan a services
│   │   ├── routes/             # Express routers, agrupan rutas + middlewares
│   │   ├── services/
│   │   │   ├── auth/
│   │   │   ├── billing/
│   │   │   ├── tracking/
│   │   │   ├── alerts/
│   │   │   ├── trending/
│   │   │   ├── search/
│   │   │   └── integrations/
│   │   │       ├── mercadolibre/
│   │   │       ├── aliexpress/
│   │   │       ├── whatsapp/
│   │   │       ├── mercadopago/
│   │   │       └── resend/
│   │   ├── repositories/       # Queries Prisma encapsuladas (testeables)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts        # Verifica JWT cookie + setea req.user
│   │   │   ├── ownership.middleware.ts   # Verifica recurso pertenece a req.user
│   │   │   ├── csrf.middleware.ts        # Double-submit CSRF
│   │   │   ├── rateLimit.middleware.ts   # Por IP + por user
│   │   │   ├── plan.middleware.ts        # Requiere plan(es) específico(s)
│   │   │   └── validation.middleware.ts  # zod schema validator
│   │   ├── jobs/
│   │   │   ├── pricePoll.job.ts
│   │   │   ├── tokenRefresh.job.ts       # ML OAuth refresh
│   │   │   ├── cleanup.job.ts            # Archivo PriceHistory > 90d
│   │   │   ├── alertRetry.job.ts         # Reintenta notificaciones fallidas
│   │   │   └── scheduler.ts              # node-cron entrypoint
│   │   ├── workers/
│   │   │   └── jobDispatcher.ts          # Dispatcher de tabla Job
│   │   ├── interfaces/                   # Contracts para swap v.1 → v.2
│   │   │   ├── CacheService.ts
│   │   │   └── JobQueue.ts
│   │   ├── implementations/
│   │   │   ├── LruCacheService.ts        # v.1
│   │   │   ├── RedisCacheService.ts      # v.2 (stub al inicio)
│   │   │   ├── MysqlJobQueue.ts          # v.1
│   │   │   └── BullMqJobQueue.ts         # v.2 (stub al inicio)
│   │   ├── utils/
│   │   │   ├── crypto.ts                 # AES-256-GCM para tokens OAuth
│   │   │   ├── planLimits.ts
│   │   │   ├── normalize.ts              # ML/AE → formato unificado
│   │   │   ├── errors.ts                 # AppError, errorHandler
│   │   │   └── pagination.ts
│   │   ├── config/
│   │   │   ├── env.ts                    # zod validation de env vars
│   │   │   └── di.ts                     # Inyección de dependencias (cache/queue)
│   │   ├── logger/
│   │   │   ├── pino.ts                   # Config + redaction de PII
│   │   │   └── sentry.ts
│   │   ├── types/                        # Tipos compartidos
│   │   └── app.ts                        # Express app factory
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── emails/                           # react-email templates (compartibles con frontend)
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── server.ts                         # Entrypoint, llama app + scheduler + graceful shutdown
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/                     # Login, register, verify-email, reset-password
│   │   │   ├── dashboard/
│   │   │   ├── search/
│   │   │   ├── tracking/
│   │   │   ├── alerts/
│   │   │   ├── trending/
│   │   │   ├── billing/
│   │   │   └── settings/
│   │   ├── components/
│   │   │   ├── ui/                       # shadcn/ui generated
│   │   │   └── domain/                   # ProductCard, PriceChart, AlertForm, PlanBadge, etc.
│   │   ├── lib/
│   │   │   ├── api.ts                    # Axios instance + interceptors
│   │   │   ├── queryClient.ts            # TanStack Query
│   │   │   └── auth.ts                   # Helpers de auth
│   │   ├── store/
│   │   │   └── auth.store.ts             # Zustand: user + plan + ui state
│   │   ├── hooks/
│   │   ├── pages/                        # Page-level components (route handlers)
│   │   ├── i18n/                         # estructura para v.2; solo es-CO en v.1
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── tests/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── api.md                            # OpenAPI/Swagger ref
│   ├── deployment.md                     # Hostinger + Cloudflare setup
│   ├── runbook.md                        # Incidentes + recovery
│   └── architecture.md                   # Decisiones técnicas + diagrama
├── scripts/
│   ├── deploy.sh
│   ├── backup.sh
│   └── seed-templates.sh                 # Crea templates WA en Meta (manual cuando aprueban)
├── SPEC.md                               # Este archivo (especificación técnica)
├── kairo-design-brief.md                 # Identidad visual
└── README.md
```

---

## 5. Schema Prisma — v.1 (corregido)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// =========================
// USERS & AUTH
// =========================

model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  passwordHash          String
  name                  String
  phone                 String?   // E.164: +57...
  whatsappVerified      Boolean   @default(false)

  emailVerified         Boolean   @default(false)
  emailVerifiedAt       DateTime?
  lastLoginAt           DateTime?
  failedLoginAttempts   Int       @default(0)
  accountLockedUntil    DateTime?

  plan                  Plan      @default(FREE)

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime?

  trackedProducts       TrackedProduct[]
  alerts                Alert[]
  priceHistory          PriceHistory[]
  alertNotifications    AlertNotification[]
  refreshTokens         RefreshToken[]
  passwordResetTokens   PasswordResetToken[]
  emailVerifications    EmailVerification[]
  mlOAuthToken          MLOAuthToken?
  whatsappOptIns        WhatsAppOptIn[]
  subscription          Subscription?
  payments              Payment[]
  auditLogs             AuditLog[]

  @@index([email])
  @@index([plan])
  @@index([deletedAt])
}

enum Plan {
  FREE
  PRO
  COMERCIANTE
}

model RefreshToken {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique     // hash SHA-256, nunca el token raw
  expiresAt   DateTime
  revokedAt   DateTime?
  replacedBy  String?              // ID del token que lo reemplazó (rotation)
  userAgent   String?
  ip          String?
  createdAt   DateTime  @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model EmailVerification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId])
}

// =========================
// TRACKING & PRICES
// =========================

model TrackedProduct {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  externalId   String                          // ID en ML o AliExpress
  source       Source
  title        String
  imageUrl     String?
  productUrl   String   @db.Text
  currentPrice Decimal  @db.Decimal(12, 2)
  currency     Currency @default(COP)
  country      String   @default("CO")         // ISO 3166-1 alpha-2

  addedAt      DateTime @default(now())
  lockedUntil  DateTime?                       // FREE: addedAt + 30 días

  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  priceHistory PriceHistory[]
  alerts       Alert[]

  @@unique([userId, externalId, source])
  @@index([userId, isActive])
  @@index([isActive])
  @@index([externalId, source])
  @@index([lockedUntil])
}

enum Source {
  ML
  ALIEXPRESS
}

enum Currency {
  COP
  USD
  MXN
  ARS
  CLP
  BRL
  PEN
}

model PriceHistory {
  id               String         @id @default(uuid())
  trackedProductId String
  trackedProduct   TrackedProduct @relation(fields: [trackedProductId], references: [id], onDelete: Cascade)
  userId           String
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  price      Decimal  @db.Decimal(12, 2)
  currency   Currency
  recordedAt DateTime @default(now())

  @@index([trackedProductId, recordedAt(sort: Desc)])
  @@index([userId])
  @@index([recordedAt])              // para cleanup job
}

model PriceAggregate {
  // Rollup diario para retención larga (>90 días)
  id               String   @id @default(uuid())
  externalId       String
  source           Source
  day              DateTime @db.Date
  minPrice         Decimal  @db.Decimal(12, 2)
  maxPrice         Decimal  @db.Decimal(12, 2)
  avgPrice         Decimal  @db.Decimal(12, 2)
  closePrice       Decimal  @db.Decimal(12, 2)
  samples          Int
  currency         Currency

  @@unique([externalId, source, day])
  @@index([externalId, source, day(sort: Desc)])
}

// =========================
// ALERTS
// =========================

model Alert {
  id               String         @id @default(uuid())
  userId           String
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  trackedProductId String
  trackedProduct   TrackedProduct @relation(fields: [trackedProductId], references: [id], onDelete: Cascade)

  mode             AlertMode      @default(ONE_SHOT)
  direction        AlertDirection @default(DOWN)
  targetPrice      Decimal?       @db.Decimal(12, 2)   // null si direction=PCT
  pctThreshold     Float?                              // ej: -20 para "bajó 20%"; null si direction=DOWN/UP
  basePrice        Decimal?       @db.Decimal(12, 2)   // precio al crear, para calcular PCT
  cooldownDays     Int            @default(7)          // solo aplica si mode=RECURRING

  notifyEmail      Boolean        @default(true)
  notifyWhatsapp   Boolean        @default(false)

  isActive         Boolean        @default(true)
  triggered        Boolean        @default(false)      // ONE_SHOT: true permanente; RECURRING: usar lastTriggeredAt
  lastTriggeredAt  DateTime?

  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  notifications    AlertNotification[]

  @@index([userId, isActive])
  @@index([trackedProductId, isActive, triggered])
}

enum AlertMode {
  ONE_SHOT
  RECURRING
}

enum AlertDirection {
  DOWN
  UP
  PCT
}

model AlertNotification {
  id              String              @id @default(uuid())
  alertId         String
  alert           Alert               @relation(fields: [alertId], references: [id], onDelete: Cascade)
  userId          String
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  channel         NotificationChannel
  idempotencyKey  String              @unique           // alertId + recordedAt
  status          NotificationStatus  @default(PENDING)
  attempts        Int                 @default(0)
  lastAttemptAt   DateTime?
  externalId      String?                               // message_id de Meta o Resend
  errorMessage    String?             @db.Text

  pricePaid       Decimal             @db.Decimal(12, 2)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([alertId])
  @@index([status])
  @@index([userId, createdAt(sort: Desc)])
}

enum NotificationChannel {
  EMAIL
  WHATSAPP
}

enum NotificationStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
}

// =========================
// INTEGRATIONS — OAuth & WhatsApp
// =========================

model MLOAuthToken {
  id                    String   @id @default(uuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  accessTokenEncrypted  String   @db.Text       // AES-256-GCM
  refreshTokenEncrypted String   @db.Text
  expiresAt             DateTime
  mlUserId              String                  // user_id de ML
  scope                 String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([expiresAt])               // para refresh job
}

model WhatsAppOptIn {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  phone       String                                // E.164
  optedInAt   DateTime @default(now())
  method      String                                // 'in_app_confirmation' | 'reply_yes'
  ip          String?
  userAgent   String?
  revokedAt   DateTime?                             // si responde STOP

  @@index([userId])
  @@index([phone])
}

// =========================
// BILLING
// =========================

model Subscription {
  id                       String   @id @default(uuid())
  userId                   String   @unique
  user                     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  plan                     Plan
  status                   SubscriptionStatus    @default(INCOMPLETE)
  mpPreapprovalId          String?  @unique       // MercadoPago preapproval ID
  mpPayerId                String?
  currentPeriodStart       DateTime?
  currentPeriodEnd         DateTime?
  cancelAtPeriodEnd        Boolean  @default(false)
  canceledAt               DateTime?

  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  @@index([status])
  @@index([currentPeriodEnd])
}

enum SubscriptionStatus {
  INCOMPLETE        // creada, pago pendiente
  TRIALING
  ACTIVE
  PAST_DUE          // pago fallido, en período de gracia
  CANCELED
  UNPAID            // tras agotar reintentos
}

model Payment {
  id                String        @id @default(uuid())
  userId            String
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  mpPaymentId       String        @unique
  amount            Decimal       @db.Decimal(12, 2)
  currency          Currency      @default(COP)
  status            PaymentStatus
  method            String?                          // credit_card, pse, etc.
  paidAt            DateTime?
  failureReason     String?       @db.Text
  createdAt         DateTime      @default(now())

  @@index([userId, createdAt(sort: Desc)])
  @@index([status])
}

enum PaymentStatus {
  PENDING
  APPROVED
  REJECTED
  REFUNDED
  CHARGED_BACK
}

model WebhookEvent {
  // Idempotencia + auditoría de webhooks
  id           String   @id @default(uuid())
  provider     String                                // 'mercadopago' | 'whatsapp'
  externalId   String                                // event_id del proveedor
  payload      Json
  processedAt  DateTime?
  errorMessage String?  @db.Text
  createdAt    DateTime @default(now())

  @@unique([provider, externalId])
  @@index([processedAt])
}

// =========================
// JOBS (cola en MySQL — v.1, reemplaza por BullMQ en v.2)
// =========================

model Job {
  id          String     @id @default(uuid())
  type        String                              // 'pricePoll' | 'alertNotify' | 'tokenRefresh' | ...
  payload     Json
  status      JobStatus  @default(PENDING)
  priority    Int        @default(0)              // mayor = más prioritario
  scheduledAt DateTime   @default(now())
  startedAt   DateTime?
  finishedAt  DateTime?
  attempts    Int        @default(0)
  maxAttempts Int        @default(3)
  lastError   String?    @db.Text

  createdAt   DateTime   @default(now())

  @@index([status, scheduledAt, priority(sort: Desc)])
  @@index([type, status])
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  DEAD              // tras agotar maxAttempts
}

// =========================
// AUDIT
// =========================

model AuditLog {
  id         String   @id @default(uuid())
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action     String                              // 'login' | 'password_change' | 'plan_change' | 'account_delete' | ...
  resource   String?                             // 'user' | 'trackedProduct' | 'alert' | ...
  resourceId String?
  ip         String?
  userAgent  String?
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([userId, createdAt(sort: Desc)])
  @@index([action, createdAt(sort: Desc)])
}
```

---

## 6. Variables de entorno — `.env.example`

```env
# Node
NODE_ENV="development"
PORT=3000
APP_URL="https://kairo.com.co"
FRONTEND_URL="http://localhost:5173"      # dev

# Database
DATABASE_URL="mysql://user:password@host:3306/kairo"

# Crypto
JWT_ACCESS_SECRET=""                       # 64+ chars random
JWT_REFRESH_SECRET=""                      # 64+ chars random, distinto al access
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"
ENCRYPTION_KEY=""                          # 32 bytes hex (64 chars) para AES-256-GCM tokens OAuth
CSRF_SECRET=""                             # 32+ chars
COOKIE_DOMAIN="kairo.com.co"               # vacío en dev

# Mercado Libre
ML_APP_ID=""
ML_CLIENT_SECRET=""
ML_REDIRECT_URI="https://kairo.com.co/api/auth/ml/callback"

# AliExpress
AE_APP_KEY=""
AE_APP_SECRET=""
AE_TRACKING_ID=""

# WhatsApp Cloud API (Meta)
WA_TOKEN=""
WA_PHONE_ID=""
WA_BUSINESS_ID=""
WA_WEBHOOK_VERIFY_TOKEN=""                 # define tú, usa el mismo en Meta
WA_APP_SECRET=""                           # para verificar firma X-Hub-Signature-256

# MercadoPago
MP_ACCESS_TOKEN=""
MP_PUBLIC_KEY=""
MP_WEBHOOK_SECRET=""

# Resend
RESEND_API_KEY=""
RESEND_FROM_DEFAULT="hola@kairo.com.co"
RESEND_FROM_ALERTS="alertas@kairo.com.co"

# Observability
SENTRY_DSN=""
LOG_LEVEL="info"
LOGTAIL_TOKEN=""                           # opcional

# Rate limiting
RATE_LIMIT_AUTH_WINDOW_MS=900000           # 15 min
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_API_WINDOW_MS=60000             # 1 min
RATE_LIMIT_API_MAX=120
```

**Reglas:**
- Nunca commit de `.env`. `.env.example` siempre actualizado.
- Validación al boot con `zod` (en `src/config/env.ts`). App no arranca si falta una var requerida.
- En producción: variables se cargan en panel Hostinger Managed Node.js, no en archivo.

---

## 7. API Endpoints

Todos los endpoints autenticados requieren cookie `accessToken` + header `X-CSRF-Token` (excepto GETs que solo requieren cookie). Responses son JSON.

### Auth
```
POST   /api/auth/register          { email, password, name } → 201 + envía email de verificación
POST   /api/auth/verify-email      { token } → 200 + emailVerified=true
POST   /api/auth/login             { email, password } → 200 + setea cookies
POST   /api/auth/refresh           (cookie refresh) → 200 + nuevas cookies, revoca el anterior
POST   /api/auth/logout            → 204 + revoca refresh
POST   /api/auth/forgot-password   { email } → 204 siempre (no revela existencia)
POST   /api/auth/reset-password    { token, newPassword } → 200
GET    /api/auth/me                → 200 { user, plan, subscription }
```

### Mercado Libre OAuth
```
GET    /api/auth/ml/connect        → 302 redirect a ML con state + PKCE
GET    /api/auth/ml/callback       ?code&state → 302 a /settings con success/error
DELETE /api/auth/ml                → revoca token y elimina MLOAuthToken
```

### Búsqueda
```
GET    /api/search?q=&source=&country=&minPrice=&maxPrice=&page=
       source=ml|aliexpress|both (default según plan)
       Cache hit típico 5 min en lru-cache
```

### Tracking
```
GET    /api/tracking?page=&limit=          → lista paginada
POST   /api/tracking                       { externalId, source, ... }
GET    /api/tracking/:id                   (ownership middleware)
DELETE /api/tracking/:id                   (ownership + FREE lock check)
GET    /api/tracking/:id/history?days=
```

### Alertas
```
GET    /api/alerts
POST   /api/alerts                         { trackedProductId, mode, direction, targetPrice?, pctThreshold?, cooldownDays?, notifyEmail, notifyWhatsapp }
PUT    /api/alerts/:id                     (ownership)
DELETE /api/alerts/:id                     (ownership)
```

### Trending
```
GET    /api/trending?country=&category=    (requirePlan('PRO', 'COMERCIANTE'))
                                            country=ALL solo COMERCIANTE
```

### Billing
```
GET    /api/billing/plans
POST   /api/billing/checkout               { plan } → { initPoint } (URL MercadoPago)
GET    /api/billing/status
POST   /api/billing/cancel                 → cancelAtPeriodEnd=true
POST   /api/billing/reactivate
POST   /api/billing/webhook                (MercadoPago — verifica HMAC + idempotency)
```

### WhatsApp
```
POST   /api/whatsapp/opt-in                { phone } → envía template kairo_optin
POST   /api/whatsapp/confirm               { code } → marca whatsappVerified
POST   /api/whatsapp/webhook               (Meta — verify token GET + firma POST)
GET    /api/whatsapp/webhook               (Meta verification challenge)
```

### Sistema
```
GET    /api/health                         { status, db, cache, version }
GET    /metrics                            (prom-client, protegido por token)
```

**Convenciones de respuesta:**
- Éxito: `{ data: ... }` o resource directo
- Error: `{ error: { code: 'snake_case', message: 'humano', details?: {} } }`
- Status codes estándar (200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500)
- Pagination: `{ data: [...], pagination: { page, limit, total, totalPages } }`

---

## 8. Integraciones — detalle

### 8.1 Mercado Libre

**OAuth flow:**
1. `GET /api/auth/ml/connect`: genera `state` (32 bytes random) + `code_verifier` PKCE → guarda en cookie httpOnly corta (5min) → redirige a `https://auth.mercadolibre.com.co/authorization?response_type=code&client_id=ML_APP_ID&redirect_uri=...&state=...&code_challenge=...&code_challenge_method=S256`
2. `GET /api/auth/ml/callback`: valida `state` contra cookie, intercambia `code` por tokens en `https://api.mercadolibre.com/oauth/token` con `code_verifier`
3. Cifra `access_token` + `refresh_token` con AES-256-GCM (clave en `ENCRYPTION_KEY`) y guarda en `MLOAuthToken`
4. `tokenRefresh.job` corre cada hora: refresca tokens que expiran en <30min

**Uso de tokens:**
- **Búsqueda pública** (`/sites/MCO/search`, `/sites/MCO/trends`): NO requiere OAuth de usuario → usar app-only token (cacheado en memoria, refresh on-demand)
- **Item detail + tracking** (`/items/:id`): requiere token del usuario que rastrea (cada user usa el suyo)
- Si un user borra su token ML, sus productos quedan "huérfanos" → fallback a app-only para sólo precio (sin detalles privados)

**Service multi-user (patrón obligatorio — usar token del usuario, nunca global):**
```typescript
// services/integrations/mercadolibre/client.ts
export async function fetchItemForUser(userId: string, itemId: string) {
  const token = await getDecryptedToken(userId);   // de MLOAuthToken cifrado
  return undici.request(`https://api.mercadolibre.com/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

**Backoff:** HTTP 429 → retry exponencial (1s, 4s, 16s) hasta 3 veces. Si falla, log + marca producto con `lastSyncError`.

**Sites soportados:**
```typescript
const ML_SITES: Record<string, string> = {
  CO: 'MCO', MX: 'MLM', AR: 'MLA', CL: 'MLC', BR: 'MLB', PE: 'MPE'
};
```

### 8.2 AliExpress Affiliate

- **Firma SHA256** (no MD5).
- Gateway: `https://api-sg.aliexpress.com/sync`
- Endpoints clave: `aliexpress.affiliate.product.query`, `aliexpress.affiliate.hotproduct.query`, `aliexpress.affiliate.productdetail.get`, `aliexpress.affiliate.link.generate`
- **Filtro por país no existe nativo** — UI muestra warning: "AliExpress envía desde el extranjero, costos y tiempos varían".
- Quotas: throttling explícito 1 req/s por endpoint.
- Productos discontinuados (HTTP 200 con código de error AE) → marca `TrackedProduct.isActive = false` + envía email "tu producto rastreado dejó de estar disponible".

**Plan B si rechazan affiliate:** integrar via aggregator (Admitad, Awin). Si todo falla, AE queda fuera de v.1 (solo ML).

### 8.3 WhatsApp Cloud API

**Templates necesarias (aprobar en Meta antes de fase 7):**
- `kairo_optin` (utility): "Hola {{1}}, recibirás alertas de precio en este número. Responde SI para confirmar o STOP para cancelar."
- `kairo_price_alert` (utility): "El precio de {{1}} bajó a ${{2}}. Ver: {{3}}"
- `kairo_welcome` (marketing, opcional): "Bienvenido a Kairo. Tu primera alerta lista en {{1}}"

**Opt-in legal (obligatorio Meta + Ley CO):**
1. User agrega número en Settings → server normaliza E.164 → envía template `kairo_optin`
2. User responde "SI" (vía webhook) o confirma en la app
3. Registro en `WhatsAppOptIn` con `optedInAt`, `method`, `ip`, `userAgent`
4. `User.whatsappVerified = true`

**Manejo de STOP/opt-out:** webhook recibe mensaje "STOP" o "BAJA" → marca `WhatsAppOptIn.revokedAt` + `User.whatsappVerified = false` + envía template de confirmación de baja.

**Verificación de webhook:** GET inicial de Meta con `hub.verify_token` → responder `hub.challenge`. POST con header `X-Hub-Signature-256` → verificar HMAC-SHA256 con `WA_APP_SECRET`.

**Status callbacks:** webhook recibe `sent → delivered → read` / `failed` → actualiza `AlertNotification.status` y `externalId`.

**Costo:** ~USD 0.04-0.10 por mensaje saliente LATAM. Monitorear vía métricas custom (`whatsapp_messages_sent_total{user_plan=...}`). Soft cap para PRO si excede 100 mensajes/mes.

### 8.4 MercadoPago

**Flow de suscripción:**
1. User elige plan en `/pricing` → `POST /api/billing/checkout` con `{ plan: 'PRO' }`
2. Server crea `preapproval` en MercadoPago (`POST /preapproval`) → recibe `init_point`
3. User completa pago en MP (redirect)
4. MP notifica vía webhook `POST /api/billing/webhook` con eventos
5. Server: verifica firma HMAC con `MP_WEBHOOK_SECRET`, valida idempotencia con `WebhookEvent`, actualiza `Subscription` + `User.plan`

**Eventos manejados:**
- `payment.created` → crea `Payment(status=PENDING)`
- `payment.updated` → actualiza `Payment.status` y, si APPROVED, marca `Subscription.status=ACTIVE`
- `subscription_preapproval.updated` → cambios de estado, cancelaciones

**State machine de Subscription:**
```
INCOMPLETE → (pago aprobado) → ACTIVE
ACTIVE → (cancelAtPeriodEnd=true) → ACTIVE hasta currentPeriodEnd → CANCELED
ACTIVE → (pago falla) → PAST_DUE → (retry MP) → ACTIVE o UNPAID
UNPAID → (nuevo método de pago) → ACTIVE
CANCELED → (re-upgrade) → nueva Subscription (INCOMPLETE → ACTIVE)
```

**Downgrade reglas:**
- Downgrade aplica al **fin del período actual** (no inmediato).
- Si downgrade a FREE y tiene >3 productos: mantener los 3 más recientes activos, marcar el resto `isActive=false` con email notificando.
- WhatsApp se desactiva inmediato si el nuevo plan no lo incluye.

**IVA 19% Colombia:** incluido en el precio mostrado. Factura DIAN se emite via Alegra en v.1.5 (no bloquea lanzamiento si declaramos volumen bajo inicial).

### 8.5 Resend (email)

- Templates con `react-email` (escape automático, JSX, previsualizables).
- Emails: `welcome`, `verify-email`, `reset-password`, `alert-fired`, `payment-failed`, `payment-succeeded`, `plan-changed`, `account-deleted`, `whatsapp-revoked`.
- DNS al comprar dominio: SPF, DKIM (Resend provee CNAME), DMARC (`v=DMARC1; p=quarantine; rua=mailto:dmarc@kairo.com.co`).
- Logging: cada send registra `messageId` para reconciliación.

---

## 9. Seguridad — checklist obligatorio antes de cada deploy

### Auth & sesiones
1. JWT en `httpOnly + Secure + SameSite=Lax` cookies. Nunca en localStorage.
2. CSRF: token double-submit (cookie no-httpOnly + header `X-CSRF-Token`) en todas las mutations.
3. Refresh token rotation: cada uso revoca el anterior y emite uno nuevo. Almacenar `tokenHash` (SHA-256), nunca el token raw.
4. Logout revoca `refresh_token` actual.
5. Verificación de email obligatoria para todas las acciones excepto `verify-email` y `forgot-password`.
6. Reset password: token 32 bytes crypto random, hash en DB, TTL 1h, single-use.
7. Lockout: 5 intentos fallidos en 15 min → `accountLockedUntil = now + 15min`. Mensaje al user via email.
8. Mensajes genéricos en login y forgot-password ("Si el email existe, te enviamos un enlace") para evitar enumeration.

### Authorization
9. Middleware `ownership` aplicado a TODA ruta `/:id` que toque recursos de usuario. Patrón: `app.delete('/tracking/:id', auth, ownership('trackedProduct'), handler)`.
10. Middleware `requirePlan('PRO', 'COMERCIANTE')` en rutas premium. Validar también en frontend para UX pero NUNCA confiar solo en frontend.

### Crypto
11. Tokens OAuth ML cifrados con AES-256-GCM. Clave en `ENCRYPTION_KEY` (32 bytes hex). Helper en `utils/crypto.ts`.
12. Passwords con bcrypt cost 12.
13. Nunca log de passwords ni de tokens. Pino configurado con `redact` para `password`, `token`, `accessToken`, `refreshToken`, `authorization`.

### Network & headers
14. **Helmet** con `contentSecurityPolicy` estricto (allow `'self'`, Sentry, Plausible, Hostinger CDN, Cloudflare).
15. **HSTS** con `maxAge: 63072000; includeSubDomains; preload`.
16. CORS: whitelist exacta (`https://kairo.com.co`, staging si existe). No usar `*`.
17. Cloudflare free tier delante del dominio: WAF managed rules + bot fight mode + rate limit básico.

### Rate limiting
18. `/api/auth/*` (login, forgot, reset, register): 10 req/15min por IP **y** 5 req/15min por email.
19. Resto `/api/*` autenticado: 120 req/min por user. Endpoints de búsqueda: 30 req/min por user.
20. Webhook endpoints sin rate limit (vienen de proveedores conocidos), pero IP whitelist si el proveedor publica rangos.

### Inputs y outputs
21. `zod` valida body, query, params en cada endpoint. Schema en archivo del route.
22. Templates de email con `react-email` (escape JSX automático). Nunca interpolar HTML raw.
23. Frontend nunca usa `dangerouslySetInnerHTML` con contenido de productos (vienen de fuentes no confiables).

### Webhooks
24. Idempotencia: tabla `WebhookEvent` con `@@unique([provider, externalId])`. Si ya existe → 200 OK sin re-procesar.
25. Firma verificada en cada webhook:
    - MercadoPago: HMAC-SHA256 con `MP_WEBHOOK_SECRET`
    - WhatsApp: header `X-Hub-Signature-256` HMAC con `WA_APP_SECRET`

### OAuth
26. `state` parameter en OAuth ML, validado contra cookie httpOnly corta. Sin esto, atacante puede vincular su cuenta ML a la víctima.
27. PKCE (`S256`) en OAuth ML.

### Logging & auditoría
28. Pino structured logging con `requestId` (UUID por request) propagado vía AsyncLocalStorage.
29. Audit log de: login (exitoso y fallido), password change, plan change, account delete, ML connect/disconnect, WhatsApp opt-in/out.
30. Errores 5xx → Sentry con contexto (`requestId`, `userId` si autenticado, sin PII).
31. Logs NO contienen: passwords, tokens, refresh tokens, números de tarjeta, CVV. Emails parcialmente enmascarados (`c***@gmail.com`) cuando se logean.

### Legal
32. Política de privacidad, términos de servicio, política de cookies publicados en `/legal/*` antes del primer user real.
33. Cookie banner (Plausible no requiere cookies pero el banner aclara analytics + cookies funcionales).
34. Footer con aviso de affiliate links (AliExpress).
35. Flow de "eliminar mi cuenta" funcional: soft delete + email confirmando + opción de descargar datos antes de borrar.

### Misc
36. `prisma migrate deploy` (no `dev`) en producción.
37. Backups: Hostinger daily + descarga semanal manual o automática a S3/Backblaze. **Restore probado mensualmente.**
38. Graceful shutdown: `SIGTERM` → drena requests en curso + cierra Prisma → exit. Importante para deploys sin downtime.
39. Health check `/api/health` chequea DB + cache. Uptime Robot pinguea cada minuto.

---

## 10. Lógica de negocio — reglas

### Plan FREE — bloqueo de productos
- Al agregar: `lockedUntil = addedAt + 30 días` (NO calendario mensual).
- Eliminar antes de `lockedUntil`: 403 `product_locked`.
- Después de `lockedUntil`: user puede eliminar y agregar otro (cuenta a su cupo de 3).
- Reactivar mismo `externalId+source` después de borrar: NUEVO `addedAt`, nuevo `lockedUntil` 30 días desde ahora.

```typescript
// services/tracking/addTrackedProduct.ts
export async function addTrackedProduct(userId: string, input: AddTrackingInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const limits = PLAN_LIMITS[user.plan];

  const activeCount = await prisma.trackedProduct.count({
    where: { userId, isActive: true }
  });
  if (activeCount >= limits.maxTrackedProducts) {
    throw new AppError('limit_reached', 403,
      `Tu plan permite rastrear hasta ${limits.maxTrackedProducts} productos.`);
  }

  if (!limits.sources.includes(input.source)) {
    throw new AppError('source_not_allowed', 403);
  }

  const lockedUntil = user.plan === 'FREE'
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : null;

  return prisma.trackedProduct.create({
    data: { ...input, userId, lockedUntil }
  });
}
```

### Alertas
- `mode: ONE_SHOT` (default): se dispara una vez, `triggered=true` permanente. UI muestra "Disparada — crear nueva".
- `mode: RECURRING`: se vuelve a disparar si `lastTriggeredAt < now - cooldownDays` y la condición se cumple. Default `cooldownDays=7`.
- `direction: DOWN` (default): dispara cuando `price <= targetPrice`.
- `direction: UP`: dispara cuando `price >= targetPrice`.
- `direction: PCT`: dispara cuando `(price - basePrice) / basePrice * 100 <= pctThreshold` (negativo = baja) o `>= pctThreshold` (positivo = sube).
- `basePrice` se setea al crear la alerta (precio actual del producto).
- Dedup: `AlertNotification.idempotencyKey = ${alertId}_${recordedAt.toISOString()}`. Si existe → no se reenvía.
- Rate limit: máx 10 notificaciones por usuario por hora (anti-spam).
- Reintentos de delivery: 3 con backoff exponencial (1min, 5min, 30min). Tras fallo final → `status=FAILED` + log.

### Polling
- `pricePoll.job` corre cada hora via `node-cron`.
- Dedup por `(externalId, source)`: si N usuarios rastrean el mismo producto, 1 sola llamada API.
- Throttling explícito: máx 60 req/min hacia ML + 60 req/min hacia AE (configurables).
- Priorización:
  - Productos con alerta `targetPrice` dentro de ±10% del precio actual → cada 1h
  - Productos con alerta lejana → cada 4h
  - Productos sin movimiento en 7 días → cada 12h
- Cada nuevo precio se guarda en `PriceHistory` solo si difiere del último registrado.
- Tras actualizar precio, dispara `checkAndFireAlerts(productId, newPrice)`.
- Errores por producto NO detienen el batch (try/catch + log).
- Job `cleanup.job` corre cada noche 3am: archiva `PriceHistory` >90 días en `PriceAggregate` (rollup diario) y elimina los originales.

### Plan limits — `utils/planLimits.ts`
```typescript
export const PLAN_LIMITS = {
  FREE: {
    maxTrackedProducts: 3,
    sources: ['ML'] as const,
    countries: ['CO'] as const,
    alertChannels: ['email'] as const,
    canSeeTrending: false,
    trendingByCategory: false,
    trendingAllLatam: false,
    canExportCSV: false,
    canSeeMargins: false,
    hasAds: true,
    productLockDays: 30,
  },
  PRO: {
    maxTrackedProducts: 50,
    sources: ['ML', 'ALIEXPRESS'] as const,
    countries: ['CO', 'MX', 'AR', 'CL', 'BR', 'PE'] as const,
    alertChannels: ['email', 'whatsapp'] as const,
    canSeeTrending: true,
    trendingByCategory: true,
    trendingAllLatam: false,
    canExportCSV: false,
    canSeeMargins: false,
    hasAds: false,
    productLockDays: 0,
  },
  COMERCIANTE: {
    maxTrackedProducts: Infinity,
    sources: ['ML', 'ALIEXPRESS'] as const,
    countries: ['CO', 'MX', 'AR', 'CL', 'BR', 'PE', 'ALL'] as const,
    alertChannels: ['email', 'whatsapp'] as const,
    canSeeTrending: true,
    trendingByCategory: true,
    trendingAllLatam: true,
    canExportCSV: true,
    canSeeMargins: true,
    hasAds: false,
    productLockDays: 0,
  },
} as const;
```

---

## 11. Convenciones de código

### TypeScript
- `strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`.
- Sin `any`. Sin `@ts-ignore` salvo justificación en comentario.
- Tipos compartidos backend ↔ frontend: paquete `packages/shared` o duplicación manual con script de sync (decidir en Fase 0).

### Backend
- **Controllers thin**: validan input (con `zod`), llaman service, mapean response. NO contienen lógica de negocio.
- **Services puros**: reciben dependencias por parámetros o DI. Testeables sin HTTP.
- **Repositories**: única capa que toca `prisma`. Facilita mocking.
- **Errores**: `AppError(code, statusCode, message, details?)`. Middleware global de error handler.
- Async/await siempre. Sin callbacks.

### Frontend
- **Features-first**, no carpetas por tipo. Una feature contiene sus components, hooks, types, tests.
- **TanStack Query** para todo lo que sea server state. Zustand SOLO para auth + UI ephemeral.
- Componentes pequeños, single responsibility.
- **Sin `any`. Sin `as Any`.**
- Tailwind classes ordenadas con plugin oficial Prettier.

### Tests
- **Unit**: services puros, utils, components React aislados.
- **Integration**: endpoints completos con DB de prueba (SQLite o MySQL test). Supertest.
- **E2E**: Playwright en v.1.5 (no bloquea MVP).
- Coverage objetivo: 70% líneas en services + utils (no perseguir 100%).

### Git
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Branch principal: `main`. Trabajo en `feat/*`, PR a `main` con CI verde.
- Pre-commit: ESLint + Prettier + typecheck via Husky + lint-staged.
- CI: lint + typecheck + tests + build en cada PR.

---

## 12. Orden de construcción v.1 (8-10 semanas full-time)

### Fase 0 — Setup (3-4 días)
- Repo + estructura completa
- TypeScript + ESLint + Prettier + Husky + lint-staged
- Prisma + schema completo (sección 5) + primera migration
- Pino + Sentry + config con `zod`
- Vitest + Supertest + factory de User
- GitHub Actions: lint + typecheck + test + build
- Deploy "hello world" a Hostinger Managed Node.js para validar setup
- Comprar dominio kairo.com.co + apuntar Cloudflare + SSL Hostinger
- DNS para Resend (SPF + DKIM + DMARC)

### Fase 1 — Auth + Users (5-7 días)
- Registro + verificación email
- Login + JWT httpOnly cookies + CSRF middleware
- Refresh rotation + logout
- Forgot/reset password
- Rate limit + account lockout
- Audit log básico
- Frontend: login, register, verify-email, forgot-password, reset-password screens
- Tests integration para flujos completos

### Fase 2 — ML integración + Búsqueda (5-7 días)
- ML OAuth flow (state + PKCE)
- `MLOAuthToken` con AES-256-GCM
- `tokenRefresh.job`
- `mercadolibre.service` con token por usuario
- App-only token para búsqueda pública
- `/api/search` con caché lru
- Frontend: Search page + ProductCard + SearchBar + filtros + grid

### Fase 3 — Tracking (4-5 días)
- `TrackedProduct` CRUD
- `ownership` middleware genérico
- Plan FREE lock por producto (30d)
- Frontend: Dashboard + add-tracking modal + lista

### Fase 4 — Polling + History (5-7 días)
- Tabla `Job` + worker in-proc + scheduler con `node-cron`
- `pricePoll.job` con dedup + throttling + priority
- `PriceHistory` model + writes
- `cleanup.job` con `PriceAggregate`
- `/api/tracking/:id/history`
- Frontend: ProductDetail con Recharts LineChart

### Fase 5 — Alertas + Email (5-7 días)
- `Alert` CRUD con modes/directions
- `AlertNotification` + idempotencia
- Resend integration + templates `react-email`
- Trigger en pricePoll → `checkAndFireAlerts`
- Job `alertRetry` para reintentos
- Frontend: AlertForm + lista de alertas + edición

### Fase 6 — Billing (7-10 días — el más complejo)
- MercadoPago SDK + Checkout Pro + preapproval
- `Subscription` state machine completa
- Webhook `/api/billing/webhook` con HMAC + idempotencia
- Upgrade/downgrade/cancel/reactivate handlers
- Plan limits runtime enforcement (incluye downgrade que desactiva productos extra)
- Frontend: Pricing page + Settings>Billing + flow de upgrade

### Fase 7 — WhatsApp (5-7 días — depende de aprobación Meta, hacer en paralelo a F8 si Meta demora)
- Templates aprobadas en Meta
- `whatsapp.service` con `libphonenumber-js`
- Opt-in flow + `WhatsAppOptIn` model
- Webhook GET (verify) + POST (firma + status callbacks + STOP handler)
- Integración en `checkAndFireAlerts`
- Frontend: Settings>WhatsApp opt-in flow

### Fase 8 — AliExpress + Trending (6-8 días)
- AE service con SHA256 + endpoints affiliate
- Búsqueda unificada ML + AE en `/api/search`
- ML trends + AE hotproduct
- `/api/trending` con plan check
- Frontend: Trending page + país/categoría filters + grid
- Aviso de affiliate links en footer

### Fase 9 — Pulido + Legal + Producción (5-7 días)
- Términos, privacidad, cookies en `/legal/*`
- Cookie banner mínimo
- Delete account flow real (soft delete + email + descarga de datos)
- Landing page final + pricing page final
- 404/500 pages, error boundary global, loading skeletons, empty states
- Smoke tests en staging
- Deploy a producción + monitoreo activo primera semana (Sentry alerts + Uptime Robot)
- `docs/runbook.md` con procedimientos de incidente

**Total v.1: 8-10 semanas full-time** (rango realista).

---

## 13. Comandos

### Setup local
```bash
# Backend
cd backend
cp .env.example .env       # completar valores
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev                # nodemon + ts-node, puerto 3000

# Frontend
cd frontend
npm install
npm run dev                # vite, puerto 5173
```

### Tests
```bash
cd backend && npm test                 # vitest
cd backend && npm run test:integration
cd frontend && npm test
```

### Lint & format
```bash
npm run lint
npm run format
npm run typecheck
```

### Build
```bash
cd frontend && npm run build           # dist/
cd backend && npm run build            # dist/
```

### Producción
```bash
cd backend
npx prisma migrate deploy
node dist/server.js                    # Passenger Hostinger lo hace por nosotros
```

### Deploy (script en `scripts/deploy.sh`)
```bash
./scripts/deploy.sh                    # ssh + git pull + npm ci + build + migrate + restart Passenger
```

---

## 14. Plan v.2 — Escalamiento y nuevas capacidades

> v.2 entra en planeación cuando v.1 esté en producción con tracción medible. **NO se construye en v.1.**

### Triggers de migración (no antes)
- >500 usuarios activos diarios
- >5000 productos rastreados
- CPU o RAM consistentemente >70% en Hostinger Business
- Retraso de polling >30 min vs schedule
- Necesidad validada de Amazon u otra integración nueva

### Infraestructura v.2
- **Migrar a VPS**: Hostinger VPS KVM 2+ (USD 7-15/mes) o Hetzner CX22 (€5/mes).
- Ubuntu 22.04 + Nginx + PM2 (cluster mode) + Redis 7 + MySQL 8 (o managed externo).
- `RedisCacheService` reemplaza `LruCacheService` (interfaces ya definidas en v.1).
- `BullMqJobQueue` reemplaza `MysqlJobQueue`; workers separados del API.
- MySQL replica de lectura cuando lo justifique el volumen.
- CDN imágenes en Cloudflare R2 o Bunny.
- Migración zero-downtime: deploy en VPS + DNS switch via Cloudflare + Business como fallback 1 semana.

### Observabilidad v.2
- Logtail/BetterStack paid o Grafana Loki self-hosted.
- Prometheus + Grafana (o Grafana Cloud).
- Sentry Performance o OpenTelemetry → Tempo.
- Status page pública.

### Nuevas integraciones v.2
- **Amazon Product Advertising API (PA-API 5.0)**: México + Brasil. Empezar aprobación Amazon Associates pronto.
- **eBay Affiliate Network**: cobertura global.
- **Shopee API**: Brasil + México.
- **Falabella/Linio**: web scraping con Playwright (consideración ToS) o aggregators.
- **Walmart Marketplace API**: México.

### Features de producto v.2
- **Predicción de precios con ML**: servicio Python (FastAPI) con regresión + estacionalidad. Feature exclusiva COMERCIANTE.
- **Alertas inteligentes**: "menor al promedio histórico", "mínimo histórico", "X días antes de Black Friday".
- **Comparador de variantes cross-marketplace**: mismo producto en ML/AE/Amazon + cálculo de margen + costo de importación.
- **API pública (B2B)**: REST + GraphQL para COMERCIANTE/Enterprise. API keys + quotas + Swagger/Mintlify.
- **Mobile app**: React Native (compartir código y types). Push notifications nativas.
- **Dashboard analytics avanzado** para COMERCIANTE: portfolio, márgenes, top movers, exports Excel/PDF programados.
- **Multi-idioma**: pt-BR + en.
- **Webhooks salientes**: COMERCIANTE recibe webhooks cuando se dispara alerta (Zapier/Make integration).
- **Equipos/workspaces (ENTERPRISE)**: múltiples users por cuenta, roles, auditoría por usuario.

### Nuevos planes v.2
- **ENTERPRISE** (nuevo, precio TBD): equipos + webhooks + soporte prioritario + SLA.
- PRO + alertas inteligentes.
- COMERCIANTE + Amazon + eBay + predicciones + comparador + API.

---

## 15. Acciones externas — checklist (paralelo al desarrollo)

| Acción | Tiempo | Estado | Bloqueante para |
|---|---|---|---|
| Comprar dominio kairo.com.co | 1h | ⏳ | Fase 0 (DNS, SSL, emails) |
| Configurar Cloudflare free | 1h | ⏳ | Fase 0 |
| Cuenta MercadoPago Business + credenciales | 1-3 días | ⏳ | Fase 6 |
| Cuenta Resend + verificar dominio (DNS) | 1-3 días | ⏳ | Fase 1 (welcome email), Fase 5 |
| Cuenta Sentry + Uptime Robot | 30 min | ⏳ | Fase 0 |
| ML OAuth (app registrada en developers.mercadolibre.com.co) | iniciado, respuesta mañana | ⏳ | Fase 2 |
| AliExpress Affiliate (aprobación) | días a 2 semanas, riesgo de rechazo | ⏳ | Fase 8 |
| Meta Business Verification | 1-3 semanas | ⏳ | Fase 7 |
| Templates WhatsApp aprobadas (3) | 1-7 días por template | ⏳ | Fase 7 |
| Cuenta Alegra/Siigo para DIAN | después de validar primeros pagos | 📋 | v.1.5 |

**Plan B AliExpress:** aggregators (Admitad, Awin). Si todo falla, fase 8 queda solo con ML trending y AE se mueve a v.2.

---

## 16. Identidad visual

Detalle completo en `kairo-design-brief.md`. Resumen:
- **Color principal:** Ámbar Kairo `#BA7517`
- **Crema:** `#FAEEDA` (CTAs texto, backgrounds claros)
- **Navy:** `#1a1a2e` (dark mode)
- **Tipografía:** Inter (400/500/600). Precios siempre `tabular-nums`.
- **Tagline:** "El momento exacto para comprar."
- **Personalidad:** datos primero, frases cortas, sin exclamaciones, sin emojis en textos formales.
- Modo oscuro nativo via `prefers-color-scheme`.

---

## 17. Riesgos conocidos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Meta tarda 4+ semanas en aprobar WhatsApp | Alto | Alto | Fase 7 puede correr en paralelo a F8; lanzar v.1 sin WA si demora demasiado (anunciar como "coming soon") |
| AliExpress Affiliate rechaza aplicación | Medio | Medio | Plan B: aggregators o quitar AE de v.1 |
| Hostinger Business no aguanta carga real >500 users | Medio | Alto | Migración v.2 a VPS ya diseñada (swap de bindings, no reescritura) |
| ML cambia política OAuth o rate limits | Medio | Alto | Service abstraído, backoff explícito, fallback a app-only token |
| MercadoPago webhook duplica eventos | Alto | Bajo | `WebhookEvent` con unique index + idempotency |
| Costos WhatsApp se disparan en PRO | Medio | Medio | Métricas custom + soft cap 100msg/mes/PRO + email avisando |
| Token OAuth ML expira sin renovar | Medio | Medio | `tokenRefresh.job` cada hora + alerta Sentry si falla |
| Polling no termina antes del siguiente ciclo | Bajo en v.1 | Alto | Dedup + priority + throttling. Migración a v.2 si pasa el threshold |
| Backup Hostinger no incluye MySQL o falla | Bajo | Crítico | Verificar + backup secundario semanal manual a S3/Backblaze + restore probado mensual |

---

## 18. Reglas de oro del proyecto

- Toda lógica de negocio crítica DEBE tener test.
- Toda función que toca dinero (precios, payments) DEBE usar `Decimal`, nunca `Float`.
- Toda query Prisma en un endpoint con `/:id` DEBE estar precedida del middleware `ownership` para evitar IDOR.
- Toda variable de entorno DEBE estar en `.env.example` y validada en `config/env.ts`.
- Toda integración externa DEBE tener retry + backoff y, en v.2, circuit breaker explícito.
- Sin `any` en TypeScript. Sin código comentado. Sin TODO sin fecha o issue asociado.
- Las interfaces `CacheService` y `JobQueue` existen para que la migración v.1 → v.2 sea swap de bindings. Mantener esa abstracción intacta.
- Si una decisión rompe algo en esta especificación, actualizar este archivo en el mismo PR que el cambio.
