// Templates HTML simples con escape manual (ver escapeHtml). Se evaluó
// migrar a react-email en Fase 5, pero el backend no tenía tooling de JSX
// (no hay React ni configuración .tsx) y meterlo solo para esto era más
// riesgo/infra que valor — este patrón ya escapa correctamente y está
// probado, así que Fase 5 (alertas) lo extiende en vez de reemplazarlo.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Wrapped {
  subject: string;
  html: string;
  text: string;
}

function wrap(title: string, bodyHtml: string, bodyText: string): Wrapped {
  return {
    subject: title,
    html: `<!doctype html>
<html lang="es">
  <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 24px auto; color: #1a1a1a;">
    <h1 style="font-size: 20px;">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
    <p style="font-size: 12px; color: #888;">Kairo — el momento exacto para comprar. Si no esperabas este email, ignóralo.</p>
  </body>
</html>`,
    text: `${title}\n\n${bodyText}\n\n— Kairo`,
  };
}

export function verifyEmailTemplate(name: string, verifyUrl: string): Wrapped {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verifyUrl);
  return wrap(
    'Confirma tu email en Kairo',
    `<p>Hola ${safeName},</p>
     <p>Bienvenido a Kairo. Confirma tu email para activar tu cuenta:</p>
     <p><a href="${safeUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px;">Confirmar email</a></p>
     <p style="color: #666; font-size: 14px;">Este enlace caduca en 24 horas.</p>`,
    `Hola ${name},\n\nConfirma tu email abriendo este enlace:\n${verifyUrl}\n\nEste enlace caduca en 24 horas.`,
  );
}

export function passwordResetTemplate(name: string, resetUrl: string): Wrapped {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);
  return wrap(
    'Restablece tu contraseña en Kairo',
    `<p>Hola ${safeName},</p>
     <p>Recibimos una solicitud para restablecer tu contraseña. Si no fuiste tú, ignora este email.</p>
     <p><a href="${safeUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px;">Crear nueva contraseña</a></p>
     <p style="color: #666; font-size: 14px;">Este enlace caduca en 1 hora.</p>`,
    `Hola ${name},\n\nRestablece tu contraseña abriendo este enlace:\n${resetUrl}\n\nSi no fuiste tú, ignora este email. El enlace caduca en 1 hora.`,
  );
}

export function accountLockedTemplate(name: string, unlockAt: Date): Wrapped {
  const safeName = escapeHtml(name);
  const when = unlockAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const safeWhen = escapeHtml(when);
  return wrap(
    'Tu cuenta de Kairo está temporalmente bloqueada',
    `<p>Hola ${safeName},</p>
     <p>Detectamos 5 intentos de inicio de sesión fallidos. Por seguridad, tu cuenta queda bloqueada hasta <strong>${safeWhen}</strong> (hora de Colombia).</p>
     <p>Si no fuiste tú, te recomendamos cambiar tu contraseña en cuanto la cuenta se desbloquee.</p>`,
    `Hola ${name},\n\nDetectamos 5 intentos fallidos de inicio de sesión. Tu cuenta queda bloqueada hasta ${when} (hora de Colombia).\n\nSi no fuiste tú, cambia tu contraseña al desbloquearse.`,
  );
}

const CURRENCY_LOCALE: Record<string, string> = {
  COP: 'es-CO',
  USD: 'en-US',
  MXN: 'es-MX',
  ARS: 'es-AR',
  CLP: 'es-CL',
  BRL: 'pt-BR',
  PEN: 'es-PE',
};

function formatMoney(amount: number, currency: string): string {
  const locale = CURRENCY_LOCALE[currency] ?? 'es-CO';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function alertTriggeredTemplate(
  name: string,
  productTitle: string,
  productUrl: string,
  price: number,
  currency: string,
  targetPrice: number | null,
): Wrapped {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(productTitle);
  const safeUrl = escapeHtml(productUrl);
  const priceLabel = formatMoney(price, currency);
  const targetLabel = targetPrice !== null ? formatMoney(targetPrice, currency) : null;

  return wrap(
    `Alerta de precio: ${productTitle}`,
    `<p>Hola ${safeName},</p>
     <p>Tu alerta se cumplió. El precio de <strong>${safeTitle}</strong> ahora está en <strong>${priceLabel}</strong>${
       targetLabel ? `, dentro de tu objetivo de ${targetLabel}` : ''
     }.</p>
     <p><a href="${safeUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px;">Ver producto</a></p>
     <p style="color: #666; font-size: 14px;">Puedes administrar tus alertas desde tu dashboard de Kairo.</p>`,
    `Hola ${name},\n\nEl precio de ${productTitle} ahora está en ${priceLabel}${
      targetLabel ? `, dentro de tu objetivo de ${targetLabel}` : ''
    }.\n\nVerlo aquí: ${productUrl}`,
  );
}

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  COMERCIANTE: 'Comerciante',
};

export function planDowngradedTemplate(name: string, fromPlan: string): Wrapped {
  const safeName = escapeHtml(name);
  const fromLabel = PLAN_LABEL[fromPlan] ?? fromPlan;
  return wrap(
    'Tu plan de Kairo cambió a Free',
    `<p>Hola ${safeName},</p>
     <p>Tu suscripción al plan <strong>${escapeHtml(fromLabel)}</strong> terminó y tu cuenta pasó al plan Free.</p>
     <p>Si rastreabas más de 3 productos, dejamos activos los 3 más recientes; el resto quedó pausado (no perdiste su historial, solo se dejó de actualizar).</p>
     <p style="color: #666; font-size: 14px;">Puedes volver a subir de plan cuando quieras desde tu cuenta.</p>`,
    `Hola ${name},\n\nTu suscripción al plan ${fromLabel} terminó y tu cuenta pasó al plan Free. Si rastreabas más de 3 productos, dejamos activos los 3 más recientes.\n\nPuedes volver a subir de plan cuando quieras.`,
  );
}
