import { z } from 'zod';

export const MAX_QUANTITY_PER_LINE = 10;
export const MAX_PERSONALIZATION_LENGTH = 12;

export const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  size: z.string().trim().min(1).max(8),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
  personalization: z
    .string()
    .trim()
    .max(MAX_PERSONALIZATION_LENGTH)
    .regex(/^[\p{L}\p{N} ]*$/u, 'Solo letras, números y espacios')
    .optional()
    .default(''),
});

export const orderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2, 'Escribe tu nombre').max(80),
    email: z.string().trim().toLowerCase().email('Correo no válido').max(120),
  }),
  items: z.array(orderItemSchema).min(1, 'El carrito está vacío').max(20),
});

/** Convierte errores de Zod al formato de detalles de la API. */
export function formatZodIssues(error) {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}
