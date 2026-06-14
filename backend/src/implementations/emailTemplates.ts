// Templates HTML simples para Fase 1. Usamos plain strings con escape manual
// — en Fase 5 (alertas) se migra a react-email cuando llegue el setup
// completo de templates.

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
