import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createFloor } from '../floor.js';
import { marbleTexture, seededRandom, walnutTexture } from '../textures.js';

/**
 * Mundo "atelier" (línea formal): sastrería de noche. Boiserie de nogal con molduras,
 * piso de mármol negro veteado, ventanal en arco con visillos, bañadores de luz sobre la madera,
 * butaca de cuero coñac, perchero con prendas, consola con rollos de tela y lámparas colgantes.
 */

const WALL_Z = -4.2;

function canvasTexture(w, h, paint, { repeat = [1, 1], srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Alfombra redonda de lana: grafito con guarda dorada. */
function rugTexture() {
  const rand = seededRandom(3);
  return canvasTexture(1024, 1024, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#26211d';
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,240,220' : '0,0,0'},0.05)`;
      ctx.fillRect(rand() * w, rand() * w, 2, 2);
    }
    [
      [0.94, 10, '#b89a64'],
      [0.86, 4, '#8a7350'],
    ].forEach(([r, width, color]) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(c, c, c * r, 0, Math.PI * 2);
      ctx.stroke();
    });
  });
}

/** Ventanal: cielo de noche cálido (luz de ciudad) que se aclara hacia abajo. */
function windowTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a2433');
    g.addColorStop(0.55, '#7a5a44');
    g.addColorStop(1, '#d9a874');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Visillo: pliegues verticales suaves y semitransparentes. */
function sheerTexture() {
  return canvasTexture(
    256,
    16,
    (ctx, w, h) => {
      for (let x = 0; x < w; x++) {
        const v = 0.55 + Math.sin((x / w) * Math.PI * 10) * 0.25 + Math.sin((x / w) * Math.PI * 23) * 0.08;
        ctx.fillStyle = `rgba(255,255,255,${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    },
    { srgb: false },
  );
}

/** Marco de moldura rectangular (cuatro listones) sobre la boiserie. */
function moldingFrame(width, height, material, depth = 0.035, bar = 0.06) {
  const frame = new THREE.Group();
  const h = new THREE.BoxGeometry(width, bar, depth);
  const v = new THREE.BoxGeometry(bar, height, depth);
  [
    [h, 0, height / 2 - bar / 2],
    [h, 0, -height / 2 + bar / 2],
    [v, -width / 2 + bar / 2, 0],
    [v, width / 2 - bar / 2, 0],
  ].forEach(([geo, x, y]) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, depth / 2);
    m.castShadow = m.receiveShadow = true;
    frame.add(m);
  });
  return frame;
}

export function createAtelierWorld() {
  const group = new THREE.Group();
  group.name = 'world-atelier';

  const walnut = new THREE.MeshStandardMaterial({
    map: walnutTexture({ repeat: [3, 2] }),
    roughness: 0.55,
    metalness: 0,
  });
  const walnutTrim = new THREE.MeshStandardMaterial({
    map: walnutTexture({ repeat: [1, 1] }),
    color: '#d9c2ad',
    roughness: 0.4,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: '#b89a64',
    metalness: 1,
    roughness: 0.3,
  });
  const bronze = new THREE.MeshStandardMaterial({
    color: '#2a221b',
    metalness: 0.8,
    roughness: 0.4,
  });

  // Piso de mármol pulido (reflejo nítido al centro) y alfombra bajo la prenda.
  group.add(
    createFloor({
      tint: '#5d5650',
      overlayColor: '#8d8780',
      overlayMap: marbleTexture(),
      overlayOpacity: 0.86,
      roughness: 0.25,
      reflectionFocus: 0.12,
    }).group,
  );
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 128),
    new THREE.MeshStandardMaterial({
      map: rugTexture(),
      roughness: 1,
      transparent: true,
    }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.006;
  rug.receiveShadow = true;
  group.add(rug);

  // Muro de boiserie: zócalo, moldura de silla, paneles altos y cornisa.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7.5), walnut);
  wall.position.set(0, 3.75, WALL_Z);
  wall.receiveShadow = true;
  group.add(wall);
  const rail = (y, height, depth) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(16, height, depth), walnutTrim);
    m.position.set(0, y, WALL_Z + depth / 2);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  };
  rail(0.08, 0.16, 0.06); // zócalo
  rail(1.02, 0.07, 0.07); // moldura de silla
  rail(5.05, 0.18, 0.16); // cornisa

  const PANEL_X = [-5.4, -1.8, 1.8, 5.4];
  PANEL_X.forEach((x) => {
    const upper = moldingFrame(2.6, 3.3, walnutTrim);
    upper.position.set(x, 2.95, WALL_Z);
    const lower = moldingFrame(2.6, 0.62, walnutTrim);
    lower.position.set(x, 0.55, WALL_Z);
    group.add(upper, lower);
  });
  // Panel central más ancho, detrás de la prenda.
  const center = moldingFrame(3, 3.5, walnutTrim);
  center.position.set(0, 2.95, WALL_Z + 0.001);
  group.add(center);

  // Ventanal en arco (izquierda) con parteluces de bronce y visillos.
  const windowGroup = new THREE.Group();
  const archShape = new THREE.Shape();
  archShape.moveTo(-0.75, 0);
  archShape.lineTo(-0.75, 2.4);
  archShape.absarc(0, 2.4, 0.75, Math.PI, 0, true);
  archShape.lineTo(0.75, 0);
  archShape.lineTo(-0.75, 0);
  const glassGeo = new THREE.ShapeGeometry(archShape, 48);
  const pos = glassGeo.attributes.position;
  const uv = glassGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.5 + 0.5, pos.getY(i) / 3.15);
  const glass = new THREE.Mesh(
    glassGeo,
    new THREE.MeshBasicMaterial({
      map: windowTexture(),
      toneMapped: false,
      color: new THREE.Color(0.55, 0.55, 0.55),
    }),
  );
  windowGroup.add(glass);
  const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.1, 0.04), bronze);
  mullionV.position.set(0, 1.55, 0.02);
  windowGroup.add(mullionV);
  [0.8, 1.6, 2.4].forEach((y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.04), bronze);
    m.position.set(0, y, 0.02);
    windowGroup.add(m);
  });
  const sheerMaterial = new THREE.MeshStandardMaterial({
    color: '#cfc2b0',
    alphaMap: sheerTexture(),
    transparent: true,
    opacity: 0.8,
    roughness: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  [-0.62, 0.62].forEach((x) => {
    const sheer = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 3.5), sheerMaterial);
    sheer.position.set(x, 1.75, 0.12);
    windowGroup.add(sheer);
  });
  windowGroup.position.set(-5.4, 1.2, WALL_Z + 0.02);
  group.add(windowGroup);
  const windowLight = new THREE.PointLight('#ffc58a', 6, 6, 2);
  windowLight.position.set(-5.2, 2.6, WALL_Z + 0.9);
  group.add(windowLight);

  // Butaca de cuero coñac.
  const leather = new THREE.MeshPhysicalMaterial({
    color: '#6b3a1f',
    roughness: 0.42,
    clearcoat: 0.5,
    clearcoatRoughness: 0.35,
  });
  const chair = new THREE.Group();
  [
    [new RoundedBoxGeometry(1.05, 0.42, 0.95, 4, 0.08), 0, 0.42, 0],
    [new RoundedBoxGeometry(1.05, 0.85, 0.24, 4, 0.08), 0, 0.85, -0.38],
    [new RoundedBoxGeometry(0.2, 0.62, 0.95, 4, 0.08), -0.5, 0.58, 0],
    [new RoundedBoxGeometry(0.2, 0.62, 0.95, 4, 0.08), 0.5, 0.58, 0],
  ].forEach(([geo, x, y, z]) => {
    const m = new THREE.Mesh(geo, leather);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    chair.add(m);
  });
  [-0.42, 0.42].forEach((x) =>
    [-0.36, 0.36].forEach((z) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.22, 12), brass);
      leg.position.set(x, 0.11, z);
      chair.add(leg);
    }),
  );
  chair.position.set(-3.1, 0, -2.3);
  chair.rotation.y = 0.55;
  group.add(chair);

  // Perchero de latón con prendas colgadas (derecha).
  const rack = new THREE.Group();
  [-0.95, 0.95].forEach((z) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.85, 16), brass);
    post.position.set(0, 0.925, z);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 32), brass);
    foot.position.set(0, 0.015, z);
    rack.add(post, foot);
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.95, 16), brass);
  rod.rotation.x = Math.PI / 2;
  rod.position.y = 1.85;
  rack.add(rod);
  const rand = seededRandom(9);
  const garmentColors = ['#22252b', '#2e3442', '#a8865c', '#3b3a3d', '#1b2233', '#5a4a3a', '#2a2a2e'];
  garmentColors.forEach((color, i) => {
    const garment = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.62, 1.05, 0.06, 3, 0.025), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    body.position.y = -0.62;
    body.castShadow = true;
    const shoulders = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.14, 0.07, 3, 0.03), body.material);
    shoulders.position.y = -0.1;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 24, Math.PI * 1.4), brass);
    hook.rotation.z = Math.PI * 0.8;
    hook.position.y = 0.02;
    garment.add(body, shoulders, hook);
    garment.position.set(0, 1.83, -0.8 + i * 0.26);
    garment.rotation.y = Math.PI / 2 + (rand() - 0.5) * 0.12;
    rack.add(garment);
  });
  rack.position.set(4.1, 0, -2.4);
  rack.rotation.y = -0.25;
  group.add(rack);

  // Consola de nogal con rollos de tela.
  const consoleTop = new THREE.Mesh(new RoundedBoxGeometry(2, 0.06, 0.55, 3, 0.02), walnutTrim);
  consoleTop.position.set(2.3, 0.86, WALL_Z + 0.4);
  consoleTop.castShadow = consoleTop.receiveShadow = true;
  group.add(consoleTop);
  [-0.92, 0.92].forEach((dx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.83, 0.5), brass);
    leg.position.set(2.3 + dx, 0.415, WALL_Z + 0.4);
    group.add(leg);
  });
  ['#1d2a44', '#3a3a3e', '#b08a5c', '#5a1f27', '#d8cfbd'].forEach((color, i) => {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 32), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    bolt.rotation.x = Math.PI / 2;
    const row = i < 3 ? 0 : 1;
    bolt.position.set(1.7 + (row ? 0.11 : 0) + (i % 3) * 0.22, 0.99 + row * 0.19, WALL_Z + 0.4);
    bolt.castShadow = true;
    group.add(bolt);
  });

  // Lámparas colgantes: pantalla de latón y foco cálido.
  const bulbMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffd9a0').multiplyScalar(2.2),
    toneMapped: false,
  });
  [-2.2, 2.2].forEach((x) => {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2, 8), bronze);
    cord.position.set(x, 5.6, -1.6);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.3, 48, 1, true),
      new THREE.MeshStandardMaterial({
        color: '#b89a64',
        metalness: 1,
        roughness: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    shade.position.set(x, 4.5, -1.6);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 12), bulbMaterial);
    bulb.position.set(x, 4.38, -1.6);
    const light = new THREE.PointLight('#ffcf94', 5, 5, 2);
    light.position.set(x, 4.2, -1.6);
    group.add(cord, shade, bulb, light);
  });

  // Bañadores de luz sobre la boiserie: "abanicos" cálidos que dan profundidad a la madera.
  [-3.6, 0, 3.6].forEach((x) => {
    const washer = new THREE.SpotLight('#ffcf94', 28, 7, 0.55, 1, 1.6);
    washer.position.set(x, 5.6, WALL_Z + 0.6);
    washer.target.position.set(x, 1.4, WALL_Z);
    group.add(washer, washer.target);
  });

  // Iluminación de la prenda y del ambiente.
  const hemi = new THREE.HemisphereLight('#ffe3c4', '#140e0a', 0.45);
  const key = new THREE.SpotLight('#fff1dc', 70, 16, 0.45, 0.85, 1.6);
  key.position.set(2.4, 5.6, 4);
  key.target.position.set(0, 0.9, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const rim = new THREE.PointLight('#ffb36b', 14, 6, 2);
  rim.position.set(0, 2.6, -2.2);
  group.add(hemi, key, key.target, rim);

  return {
    group,
    mood: {
      background: '#120d0a',
      fog: '#160f0b',
      fogDensity: 0.05,
      exposure: 1.05,
      envIntensity: 0.35,
      bloom: { strength: 0.35, radius: 0.5, threshold: 0.95 },
    },
    marquee: { color: '#d8c3a0', opacity: 0.12 },
    ui: 'dark',
    tick() {}, // escena estática: sin partículas
  };
}
