import { AppError } from '../errors.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'El cuerpo de la petición no es JSON válido' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'La petición es demasiado grande' } });
  }
  console.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack }));
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado' } });
}
