/** Cliente de la API: desenvuelve { data } y convierte { error } en excepciones con código. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No hay conexión con el servidor.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body.error ?? {};
    throw new ApiError(response.status, error.code ?? 'UNKNOWN', error.message ?? 'Error inesperado', error.details);
  }
  return body.data;
}

export const api = {
  getProducts: () => request('/products'),
  getContent: () => request('/content'),
  getCategories: () => request('/categories'),
  createOrder: (order) => request('/orders', { method: 'POST', body: JSON.stringify(order) }),
};
