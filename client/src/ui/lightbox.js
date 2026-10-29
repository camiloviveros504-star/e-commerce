import gsap from 'gsap';

const $ = (id) => document.getElementById(id);

/** Visor de fotos a pantalla completa con navegación por teclado y transiciones. */
export function createLightbox() {
  const root = $('lightbox');
  const img = $('lightbox-img');
  const caption = $('lightbox-caption');
  const counter = $('lightbox-counter');
  let images = [];
  let index = 0;
  let lastFocus = null;

  function show(i, direction = 0) {
    index = (i + images.length) % images.length;
    const image = images[index];
    gsap.fromTo(
      img,
      { autoAlpha: 0, x: direction * 40, scale: 0.98 },
      { autoAlpha: 1, x: 0, scale: 1, duration: 0.45, ease: 'power3.out' },
    );
    img.src = image.url;
    img.alt = image.alt;
    caption.textContent = image.alt;
    counter.textContent = `${index + 1} / ${images.length}`;
  }

  function open(list, start = 0) {
    images = list;
    lastFocus = document.activeElement;
    root.hidden = false;
    document.body.classList.add('lightbox-open');
    gsap.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
    show(start);
    $('lightbox-close').focus();
  }

  function close() {
    gsap.to(root, {
      autoAlpha: 0,
      duration: 0.25,
      onComplete: () => {
        root.hidden = true;
        document.body.classList.remove('lightbox-open');
      },
    });
    lastFocus?.focus?.();
  }

  $('lightbox-close').addEventListener('click', close);
  $('lightbox-prev').addEventListener('click', () => show(index - 1, -1));
  $('lightbox-next').addEventListener('click', () => show(index + 1, 1));
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  document.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(index - 1, -1);
    if (e.key === 'ArrowRight') show(index + 1, 1);
  });

  return { open, close };
}
