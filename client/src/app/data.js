import { api } from '../api/client.js';
import { loader } from '../ui/loader.js';

const SHOWROOM_FALLBACK_COUNT = 3;

/** Textos editables (desde la BD) sobre los elementos con `data-content`. */
export function applyContent(content) {
  document.querySelectorAll('[data-content]').forEach((el) => {
    const value = content[el.dataset.content];
    if (value !== undefined) el.textContent = value;
  });
  document.title = `${content.brand_name ?? ''} · ${content.collection_name ?? ''}`;
}

export async function loadData() {
  loader.progress(0.1, 'Conectando…');
  const [products, content, categories] = await Promise.all([api.getProducts(), api.getContent(), api.getCategories()]);
  await Promise.all([document.fonts.load('200px Anton'), document.fonts.load('16px "Space Mono"'), document.fonts.load('16px Inter')]);
  return { products, content, categories };
}

/** Qué se ve en el showroom 3D: prendas destacadas, texto del friso y percheros (todo desde la BD). */
export function pickShowroomContent(products, content) {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const featured = products.filter((p) => p.featured);
  return {
    showroomProducts: featured.length ? featured : products.slice(0, SHOWROOM_FALLBACK_COUNT),
    friezeText: `${content.brand_name ?? ''} · ${content.frieze_text ?? ''} · `.toUpperCase(),
    rackProducts: (content.home_rack ?? '')
      .split(',')
      .map((slug) => bySlug.get(slug.trim()))
      .filter(Boolean),
  };
}
