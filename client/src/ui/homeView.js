import gsap from 'gsap';
import { $, prefersReducedMotion } from './dom.js';
import { escapeHtml, formatMoney } from './format.js';

/**
 * Inicio debajo del showroom 3D: banners editoriales por línea, filtros por categoría
 * y la grilla de toda la colección. Todo el contenido (productos, categorías, textos) viene de la API.
 */
export function createHomeView({ products, categories, content, onOpen, scrollTo, onFilterChange = () => {} }) {
  const els = {
    root: $('home'),
    editorial: $('editorial'),
    filters: $('filters'),
    grid: $('product-grid'),
    catalog: $('catalog'),
  };
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));
  let activeFilter = 'all';

  /** Un banner por línea, con la foto lifestyle de su primera prenda. */
  function renderEditorial() {
    // La línea del showroom va primero: el recorrido 3D desemboca en ella.
    const isFeatured = (c) => products.some((p) => p.category === c.slug && p.featured);
    const lines = [...categories]
      .sort((a, b) => isFeatured(b) - isFeatured(a))
      .map((c) => ({ category: c, product: products.find((p) => p.category === c.slug && p.images.lifestyle) }))
      .filter((line) => line.product);
    els.editorial.innerHTML = lines
      .map(({ category, product }) => {
        const title = content[`editorial_${category.slug}_title`] ?? category.name;
        const text = content[`editorial_${category.slug}_text`] ?? category.description;
        return `<button type="button" class="editorial__tile" data-filter="${escapeHtml(category.slug)}">
          <img src="${escapeHtml(product.images.lifestyle.url)}" alt="${escapeHtml(product.images.lifestyle.alt)}" loading="lazy" />
          <span class="editorial__text">
            <span class="eyebrow">${escapeHtml(category.name)}</span>
            <span class="editorial__title">${escapeHtml(title)}</span>
            <span class="editorial__desc">${escapeHtml(text)}</span>
            <span class="editorial__cta">${escapeHtml(content.editorial_cta ?? '')} →</span>
          </span>
        </button>`;
      })
      .join('');
  }

  function renderFilters() {
    const options = [{ slug: 'all', name: content.filter_all ?? 'Todo' }, ...categories];
    els.filters.innerHTML = options
      .map(
        (c) => `<button type="button" class="filter" data-filter="${escapeHtml(c.slug)}" aria-pressed="${c.slug === activeFilter}">
          ${escapeHtml(c.name)}<span>${c.slug === 'all' ? products.length : products.filter((p) => p.category === c.slug).length}</span>
        </button>`,
      )
      .join('');
  }

  function cardTemplate(p) {
    const life = p.images.lifestyle;
    return `<article class="card" data-category="${escapeHtml(p.category ?? '')}" style="--accent:${escapeHtml(p.colors.accent)}">
      <button type="button" class="card__media" data-open="${escapeHtml(p.slug)}" aria-label="Ver ${escapeHtml(p.name)} en 3D">
        <img class="card__front" src="${escapeHtml(p.images.front.url)}" alt="${escapeHtml(p.images.front.alt)}" loading="lazy" />
        ${life ? `<img class="card__life" src="${escapeHtml(life.url)}" alt="" loading="lazy" />` : ''}
        <span class="card__shine" aria-hidden="true"></span>
        <span class="card__badge">${escapeHtml(categoryName.get(p.category) ?? '')}</span>
      </button>
      <div class="card__info">
        <div>
          <h3 class="card__name">${escapeHtml(p.name)}</h3>
          <p class="card__tagline">${escapeHtml(p.tagline)}</p>
        </div>
        <p class="card__price">${formatMoney(p.priceCents, p.currency)}</p>
      </div>
      <button type="button" class="card__cta" data-open="${escapeHtml(p.slug)}">${escapeHtml(content.card_cta ?? '')} <span aria-hidden="true">→</span></button>
    </article>`;
  }

  function renderGrid() {
    const visible = products.filter((p) => activeFilter === 'all' || p.category === activeFilter);
    els.grid.innerHTML = visible.length
      ? visible.map(cardTemplate).join('')
      : `<p class="grid__empty">No hay prendas en esta categoría por ahora.</p>`;
    if (!prefersReducedMotion()) {
      gsap.fromTo(els.grid.children, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out' });
    }
  }

  function setFilter(slug, { scroll = false } = {}) {
    activeFilter = slug;
    els.filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === slug)));
    renderGrid();
    onFilterChange(slug);
    if (scroll) scrollTo(els.catalog);
  }

  els.filters.addEventListener('click', (e) => {
    const button = e.target.closest('[data-filter]');
    if (button) setFilter(button.dataset.filter);
  });
  els.editorial.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-filter]');
    if (tile) setFilter(tile.dataset.filter, { scroll: true });
  });
  els.grid.addEventListener('click', (e) => {
    const target = e.target.closest('[data-open]');
    if (target) onOpen(target.dataset.open);
  });

  // Aparición en 3D al entrar en pantalla: el bloque se levanta desde un plano inclinado.
  const reveal = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry, i) => {
          reveal.unobserve(entry.target);
          if (prefersReducedMotion()) return;
          gsap.fromTo(
            entry.target,
            { autoAlpha: 0, y: 90, rotationX: -22, scale: 0.94, transformPerspective: 1400, transformOrigin: '50% 100%' },
            { autoAlpha: 1, y: 0, rotationX: 0, scale: 1, duration: 1.3, delay: i * 0.14, ease: 'expo.out', clearProps: 'transform' },
          );
        });
    },
    { threshold: 0.12 },
  );

  renderEditorial();
  renderFilters();
  renderGrid();
  els.editorial.querySelectorAll('.editorial__tile').forEach((tile) => reveal.observe(tile));
  reveal.observe(els.catalog.querySelector('.catalog__head'));

  return {
    show() {
      els.root.hidden = false;
    },
    hide() {
      els.root.hidden = true;
    },
    catalogElement: els.catalog,
    /** Lleva a la colección filtrada por una línea (desde el menú). */
    filterTo: (slug) => setFilter(slug, { scroll: true }),
  };
}
