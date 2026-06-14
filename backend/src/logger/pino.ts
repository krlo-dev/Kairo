import pino from 'pino';
import { env, isDevelopment } from '../config/env.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.newPassword',
  'req.body.token',
  'password',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'tokenHash',
  'authorization',
  '*.password',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  base: {
    service: 'kairo-api',
    env: env.NODE_ENV,
  },
});

export type Logger = typeof logger;
