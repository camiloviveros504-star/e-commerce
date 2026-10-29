import gsap from 'gsap';
import { cartCount, cartSubtotal, lineKey, linePrice } from '../state/cart.js';
import { buildOrderMessage, whatsappUrl } from '../state/whatsapp.js';
import { escapeHtml, formatMoney } from './format.js';

const $ = (id) => document.getElementById(id);
const WHATSAPP_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';

/** Panel lateral del carrito: lista de prendas y compra por WhatsApp con un mensaje con todos los datos. */
export function createCartDrawer({ store, productsById, content, categories = [] }) {
  const drawer = $('cart-drawer');
  const backdrop = $('drawer-backdrop');
  const body = $('cart-body');
  const toggle = $('cart-toggle');
  const countBadge = $('cart-count');
  const currency = content.currency ?? 'COP';
  const categoryNames = new Map(categories.map((c) => [c.slug, c.name]));
  let isOpen = false;
  let sent = false; // ya se abrió WhatsApp con el pedido
  let customerName = '';
  let lastFocus = null;
  // GSAP controla la transformación (reemplaza el translateX del CSS usado antes de que cargue el JS).
  gsap.set(drawer, { x: 0, xPercent: 100 });

  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
    document.body.classList.add('drawer-open');
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.to(drawer, { xPercent: 0, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
    gsap.from(body.children, { y: 16, opacity: 0, stagger: 0.04, duration: 0.35, delay: 0.12, ease: 'power2.out' });
    $('cart-close').focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
    gsap.to(backdrop, { opacity: 0, duration: 0.25, onComplete: () => (backdrop.hidden = true) });
    gsap.to(drawer, {
      xPercent: 100,
      duration: 0.35,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('inert', '');
      },
    });
    if (sent) {
      sent = false;
      render(store.items);
    }
    lastFocus?.focus?.();
  }

  function itemTemplate(item) {
    const product = productsById.get(item.productId);
    const key = escapeHtml(lineKey(item));
    return `
      <li class="cart-item">
        <img class="cart-item__thumb" src="${escapeHtml(product.images.front.url)}" alt="" width="56" height="68" />
        <div class="cart-item__info">
          <p class="cart-item__name">${escapeHtml(product.name)}</p>
          <p class="cart-item__meta">Talla ${escapeHtml(item.size)}</p>
          <div class="qty" role="group" aria-label="Cantidad">
            <button type="button" data-action="dec" data-key="${key}" aria-label="Quitar uno">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-action="inc" data-key="${key}" aria-label="Agregar uno">+</button>
          </div>
        </div>
        <div class="cart-item__side">
          <p>${formatMoney(linePrice(item, product), product.currency)}</p>
          <button type="button" class="cart-item__remove" data-action="remove" data-key="${key}" aria-label="Quitar ${escapeHtml(product.name)} del carrito">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm4 2v8h1.6v-8H10Zm2.4 0v8H14v-8h-1.6Z"/></svg>
            Quitar
          </button>
        </div>
      </li>`;
  }

  function render(items) {
    const count = cartCount(items);
    countBadge.hidden = count === 0;
    countBadge.textContent = String(count);

    if (sent) {
      body.innerHTML = `
        <div class="cart-state cart-state--success">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>
          <h3>Te llevamos a WhatsApp</h3>
          <p>Tu pedido va con el detalle de cada prenda. Envía el mensaje y te confirmamos disponibilidad y forma de pago.</p>
          <button type="button" class="btn btn--whatsapp btn--block" data-action="whatsapp">${WHATSAPP_ICON} Abrir WhatsApp de nuevo</button>
          <button type="button" class="btn btn--outline btn--block" data-action="clear">Ya lo envié: vaciar carrito</button>
          <button type="button" class="link-btn" data-action="close">Seguir explorando</button>
        </div>`;
      return;
    }

    if (!items.length) {
      body.innerHTML = `
        <div class="cart-state">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7V6a6 6 0 0 1 12 0v1h3l-1.5 15h-15L3 7h3Zm2 0h8V6a4 4 0 0 0-8 0v1Z"/></svg>
          <p>${escapeHtml(content.cart_empty ?? '')}</p>
          <button type="button" class="btn btn--outline" data-action="close">Ver la colección</button>
        </div>`;
      return;
    }

    const subtotal = cartSubtotal(items, productsById);
    body.innerHTML = `
      <ul class="cart-list">${items.map(itemTemplate).join('')}</ul>
      <div class="cart-summary">
        <div class="cart-summary__row"><span>Total</span><strong>${formatMoney(subtotal, currency)}</strong></div>
        <button type="button" class="link-btn cart-summary__clear" data-action="clear-all">Vaciar carrito</button>
        <p class="muted">${escapeHtml(content.checkout_note ?? '')}</p>
      </div>
      <form class="checkout" id="checkout-form" novalidate>
        <label>Tu nombre <span class="muted">(opcional)</span><input name="name" autocomplete="name" maxlength="80" value="${escapeHtml(customerName)}" /></label>
        <button class="btn btn--whatsapp btn--block" type="submit">${WHATSAPP_ICON} Comprar por WhatsApp</button>
        <p class="muted">Abrimos WhatsApp con el detalle exacto de tu pedido: prenda, referencia, talla, cantidad y precio.</p>
      </form>`;
  }

  /** Abre WhatsApp con el pedido (dentro del clic, para que el navegador no lo bloquee). */
  function sendToWhatsApp() {
    const text = buildOrderMessage({
      items: store.items,
      productsById,
      categoryNames,
      currency,
      brand: content.brand_name ?? '',
      origin: window.location.origin,
      customerName,
    });
    window.open(whatsappUrl(content.whatsapp_number, text), '_blank', 'noopener');
  }

  body.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const { action, key } = button.dataset;
    const item = store.items.find((i) => lineKey(i) === key);
    if (action === 'close') close();
    if (action === 'whatsapp') sendToWhatsApp();
    if (action === 'clear') {
      sent = false;
      store.clear();
    }
    if (action === 'remove') store.remove(key);
    // Vaciar todo pide confirmación: es fácil tocarlo por accidente en el teléfono.
    if (action === 'clear-all' && window.confirm('¿Quitar todas las prendas del carrito?')) store.clear();
    if (action === 'inc' && item) store.setQuantity(key, item.quantity + 1);
    if (action === 'dec' && item) store.setQuantity(key, item.quantity - 1);
  });
  body.addEventListener('input', (e) => {
    if (e.target.name === 'name') customerName = e.target.value.trim();
  });
  body.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!store.items.length) return;
    sendToWhatsApp();
    sent = true;
    render(store.items);
    gsap.from('.cart-state--success > *', { y: 20, opacity: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out' });
  });
  toggle.addEventListener('click', () => (isOpen ? close() : open()));
  $('cart-close').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  store.subscribe((items) => render(items));

  return {
    open,
    close,
    get isOpen() {
      return isOpen;
    },
  };
}
