import '@fontsource/anton/400.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/space-mono/400.css';
import './styles/main.css';

import * as THREE from 'three';
import gsap from 'gsap';
import Lenis from 'lenis';
import { api } from './api/client.js';
import { createCartStore, pruneUnknown } from './state/cart.js';
import { createEngine, createCameraRig } from './three/engine.js';
import { createShowroom, JACKET_Y } from './three/showroom.js';
import { createProductStage } from './three/productStage.js';
import { loadJacketTextures } from './three/photoJacket.js';
import { createLightbox } from './ui/lightbox.js';
import { createCartDrawer } from './ui/cartDrawer.js';
import { createStoryView } from './ui/storyView.js';
import { createSound } from './ui/sound.js';
import { createToast } from './ui/toast.js';
import { escapeHtml, formatMoney } from './ui/format.js';
import { createHomeView } from './ui/homeView.js';
import { createHomeStory } from './ui/homeStory.js';
import { createMainMenu } from './ui/mainMenu.js';

const $ = (id) => document.getElementById(id);
// El recorrido siempre empieza desde arriba: el navegador no debe restaurar un scroll anterior.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Cede un fotograma para que la barra de carga se pinte; con la pestaña oculta (sin rAF) sigue igual.
const nextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
    setTimeout(resolve, 60);
  });

/* ---------- Pantalla de carga ---------- */
const loader = {
  progress(value, label) {
    gsap.to('#loader-bar', {
      scaleX: value,
      duration: 0.4,
      ease: 'power2.out',
    });
    if (label) $('loader-status').textContent = label;
  },
  fail(message, onRetry) {
    $('loader-status').textContent = message;
    const retry = $('loader-retry');
    retry.hidden = false;
    retry.onclick = () => {
      retry.hidden = true;
      onRetry();
    };
  },
  /** Entrada directa: al terminar de cargar se pasa sola al showroom (sin pedir clic ni sonido). */
  ready() {
    $('loader-status').textContent = '';
    return new Promise((resolve) => setTimeout(resolve, 450));
  },
  hide() {
    return gsap.to('#loader', {
      autoAlpha: 0,
      duration: 1,
      ease: 'power2.inOut',
    });
  },
};

function applyContent(content) {
  document.querySelectorAll('[data-content]').forEach((el) => {
    const value = content[el.dataset.content];
    if (value !== undefined) el.textContent = value;
  });
  document.title = `${content.brand_name ?? ''} · ${content.collection_name ?? ''}`;
}

async function loadData() {
  loader.progress(0.1, 'Conectando…');
  const [products, content, categories] = await Promise.all([api.getProducts(), api.getContent(), api.getCategories()]);
  await Promise.all([document.fonts.load('200px Anton'), document.fonts.load('16px "Space Mono"'), document.fonts.load('16px Inter')]);
  return { products, content, categories };
}

async function boot() {
  let data;
  try {
    data = await loadData();
  } catch (error) {
    loader.fail(`No se pudo cargar la colección. ${error.message}`, boot);
    return;
  }
  const { products, content, categories } = data;
  if (!products.length) {
    loader.fail('La colección no tiene productos disponibles por ahora.', boot);
    return;
  }
  applyContent(content);
  loader.progress(0.35, content.loading_label);
  await nextFrame();

  const productsById = new Map(products.map((p) => [p.id, p]));
  const productsBySlug = new Map(products.map((p) => [p.slug, p]));

  const engine = createEngine($('scene'));
  const rig = createCameraRig(engine);
  let textures;
  try {
    textures = await loadJacketTextures(products, engine.renderer, (p) => loader.progress(0.35 + p * 0.3));
  } catch (error) {
    loader.fail(`${error.message}. Revisa tu conexión.`, () => location.reload());
    return;
  }
  // El showroom 3D muestra las prendas destacadas; el resto vive en la colección de abajo.
  const featured = products.filter((p) => p.featured);
  const showroomProducts = featured.length ? featured : products.slice(0, 3);
  // El friso de la rotonda lleva la marca y la línea, desde la BD.
  const friezeText = `${content.brand_name ?? ''} · ${content.frieze_text ?? ''} · `.toUpperCase();
  // Percheros de los nichos laterales: prendas formales elegidas desde la BD (home_rack).
  const rackProducts = (content.home_rack ?? '')
    .split(',')
    .map((slug) => productsBySlug.get(slug.trim()))
    .filter(Boolean);
  const showroom = createShowroom(engine, showroomProducts, textures, { friezeText, rackProducts });
  loader.progress(0.7);
  await nextFrame();
  const stage = createProductStage(engine, rig, content, textures);
  stage.prepare(products);
  loader.progress(0.85);
  await nextFrame();
  engine.warmUp();
  loader.progress(1);

  const sound = createSound();
  const toast = createToast();
  const store = createCartStore();
  store.replace(pruneUnknown(store.items, productsById));
  const cart = createCartDrawer({ store, productsById, content, categories });
  const lightbox = createLightbox();
  const story = createStoryView({
    stage,
    store,
    sound,
    toast,
    openCart: cart.open,
    lightbox,
  });

  const lenis = new Lenis({
    lerp: reduceMotion ? 1 : 0.08,
    wheelMultiplier: 0.9,
  });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  let mainMenu = null; // menú principal (se crea más abajo; la colección le avisa qué línea está activa)
  const home = createHomeView({
    products,
    categories,
    content,
    onOpen: (slug) => navigate(slug),
    scrollTo: (el) => lenis.scrollTo(el, { offset: -96, duration: reduceMotion ? 0 : 1.4 }),
    onFilterChange: (slug) => mainMenu?.setActive(slug),
  });

  const homeStory = createHomeStory({
    products: showroomProducts,
    categories,
    content,
    onOpen: (slug) => navigate(slug),
  });

  /* ---------- Scroll del inicio: coreografía de cámara por las prendas y luego la colección ---------- */
  const showroomUi = $('showroom-ui');
  const spacer = document.querySelector('.home__spacer');
  // ~60vh de scroll por tramo del recorrido: más prendas, recorrido más largo.
  spacer.style.height = `${showroom.stops * 60}vh`;
  let entered = false; // ya se cerró la pantalla de carga
  let scrollFocus = -1;
  let pendingFocus = -1;
  let pendingSince = 0;
  let focusTimer = 0;
  // Alto de pantalla estable: en móvil la barra del navegador se oculta al hacer scroll y cambia innerHeight;
  // si se usara directo, el recorrido "saltaría" hacia atrás cada vez. Solo se actualiza si cambia el ancho.
  let viewH = window.innerHeight;
  let viewW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth !== viewW || !window.matchMedia('(pointer: coarse)').matches) {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
    }
  });
  /** Progreso 0–1 de la coreografía: termina cuando la colección ya asoma por abajo. */
  const choreography = (scroll) => Math.min(1, Math.max(0, scroll / Math.max(1, spacer.offsetHeight - viewH * 0.55)));

  function updateHomeScroll(scroll) {
    const vh = viewH;
    const fade = Math.min(1, scroll / (vh * 0.3));
    showroomUi.style.opacity = String(1 - fade);
    showroomUi.style.pointerEvents = fade > 0.6 ? 'none' : '';
    engine.setPaused(scroll > spacer.offsetHeight + vh * 0.05);
    document.querySelector('.topbar').classList.toggle('is-solid', scroll > spacer.offsetHeight - vh * 0.3);
    showroom.setInteractive(entered && !transitioning && scroll < vh * 0.12);
    if (scroll > vh * 0.12) hoverLabel.classList.remove('is-visible');
    if (!entered || transitioning || current !== null) return;

    const p = choreography(scroll);
    const pose = showroom.scrollPose(p);
    rig.desiredPos.copy(pose.pos);
    rig.desiredTarget.copy(pose.target);
    // Cambio de prenda con confirmación: el nuevo foco debe sostenerse 120 ms. Así la inercia del dedo
    // en el borde entre dos prendas no hace ir y volver el panel (y la cámara) varias veces.
    if (pose.focus !== pendingFocus) {
      pendingFocus = pose.focus;
      pendingSince = performance.now();
    }
    const settled = performance.now() - pendingSince > 120 || scrollFocus === -2;
    if (!settled && pose.focus !== scrollFocus) {
      // Si el scroll se detiene justo aquí, se confirma igual al cumplirse el plazo.
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => updateHomeScroll(lenis.scroll), 140);
    }
    if (pose.focus !== scrollFocus && settled) {
      scrollFocus = pose.focus;
      // De vuelta arriba: en vertical la prenda central queda encendida; en horizontal, ninguna.
      const rest = showroom.basePose().portrait ? Math.floor(showroomProducts.length / 2) : -1;
      showroom.focus(pose.focus >= 0 ? pose.focus : p < 0.5 ? rest : -1);
      if (pose.focus >= 0) sound.blip();
    }
    homeStory.update(scrollFocus);
  }
  lenis.on('scroll', ({ scroll, limit }) => {
    if (current) story.update(limit > 0 ? scroll / limit : 0);
    else updateHomeScroll(scroll);
  });
  // La pista lleva a la primera parada del recorrido.
  $('home-hint').addEventListener('click', () =>
    lenis.scrollTo((spacer.offsetHeight - window.innerHeight * 0.55) * (1.2 / showroom.stops), {
      duration: reduceMotion ? 0 : 1.6,
    }),
  );

  /* ---------- Showroom: etiqueta flotante y selector ---------- */
  const hoverLabel = $('hover-label');
  let hoveredSlug = null;
  showroom.onHover((product) => {
    hoveredSlug = product?.slug ?? null;
    hoverLabel.classList.toggle('is-visible', Boolean(product));
    showroomUi.classList.toggle('is-hovering', Boolean(product));
    // En vertical la cámara se desplaza hasta la prenda seleccionada.
    if (current === null && !transitioning && lenis.scroll < window.innerHeight * 0.12) {
      const pose = showroom.basePose();
      if (pose.portrait) {
        rig.desiredPos.copy(pose.pos);
        rig.desiredTarget.copy(pose.target);
      }
    }
    chips.querySelectorAll('[data-slug]').forEach((chip) => chip.classList.toggle('is-active', chip.dataset.slug === hoveredSlug));
    if (product) {
      $('hover-name').textContent = product.name;
      $('hover-price').textContent = formatMoney(product.priceCents, product.currency);
      sound.blip();
    }
  });
  engine.onTick(() => {
    if (!hoveredSlug) return;
    const p = showroom.labelPosition(hoveredSlug);
    if (p) hoverLabel.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
  });

  const chips = $('product-chips');
  chips.innerHTML = showroomProducts
    .map(
      (p) => `<button type="button" class="chip" data-slug="${escapeHtml(p.slug)}" style="--ring:${p.colors.accent}">
        <img src="${escapeHtml(p.images.front.url)}" alt="" width="28" height="34" loading="lazy" /><span>${escapeHtml(p.name)}</span></button>`,
    )
    .join('');
  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-slug]');
    if (chip) navigate(chip.dataset.slug);
  });
  const hoverChip = (e) => {
    const chip = e.target.closest('[data-slug]');
    if (chip && current === null) showroom.setHovered(showroomProducts.findIndex((p) => p.slug === chip.dataset.slug));
  };
  chips.addEventListener('pointerover', hoverChip);
  chips.addEventListener('focusin', hoverChip);
  showroom.onSelect((product) => navigate(product.slug));

  /* ---------- Navegación con transiciones ---------- */
  let current = null; // slug del producto abierto o null (showroom)
  let transitioning = false;
  const veil = $('veil');

  function setView(view) {
    document.body.dataset.view = view;
  }

  let returnScroll = 0; // posición del inicio a la que se vuelve al cerrar un producto

  async function openProduct(product) {
    transitioning = true;
    cart.close();
    showroom.setInteractive(false);
    hoverLabel.classList.remove('is-visible');
    hoveredSlug = null;
    sound.whoosh();
    returnScroll = lenis.scroll;
    veil.style.background = stage.backgroundFor(product);
    const duration = reduceMotion ? 0.2 : 1;
    const jacket = showroom.jacketBySlug(product.slug);
    const tl = gsap.timeline();
    // Mientras la escena 3D está a la vista (inicio o recorrido) la cámara vuela hasta la prenda.
    if (jacket && returnScroll < spacer.offsetHeight - window.innerHeight * 0.6) {
      // Vuelo de la cámara hacia la prenda elegida en el showroom
      const p = jacket.group.position;
      tl.to(
        rig.desiredPos,
        {
          x: p.x,
          y: JACKET_Y + 0.15,
          z: p.z + 1.6,
          duration,
          ease: 'power2.in',
        },
        0,
      )
        .to(
          rig.desiredTarget,
          {
            x: p.x,
            y: JACKET_Y + 0.1,
            z: p.z,
            duration: duration * 0.8,
            ease: 'power2.inOut',
          },
          0,
        )
        .to(veil, { autoAlpha: 1, duration: duration * 0.45, ease: 'power1.in' }, duration * 0.6);
    } else {
      // Desde la colección: fundido directo al mundo del producto
      tl.to(veil, {
        autoAlpha: 1,
        duration: duration * 0.5,
        ease: 'power1.in',
      });
    }
    await tl;

    showroom.group.visible = false;
    showroomUi.hidden = true;
    home.hide();
    engine.setPaused(false);
    const world = stage.enter(product);
    story.open(product, world);
    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.resize();
    story.update(0);
    setView('product');
    document.querySelector('.topbar').classList.remove('is-solid');
    await gsap.to(veil, {
      autoAlpha: 0,
      duration: reduceMotion ? 0.2 : 1.1,
      ease: 'power2.out',
      delay: 0.1,
    });
    transitioning = false;
  }

  async function closeProduct() {
    transitioning = true;
    sound.whoosh();
    veil.style.background = `#${engine.scene.background.getHexString()}`;
    await gsap.to(veil, {
      autoAlpha: 1,
      duration: reduceMotion ? 0.15 : 0.5,
      ease: 'power1.in',
    });
    stage.exit();
    story.close();
    showroom.group.visible = true;
    showroomUi.hidden = false;
    home.show();
    engine.setMood(showroom.neutralMood, 0.01);
    const base = showroom.basePose();
    rig.jumpTo(new THREE.Vector3(0, JACKET_Y + 0.4, 3.2), base.target);
    rig.desiredPos.copy(base.pos);
    showroom.clearHover();
    scrollFocus = -2; // obliga a reaplicar el foco del punto del recorrido al que se vuelve
    setView('showroom');
    // Vuelve al mismo punto del inicio (por ejemplo, a la grilla desde donde se abrió la prenda).
    lenis.resize();
    lenis.scrollTo(returnScroll, { immediate: true, force: true });
    updateHomeScroll(returnScroll);
    await gsap.to(veil, {
      autoAlpha: 0,
      duration: reduceMotion ? 0.2 : 0.9,
      ease: 'power2.out',
    });
    transitioning = false;
    updateHomeScroll(lenis.scroll);
  }

  async function route(slug) {
    if (transitioning) return;
    const product = slug ? productsBySlug.get(slug) : null;
    if (product && current !== product.slug) {
      if (current) await closeProduct();
      current = product.slug;
      await openProduct(product);
    } else if (!product && current) {
      current = null;
      await closeProduct();
    }
  }

  function navigate(slug) {
    if (transitioning) return;
    const path = slug ? `/producto/${slug}` : '/';
    if (location.pathname !== path) history.pushState({}, '', path);
    route(slug);
  }

  const slugFromPath = () => location.pathname.match(/^\/producto\/([\w-]+)/)?.[1] ?? null;
  window.addEventListener('popstate', () => route(slugFromPath()));
  document.querySelectorAll('[data-link]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(null);
    }),
  );
  $('back-btn').addEventListener('click', () => navigate(null));

  // Menú principal: cada enlace lleva a su línea en la colección (si hay un producto abierto, primero vuelve al inicio).
  mainMenu = createMainMenu({
    categories,
    content,
    onSelect: async (slug) => {
      if (current) {
        history.pushState({}, '', '/');
        await route(null);
      }
      home.filterTo(slug);
    },
    onOpenChange: (open) => (open ? lenis.stop() : lenis.start()),
  });
  $('shop-cta').addEventListener('click', () => {
    if (current) lenis.scrollTo('bottom', { duration: 2.2 });
    else lenis.scrollTo(home.catalogElement, { offset: -96, duration: 1.6 });
  });

  const soundToggle = $('sound-toggle');
  const setSound = (on) => {
    sound.setEnabled(on);
    soundToggle.setAttribute('aria-pressed', String(on));
    soundToggle.setAttribute('aria-label', on ? 'Silenciar sonido' : 'Activar sonido');
  };
  soundToggle.addEventListener('click', () => setSound(!sound.enabled));

  /* ---------- Entrada ---------- */
  const base = showroom.basePose();
  rig.jumpTo(new THREE.Vector3(0, 4.5, base.pos.z + 9), base.target);
  engine.onResize(() => {
    if (current !== null || transitioning) return;
    if (entered) return updateHomeScroll(lenis.scroll);
    const pose = showroom.basePose();
    rig.desiredPos.copy(pose.pos);
    rig.desiredTarget.copy(pose.target);
  });

  // Se entra sin clic. El sonido queda apagado: los navegadores no permiten reproducir audio
  // sin un gesto del usuario, y se puede activar con el botón de la barra superior.
  await loader.ready();
  setView('showroom');
  // Siempre se entra al showroom desde arriba (el navegador puede restaurar un scroll anterior).
  window.scrollTo(0, 0);
  lenis.scrollTo(0, { immediate: true, force: true });
  const loaderHidden = loader.hide();
  rig.damping = 0.9;
  rig.desiredPos.copy(base.pos);
  gsap.to(rig, { damping: 3.2, duration: 3, ease: 'power1.in' });
  gsap.fromTo('.topbar, .showroom-ui', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, delay: 0.6, stagger: 0.15 });

  const initialSlug = slugFromPath();
  if (initialSlug && productsBySlug.has(initialSlug)) {
    await gsap.delayedCall(1.2, () => {});
    route(initialSlug);
  } else {
    if (initialSlug) history.replaceState({}, '', '/');
    // El showroom responde a clics solo cuando la pantalla de carga ya desapareció del todo.
    loaderHidden.then(() => {
      entered = true;
      updateHomeScroll(lenis.scroll);
      // En vertical se ve una prenda a la vez: la central entra ya seleccionada (nicho encendido y nombre visible).
      if (showroom.basePose().portrait) showroom.setHovered(Math.floor(showroomProducts.length / 2));
    });
  }
}

boot();
