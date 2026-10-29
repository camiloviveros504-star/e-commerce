/** Atajo para buscar un elemento por id. */
export const $ = (id) => document.getElementById(id);

/** El usuario pidió reducir el movimiento (se consulta en cada llamada: puede cambiar en caliente). */
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
