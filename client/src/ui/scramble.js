import { prefersReducedMotion } from './dom.js';

const GLYPHS = '▓▒░<>/\\_-=+*#%&@01OBSIDNA';

/** Efecto "glitch": el texto aparece descifrándose carácter por carácter. */
export function scrambleText(element, text, { duration = 900 } = {}) {
  element._scrambleId = (element._scrambleId ?? 0) + 1;
  const id = element._scrambleId;
  if (prefersReducedMotion() || !text) {
    element.textContent = text;
    return;
  }
  const start = performance.now();
  const frame = (now) => {
    if (element._scrambleId !== id) return;
    const progress = Math.min((now - start) / duration, 1);
    const revealed = Math.floor(progress * text.length);
    let out = text.slice(0, revealed);
    for (let i = revealed; i < text.length; i++) {
      out += text[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
    element.textContent = out;
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
