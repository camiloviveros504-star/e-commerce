import * as THREE from 'three';
import gsap from 'gsap';
import { JACKET_Y } from '../three/showroom.js';
import { $, prefersReducedMotion } from '../ui/dom.js';
import { FOCUS_REAPPLY } from './constants.js';

const slugFromPath = () => location.pathname.match(/^\/producto\/([\w-]+)/)?.[1] ?? null;

/** Rutas (/ y /producto/:slug) y transiciones entre el showroom y el mundo de cada producto. */
export function createNavigation({ state, engine, rig, showroom, stage, story, home, cart, sound, lenis, homeScroll, hideLabel, productsBySlug }) {
  const reduceMotion = prefersReducedMotion();
  const veil = $('veil');
  const showroomUi = $('showroom-ui');
  const topbar = document.querySelector('.topbar');
  let returnScroll = 0; // posición del inicio a la que se vuelve al cerrar un producto

  const setView = (view) => {
    document.body.dataset.view = view;
  };

  /** La cámara vuela hasta la prenda elegida y el velo cubre el final del trayecto. */
  function flyToJacket(timeline, jacket, duration) {
    const { x, z } = jacket.group.position;
    timeline
      .to(rig.desiredPos, { x, y: JACKET_Y + 0.15, z: z + 1.6, duration, ease: 'power2.in' }, 0)
      .to(rig.desiredTarget, { x, y: JACKET_Y + 0.1, z, duration: duration * 0.8, ease: 'power2.inOut' }, 0)
      .to(veil, { autoAlpha: 1, duration: duration * 0.45, ease: 'power1.in' }, duration * 0.6);
  }

  async function openProduct(product) {
    state.transitioning = true;
    cart.close();
    showroom.setInteractive(false);
    hideLabel();
    state.hoveredSlug = null;
    sound.whoosh();
    returnScroll = lenis.scroll;
    veil.style.background = stage.backgroundFor(product);
    const duration = reduceMotion ? 0.2 : 1;
    const jacket = showroom.jacketBySlug(product.slug);
    const timeline = gsap.timeline();
    // Con la escena 3D a la vista la cámara vuela hasta la prenda; desde la colección es un fundido directo.
    if (jacket && homeScroll.isSceneVisible(returnScroll)) flyToJacket(timeline, jacket, duration);
    else timeline.to(veil, { autoAlpha: 1, duration: duration * 0.5, ease: 'power1.in' });
    await timeline;

    showroom.group.visible = false;
    showroomUi.hidden = true;
    home.hide();
    engine.setPaused(false);
    story.open(product, stage.enter(product));
    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.resize();
    story.update(0);
    setView('product');
    topbar.classList.remove('is-solid');
    await gsap.to(veil, { autoAlpha: 0, duration: reduceMotion ? 0.2 : 1.1, ease: 'power2.out', delay: 0.1 });
    state.transitioning = false;
  }

  async function closeProduct() {
    state.transitioning = true;
    sound.whoosh();
    veil.style.background = `#${engine.scene.background.getHexString()}`;
    await gsap.to(veil, { autoAlpha: 1, duration: reduceMotion ? 0.15 : 0.5, ease: 'power1.in' });
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
    state.scrollFocus = FOCUS_REAPPLY;
    setView('showroom');
    // Vuelve al mismo punto del inicio (por ejemplo, a la grilla desde donde se abrió la prenda).
    lenis.resize();
    lenis.scrollTo(returnScroll, { immediate: true, force: true });
    homeScroll.update(returnScroll);
    await gsap.to(veil, { autoAlpha: 0, duration: reduceMotion ? 0.2 : 0.9, ease: 'power2.out' });
    state.transitioning = false;
    homeScroll.update(lenis.scroll);
  }

  async function route(slug) {
    if (state.transitioning) return;
    const product = slug ? productsBySlug.get(slug) : null;
    if (product && state.current !== product.slug) {
      if (state.current) await closeProduct();
      state.current = product.slug;
      await openProduct(product);
    } else if (!product && state.current) {
      state.current = null;
      await closeProduct();
    }
  }

  function navigate(slug) {
    if (state.transitioning) return;
    const path = slug ? `/producto/${slug}` : '/';
    if (location.pathname !== path) history.pushState({}, '', path);
    route(slug);
  }

  window.addEventListener('popstate', () => route(slugFromPath()));
  document.querySelectorAll('[data-link]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(null);
    }),
  );
  $('back-btn').addEventListener('click', () => navigate(null));

  return { route, navigate, setView, initialSlug: slugFromPath };
}
