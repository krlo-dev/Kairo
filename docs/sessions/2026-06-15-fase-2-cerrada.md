# Sesión 2026-06-15 — Fase 2 cerrada en código, retomamos mañana

## En qué quedamos al cierre

**Fase 2 (Mercado Libre + Búsqueda)** está completa en código y pusheada a `develop`. Faltó **validación end-to-end real** porque preferimos parar y retomar mañana.

### Última situación

- Carlos pegó `ML_APP_ID` + `ML_CLIENT_SECRET` en `backend/.env` local.
- AliExpress aprobó la aplicación con **Standard API activa** + Carlos aplicó a **Advanced API** y **SKU Dimension API** (en cola).
- **Falta** encontrar el `AE_TRACKING_ID` en el panel — no depende de Advanced API, está en otra sección del portal AE (Tools → Tracking ID Management). Carlos lo busca mañana.

### Estado git al cierre

```
develop @ b11a88e (origin/develop sincronizado)
  b11a88e feat(ml): frontend Fase 2 — Search page + ProductCard + Settings
  7dde2dd feat(ml): backend Fase 2 — OAuth flow + búsqueda + tokenRefresh job
  9ee19e5 chore(branding): añade icon 100x100 y 200x200 para AE Affiliates
  96a8b5b chore(branding): brand kit Kairo — logos SVG + PNG en docs/branding
  79c800a chore: gitignore para carpetas con capturas de paneles
  09a2db2 fix(auth): CSRF exempt list usa originalUrl + email rate limit
  45aca52 chore(setup): docker-compose + primera migration + guía paso a paso
  ...
```

- **main** está atrás (decidimos no operar ahí hasta versión estable).
- Working tree limpio.

---

## Lo que se construyó hoy (resumen)

### Backend Fase 2 (`7dde2dd`)

- `utils/httpClient.ts` — cliente HTTP con undici, retry exponencial + jitter, 4xx no retry (excepto 429), 5xx/network retry. Reutilizable.
- `services/mercadolibre/appToken.service.ts` — Client Credentials grant cacheado + coalescing concurrente + invalidate on-demand.
- `services/mercadolibre/oauth.service.ts` — Authorization Code + PKCE S256. State y verifier en cookie httpOnly corta. Tokens cifrados AES-256-GCM en DB.
- `services/mercadolibre/mercadolibre.service.ts` — clase `MercadoLibreService` con `searchItems()` y `getItem()`. Mapeo país→site_id (MCO/MLM/MLA/MLC/MLB/MPE/MLU/MLV). Cache lru 5min (búsqueda) y 3h (detalle). Si app-token 401 → invalida + reintenta.
- `services/search/types.ts` — `UnifiedProduct` compartido ML+AE.
- `jobs/tokenRefresh.job.ts` — node-cron horario (TZ America/Bogota). Refresca tokens que vencen en <30min. Errores no detienen batch.
- Rutas:
  - `GET /api/auth/ml/connect` (requireAuth)
  - `GET /api/auth/ml/callback` (requireAuth)
  - `DELETE /api/auth/ml` (requireAuth)
  - `GET /api/search?q=&country=&source=&minPrice=&maxPrice=&page=&limit=` (requireAuth)
- 22 tests nuevos: httpClient (5), appToken (3), oauth (5), mercadolibre.service (6), tokenRefresh (3).
- **Total backend: 69/69 tests verdes en ~3.5s.**

### Frontend Fase 2 (`b11a88e`)

- `lib/search.ts` — `searchProducts()` + tipos alineados al backend.
- `lib/ml.ts` — `startMlConnect()` (navegación `window.location`, NO XHR) + `disconnectMl()`.
- `hooks/useDebounce.ts` — debounce genérico (default 300ms).
- `components/ProductCard.tsx` — siguiendo brief (imagen 80x80, badge fuente, precio ámbar tabular-nums).
- `pages/Search.tsx` — SearchBar debounced, filtros país (limitados por plan: FREE solo CO, PRO/COMERCIANTE LATAM), precio min/max, paginación, skeleton/empty/error states.
- `pages/Settings.tsx` — card cuenta + integración ML (Conectar/Desconectar) + logout. Lee `?ml=connected` del query y muestra toast.
- Dashboard nav: links a Buscar, Ajustes, Salir.
- App.tsx: rutas `/search` y `/settings` bajo ProtectedRoute.

### Branding (`96a8b5b`, `9ee19e5`)

- `docs/branding/` con SVGs fuente + PNGs en muchos tamaños (incluye 100×100 light para AE Affiliates, 512 para ML).
- `frontend/public/` favicon.svg + favicon-32.png + icon-192.png + icon-512.png.
- `index.html` con apple-touch-icon + Open Graph tags.

---

## Decisiones tomadas hoy

| Decisión                                                                        | Razón                                                                                                       |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Mantener `KairoApp` como nombre de la app en ML                                 | `Kairo` solo estaba ocupado; el nombre técnico no importa para branding                                     |
| Permisos ML: solo "Usuarios" (Lectura y escritura), resto en "Sin acceso"       | Único endpoint que necesitamos de scopes user-based es `/users/me`. Para search/items usamos app-only token |
| Marcar `Client Credentials` además de Authorization Code + Refresh Token + PKCE | Es lo que permite el app-only token para búsqueda pública sin OAuth de usuario                              |
| Tópicos webhook ML: ninguno                                                     | Hacemos polling cada hora en Fase 4 — webhooks llegan en v.1.5 si reaccionamos a precios                    |
| Permisos AE: `Affiliates (individual)`                                          | Carlos arranca como persona natural; no procesamos órdenes, solo affiliate links                            |
| Aplicar a Advanced API + SKU Dimension API de AE                                | Advanced bloquea Fase 8 trending; SKU es v.1.5 pero la cola corre gratis                                    |
| MercadoPago: `Cuenta personal` recomendada                                      | No urge (Fase 6). Migrar a empresa cuando constituya SAS                                                    |
| Refresh token ML = opaco random + sha256 en DB                                  | Más simple que JWT, alineado con SPEC §9.3                                                                  |
| CSRF exempt list usando `req.originalUrl` (no `req.path`)                       | Bug fix de Fase 1: el middleware se monta con `/api` y `req.path` queda relativo                            |
| HTTP client en `utils/httpClient.ts` con undici                                 | Cliente HTTP nativo de Node 18+, sin deps, mejor throughput. Reusable para AE/MP/Resend                     |

---

## Lo PRIMERO al retomar mañana

### 1. Buscar `AE_TRACKING_ID` (5 min)

En el panel **AliExpress Portals** (portals.aliexpress.com), no en el de developer. Buscar:

- `Tools` → `Tracking ID Management` (o `Tracking ID Setting`)
- `Promotion` → `Generate Promotion Link` (a veces te pide crear un tracking al primer uso)
- `Account` → `Tracking IDs`

Crear uno (nombre sugerido: `kairo_web`) y pegarlo en `backend/.env` junto con `AE_APP_KEY` y `AE_APP_SECRET`:

```ini
AE_APP_KEY="..."
AE_APP_SECRET="..."
AE_TRACKING_ID="..."
```

Verificar:

```powershell
Select-String "^(ML_|AE_)" backend/.env
```

### 2. Validar Fase 2 end-to-end real

```powershell
# Verifica que MySQL esté arriba
docker compose ps                     # debe mostrar kairo-mysql Up healthy

# Si no, levantarlo
docker compose up -d

# Arranca backend (en una terminal)
npm run dev --workspace=backend       # puerto 3000

# Comprobar health
curl http://localhost:3000/api/health
# debe devolver { status: "ok", checks: { api: "ok", database: "ok" } }
```

Luego registrar/loguear un usuario y probar `/api/search?q=iphone&country=CO`:

```powershell
# 1) Registrar
$base = "http://localhost:3000/api"
$email = "test-$(Get-Date -Format yyyyMMddHHmmss)@kairo.test"
$pass  = "secret-1234"
Invoke-RestMethod -Uri "$base/auth/register" -Method Post -Body (@{email=$email; password=$pass; name="Test"} | ConvertTo-Json) -ContentType "application/json"

# 2) Sacar el verifyUrl del log del backend y pegarlo en navegador para verificar
#    (o llamar a verify-email con el token extraído)

# 3) Login con session
$r = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body (@{email=$email; password=$pass} | ConvertTo-Json) -ContentType "application/json" -SessionVariable s

# 4) Buscar
Invoke-RestMethod -Uri "$base/search?q=iphone&country=CO" -WebSession $s | ConvertTo-Json -Depth 4
```

Si devuelve productos: **Fase 2 backend validado end-to-end real** ✅. Sigue UI:

```powershell
# Frontend (otra terminal)
npm run dev --workspace=frontend      # puerto 5173
```

Abrir http://localhost:5173, login con el user de prueba, ir a /search y buscar "iphone" → debe mostrar grid de productos ML.

### 3. (opcional) Probar OAuth de usuario con tunnel HTTPS

El `redirect_uri` registrado en ML es `https://kairo.com.co/api/auth/ml/callback` y ML no acepta `http://localhost`. Para probar el botón "Conectar Mercado Libre" real:

- Instalar `cloudflared` (https://github.com/cloudflare/cloudflared/releases) o `ngrok`
- `cloudflared tunnel --url http://localhost:3000` → te da una URL `https://xxx.trycloudflare.com`
- Agregar esa URL como segundo redirect en el panel ML DevCenter
- Actualizar `ML_REDIRECT_URI` en `.env` a esa URL + `/api/auth/ml/callback`
- Reiniciar backend
- Click "Conectar Mercado Libre" en `/settings` → autorizar → debe redirigir a `?ml=connected`

Esto es **opcional** porque la búsqueda pública NO necesita OAuth de usuario; solo el tracking detallado de items privados lo necesita (eso es Fase 3+).

### 4. Empezar Fase 3 (Tracking)

Cuando Fase 2 esté validada, arrancamos Fase 3:

- `TrackedProduct` CRUD (POST/GET/DELETE)
- Middleware `ownership` genérico (validar que el recurso `/:id` es del user actual)
- Plan FREE: bloqueo de 30 días por producto (SPEC §10)
- Frontend: Dashboard con grid real de productos rastreados + modal "Agregar tracking" que llama a `getItem()` desde el search

---

## Pendientes que NO bloquean código

Estas son cosas tuyas (manuales), corren en paralelo:

| Pendiente                                                | Tiempo estimado                | Para qué fase              |
| -------------------------------------------------------- | ------------------------------ | -------------------------- |
| `AE_TRACKING_ID` (panel AE Portals)                      | 5 min                          | Fase 8                     |
| Aprobación AE Advanced API                               | 3-15 días                      | Fase 8 trending            |
| Aprobación AE SKU Dimension API                          | 3-15 días                      | v.1.5                      |
| Comprar dominio kairo.com.co                             | 30 min + propagación DNS       | Producción                 |
| Crear cuenta Resend + verificar dominio (SPF/DKIM/DMARC) | 1 hora                         | Producción (emails reales) |
| Aplicar a Meta Business + WhatsApp Cloud API             | Ahora (aprobación 2-3 semanas) | Fase 7                     |
| Crear cuenta Sentry, Uptime Robot, Cloudflare            | 15 min cada una                | Producción                 |
| Decidir MercadoPago (personal vs empresa)                | —                              | Fase 6                     |

Ver `docs/setup-local.md` §10 para la lista completa con instrucciones.

---

## Estado de tests al cierre

```
backend: 69/69 verde (~3.5s con DB conectada)
frontend: 2/2 verde
```

Comandos del día a día (referencia rápida):

```powershell
docker compose up -d                                # MySQL + Adminer
docker compose ps                                   # ver estado
npm run dev --workspace=backend                     # puerto 3000
npm run dev --workspace=frontend                    # puerto 5173
npm run typecheck                                   # ambos workspaces
npm run lint                                        # max-warnings 0
npm test --workspace=backend                        # vitest
npm run build                                       # producción
npx --workspace=backend prisma studio              # UI DB localhost:5555
```

---

## Cómo retomar exactamente

Al abrir Cursor/VSCode mañana:

1. **Pull por si hay cambios remotos** (no debería pero por hábito):
   ```powershell
   git pull origin develop
   ```
2. **Levantar Docker** (no persiste al reiniciar Windows):
   ```powershell
   docker compose up -d
   ```
3. **Verificar `.env` tiene todos los secrets**:
   ```powershell
   Select-String "^(ML_|AE_)" backend/.env
   ```
   Debe mostrar 6 líneas con valores no vacíos. Si `AE_TRACKING_ID=""`, ir a buscarlo al panel AE Portals primero.
4. **Decirle a Claude**: "vamos a validar Fase 2" o "arranquemos Fase 3" — Claude lee este doc + la memoria del proyecto y sabe exactamente dónde retomar.

---

🟢 **Día productivo. Buenas noches.**
