export function createCatalogController(catalogService) {
  return {
    listProducts(_req, res) {
      const products = catalogService.listProducts();
      res.json({ data: products, meta: { count: products.length } });
    },
    getProduct(req, res) {
      res.json({ data: catalogService.getProduct(req.params.slug) });
    },
    listCategories(_req, res) {
      res.json({ data: catalogService.listCategories() });
    },
    getContent(_req, res) {
      res.json({ data: catalogService.getContent() });
    },
  };
}
