import { notFound } from '../errors.js';

/** Convierte la fila de BD (snake_case) al contrato público de la API (camelCase). */
export function toProductDto(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    theme: row.theme,
    colors: { base: row.base_color, stripe: row.stripe_color, trim: row.trim_color, accent: row.accent_color },
    stripeLayout: row.stripe_layout,
    category: row.category_slug,
    featured: Boolean(row.featured),
    features: row.features,
    sizes: row.sizes.map((s) => ({ label: s.label, inStock: s.stock > 0 })),
    // Fotos indexadas por tipo: { front, back, detail, lifestyle } → { url, alt, width, height }
    images: Object.fromEntries((row.images ?? []).map(({ kind, ...image }) => [kind, image])),
  };
}

export function createCatalogService({ productRepository, contentRepository }) {
  return {
    listProducts() {
      return productRepository.listActive().map(toProductDto);
    },
    getProduct(slug) {
      const row = productRepository.findBySlug(slug);
      if (!row) throw notFound('Producto no encontrado');
      return toProductDto(row);
    },
    listCategories() {
      return productRepository.listCategories();
    },
    getContent() {
      return contentRepository.getAll();
    },
  };
}
