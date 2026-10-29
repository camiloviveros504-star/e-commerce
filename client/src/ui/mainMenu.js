import gsap from 'gsap';
import { escapeHtml } from './format.js';

/**
 * Menú principal: enlaces a cada línea de la colección (desde la BD).
 * En escritorio va en la barra superior; en móvil y tablet se abre a pantalla completa.
 */
export function createMainMenu({ categories, content, onSelect, onOpenChange = () => {} }) {
  const bar = document.getElementById('mainnav');
  const drawer = document.getElementById('menu-drawer');
  const drawerNav = document.getElementById('menu-nav');
  const toggle = document.getElementById('menu-toggle');
  const close = document.getElementById('menu-close');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const items = [{ slug: 'all', name: content.nav_collection ?? 'Colección' }, ...categories.map((c) => ({ slug: c.slug, name: c.name }))];
  const link = (item, i, big) =>
    `<a href="#catalog" class="${big ? 'menu-drawer__link' : 'mainnav__link'}" data-filter="${escapeHtml(item.slug)}">${
      big ? `<span class="menu-drawer__index">${String(i + 1).padStart(2, '0')}</span>` : ''
    }<span>${escapeHtml(item.name)}</span></a>`;
  bar.innerHTML = items.map((item, i) => link(item, i, false)).join('');
  drawerNav.innerHTML = items.map((item, i) => link(item, i, true)).join('');

  let open = false;
  function setOpen(value) {
    if (value === open) return;
    open = value;
    toggle.setAttribute('aria-expanded', String(value));
    onOpenChange(value);
    if (value) {
      drawer.hidden = false;
      document.body.classList.add('menu-open');
      gsap.fromTo(drawer, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: reduceMotion ? 0.01 : 0.7, ease: 'expo.out' });
      gsap.fromTo(
        drawerNav.children,
        { y: 40, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: reduceMotion ? 0.01 : 0.8, stagger: 0.06, delay: 0.12, ease: 'expo.out' },
      );
      drawerNav.querySelector('a')?.focus({ preventScroll: true });
    } else {
      document.body.classList.remove('menu-open');
      gsap.to(drawer, {
        clipPath: 'inset(0 0 100% 0)',
        duration: reduceMotion ? 0.01 : 0.45,
        ease: 'power2.in',
        onComplete: () => (drawer.hidden = true),
      });
      toggle.focus({ preventScroll: true });
    }
  }

  const choose = (e) => {
    const a = e.target.closest('[data-filter]');
    if (!a) return;
    e.preventDefault();
    setOpen(false);
    onSelect(a.dataset.filter);
  };
  bar.addEventListener('click', choose);
  drawerNav.addEventListener('click', choose);
  toggle.addEventListener('click', () => setOpen(!open));
  close.addEventListener('click', () => setOpen(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });
  // Si la pantalla se agranda con el menú abierto, se cierra solo.
  window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => e.matches && setOpen(false));

  return {
    /** Marca la línea activa (la que muestra la colección). */
    setActive(slug) {
      [bar, drawerNav].forEach((nav) =>
        nav.querySelectorAll('[data-filter]').forEach((a) => {
          if (a.dataset.filter === slug) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        }),
      );
    },
    close: () => setOpen(false),
  };
}
