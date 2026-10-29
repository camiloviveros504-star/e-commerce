import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createFloor } from '../floor.js';
import { concreteTexture, seededRandom } from '../textures.js';

/**
 * Mundo "loft" (línea oversize): loft industrial refinado de noche. Ventanal de acero negro
 * con la ciudad iluminada detrás, columnas y piso de concreto pulido, banca de travertino con
 * libros de arte y un jarrón, lámpara de arco de latón, perchero mínimo y alfombra de lana.
 */

const WALL_Z = -4.6;

function canvasTexture(w, h, paint, repeat = [1, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Ciudad de noche: cielo violeta azulado, siluetas de edificios y ventanas encendidas. */
function skylineTexture() {
  const rand = seededRandom(61);
  return canvasTexture(2048, 1024, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b0e1a');
    sky.addColorStop(0.6, '#1d2238');
    sky.addColorStop(1, '#3a3346');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // Tres planos de edificios: los lejanos más claros y difusos.
    [
      ['#1a1d2c', 0.35, 0.55, 0.12],
      ['#12141f', 0.5, 0.75, 0.22],
      ['#0a0b12', 0.62, 0.95, 0.38],
    ].forEach(([color, minTop, maxTop, lit]) => {
      let x = 0;
      while (x < w) {
        const bw = 60 + rand() * 160;
        const top = h * (minTop + rand() * (maxTop - minTop) * 0.6);
        ctx.fillStyle = color;
        ctx.fillRect(x, top, bw, h - top);
        for (let wy = top + 12; wy < h - 8; wy += 16) {
          for (let wx = x + 8; wx < x + bw - 8; wx += 14) {
            if (rand() < lit) {
              const warm = rand() > 0.3;
              ctx.fillStyle = warm
                ? `rgba(255,${190 + rand() * 40},${120 + rand() * 50},${0.5 + rand() * 0.4})`
                : `rgba(180,210,255,${0.35 + rand() * 0.3})`;
              ctx.fillRect(wx, wy, 6, 8);
            }
          }
        }
        x += bw + rand() * 10;
      }
    });
  });
}

/** Travertino: beige con vetas horizontales y poros. */
function travertineTexture() {
  const rand = seededRandom(13);
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cbbda5';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? '150,130,100' : '235,225,205'},${0.15 + rand() * 0.2})`;
      ctx.fillRect(0, rand() * h, w, 1 + rand() * 4);
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = 'rgba(120,100,75,0.45)';
      ctx.beginPath();
      ctx.ellipse(rand() * w, rand() * h, 1 + rand() * 4, 0.6 + rand(), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Alfombra de lana gris piedra con trama fina y borde liso. */
function rugTexture() {
  const rand = seededRandom(7);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5b5853';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,250,240' : '0,0,0'},0.05)`;
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(30,28,26,0.6)';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
  });
}

export function createLoftWorld() {
  const group = new THREE.Group();
  group.name = 'world-loft';
  const steel = new THREE.MeshStandardMaterial({ color: '#141518', metalness: 0.7, roughness: 0.38 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b89a64', metalness: 1, roughness: 0.3 });
  const plaster = new THREE.MeshStandardMaterial({
    map: concreteTexture({ base: '#6e6b67', seed: 52, repeat: [3, 2] }),
    color: '#8c8883',
    roughness: 0.92,
  });

  group.add(
    createFloor({
      tint: '#6a6560',
      overlayColor: '#5e5a55',
      overlayMap: concreteTexture({ base: '#9b958e', seed: 17, repeat: [9, 9] }),
      overlayOpacity: 0.84,
      roughness: 0.45,
      reflectionFocus: 0.12,
    }).group,
  );
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.5), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, 0.2);
  rug.receiveShadow = true;
  group.add(rug);

  // Muro con ventanal: macizos de estuco a los lados y arriba, vano de 6,4 × 4,4 m al centro.
  const W = 6.4;
  const H = 4.4;
  const SILL = 0.5;
  [
    [-(W / 2 + 2.3), 3.6, 4.6, 7.2],
    [W / 2 + 2.3, 3.6, 4.6, 7.2],
    [0, (SILL + H + 7.2) / 2, W, 7.2 - SILL - H],
    [0, SILL / 2, W, SILL],
  ].forEach(([x, y, w, h]) => {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.35), plaster);
    block.position.set(x, y, WALL_Z - 0.175);
    block.castShadow = block.receiveShadow = true;
    group.add(block);
  });
  // Perfilería de acero: marco, 4 parantes y 2 travesaños.
  const frame = new THREE.Group();
  const bar = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), steel);
    m.position.set(x, y, 0);
    m.castShadow = true;
    frame.add(m);
  };
  bar(W, 0.08, 0, SILL);
  bar(W, 0.08, 0, SILL + H);
  for (let i = 0; i <= 4; i++) bar(0.07, H, -W / 2 + (W / 4) * i, SILL + H / 2);
  [1, 2].forEach((j) => bar(W, 0.05, 0, SILL + (H / 3) * j));
  frame.position.z = WALL_Z - 0.1;
  group.add(frame);
  // Ciudad detrás (más lejos y más grande: paralaje real al mover la cámara).
  const skyline = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 13),
    new THREE.MeshBasicMaterial({ map: skylineTexture(), toneMapped: false, fog: false }),
  );
  skyline.position.set(0, 4.2, WALL_Z - 6);
  group.add(skyline);

  // Columnas de concreto.
  [-3.9, 3.9].forEach((x) => {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.2, 0.5), plaster);
    column.position.set(x, 3.6, WALL_Z + 0.6);
    column.castShadow = column.receiveShadow = true;
    group.add(column);
  });

  // Banca de travertino con libros de arte y un jarrón de cerámica.
  const travertine = new THREE.MeshStandardMaterial({ map: travertineTexture(), roughness: 0.7 });
  const bench = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.46, 0.55, 3, 0.03), travertine);
  bench.position.set(-2.5, 0.23, -3.2);
  bench.rotation.y = 0.18;
  bench.castShadow = bench.receiveShadow = true;
  group.add(bench);
  ['#1d1d1f', '#c9c2b6', '#7b2a22'].forEach((color, i) => {
    const book = new THREE.Mesh(
      new RoundedBoxGeometry(0.42 - i * 0.04, 0.05, 0.32 - i * 0.03, 2, 0.008),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    book.position.set(-2.95, 0.485 + i * 0.05, -3.12);
    book.rotation.y = 0.18 + (i - 1) * 0.12;
    book.castShadow = true;
    group.add(book);
  });
  const vaseProfile = [
    [0, 0],
    [0.09, 0],
    [0.12, 0.08],
    [0.13, 0.2],
    [0.08, 0.34],
    [0.05, 0.4],
    [0.06, 0.44],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const vase = new THREE.Mesh(
    new THREE.LatheGeometry(vaseProfile, 64),
    new THREE.MeshPhysicalMaterial({ color: '#e8e1d4', roughness: 0.55, clearcoat: 0.3 }),
  );
  vase.position.set(-1.95, 0.46, -3.3);
  vase.castShadow = true;
  group.add(vase);

  // Lámpara de arco: base de mármol, arco de latón y pantalla que ilumina la banca.
  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.08, 48),
    new THREE.MeshStandardMaterial({ color: '#e6e1d8', roughness: 0.3 }),
  );
  lampBase.position.set(-3.6, 0.04, -1.6);
  const arcCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-3.6, 0.08, -1.6),
    new THREE.Vector3(-3.4, 3.6, -2.2),
    new THREE.Vector3(-2.4, 2.4, -2.9),
  );
  const arc = new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 64, 0.018, 12), brass);
  const shade = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#b89a64', metalness: 1, roughness: 0.3, side: THREE.DoubleSide }),
  );
  shade.position.set(-2.4, 2.35, -2.9);
  const lampLight = new THREE.PointLight('#ffcf94', 7, 5, 2);
  lampLight.position.set(-2.4, 2.15, -2.9);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 20, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2), toneMapped: false }),
  );
  bulb.position.set(-2.4, 2.22, -2.9);
  group.add(lampBase, arc, shade, lampLight, bulb);

  // Perchero mínimo de acero con tres prendas oversize.
  const rack = new THREE.Group();
  [-0.85, 0.85].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.7, 0.03), steel);
    post.position.set(x, 0.85, 0);
    rack.add(post);
  });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.73, 0.03, 0.03), steel);
  rail.position.y = 1.7;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.73, 0.03, 0.4), steel);
  base.position.y = 0.015;
  rack.add(rail, base);
  ['#d9cfbd', '#1c1c1e', '#5d6440'].forEach((color, i) => {
    const garment = new THREE.Mesh(new RoundedBoxGeometry(0.74, 0.9, 0.08, 3, 0.03), new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
    garment.position.set(-0.45 + i * 0.45, 1.18, 0.02 + i * 0.04);
    garment.rotation.y = (i - 1) * 0.08;
    garment.castShadow = true;
    rack.add(garment);
  });
  rack.position.set(3.1, 0, -3.3);
  rack.rotation.y = -0.3;
  group.add(rack);

  // Luz: ciudad fría como contraluz, foco cálido frontal con sombra y relleno suave.
  const hemi = new THREE.HemisphereLight('#c9cfd6', '#0e0f12', 0.42);
  const city = new THREE.DirectionalLight('#8fa6d6', 0.9);
  city.position.set(0, 4, -9);
  city.target.position.set(0, 1, 0);
  const key = new THREE.SpotLight('#fff0dc', 62, 16, 0.42, 0.85, 1.6);
  key.position.set(-2.4, 5.4, 4.2);
  key.target.position.set(0, 0.9, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const rim = new THREE.PointLight('#9fb4e0', 8, 6, 2);
  rim.position.set(1.4, 2.6, -2.4);
  group.add(hemi, city, city.target, key, key.target, rim);

  return {
    group,
    mood: {
      background: '#0e0f12',
      fog: '#121318',
      fogDensity: 0.045,
      exposure: 1.05,
      envIntensity: 0.35,
      bloom: { strength: 0.4, radius: 0.5, threshold: 0.95 },
    },
    marquee: { color: '#e6dfd3', opacity: 0.12 },
    ui: 'dark',
    /** El contraluz toma un matiz del color de la prenda. */
    setAccent(accent) {
      rim.color.copy(new THREE.Color('#9fb4e0').lerp(new THREE.Color(accent), 0.35));
    },
    tick() {}, // escena estática: sin partículas
  };
}
