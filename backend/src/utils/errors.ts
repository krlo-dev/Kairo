export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export const Errors = {
  unauthorized: (msg = 'No autorizado') => new AppError('unauthorized', 401, msg),
  forbidden: (msg = 'Acceso denegado') => new AppError('forbidden', 403, msg),
  notFound: (msg = 'Recurso no encontrado') => new AppError('not_found', 404, msg),
  conflict: (msg = 'Conflicto con el estado actual') => new AppError('conflict', 409, msg),
  validation: (msg = 'Datos inválidos', details?: Record<string, unknown>) =>
    new AppError('validation_error', 422, msg, details),
  rateLimited: (msg = 'Demasiadas solicitudes') => new AppError('rate_limited', 429, msg),
  internal: (msg = 'Error interno del servidor') => new AppError('internal_error', 500, msg),
};
