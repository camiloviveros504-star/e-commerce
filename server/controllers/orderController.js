export function createOrderController(orderService) {
  return {
    create(req, res) {
      res.status(201).json({ data: orderService.createOrder(req.body) });
    },
    getByNumber(req, res) {
      res.json({ data: orderService.getOrder(req.params.orderNumber) });
    },
  };
}
