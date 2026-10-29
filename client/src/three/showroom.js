import * as THREE from 'three';
import gsap from 'gsap';
import { createPhotoJacket } from './photoJacket.js';
import { createFloor } from './floor.js';
import { createGallery, ROTUNDA, rotundaFrame, rotundaPoint } from './gallery.js';
import { concreteTexture, marbleTexture } from './textures.js';

export const JACKET_Y = 1.35;
const NEUTRAL_MOOD = {
  background: '#060606',
  fog: '#070707',
  fogDensity: 0.022,
  exposure: 1.3,
  envIntensity: 0.55,
  // Bloom casi apagado: la sala de nogal se ve sobria, sin halos brillantes.
  bloom: { strength: 0.18, radius: 0.4, threshold: 0.98 },
};
const DIMMED = 0.6; // brillo de las prendas no seleccionadas durante el hover

// Pedestal torneado: piedra negra pulida con canto biselado, cara superior en piedra gris apomazada
// y una banda de latón en la base (a la vista de frente, sin líneas finas que se dentan).
const PEDESTAL_RADIUS = 0.78;
const PEDESTAL_HEIGHT = 0.1;
const BRASS_GLOW = { idle: 0.02, active: 0.18 }; // el latón solo se aviva apenas al elegir la prenda

const isLowPower = () => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

function radialTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function flatDisc(size, material, y) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

const shared = {};
function pedestalMaterials() {
  if (shared.stone) return shared;
  shared.stone = new THREE.MeshStandardMaterial({
    color: '#0f0f11',
    roughness: 0.16,
    metalness: 0.4,
  });
  shared.top = new THREE.MeshStandardMaterial({
    color: '#3d3b39',
    map: concreteTexture({ base: '#8a8682', seed: 31, repeat: [1, 1] }),
    roughness: 0.55,
    metalness: 0.05,
  });
  shared.occlusion = radialTexture([
    [0, 'rgba(0,0,0,0.9)'],
    [0.4, 'rgba(0,0,0,0.65)'],
    [0.7, 'rgba(0,0,0,0.2)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  return shared;
}

function createPedestal() {
  const m = pedestalMaterials();
  const group = new THREE.Group();
  const R = PEDESTAL_RADIUS;
  const H = PEDESTAL_HEIGHT;
  const bevel = 0.016;

  // Perfil torneado: base → costado → bisel → borde de la cara superior.
  const profile = [
    new THREE.Vector2(0, 0.02),
    new THREE.Vector2(R - 0.012, 0.02),
    new THREE.Vector2(R, 0.032),
    new THREE.Vector2(R, H - bevel),
    new THREE.Vector2(R - bevel * 0.3, H - bevel * 0.3),
    new THREE.Vector2(R - bevel, H),
    new THREE.Vector2(0, H),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 160), m.stone);
  body.castShadow = body.receiveShadow = true;

  const top = new THREE.Mesh(new THREE.CircleGeometry(R - bevel, 160), m.top);
  top.rotation.x = -Math.PI / 2;
  top.position.y = H + 0.0008;
  top.receiveShadow = true;

  // Banda de latón cepillado en la base: se ve de frente y atrapa la luz sin generar líneas finas.
  const brass = new THREE.MeshStandardMaterial({
    color: '#b89a64',
    metalness: 1,
    roughness: 0.32,
    emissive: '#e8d3a8',
    emissiveIntensity: BRASS_GLOW.idle,
  });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.012, R * 1.02, 0.026, 160, 1, true), brass);
  band.position.y = 0.013;

  const occlusion = flatDisc(
    R * 3,
    new THREE.MeshBasicMaterial({
      map: m.occlusion,
      transparent: true,
      depthWrite: false,
    }),
    0.004,
  );
  group.add(occlusion, body, top, band);
  return { group, brass };
}

/** @param rackProducts prendas formales que cuelgan en los percheros de los nichos laterales */
export function createShowroom(engine, products, textures, { friezeText, rackProducts = [] } = {}) {
  const { scene, camera } = engine;
  const lowPower = isLowPower();
  const group = new THREE.Group();
  group.name = 'showroom';
  scene.add(group);

  // Prendas en arco alrededor del centro de la rotonda (la del medio al fondo, las de los lados más cerca).
  const garmentAngles = products.map((_, i) => (i - (products.length - 1) / 2) * ROTUNDA.step);
  const center = Math.floor(products.length / 2);

  // Mármol negro pulido con vetas finas: refleja la sala como un espejo oscuro.
  const floor = createFloor({
    tint: '#3a3836',
    overlayColor: '#8f8b86',
    overlayMap: marbleTexture({ repeat: [5, 5], veins: 10 }),
    overlayOpacity: 0.84,
    roughness: 0.25,
    reflectionFocus: 0.16,
  });
  group.add(floor.group);

  const rackTextures = rackProducts.map((p) => textures.get(p.slug)?.front).filter(Boolean);
  const gallery = createGallery({ garmentAngles, rackTextures, lowPower, friezeText });
  group.add(gallery.group);

  // Luz general muy baja: la escena la dibujan los focos y los nichos.
  // Luz general cálida y baja: deja leer la madera negra sin quitarle penumbra a la sala.
  group.add(new THREE.HemisphereLight('#f0dcc4', '#0a0908', 0.7));

  const jackets = products.map((product, i) => {
    const angle = garmentAngles[i];
    const { inward, tangent } = rotundaFrame(angle);
    const jacket = createPhotoJacket(product, textures.get(product.slug), -JACKET_Y + PEDESTAL_HEIGHT);
    rotundaPoint(angle, ROTUNDA.garmentRadius, JACKET_Y, jacket.group.position);
    jacket.group.rotation.y = -angle; // mira al centro de la rotonda
    jacket.baseRotation = jacket.group.rotation.y;
    jacket.angle = angle;
    jacket.inward = inward;
    jacket.tangent = tangent;
    jacket.meshes.forEach((mesh) => (mesh.castShadow = true));
    group.add(jacket.group);

    // Foco frontal: dibuja la silueta de la prenda como sombra dentro de su nicho.
    const spot = new THREE.SpotLight('#fff3e2', i === center ? 60 : 50, 18, 0.32, 0.8, 1.5);
    spot.position.copy(jacket.group.position).addScaledVector(inward, 6.5).addScaledVector(tangent, 1.1).setY(2.5);
    rotundaPoint(angle, ROTUNDA.wallRadius + 0.5, 1.05, spot.target.position);
    spot.castShadow = true;
    const size = lowPower ? 512 : 1024;
    spot.shadow.mapSize.set(size, size);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    group.add(spot, spot.target);

    const pedestal = createPedestal();
    pedestal.group.position.set(jacket.group.position.x, 0, jacket.group.position.z);
    group.add(pedestal.group);
    jacket.pedestal = pedestal;
    // Sombra de contacto ajustada al disco: más estrecha que la prenda y más densa.
    jacket.shadow.scale.set((PEDESTAL_RADIUS * 1.55) / jacket.width, (PEDESTAL_RADIUS * 0.85) / 0.7, 1);
    jacket.shadow.material.opacity = 0.9;
    return jacket;
  });

  // Hover y selección por raycast
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = -1;
  let interactive = false;
  const listeners = { hover: () => {}, select: () => {} };

  function pick(clientX, clientY) {
    ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    let best = -1;
    let bestDistance = Infinity;
    jackets.forEach((j, i) => {
      const hit = raycaster.intersectObjects(j.meshes, false)[0];
      if (hit && hit.distance < bestDistance) {
        best = i;
        bestDistance = hit.distance;
      }
    });
    return best;
  }

  /** @param silent true para el foco guiado por scroll: no muestra la etiqueta ni mueve la cámara. */
  function setHovered(index, silent = false) {
    if (index === hovered) return;
    hovered = index;
    jackets.forEach((j, i) => {
      const active = i === index;
      const scale = active ? 1.05 : 1;
      gsap.to(j.group.scale, { x: scale, y: scale, z: scale, duration: 0.7, ease: 'power3.out' });
      gsap.to(j.pedestal.brass, { emissiveIntensity: active ? BRASS_GLOW.active : BRASS_GLOW.idle, duration: 0.7 });
      const brightness = index < 0 ? j.baseBrightness : active ? 1 : DIMMED;
      gsap.to(j.brightnessTargets, { r: brightness, g: brightness, b: brightness, duration: 0.6, ease: 'power2.out' });
      if (active) j.sweepShine();
    });
    const product = index >= 0 ? jackets[index].product : null;
    gallery.setActive(index >= 0 ? index : null);
    if (!silent) listeners.hover(product, index);
  }

  window.addEventListener('pointermove', (e) => {
    if (!interactive || e.pointerType === 'touch') return;
    setHovered(pick(e.clientX, e.clientY));
    document.body.style.cursor = hovered >= 0 ? 'pointer' : '';
  });
  // Solo cuenta un clic que empezó sobre el lienzo con el showroom ya activo
  // (evita que el clic de "entrar" o de otra capa abra un producto por accidente).
  let pressedOnCanvas = false;
  let swipeStart = null;
  const canvas = engine.renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => {
    pressedOnCanvas = interactive;
    swipeStart = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null;
  });
  // En táctil, deslizar en horizontal recorre las prendas.
  canvas.addEventListener('pointerup', (e) => {
    if (!interactive || !swipeStart) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    pressedOnCanvas = false;
    const from = hovered < 0 ? center : hovered;
    setHovered(THREE.MathUtils.clamp(from + (dx < 0 ? 1 : -1), 0, jackets.length - 1));
  });
  canvas.addEventListener('click', (e) => {
    if (!interactive || !pressedOnCanvas) return;
    pressedOnCanvas = false;
    const index = pick(e.clientX, e.clientY);
    if (index < 0) return;
    // En pantallas táctiles el primer toque "enciende" la prenda y el segundo la abre.
    if (e.pointerType === 'touch' && hovered !== index) return setHovered(index);
    listeners.select(jackets[index].product);
  });

  engine.onTick((dt, t) => {
    if (!group.visible) return;
    jackets.forEach((j, i) => {
      const bob = Math.sin(t * 0.9 + i * 1.7);
      j.pivot.position.y = bob * 0.03;
      j.pivot.rotation.y = Math.sin(t * 0.35 + i) * 0.035; // leve vaivén, como colgada en el aire
      // Cuando la prenda sube, su sombra se abre y se aclara (y al revés).
      j.shadow.material.opacity = 0.9 - bob * 0.12;
    });
    gallery.tick(dt);
  });

  const halfFovTan = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const aspect = () => window.innerWidth / window.innerHeight;

  /**
   * Encuadre general. En horizontal la cámara mira la rotonda desde afuera y entran todas las prendas;
   * en vertical se acerca a una sola (la seleccionada o la central) y deja asomar las vecinas.
   */
  function basePose(focusIndex = hovered) {
    const portrait = aspect() < 0.9;
    if (portrait) {
      const index = focusIndex >= 0 ? focusIndex : center;
      const j = jackets[index];
      const distance = THREE.MathUtils.clamp(1.55 / (halfFovTan() * aspect()), 8, 17);
      return {
        pos: j.group.position.clone().addScaledVector(j.inward, distance).setY(1.6),
        target: j.group.position.clone().setY(1.3),
        portrait,
      };
    }
    // Las prendas de los extremos (más cercanas) definen el ancho que debe entrar.
    const outer = jackets[jackets.length - 1].group.position;
    const halfWidth = Math.abs(outer.x) + 1.1;
    const distance = THREE.MathUtils.clamp(halfWidth / (halfFovTan() * aspect()), 9, 22);
    return { pos: new THREE.Vector3(0, 1.9, outer.z + distance), target: new THREE.Vector3(0, 1.3, 0.6), portrait };
  }

  /** Parada frente a una prenda: la cámara entra a la rotonda y la mira de frente. */
  function focusPose(index, near) {
    const j = jackets[index];
    const g = j.group.position;
    if (aspect() < 0.9) {
      // Vertical: prenda arriba y centrada, el texto va abajo.
      const distance = THREE.MathUtils.clamp(1.3 / (halfFovTan() * aspect()), 6, 14) * (near ? 0.92 : 1);
      return { pos: g.clone().addScaledVector(j.inward, distance).setY(1.5), target: g.clone().setY(0.92) };
    }
    // Horizontal: la prenda queda en el tercio derecho; el texto, a la izquierda.
    const distance = near ? 5.7 : 6.4;
    const side = THREE.MathUtils.clamp(distance * halfFovTan() * aspect() * 0.36, 0.5, 1.2);
    return {
      pos: g
        .clone()
        .addScaledVector(j.inward, distance)
        .addScaledVector(j.tangent, -side * 0.55)
        .setY(near ? 1.4 : 1.55),
      target: g.clone().addScaledVector(j.tangent, -side).setY(1.28),
    };
  }

  /** Cierre: la cámara sale de la rotonda y sube apenas, mirando el friso. */
  function cranePose() {
    const base = basePose(-1);
    return { pos: base.pos.clone().multiplyScalar(1.12).setY(2.4), target: new THREE.Vector3(0, 2.6, -1.5) };
  }

  /*
   * Coreografía al bajar por el inicio: plano general → la cámara entra y se detiene en cada prenda
   * (una parada "lejos" y otra "cerca": mientras se lee, sigue acercándose) → salida final.
   * Las claves se reparten parejas según la cantidad de prendas.
   */
  const ease = (t) => t * t * (3 - 2 * t);
  const keyCount = jackets.length * 2 + 2;
  const keyAt = (k) => k / (keyCount - 1);
  const focusRanges = jackets.map((_, i) => [(keyAt(2 * i) + keyAt(2 * i + 1)) / 2, (keyAt(2 * i + 2) + keyAt(2 * i + 3)) / 2]);

  function scrollPose(p) {
    const poses = [basePose()];
    jackets.forEach((_, i) => poses.push(focusPose(i, false), focusPose(i, true)));
    poses.push(cranePose());
    const clamped = THREE.MathUtils.clamp(p, 0, 1);
    const i = Math.min(Math.floor(clamped * (keyCount - 1)), keyCount - 2);
    const t = ease(clamped * (keyCount - 1) - i);
    const focus = focusRanges.findIndex(([a, b]) => clamped >= a && clamped < b);
    return {
      pos: poses[i].pos.clone().lerp(poses[i + 1].pos, t),
      target: poses[i].target.clone().lerp(poses[i + 1].target, t),
      focus,
    };
  }

  const tmp = new THREE.Vector3();
  return {
    scrollPose,
    /** Cantidad de tramos del recorrido (para dimensionar el scroll). */
    stops: keyCount - 1,
    /** Foco guiado por scroll (sin etiqueta flotante). */
    focus: (index) => setHovered(index, true),
    get hoveredIndex() {
      return hovered;
    },
    group,
    jackets,
    basePose,
    neutralMood: NEUTRAL_MOOD,
    onHover: (fn) => (listeners.hover = fn),
    onSelect: (fn) => (listeners.select = fn),
    setInteractive(value) {
      interactive = value;
      if (!value) document.body.style.cursor = '';
    },
    setHovered,
    clearHover: () => setHovered(-1),
    /** Posición en pantalla sobre una prenda (para la etiqueta HTML). */
    labelPosition(slug) {
      const jacket = jackets.find((j) => j.product.slug === slug);
      if (!jacket) return null;
      tmp.copy(jacket.group.position).add({ x: 0, y: 1.3, z: 0 }).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp.y * 0.5 + 0.5) * window.innerHeight };
    },
    jacketBySlug: (slug) => jackets.find((j) => j.product.slug === slug),
  };
}
