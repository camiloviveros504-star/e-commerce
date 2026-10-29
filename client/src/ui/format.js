const formatters = new Map();

/** Monedas que se muestran sin decimales (en Colombia los precios van en pesos enteros: $ 760.000). */
const NO_DECIMALS = new Set(['COP', 'CLP']);

export function formatMoney(cents, currency = 'COP') {
  if (!formatters.has(currency)) {
    const digits = NO_DECIMALS.has(currency) ? 0 : 2;
    formatters.set(
      currency,
      new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }),
    );
  }
  return formatters.get(currency).format(cents / 100);
}

/** Escapa texto antes de insertarlo como HTML. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
