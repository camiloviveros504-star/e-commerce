import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/**
 * Máscara radial para la capa superior del piso: más transparente en el centro (reflejo nítido
 * bajo las prendas) y opaca hacia los bordes, para que el reflejo se desvanezca con naturalidad.
 */
function reflectionMask(focus) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * focus * 1.6);
  g.addColorStop(0, 'rgb(105,105,105)');
  g.addColorStop(0.55, 'rgb(170,170,170)');
  g.addColorStop(1, 'rgb(255,255,255)');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(1.8, 1); // elipse más ancha que profunda, como la fila de prendas
  ctx.translate(-size / 2, -size / 2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  return new THREE.CanvasTexture(canvas);
}

/**
 * Piso pulido: un espejo (Reflector) con una capa semitransparente encima
 * para que el reflejo se vea difuso como concreto pulido o asfalto mojado.
 * @param reflectionFocus radio (fracción del piso) de la zona de reflejo nítido; omitir para reflejo uniforme.
 */
export function createFloor({
  size = 40,
  tint = '#808080',
  overlayColor = '#111111',
  overlayMap = null,
  overlayOpacity = 0.75,
  roughness = 0.9,
  reflectionFocus = null,
} = {}) {
  const group = new THREE.Group();
  const scale = Math.min(window.devicePixelRatio, 1.5) * 0.7;
  // Si la página carga en una pestaña oculta la ventana mide 0: se usa el tamaño de pantalla como respaldo
  // y el reflejo se redimensiona con la ventana (un render target de tamaño 0 deja la escena en negro).
  const reflectionSize = () => [
    Math.max(1, Math.round((window.innerWidth || window.screen.width) * scale)),
    Math.max(1, Math.round((window.innerHeight || window.screen.height) * scale)),
  ];
  const [textureWidth, textureHeight] = reflectionSize();
  const mirror = new Reflector(new THREE.PlaneGeometry(size, size), { textureWidth, textureHeight, color: new THREE.Color(tint) });
  mirror.rotation.x = -Math.PI / 2;
  window.addEventListener('resize', () => mirror.getRenderTarget().setSize(...reflectionSize()));

  const overlay = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      color: overlayColor,
      map: overlayMap,
      alphaMap: reflectionFocus ? reflectionMask(reflectionFocus) : null,
      roughness,
      transparent: true,
      opacity: overlayOpacity,
    }),
  );
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.003;
  overlay.receiveShadow = true;

  group.add(mirror, overlay);
  return { group, overlay };
}
