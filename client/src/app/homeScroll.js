import { $, prefersReducedMotion } from '../ui/dom.js';
import {
  CAMERA_FLIGHT_MAX_VH,
  CHOREOGRAPHY_TAIL_VH,
  FOCUS_CONFIRM_MS,
  FOCUS_REAPPLY,
  FOCUS_RECHECK_MS,
  INTERACTIVE_VH,
  SCROLL_VH_PER_STOP,
} from './constants.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Scroll del inicio: coreografía de cámara por las prendas del showroom y luego la colección. */
export function createHomeScroll({ engine, rig, showroom, showroomProducts, homeStory, sound, lenis, state, hideLabel }) {
  const showroomUi = $('showroom-ui');
  const topbar = document.querySelector('.topbar');
  const spacer = document.querySelector('.home__spacer');
  // Más prendas, recorrido más largo.
  spacer.style.height = `${showroom.stops * SCROLL_VH_PER_STOP}vh`;

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

  /** Scroll que dura la coreografía: termina cuando la colección ya asoma por abajo. */
  const travel = () => Math.max(1, spacer.offsetHeight - viewH * CHOREOGRAPHY_TAIL_VH);

  /** Atenúa la interfaz del showroom, pausa el render y ajusta la barra según la posición del scroll. */
  function updateChrome(scroll) {
    const fade = Math.min(1, scroll / (viewH * 0.3));
    showroomUi.style.opacity = String(1 - fade);
    showroomUi.style.pointerEvents = fade > 0.6 ? 'none' : '';
    engine.setPaused(scroll > spacer.offsetHeight + viewH * 0.05);
    topbar.classList.toggle('is-solid', scroll > spacer.offsetHeight - viewH * 0.3);
    showroom.setInteractive(state.entered && !state.transitioning && scroll < viewH * INTERACTIVE_VH);
    if (scroll > viewH * INTERACTIVE_VH) hideLabel();
  }

  /** Cambio de prenda con confirmación: así la inercia del dedo en el borde entre dos prendas no hace ir y volver el panel. */
  function applyFocus(pose, progress) {
    if (pose.focus !== pendingFocus) {
      pendingFocus = pose.focus;
      pendingSince = performance.now();
    }
    const settled = performance.now() - pendingSince > FOCUS_CONFIRM_MS || state.scrollFocus === FOCUS_REAPPLY;
    if (!settled && pose.focus !== state.scrollFocus) {
      // Si el scroll se detiene justo aquí, se confirma igual al cumplirse el plazo.
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => update(lenis.scroll), FOCUS_RECHECK_MS);
    }
    if (pose.focus !== state.scrollFocus && settled) {
      state.scrollFocus = pose.focus;
      // De vuelta arriba: en vertical la prenda central queda encendida; en horizontal, ninguna.
      const rest = showroom.basePose().portrait ? Math.floor(showroomProducts.length / 2) : -1;
      showroom.focus(pose.focus >= 0 ? pose.focus : progress < 0.5 ? rest : -1);
      if (pose.focus >= 0) sound.blip();
    }
  }

  function update(scroll) {
    updateChrome(scroll);
    if (!state.entered || state.transitioning || state.current !== null) return;
    const progress = clamp01(scroll / travel());
    const pose = showroom.scrollPose(progress);
    rig.desiredPos.copy(pose.pos);
    rig.desiredTarget.copy(pose.target);
    applyFocus(pose, progress);
    homeStory.update(state.scrollFocus);
  }

  // La pista lleva a la primera parada del recorrido.
  $('home-hint').addEventListener('click', () => {
    const firstStop = (spacer.offsetHeight - window.innerHeight * CHOREOGRAPHY_TAIL_VH) * (1.2 / showroom.stops);
    lenis.scrollTo(firstStop, { duration: prefersReducedMotion() ? 0 : 1.6 });
  });

  return {
    update,
    /** ¿La escena 3D sigue a la vista en esta posición del scroll? (si no, se abre el producto con un fundido directo) */
    isSceneVisible: (scroll) => scroll < spacer.offsetHeight - window.innerHeight * CAMERA_FLIGHT_MAX_VH,
  };
}
