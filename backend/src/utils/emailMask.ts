// Enmascara emails para logs: carlos@gmail.com -> c***@gmail.com

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.charAt(0);
  return `${head}***${domain}`;
}
