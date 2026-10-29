import * as THREE from 'three';
import { walnutTexture } from './textures.js';

/**
 * Rotonda del showroom revestida en nogal: las prendas se ubican en un arco y cada una tiene detrás
 * un nicho de madera iluminado con una lámpara de cuadro de latón. Los nichos de los costados llevan
 * percheros de latón con prendas formales colgadas en ganchos. Todo se mide en ángulos alrededor de
 * un centro, así la escena gana profundidad y la cámara puede girar adentro.
 */

export const ROTUNDA = {
  garmentRadius: 6, // radio del arco de prendas
  wallRadius: 8.3, // radio de la cara del muro
  step: 2.45 / 6, // ángulo entre prendas (2,45 m de arco)
};
// Centro de la rotonda: la prenda central queda en el origen.
ROTUNDA.center = new THREE.Vector3(0, 0, ROTUNDA.garmentRadius);

const NICHE_DEPTH = 0.55;
const NICHE_WIDTH = 1.95;
const NICHE_SPRING = 3.25; // altura donde arranca el arco
const WALL_HEIGHT = 9;
const ROD_Y = 2.95; // altura de la barra del perchero
const LAMP_COLOR = new THREE.Color('#ffd7a0');

/** Punto sobre la rotonda a un ángulo dado (0 = fondo, positivo = derecha) y radio dado. */
export function rotundaPoint(angle, radius, y = 0, target = new THREE.Vector3()) {
  return target.set(ROTUNDA.center.x + Math.sin(angle) * radius, y, ROTUNDA.center.z - Math.cos(angle) * radius);
}

/** Normal hacia el centro y tangente (hacia la derecha) en un ángulo dado. */
export function rotundaFrame(angle) {
  return {
    inward: new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)),
    tangent: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
  };
}

function archPath(path, x, width, spring, radius, bottom = 0) {
  const left = x - width / 2;
  path.moveTo(left, bottom);
  path.lineTo(left, spring);
  path.absarc(x, spring, radius, Math.PI, 0, true);
  path.lineTo(left + width, bottom);
  path.lineTo(left, bottom);
  return path;
}

/** Friso: la marca grabada en latón, repetida para recorrer la rotonda. */
function friezeTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '600 52px Cinzel, "Times New Roman", serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '16px';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(185,162,117,0.9)';
    const width = ctx.measureText(text).width;
    for (let x = 0; x < canvas.width; x += width) ctx.fillText(text, x, canvas.height / 2 + 2);
    texture.needsUpdate = true;
  };
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  draw();
  // La tipografía puede cargar después: se vuelve a dibujar cuando esté lista.
  document.fonts?.load('600 52px Cinzel').then(draw, () => {});
  return texture;
}

/** Gancho de latón: barra de hombros curva y gancho que abraza la barra del perchero. */
function createHanger(brass) {
  const group = new THREE.Group();
  const shoulders = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.3, -0.1, 0), new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0.3, -0.1, 0));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(shoulders, 24, 0.011, 8), brass));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 8), brass);
  neck.position.y = 0.06;
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 8, 24, Math.PI * 1.3), brass);
  hook.position.y = 0.12;
  hook.rotation.z = -Math.PI * 0.15;
  group.add(neck, hook);
  return group;
}

/**
 * @param garmentAngles ángulos de las prendas (los nichos con prenda se centran en ellos)
 * @param rackTextures fotos (recortadas) de las prendas que cuelgan en los percheros de los costados
 * @param lowPower true en móviles: menos nichos laterales y geometría más liviana
 */
export function createGallery({ garmentAngles, rackTextures = [], lowPower = false, friezeText = 'MONTEVAR · SASTRERÍA Y RELOJERÍA · ' }) {
  const group = new THREE.Group();
  group.name = 'gallery';
  const { step, wallRadius } = ROTUNDA;
  const archRadius = NICHE_WIDTH / 2;
  const bayWidth = 2 * wallRadius * Math.sin(step / 2) + 0.04; // cuerda + solape mínimo

  const extra = lowPower ? 1 : 2;
  const first = garmentAngles[0];
  const last = garmentAngles[garmentAngles.length - 1];
  const bays = [];
  for (let i = extra; i > 0; i--) bays.push({ angle: first - i * step, garment: -1 });
  garmentAngles.forEach((angle, i) => bays.push({ angle, garment: i }));
  for (let i = 1; i <= extra; i++) bays.push({ angle: last + i * step, garment: -1 });

  // Sala negra: madera ebanizada con veta apenas visible y acabado satinado, molduras de laca negra
  // y filetes de latón en el contorno de los arcos.
  const wallMaterial = new THREE.MeshStandardMaterial({ map: walnutTexture({ repeat: [0.4, 0.4], base: '#1b1714' }), roughness: 0.38 });
  const nicheMaterial = new THREE.MeshStandardMaterial({ map: walnutTexture({ repeat: [0.9, 0.9], base: '#121010', seed: 9 }), roughness: 0.42 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: '#141312', roughness: 0.22, metalness: 0.15 });
  const stone = new THREE.MeshStandardMaterial({ color: '#0c0b0b', roughness: 0.3, metalness: 0.2 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b89a64', metalness: 1, roughness: 0.32 });
  // Latón satinado para los filetes de los arcos: conserva el tono sin destellos al recibir los focos.
  const satinBrass = new THREE.MeshStandardMaterial({ color: '#8f7850', metalness: 0.6, roughness: 0.7 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: LAMP_COLOR.clone().multiplyScalar(0.85) });

  // Paño de muro con el arco recortado (se reutiliza en todos los tramos).
  const bayShape = new THREE.Shape();
  bayShape.moveTo(-bayWidth / 2, 0);
  bayShape.lineTo(bayWidth / 2, 0);
  bayShape.lineTo(bayWidth / 2, WALL_HEIGHT);
  bayShape.lineTo(-bayWidth / 2, WALL_HEIGHT);
  bayShape.lineTo(-bayWidth / 2, 0);
  bayShape.holes.push(archPath(new THREE.Path(), 0, NICHE_WIDTH, NICHE_SPRING, archRadius, 0.03));
  const bayGeometry = new THREE.ExtrudeGeometry(bayShape, { depth: NICHE_DEPTH, bevelEnabled: false, curveSegments: lowPower ? 32 : 64 });
  const nicheGeometry = new THREE.ShapeGeometry(archPath(new THREE.Shape(), 0, NICHE_WIDTH + 0.02, NICHE_SPRING, archRadius + 0.01), 64);
  // Filete del arco: una línea de latón que sigue el contorno del nicho.
  const archTrim = new THREE.Shape();
  archPath(archTrim, 0, NICHE_WIDTH + 0.07, NICHE_SPRING, archRadius + 0.035, 0.03);
  archTrim.holes.push(archPath(new THREE.Path(), 0, NICHE_WIDTH, NICHE_SPRING, archRadius, 0.03));
  const archTrimGeometry = new THREE.ExtrudeGeometry(archTrim, { depth: 0.04, bevelEnabled: false, curveSegments: 64 });
  const pilasterGeometry = new THREE.BoxGeometry(0.18, WALL_HEIGHT, 0.12);
  const corniceGeometry = new THREE.BoxGeometry(bayWidth, 0.16, 0.3);
  const railGeometry = new THREE.BoxGeometry(bayWidth, 0.06, 0.06);
  const skirtingGeometry = new THREE.BoxGeometry(bayWidth, 0.22, 0.1);
  const lampBarGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 24);
  const lampGlowGeometry = new THREE.PlaneGeometry(0.62, 0.025);
  const rodGeometry = new THREE.CylinderGeometry(0.014, 0.014, NICHE_WIDTH - 0.04, 16);
  let rackIndex = 0;

  const niches = bays.map((bay) => {
    // Cada tramo tiene su propio marco local: x a lo largo del muro, z hacia el centro.
    const frame = new THREE.Group();
    rotundaPoint(bay.angle, wallRadius, 0, frame.position);
    frame.rotation.y = -bay.angle;
    group.add(frame);

    const wall = new THREE.Mesh(bayGeometry, wallMaterial);
    wall.position.z = -NICHE_DEPTH;
    const back = new THREE.Mesh(nicheGeometry, nicheMaterial);
    back.position.z = -NICHE_DEPTH + 0.002;
    const trim = new THREE.Mesh(archTrimGeometry, satinBrass); // filete de latón que dibuja el arco sobre el negro
    const pilaster = new THREE.Mesh(pilasterGeometry, trimMaterial);
    pilaster.position.set(bayWidth / 2, WALL_HEIGHT / 2, 0.06);
    const cornice = new THREE.Mesh(corniceGeometry, trimMaterial);
    cornice.position.set(0, NICHE_SPRING + archRadius + 0.75, 0.15);
    const chairRail = new THREE.Mesh(railGeometry, trimMaterial);
    chairRail.position.set(0, 1.0, 0.03);
    const skirting = new THREE.Mesh(skirtingGeometry, stone);
    skirting.position.set(0, 0.11, 0.05);
    [wall, back, trim, pilaster, cornice, chairRail, skirting].forEach((m) => {
      m.castShadow = m.receiveShadow = true;
      frame.add(m);
    });

    // Lámpara de cuadro de latón en la clave del arco: baña el nicho con luz cálida hacia abajo.
    const lampBar = new THREE.Mesh(lampBarGeometry, brass);
    lampBar.rotation.z = Math.PI / 2;
    lampBar.position.set(0, NICHE_SPRING + archRadius * 0.55, -NICHE_DEPTH + 0.16);
    const glow = new THREE.Mesh(lampGlowGeometry, lampGlow);
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, lampBar.position.y - 0.036, lampBar.position.z);
    const light = new THREE.SpotLight(LAMP_COLOR, bay.garment >= 0 ? 16 : 20, 5.5, 0.9, 0.85, 1.6);
    light.position.set(0, lampBar.position.y - 0.05, -NICHE_DEPTH + 0.25);
    light.target.position.set(0, 0.6, -NICHE_DEPTH + 0.1);
    frame.add(lampBar, glow, light, light.target);

    if (bay.garment < 0 && rackTextures.length) {
      // Perchero de latón con dos prendas formales colgadas en ganchos.
      const rod = new THREE.Mesh(rodGeometry, brass);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, ROD_Y, -NICHE_DEPTH + 0.32);
      frame.add(rod);
      [-0.42, 0.42].forEach((x, slot) => {
        const texture = rackTextures[rackIndex++ % rackTextures.length];
        const height = 1.55;
        const width = height * (texture.image.width / texture.image.height);
        const garment = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          new THREE.MeshStandardMaterial({ map: texture, alphaTest: 0.35, roughness: 0.9, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide }),
        );
        garment.position.set(x, ROD_Y - 0.08 - height / 2, -NICHE_DEPTH + 0.32 + (slot ? 0.06 : 0));
        garment.rotation.y = slot ? -0.08 : 0.08;
        garment.castShadow = true;
        const hanger = createHanger(brass);
        hanger.position.set(x, ROD_Y - 0.12, garment.position.z + 0.01);
        hanger.rotation.y = garment.rotation.y;
        frame.add(garment, hanger);
      });
    }
    return { ...bay, light, baseLight: light.intensity };
  });
  // Pilastra de cierre del primer tramo.
  {
    const frame = new THREE.Group();
    rotundaPoint(bays[0].angle, wallRadius, 0, frame.position);
    frame.rotation.y = -bays[0].angle;
    const pilaster = new THREE.Mesh(pilasterGeometry, trimMaterial);
    pilaster.position.set(-bayWidth / 2, WALL_HEIGHT / 2, 0.06);
    frame.add(pilaster);
    group.add(frame);
  }

  // Friso de latón que recorre la rotonda sobre los nichos con prenda (cilindro visto desde adentro).
  const spanStart = first - step / 2;
  const spanLength = last - first + step;
  const friezeMap = friezeTexture(friezeText);
  friezeMap.repeat.set(-(spanLength * wallRadius) / 22, 1); // negativo: se ve al derecho desde adentro
  const frieze = new THREE.Mesh(
    new THREE.CylinderGeometry(wallRadius - 0.04, wallRadius - 0.04, 0.28, 160, 1, true, Math.PI - spanStart - spanLength, spanLength),
    new THREE.MeshBasicMaterial({ map: friezeMap, transparent: true, side: THREE.BackSide, depthWrite: false }),
  );
  frieze.position.set(ROTUNDA.center.x, NICHE_SPRING + archRadius + 0.38, ROTUNDA.center.z);
  group.add(frieze);

  /** Hover: la lámpara del nicho de la prenda activa sube un poco; las demás bajan. */
  function setActive(garmentIndex) {
    niches.forEach((n) => {
      const active = garmentIndex !== null && n.garment === garmentIndex;
      const dim = garmentIndex !== null && !active;
      n.target = active ? n.baseLight * 1.5 : dim ? n.baseLight * 0.6 : n.baseLight;
    });
  }

  function tick(dt) {
    friezeMap.offset.x -= dt * 0.012; // el friso avanza lento alrededor de la rotonda
    const k = 1 - Math.exp(-5 * dt);
    niches.forEach((n) => {
      n.light.intensity += ((n.target ?? n.baseLight) - n.light.intensity) * k;
    });
  }

  return { group, setActive, tick };
}
