export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = 'Recurso no encontrado') => new AppError(404, 'NOT_FOUND', message);
export const validationError = (details, message = 'Los datos enviados no son válidos') =>
  new AppError(422, 'VALIDATION_ERROR', message, details);
export const conflict = (message, details) => new AppError(409, 'CONFLICT', message, details);
