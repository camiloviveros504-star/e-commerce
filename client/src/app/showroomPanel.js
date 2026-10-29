import { $ } from '../ui/dom.js';
import { escapeHtml, formatMoney } from '../ui/format.js';
import { INTERACTIVE_VH } from './constants.js';

const chipTemplate = (p) => `<button type="button" class="chip" data-slug="${escapeHtml(p.slug)}" style="--ring:${p.colors.accent}">
  <img src="${escapeHtml(p.images.front.url)}" alt="" width="28" height="34" loading="lazy" /><span>${escapeHtml(p.name)}</span></button>`;

/** Etiqueta flotante sobre la prenda señalada y selector de prendas (chips) del showroom. */
export function createShowroomPanel({ engine, rig, showroom, showroomProducts, lenis, state, sound, onOpen }) {
  const hoverLabel = $('hover-label');
  const showroomUi = $('showroom-ui');
  const chips = $('product-chips');

  const hideLabel = () => hoverLabel.classList.remove('is-visible');

  showroom.onHover((product) => {
    state.hoveredSlug = product?.slug ?? null;
    hoverLabel.classList.toggle('is-visible', Boolean(product));
    showroomUi.classList.toggle('is-hovering', Boolean(product));
    // En vertical la cámara se desplaza hasta la prenda seleccionada.
    const pose = showroom.basePose();
    const atTop = state.current === null && !state.transitioning && lenis.scroll < window.innerHeight * INTERACTIVE_VH;
    if (atTop && pose.portrait) {
      rig.desiredPos.copy(pose.pos);
      rig.desiredTarget.copy(pose.target);
    }
    chips.querySelectorAll('[data-slug]').forEach((chip) => chip.classList.toggle('is-active', chip.dataset.slug === state.hoveredSlug));
    if (product) {
      $('hover-name').textContent = product.name;
      $('hover-price').textContent = formatMoney(product.priceCents, product.currency);
      sound.blip();
    }
  });
  engine.onTick(() => {
    if (!state.hoveredSlug) return;
    const p = showroom.labelPosition(state.hoveredSlug);
    if (p) hoverLabel.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
  });

  chips.innerHTML = showroomProducts.map(chipTemplate).join('');
  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-slug]');
    if (chip) onOpen(chip.dataset.slug);
  });
  const hoverChip = (e) => {
    const chip = e.target.closest('[data-slug]');
    if (chip && state.current === null) showroom.setHovered(showroomProducts.findIndex((p) => p.slug === chip.dataset.slug));
  };
  chips.addEventListener('pointerover', hoverChip);
  chips.addEventListener('focusin', hoverChip);
  showroom.onSelect((product) => onOpen(product.slug));

  return { hideLabel };
}
