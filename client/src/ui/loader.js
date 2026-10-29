import gsap from 'gsap';
import { $ } from './dom.js';

const READY_DELAY_MS = 450;
const FRAME_FALLBACK_MS = 60;

/** Cede un fotograma para que la barra de carga se pinte; con la pestaña oculta (sin rAF) sigue igual. */
export const nextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
    setTimeout(resolve, FRAME_FALLBACK_MS);
  });

/** Pantalla de carga: barra de progreso, errores con reintento y salida. */
export const loader = {
  progress(value, label) {
    gsap.to('#loader-bar', { scaleX: value, duration: 0.4, ease: 'power2.out' });
    if (label) $('loader-status').textContent = label;
  },
  fail(message, onRetry) {
    $('loader-status').textContent = message;
    const retry = $('loader-retry');
    retry.hidden = false;
    retry.onclick = () => {
      retry.hidden = true;
      onRetry();
    };
  },
  /** Entrada directa: al terminar de cargar se pasa sola al showroom (sin pedir clic ni sonido). */
  ready() {
    $('loader-status').textContent = '';
    return new Promise((resolve) => setTimeout(resolve, READY_DELAY_MS));
  },
  hide() {
    return gsap.to('#loader', { autoAlpha: 0, duration: 1, ease: 'power2.inOut' });
  },
};
