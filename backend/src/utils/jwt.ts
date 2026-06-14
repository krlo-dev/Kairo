import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Plan } from '@prisma/client';
import { env } from '../config/env.js';
import { Errors } from './errors.js';

export interface AccessTokenPayload {
  sub: string;
  plan: Plan;
}

const accessOpts: SignOptions = {
  expiresIn: env.JWT_ACCESS_TTL as NonNullable<SignOptions['expiresIn']>,
  issuer: 'kairo',
  audience: 'kairo-web',
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, accessOpts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'kairo',
      audience: 'kairo-web',
    });
    if (typeof decoded === 'string') throw Errors.unauthorized('Token inválido');
    return decoded as AccessTokenPayload;
  } catch {
    throw Errors.unauthorized('Sesión inválida o expirada');
  }
}
