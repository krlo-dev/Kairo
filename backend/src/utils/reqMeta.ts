import type { Request } from 'express';
import type { RequestMeta } from '../services/auth/types.js';

export function reqMeta(req: Request): RequestMeta {
  const ip = typeof req.ip === 'string' ? req.ip : undefined;
  const ua = req.header('user-agent');
  const out: RequestMeta = {};
  if (ip !== undefined) out.ip = ip;
  if (ua !== undefined) out.userAgent = ua;
  return out;
}
