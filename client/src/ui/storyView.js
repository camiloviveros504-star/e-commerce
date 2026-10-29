import gsap from 'gsap';
import { $ } from './dom.js';
import { scrambleText } from './scramble.js';
import { escapeHtml, formatMoney } from './format.js';

const FINALE_AT = 0.9; // progreso del scroll desde el que aparece el panel final
const GALLERY_ORDER = ['front', 'back', 'detail', 'lifestyle'];

/** Fotos del producto en el orden de la galería (omite las que falten). */
export const galleryImages = (product) => GALLERY_ORDER.map((kind) => product.images?.[kind]).filter(Boolean);

/** Capa HTML del recorrido de producto: textos por parada, barra de progreso y panel final de compra. */
export function createStoryView({ stage, store, sound, toast, openCart, lightbox }) {
  const els = {
    root: $('story'),
    track: $('story-track'),
    intro: $('story-intro'),
    tagline: $('story-tagline'),
    title: $('story-title'),
    desc: $('story-desc'),
    caption: $('caption'),
    captionIndex: $('caption-index'),
    captionTitle: $('caption-title'),
    captionBody: $('caption-body'),
    scrollHint: $('scroll-hint'),
    progress: $('progress-bar'),
    finale: $('finale'),
    buyName: $('buy-name'),
    buyPrice: $('buy-price'),
    sizeGrid: $('size-grid'),
    buyError: $('buy-error'),
    form: $('buy-panel'),
    gallery: $('gallery'),
    lookbook: $('lookbook'),
    lookbookImg: $('lookbook-img'),
    lookbookCount: $('lookbook-count'),
    captionImg: $('caption-img'),
  };
  let product = null;
  let featureIndex = -1;
  let finaleVisible = false;
  let introVisible = true;

  function renderSizes() {
    els.sizeGrid.innerHTML = product.sizes
      .map(
        (s) => `<label class="size ${s.inStock ? '' : 'size--out'}">
          <input type="radio" name="size" value="${escapeHtml(s.label)}" ${s.inStock ? '' : 'disabled'} />
          <span>${escapeHtml(s.label)}</span>
        </label>`,
      )
      .join('');
  }

  function renderGallery() {
    const images = galleryImages(product);
    els.gallery.innerHTML = images
      .map(
        (img, i) => `<button type="button" class="gallery__item" data-index="${i}" aria-label="Ver foto: ${escapeHtml(img.alt)}">
          <img src="${escapeHtml(img.url)}" alt="" loading="lazy" width="${img.width}" height="${img.height}" />
        </button>`,
      )
      .join('');
    const lifestyle = product.images?.lifestyle;
    els.lookbook.hidden = !lifestyle;
    if (lifestyle) {
      els.lookbookImg.src = lifestyle.url;
      els.lookbookImg.alt = lifestyle.alt;
      els.lookbookCount.textContent = `${images.length} fotos`;
    }
  }

  function setCaption(index) {
    if (index === featureIndex) return;
    featureIndex = index;
    if (index < 0) {
      gsap.to(els.caption, { autoAlpha: 0, y: 12, duration: 0.3, ease: 'power2.in' });
      return;
    }
    const feature = product.features[index];
    els.caption.dataset.side = index % 2 === 0 ? 'right' : 'left';
    els.captionIndex.textContent = `${String(index + 1).padStart(2, '0')} / ${String(product.features.length).padStart(2, '0')}`;
    // La primera característica se acompaña de la foto de detalle de la tela.
    const detail = index === 0 ? product.images?.detail : null;
    els.captionImg.hidden = !detail;
    if (detail) {
      els.captionImg.src = detail.url;
      els.captionImg.alt = detail.alt;
    }
    scrambleText(els.captionTitle, feature.title, { duration: 700 });
    scrambleText(els.captionBody, feature.body, { duration: 1000 });
    gsap.fromTo(els.caption, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    sound.blip();
  }

  function setFinale(visible) {
    if (visible === finaleVisible) return;
    finaleVisible = visible;
    stage.showMarquee(visible);
    els.finale.classList.toggle('is-visible', visible);
    if (visible) gsap.fromTo(els.form, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    else gsap.to(els.form, { autoAlpha: 0, y: 24, duration: 0.3 });
  }

  function setIntro(visible) {
    if (visible === introVisible) return;
    introVisible = visible;
    gsap.to([els.intro, els.lookbook], { autoAlpha: visible ? 1 : 0, y: visible ? 0 : -20, duration: 0.5, ease: 'power2.out' });
  }

  els.gallery.addEventListener('click', (e) => {
    const item = e.target.closest('[data-index]');
    if (item) lightbox.open(galleryImages(product), Number(item.dataset.index));
  });
  $('lookbook-btn').addEventListener('click', () => {
    const images = galleryImages(product);
    lightbox.open(images, images.indexOf(product.images.lifestyle));
  });
  els.form.addEventListener('change', () => {
    els.buyError.hidden = true;
  });
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const size = new FormData(els.form).get('size');
    if (!size) {
      els.buyError.textContent = 'Elige una talla para continuar.';
      els.buyError.hidden = false;
      gsap.fromTo(els.sizeGrid, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      return;
    }
    store.add({ productId: product.id, size: String(size), quantity: 1 });
    toast(`${product.name} · Talla ${size} añadida`, { label: 'Ver carrito', onClick: openCart });
    gsap.fromTo('#cart-toggle', { scale: 1 }, { scale: 1.25, yoyo: true, repeat: 1, duration: 0.18 });
  });

  return {
    open(nextProduct, world) {
      product = nextProduct;
      featureIndex = -2;
      finaleVisible = true;
      introVisible = false;
      els.tagline.textContent = product.tagline;
      els.title.textContent = product.name;
      els.desc.textContent = product.description;
      els.buyName.textContent = product.name;
      els.buyPrice.textContent = formatMoney(product.priceCents, product.currency);
      els.buyError.hidden = true;
      renderSizes();
      renderGallery();
      document.body.dataset.ui = world.ui;
      els.track.style.height = `${stage.stopCount() * 115}vh`;
      els.root.hidden = false;
      setCaption(-1);
      setFinale(false);
      setIntro(true);
      gsap.fromTo(els.intro.children, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.8, delay: 0.4, ease: 'power3.out' });
      gsap.fromTo(els.lookbook, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.1, delay: 0.7, ease: 'power3.inOut' });
    },
    close() {
      product = null;
      els.root.hidden = true;
      els.track.style.height = '0';
      stage.showMarquee(false);
      document.body.dataset.ui = 'dark';
    },
    /** Llamado en cada evento de scroll con el progreso 0..1. */
    update(progress) {
      if (!product) return;
      const index = stage.setProgress(progress);
      const last = stage.stopCount() - 1;
      els.progress.style.transform = `scaleY(${progress})`;
      setIntro(progress < 0.03);
      setCaption(index >= 1 && index < last ? index - 1 : -1);
      setFinale(index === last && progress > FINALE_AT);
      els.scrollHint.classList.toggle('is-hidden', progress > FINALE_AT);
    },
  };
}
