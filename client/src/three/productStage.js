import * as THREE from 'three';
import gsap from 'gsap';
import { createPhotoJacket } from './photoJacket.js';
import { createMarquee } from './marquee.js';
import { createAtelierWorld } from './worlds/atelier.js';
import { createLoftWorld } from './worlds/loft.js';
import { createPavilionWorld } from './worlds/pavilion.js';
import { JACKET_Y } from './showroom.js';

// Un mundo por línea: atelier (formal), pavilion (chaquetas de pista) y loft (oversize).
const WORLD_FACTORIES = { atelier: createAtelierWorld, pavilion: createPavilionWorld, loft: createLoftWorld };
const CENTER = new THREE.Vector3(0, JACKET_Y, 0);
const TURN = Math.PI;

/**
 * Paradas del recorrido: la cámara se mueve en un arco frontal (ángulo, radio, altura, objetivo)
 * porque la chaqueta es una foto; para mostrar la espalda gira la prenda (`turn`), no la cámara.
 */
const INTRO_STOP = { angle: 0, radius: 6.2, height: 0.25, target: [0, 0, 0], turn: 0 };
const FEATURE_STOPS = [
  { angle: 0.32, radius: 2.5, height: 0.5, target: [0.3, 0.35, 0], turn: 0 }, // pecho y cierre
  { angle: -0.22, radius: 3.3, height: 0.3, target: [0, 0.25, 0], turn: TURN }, // espalda
  { angle: 0.3, radius: 2.5, height: -0.35, target: [-0.55, -0.45, 0], turn: 2 * TURN }, // puño
  { angle: -0.3, radius: 2.6, height: 0.05, target: [0.35, -0.2, 0], turn: 2 * TURN }, // bolsillo
];
const FINAL_STOP = { angle: 0, radius: 5.6, height: 0.1, target: [0, 0.05, 0] };

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** @param hasBack si no hay foto de la espalda la prenda no gira (solo se mueve la cámara). */
export function buildStops(featureCount, hasBack = true) {
  const features = Array.from({ length: featureCount }, (_, i) => {
    const stop = FEATURE_STOPS[i % FEATURE_STOPS.length];
    // Con más de 4 características la prenda sigue girando en vueltas adicionales.
    const turn = hasBack ? stop.turn + Math.floor(i / FEATURE_STOPS.length) * 2 * TURN : 0;
    return { ...stop, turn };
  });
  const lastTurn = features.at(-1)?.turn ?? 0;
  return [{ ...INTRO_STOP }, ...features, { ...FINAL_STOP, turn: Math.ceil(lastTurn / (2 * TURN)) * 2 * TURN }];
}

/** En pantallas verticales la cámara se aleja para que la chaqueta quepa a lo ancho. */
export const radiusScaleFor = (aspect) => THREE.MathUtils.clamp(1.05 / aspect, 1, 2.2);

/** Cámara y giro de la prenda para un progreso de 0 a 1, con pausas en cada parada. */
export function cameraAt(stops, progress, outPos = new THREE.Vector3(), outTarget = new THREE.Vector3(), radiusScale = 1) {
  const s = Math.min(Math.max(progress, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(s), stops.length - 2);
  const f = smoothstep(0.18, 0.82, s - i);
  const a = stops[i];
  const b = stops[i + 1];
  const lerp = (x, y) => x + (y - x) * f;
  const angle = lerp(a.angle, b.angle);
  const radius = lerp(a.radius, b.radius) * radiusScale;
  outPos.set(Math.sin(angle) * radius, CENTER.y + lerp(a.height, b.height), Math.cos(angle) * radius);
  outTarget.set(CENTER.x + lerp(a.target[0], b.target[0]), CENTER.y + lerp(a.target[1], b.target[1]), CENTER.z + lerp(a.target[2], b.target[2]));
  return { pos: outPos, target: outTarget, turn: lerp(a.turn, b.turn), index: Math.round(s) };
}

export function createProductStage(engine, rig, content, textures) {
  const { scene } = engine;
  const worlds = {};
  const jackets = {};
  const marquee = createMarquee(content.marquee_text ?? '');
  scene.add(marquee.group);

  let active = null; // { product, world, jacket, stops }
  const currentRadiusScale = () => radiusScaleFor(window.innerWidth / window.innerHeight);
  let lastProgress = 0;
  let desiredTurn = 0;
  let currentTurn = 0;

  function worldFor(requested) {
    // Un mundo desconocido (p. ej. datos viejos en caché) no rompe la tienda: se usa el pabellón.
    const theme = WORLD_FACTORIES[requested] ? requested : 'pavilion';
    if (!worlds[theme]) {
      worlds[theme] = WORLD_FACTORIES[theme]();
      worlds[theme].group.visible = false;
      scene.add(worlds[theme].group);
    }
    return worlds[theme];
  }

  function jacketFor(product) {
    if (!jackets[product.slug]) {
      const jacket = createPhotoJacket(product, textures.get(product.slug), -JACKET_Y);
      jacket.group.position.copy(CENTER);
      jacket.meshes.forEach((mesh) => (mesh.castShadow = true));
      jacket.group.visible = false;
      scene.add(jacket.group);
      jackets[product.slug] = jacket;
    }
    return jackets[product.slug];
  }

  function applyProgress(progress) {
    const { pos, target, turn, index } = cameraAt(active.stops, progress, undefined, undefined, currentRadiusScale());
    rig.desiredPos.copy(pos);
    rig.desiredTarget.copy(target);
    desiredTurn = turn;
    return index;
  }

  // Al cambiar el tamaño de la ventana se recalcula el encuadre de la parada actual.
  engine.onResize(() => {
    if (active) applyProgress(lastProgress);
  });

  engine.onTick((dt, t) => {
    if (!active) return;
    active.world.tick(dt, t);
    marquee.tick(dt);
    const { pivot } = active.jacket;
    pivot.position.y = Math.sin(t * 0.8) * 0.03;
    currentTurn += (desiredTurn - currentTurn) * (1 - Math.exp(-3.5 * dt));
    active.jacket.setTurn(currentTurn);
  });

  return {
    marquee,
    /** Pre-construye todos los mundos durante la pantalla de carga. */
    prepare(products) {
      products.forEach((p) => {
        worldFor(p.theme);
        jacketFor(p);
      });
    },
    enter(product) {
      const world = worldFor(product.theme);
      world.setAccent?.(product.colors.accent); // varias prendas comparten mundo: cada una lo tiñe apenas
      const jacket = jacketFor(product);
      Object.values(worlds).forEach((w) => (w.group.visible = w === world));
      Object.values(jackets).forEach((j) => (j.group.visible = j === jacket));
      currentTurn = 0;
      jacket.setTurn(0);
      gsap.delayedCall(1.4, () => jacket.sweepShine({ strength: 0.9, duration: 1.6 }));
      active = { product, world, jacket, stops: buildStops(product.features.length, jacket.hasBack) };
      lastProgress = 0;
      desiredTurn = 0;
      marquee.setStyle(world.marquee);
      marquee.show(false);
      engine.setMood(world.mood, 0.01);
      // La cámara arranca lejos y se acerca: el "vuelo" de entrada al mundo.
      const start = cameraAt(active.stops, 0, undefined, undefined, currentRadiusScale());
      rig.jumpTo(
        start.pos
          .clone()
          .multiplyScalar(1.9)
          .setY(CENTER.y + 1.4),
        start.target,
      );
      rig.damping = 1.6;
      gsap.to(rig, { damping: 3.2, duration: 2.5, ease: 'power1.in' });
      return world;
    },
    exit() {
      Object.values(worlds).forEach((w) => (w.group.visible = false));
      Object.values(jackets).forEach((j) => (j.group.visible = false));
      marquee.show(false);
      marquee.group.visible = false;
      active = null;
    },
    /** Avance del scroll (0..1) → cámara y giro. Devuelve el índice de la parada más cercana. */
    setProgress(progress) {
      if (!active) return 0;
      lastProgress = progress;
      return applyProgress(progress);
    },
    stopCount: () => active?.stops.length ?? 0,
    showMarquee: (visible) => marquee.show(visible),
    backgroundFor: (product) => worldFor(product.theme).mood.background,
  };
}
