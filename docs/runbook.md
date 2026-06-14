# Runbook — Incidentes

## API caída (5xx persistente)

1. Verificar Uptime Robot — ¿falla intermitente o total?
2. SSH a Hostinger → `tail -f logs/combined.log` o panel de logs Managed Node.js.
3. Verificar Sentry — ¿hay error nuevo?
4. Verificar MySQL accesible: `mysql -h <host> -u <user> -p kairo -e "SELECT 1"`
5. Reiniciar Passenger: panel Hostinger → Managed Node.js → Restart.
6. Si persiste: rollback al commit anterior (ver `deployment.md` § Rollback).

## DB pool exhausted

1. Sentry mostrará errores `P1001` o `connection limit exceeded`.
2. Verificar `MAX_CONNECTIONS` del plan Hostinger MySQL.
3. Verificar leaks en código (transacciones sin commit, `prisma` instanciado múltiple).
4. Mitigación inmediata: restart Passenger.
5. Fix: reducir `connection_limit` en `DATABASE_URL` query string.

## Polling no ejecuta

1. Verificar logs: `[scheduler]` debe loguear cada hora.
2. Verificar tabla `Job` — ¿hay jobs `RUNNING` viejos sin terminar?
3. Cleanup manual: `UPDATE Job SET status='FAILED' WHERE status='RUNNING' AND startedAt < NOW() - INTERVAL 1 HOUR;`
4. Reiniciar Passenger.

## ML OAuth tokens expirados masivos

1. Verificar `tokenRefresh.job` corre cada hora en logs.
2. Si falló: `SELECT COUNT(*) FROM MLOAuthToken WHERE expiresAt < NOW()`.
3. Ejecutar job manual via endpoint admin (TODO Fase 2) o script Node.
4. Usuarios afectados: enviar email "reconectá tu cuenta ML".

## Webhook MercadoPago no procesa pagos

1. Verificar Sentry — ¿error en verificación de firma?
2. Verificar `WebhookEvent` tabla — ¿llegan eventos pero no se procesan?
3. Verificar `MP_WEBHOOK_SECRET` correcto.
4. Reproducir desde panel MP: "Reenviar notificaciones".

## WhatsApp no envía alertas

1. Verificar logs `[whatsapp]`.
2. Verificar token Meta no caducó (renovación cada 60 días si es System User token).
3. Verificar templates aún aprobadas en panel Meta Business.
4. Verificar opt-in del user vigente (no revocado).
5. Verificar saldo / método de pago en Meta Business.

## Backup falla

1. Verificar daily backup en panel Hostinger.
2. Si Hostinger backup no está disponible: ejecutar manual `mysqldump`.
3. Subir a S3/Backblaze manualmente.
4. Crear issue: automatizar `scripts/backup.sh`.

## Spike de tráfico inesperado

1. Cloudflare Analytics: ¿es tráfico real o bot?
2. Activar "Under Attack Mode" en Cloudflare si es bot.
3. Si es real: anticipar migración v.2 (VPS) — ver triggers en `architecture.md`.

## Contactos de emergencia

- Hostinger Support: panel chat 24/7
- MercadoPago dev support: developers.mercadopago.com
- Meta Business support: business.facebook.com → Ayuda
- Cloudflare community: community.cloudflare.com
