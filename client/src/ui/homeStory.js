import { escapeHtml, formatMoney } from './format.js';

/**
 * Paneles editoriales que acompañan la coreografía 3D del inicio: uno por prenda destacada.
 * Al cambiar de prenda, el panel saliente gira hacia arriba y el entrante llega desde abajo (3D).
 */
export function createHomeStory({ products, categories, content, onOpen }) {
  const root = document.getElementById('home-story');
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  root.innerHTML = `
    ${products
      .map(
        (p, i) => `<article class="story-panel" data-index="${i}" inert>
          <p class="eyebrow">${escapeHtml(categoryName.get(p.category) ?? '')}</p>
          <h2 class="story-panel__name">${escapeHtml(p.name)}</h2>
          <p class="story-panel__tagline">${escapeHtml(p.tagline)}</p>
          <p class="story-panel__desc">${escapeHtml(p.description)}</p>
          <div class="story-panel__foot">
            <span class="story-panel__price">${formatMoney(p.priceCents, p.currency)}</span>
            <button type="button" class="btn btn--outline btn--sm" data-open="${escapeHtml(p.slug)}">${escapeHtml(content.card_cta ?? '')} <span aria-hidden="true">→</span></button>
          </div>
        </article>`,
      )
      .join('')}
    <div class="story-rail" aria-hidden="true">${products.map(() => '<span></span>').join('')}</div>`;

  const panels = [...root.querySelectorAll('.story-panel')];
  const ticks = [...root.querySelectorAll('.story-rail span')];
  root.addEventListener('click', (e) => {
    const button = e.target.closest('[data-open]');
    if (button) onOpen(button.dataset.open);
  });

  let active = -2;
  return {
    /** @param focus índice de la prenda en foco (-1 = ninguna). */
    update(focus) {
      if (focus === active) return;
      active = focus;
      root.classList.toggle('is-visible', focus >= 0);
      panels.forEach((panel, i) => {
        panel.classList.toggle('is-active', i === focus);
        panel.classList.toggle('is-past', focus >= 0 && i < focus);
        panel.inert = i !== focus;
      });
      ticks.forEach((tick, i) => tick.classList.toggle('is-on', i <= focus));
    },
  };
}
