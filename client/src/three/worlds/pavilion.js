import * as THREE from 'three';
import { createFloor } from '../floor.js';
import { concreteTexture, seededRandom } from '../textures.js';

/**
 * Mundo "pavilion" (chaquetas de pista): pabellón de concreto arquitectónico de noche.
 * Muro de concreto visto con juntas y huecos de amarre, una ranura vertical de luz detrás de la prenda
 * (teñida con el color de cada chaqueta), muros exentos que proyectan sombra con luz de luna,
 * líneas de luz embutidas en el piso como una pasarela y una banca de concreto con piedras de basalto.
 */

const WALL_Z = -4.6;
const SLIT_GAIN = 2.4; // la ranura supera el umbral del bloom; la foto nunca

/** Concreto visto: paneles de 1,8 × 0,9 m con juntas y seis huecos de amarre cada uno. */
function formworkTexture() {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(23);
  ctx.fillStyle = '#8a8985';
  ctx.fillRect(0, 0, w, h);
  // Variación de tono por panel y manchas suaves.
  const cols = 8;
  const rows = 4;
  const pw = w / cols;
  const ph = h / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + rand() * 0.05})`;
      ctx.fillRect(c * pw, r * ph, pw, ph);
    }
  }
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rand() * 0.06})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
  // Juntas
  ctx.strokeStyle = 'rgba(30,30,30,0.35)';
  ctx.lineWidth = 1.5;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * pw, 0);
    ctx.lineTo(c * pw, h);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * ph);
    ctx.lineTo(w, r * ph);
    ctx.stroke();
  }
  // Huecos de amarre (3 × 2 por panel)
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          const x = c * pw + pw * (0.17 + i * 0.33);
          const y = r * ph + ph * (0.25 + j * 0.5);
          const g = ctx.createRadialGradient(x, y, 0, x, y, 5);
          g.addColorStop(0, 'rgba(25,25,25,0.85)');
          g.addColorStop(0.6, 'rgba(40,40,40,0.5)');
          g.addColorStop(1, 'rgba(40,40,40,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createPavilionWorld() {
  const group = new THREE.Group();
  group.name = 'world-pavilion';
  const formwork = formworkTexture();
  const concrete = new THREE.MeshStandardMaterial({ map: formwork, color: '#9a9994', roughness: 0.88 });

  group.add(
    createFloor({
      tint: '#5a5d62',
      overlayColor: '#2b2d30',
      overlayMap: concreteTexture({ base: '#77797c', seed: 41, repeat: [8, 8] }),
      overlayOpacity: 0.82,
      roughness: 0.5,
      reflectionFocus: 0.12,
    }).group,
  );

  // Muro de fondo (14,4 × 7,2 m = 8 × 8 paneles) partido por una ranura de luz al centro.
  const halfWidth = 7.2;
  const slitHalf = 0.07;
  [-1, 1].forEach((side) => {
    const width = halfWidth - slitHalf;
    const wallTexture = formwork.clone();
    wallTexture.needsUpdate = true;
    wallTexture.repeat.set(width / (halfWidth * 2), 1);
    wallTexture.offset.set(side < 0 ? 0 : (halfWidth + slitHalf) / (halfWidth * 2), 0);
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, 7.2, 0.3),
      new THREE.MeshStandardMaterial({ map: wallTexture, color: '#9a9994', roughness: 0.88 }),
    );
    wall.position.set(side * (slitHalf + width / 2), 3.6, WALL_Z - 0.15);
    wall.receiveShadow = wall.castShadow = true;
    group.add(wall);
  });
  const slitMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e6').multiplyScalar(SLIT_GAIN), toneMapped: false });
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(slitHalf * 2, 7.2), slitMaterial);
  slit.position.set(0, 3.6, WALL_Z - 0.28);
  group.add(slit);
  const slitLight = new THREE.PointLight('#fff4e6', 9, 6, 2);
  slitLight.position.set(0, 2.6, WALL_Z + 0.4);
  group.add(slitLight);

  // Muros exentos (aletas) a los lados: atrapan la luz de luna y proyectan sombras largas.
  const finTexture = formwork.clone();
  finTexture.needsUpdate = true;
  finTexture.repeat.set(0.25, 0.75);
  const finMaterial = new THREE.MeshStandardMaterial({ map: finTexture, color: '#9a9994', roughness: 0.88 });
  [
    [-3.9, -2.6, 3.2],
    [4.3, -3.2, 2.4],
  ].forEach(([x, z, depth]) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.4, depth), finMaterial);
    fin.position.set(x, 2.7, z);
    fin.castShadow = fin.receiveShadow = true;
    group.add(fin);
  });

  // Pasarela: dos líneas de luz embutidas en el piso que llevan a la prenda (bajo el umbral del bloom: sin halo).
  const runwayMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e9eef5').multiplyScalar(0.85), toneMapped: false });
  [-1.25, 1.25].forEach((x) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 9), runwayMaterial);
    line.position.set(x, 0.004, 0.2);
    group.add(line);
  });

  // Banca de concreto con piedras de basalto.
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.44, 0.55), concrete);
  bench.position.set(2.4, 0.22, -3.7);
  bench.castShadow = bench.receiveShadow = true;
  group.add(bench);
  const basalt = new THREE.MeshPhysicalMaterial({ color: '#16171a', roughness: 0.35, clearcoat: 0.4 });
  // [x, y, radio horizontal, radio vertical]: dos piedras sobre la banca y una apilada.
  [
    [1.6, 0.57, 0.18, 0.13],
    [1.9, 0.54, 0.12, 0.1],
    [1.62, 0.77, 0.09, 0.07],
  ].forEach(([x, y, rx, ry]) => {
    const stone = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), basalt);
    stone.scale.set(rx, ry, rx * 0.85);
    stone.position.set(x, y, -3.7);
    stone.castShadow = true;
    group.add(stone);
  });

  // Luz: luna fría cenital (sombras nítidas), foco frontal neutro y contraluz de la ranura.
  const hemi = new THREE.HemisphereLight('#aab4c0', '#0b0c0e', 0.4);
  const moon = new THREE.DirectionalLight('#c7d5e6', 1.4);
  moon.position.set(-5, 9, 2.5);
  moon.target.position.set(0, 0, -2);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 25 });
  moon.shadow.bias = -0.0005;
  moon.shadow.normalBias = 0.03;
  const key = new THREE.SpotLight('#f4f1ec', 55, 16, 0.42, 0.85, 1.6);
  key.position.set(2.2, 5.2, 4.2);
  key.target.position.set(0, 0.9, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  group.add(hemi, moon, moon.target, key, key.target);

  return {
    group,
    mood: {
      background: '#0b0c0e',
      fog: '#0e1013',
      fogDensity: 0.055,
      exposure: 1.05,
      envIntensity: 0.3,
      bloom: { strength: 0.5, radius: 0.5, threshold: 0.95 },
    },
    marquee: { color: '#e4e8ee', opacity: 0.12 },
    ui: 'dark',
    /** La ranura y su luz toman un matiz del color de la chaqueta. */
    setAccent(accent) {
      const tint = new THREE.Color('#fff4e6').lerp(new THREE.Color(accent), 0.4);
      slitMaterial.color.copy(tint).multiplyScalar(SLIT_GAIN);
      slitLight.color.copy(tint);
      runwayMaterial.color.copy(new THREE.Color('#e9eef5').lerp(new THREE.Color(accent), 0.2)).multiplyScalar(0.85);
    },
    tick() {}, // escena estática: sin partículas
  };
}
