import '@fontsource/anton/400.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/space-mono/400.css';
import './styles/main.css';

import * as THREE from 'three';
import gsap from 'gsap';
import Lenis from 'lenis';
import { createCartStore, pruneUnknown } from './state/cart.js';
import { createEngine, createCameraRig } from './three/engine.js';
import { createShowroom } from './three/showroom.js';
import { createProductStage } from './three/productStage.js';
import { loadJacketTextures } from './three/photoJacket.js';
import { createLightbox } from './ui/lightbox.js';
import { createCartDrawer } from './ui/cartDrawer.js';
import { createStoryView } from './ui/storyView.js';
import { createSound } from './ui/sound.js';
import { createToast } from './ui/toast.js';
import { createHomeView } from './ui/homeView.js';
import { createHomeStory } from './ui/homeStory.js';
import { createMainMenu } from './ui/mainMenu.js';
import { $, prefersReducedMotion } from './ui/dom.js';
import { loader, nextFrame } from './ui/loader.js';
import { SCROLL_OFFSET } from './app/constants.js';
import { applyContent, loadData, pickShowroomContent } from './app/data.js';
import { createShowroomPanel } from './app/showroomPanel.js';
import { createHomeScroll } from './app/homeScroll.js';
import { createNavigation } from './app/navigation.js';

// El recorrido siempre empieza desde arriba: el navegador no debe restaurar un scroll anterior.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const reduceMotion = prefersReducedMotion();

/** Estado de la navegación compartido por los módulos de la aplicación. */
const createState = () => ({
  current: null, // slug del producto abierto o null (showroom)
  transitioning: false,
  entered: false, // ya se cerró la pantalla de carga
  scrollFocus: -1, // prenda en foco durante el recorrido del inicio
  hoveredSlug: null,
});

/** Datos, escena 3D y texturas. Devuelve null si algo falla (el loader ya muestra el error). */
async function loadWorld() {
  let data;
  try {
    data = await loadData();
  } catch (error) {
    loader.fail(`No se pudo cargar la colección. ${error.message}`, boot);
    return null;
  }
  const { products, content, categories } = data;
  if (!products.length) {
    loader.fail('La colección no tiene productos disponibles por ahora.', boot);
    return null;
  }
  applyContent(content);
  loader.progress(0.35, content.loading_label);
  await nextFrame();

  const engine = createEngine($('scene'));
  const rig = createCameraRig(engine);
  let textures;
  try {
    textures = await loadJacketTextures(products, engine.renderer, (p) => loader.progress(0.35 + p * 0.3));
  } catch (error) {
    loader.fail(`${error.message}. Revisa tu conexión.`, () => location.reload());
    return null;
  }
  const { showroomProducts, friezeText, rackProducts } = pickShowroomContent(products, content);
  const showroom = createShowroom(engine, showroomProducts, textures, { friezeText, rackProducts });
  loader.progress(0.7);
  await nextFrame();
  const stage = createProductStage(engine, rig, content, textures);
  stage.prepare(products);
  loader.progress(0.85);
  await nextFrame();
  engine.warmUp();
  loader.progress(1);
  return { products, content, categories, engine, rig, showroom, showroomProducts, stage };
}

function createLenis() {
  const lenis = new Lenis({ lerp: reduceMotion ? 1 : 0.08, wheelMultiplier: 0.9 });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

/** Botón de sonido de la barra superior (apagado de inicio: el navegador exige un gesto del usuario para el audio). */
function bindSoundToggle(sound) {
  const toggle = $('sound-toggle');
  toggle.addEventListener('click', () => {
    const on = !sound.enabled;
    sound.setEnabled(on);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', on ? 'Silenciar sonido' : 'Activar sonido');
  });
}

/** Animación de entrada: se pasa sola al showroom (sin pedir clic ni sonido). */
async function playEntrance({ rig, lenis, base, setView }) {
  await loader.ready();
  setView('showroom');
  window.scrollTo(0, 0);
  lenis.scrollTo(0, { immediate: true, force: true });
  const hidden = loader.hide();
  rig.damping = 0.9;
  rig.desiredPos.copy(base.pos);
  gsap.to(rig, { damping: 3.2, duration: 3, ease: 'power1.in' });
  gsap.fromTo('.topbar, .showroom-ui', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, delay: 0.6, stagger: 0.15 });
  return { hidden }; // envuelto: devolver el tween directamente haría que el `await` lo esperara
}

async function boot() {
  const world = await loadWorld();
  if (!world) return;
  const { products, content, categories, engine, rig, showroom, showroomProducts, stage } = world;
  const productsById = new Map(products.map((p) => [p.id, p]));
  const productsBySlug = new Map(products.map((p) => [p.slug, p]));
  const state = createState();

  const sound = createSound();
  const store = createCartStore();
  store.replace(pruneUnknown(store.items, productsById));
  const cart = createCartDrawer({ store, productsById, content, categories });
  const story = createStoryView({ stage, store, sound, toast: createToast(), openCart: cart.open, lightbox: createLightbox() });
  const lenis = createLenis();

  // Las piezas se referencian entre sí solo desde callbacks (se ejecutan después de armarlo todo).
  const go = (slug) => nav.navigate(slug);
  const mainMenu = createMainMenu({
    categories,
    content,
    onSelect: async (slug) => {
      if (state.current) {
        history.pushState({}, '', '/');
        await nav.route(null);
      }
      home.filterTo(slug);
    },
    onOpenChange: (open) => (open ? lenis.stop() : lenis.start()),
  });
  const home = createHomeView({
    products,
    categories,
    content,
    onOpen: go,
    scrollTo: (el) => lenis.scrollTo(el, { offset: SCROLL_OFFSET, duration: reduceMotion ? 0 : 1.4 }),
    onFilterChange: mainMenu.setActive,
  });
  const homeStory = createHomeStory({ products: showroomProducts, categories, content, onOpen: go });
  const { hideLabel } = createShowroomPanel({ engine, rig, showroom, showroomProducts, lenis, state, sound, onOpen: go });
  const homeScroll = createHomeScroll({ engine, rig, showroom, showroomProducts, homeStory, sound, lenis, state, hideLabel });
  const nav = createNavigation({ state, engine, rig, showroom, stage, story, home, cart, sound, lenis, homeScroll, hideLabel, productsBySlug });

  lenis.on('scroll', ({ scroll, limit }) => {
    if (state.current) story.update(limit > 0 ? scroll / limit : 0);
    else homeScroll.update(scroll);
  });
  $('shop-cta').addEventListener('click', () => {
    if (state.current) lenis.scrollTo('bottom', { duration: 2.2 });
    else lenis.scrollTo(home.catalogElement, { offset: SCROLL_OFFSET, duration: 1.6 });
  });
  bindSoundToggle(sound);

  const base = showroom.basePose();
  rig.jumpTo(new THREE.Vector3(0, 4.5, base.pos.z + 9), base.target);
  engine.onResize(() => {
    if (state.current !== null || state.transitioning) return;
    if (state.entered) return homeScroll.update(lenis.scroll);
    const pose = showroom.basePose();
    rig.desiredPos.copy(pose.pos);
    rig.desiredTarget.copy(pose.target);
  });

  const { hidden: loaderHidden } = await playEntrance({ rig, lenis, base, setView: nav.setView });

  const initialSlug = nav.initialSlug();
  if (initialSlug && productsBySlug.has(initialSlug)) {
    await gsap.delayedCall(1.2, () => {});
    nav.route(initialSlug);
    return;
  }
  if (initialSlug) history.replaceState({}, '', '/');
  // El showroom responde a clics solo cuando la pantalla de carga ya desapareció del todo.
  loaderHidden.then(() => {
    state.entered = true;
    homeScroll.update(lenis.scroll);
    // En vertical se ve una prenda a la vez: la central entra ya seleccionada (nicho encendido y nombre visible).
    if (showroom.basePose().portrait) showroom.setHovered(Math.floor(showroomProducts.length / 2));
  });
}

boot();
