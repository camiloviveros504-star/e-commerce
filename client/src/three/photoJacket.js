import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Prenda fotográfica: la foto recortada del frente y la de la espalda, superpuestas.
 * Para "girar" no se rota un plano plano (se vería como un cuadro de canto): la prenda se balancea
 * levemente con perspectiva mientras el frente se funde con la espalda. Un barrido de brillo
 * satinado recorre la tela al pasar el mouse.
 */

export const JACKET_HEIGHT = 2.35;
// Los relojes se muestran como pieza de joyería: más pequeños que una prenda, flotando a la misma altura.
const WATCH_HEIGHT = 1.55;
const isWatch = (product) => product.category === 'relojeria';
const BASE_BRIGHTNESS = 0.94;
const SWAY = 0.32; // inclinación máxima (radianes) durante la transición frente ↔ espalda

/** Carga las fotos de frente y espalda de cada producto, informando el avance. */
export function loadJacketTextures(products, renderer, onProgress = () => {}) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress(loaded / total);
  const loader = new THREE.TextureLoader(manager);
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const load = (url) =>
    new Promise((resolve, reject) =>
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAnisotropy;
          resolve(texture);
        },
        undefined,
        () => reject(new Error(`No se pudo cargar la imagen ${url}`)),
      ),
    );
  return Promise.all(
    products.map(async (p) => [p.slug, { front: await load(p.images.front.url), back: p.images.back ? await load(p.images.back.url) : null }]),
  ).then((entries) => new Map(entries));
}

let shadowTexture;
function contactShadowTexture() {
  if (shadowTexture) return shadowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  shadowTexture = new THREE.CanvasTexture(canvas);
  return shadowTexture;
}

/**
 * Material de foto con dos extras inyectados en el shader de MeshBasicMaterial:
 * un barrido de brillo diagonal (uShine = posición de la banda) y respeto por la transparencia del recorte.
 */
function photoMaterial(texture, shine) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.04,
    toneMapped: false,
    // Un plano de una sola cara no proyecta sombra hacia la luz que tiene delante (three usa la cara trasera).
    shadowSide: THREE.DoubleSide,
    color: new THREE.Color(BASE_BRIGHTNESS, BASE_BRIGHTNESS, BASE_BRIGHTNESS),
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uShine = shine.position;
    shader.uniforms.uShineStrength = shine.strength;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uShine;\nuniform float uShineStrength;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float bandPos = vMapUv.x * 0.55 + (1.0 - vMapUv.y) * 0.45;
        float band = smoothstep(0.16, 0.0, abs(bandPos - uShine));
        float core = smoothstep(0.05, 0.0, abs(bandPos - uShine));
        diffuseColor.rgb += (band * 0.22 + core * 0.18) * uShineStrength * diffuseColor.a;`,
      );
  };
  material.customProgramCacheKey = () => 'photo-shine';
  return material;
}

function photoFace(texture, shine, height = JACKET_HEIGHT) {
  const aspect = texture.image.width / texture.image.height;
  const material = photoMaterial(texture, shine);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), material);
  return { mesh, width: height * aspect };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * @param product producto de la API
 * @param textures { front, back } texturas ya cargadas (back puede ser null)
 * @param floorY altura del piso relativa al centro de la prenda (para la sombra)
 */
export function createPhotoJacket(product, textures, floorY) {
  const group = new THREE.Group();
  group.name = `jacket-${product.slug}`;
  const pivot = new THREE.Group();
  group.add(pivot);

  const shine = { position: { value: -1 }, strength: { value: 0 } };
  const height = isWatch(product) ? WATCH_HEIGHT : JACKET_HEIGHT;
  const front = photoFace(textures.front, shine, height);
  pivot.add(front.mesh);
  const back = textures.back ? photoFace(textures.back, shine, height) : null;
  if (back) {
    // Ambas caras miran a la cámara; la espalda aparece por fundido, no por rotación.
    back.mesh.position.z = -0.002;
    back.mesh.material.opacity = 0;
    back.mesh.visible = false;
    pivot.add(back.mesh);
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(front.width * 0.95, 0.7),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = floorY + 0.012;
  group.add(shadow);

  const faces = back ? [front.mesh, back.mesh] : [front.mesh];

  return {
    group,
    pivot,
    product,
    width: front.width,
    shadow,
    hasBack: Boolean(back),
    meshes: faces,
    /**
     * Giro "virtual": turn en radianes (0 = frente, π = espalda, 2π = frente otra vez).
     * Se traduce en balanceo con perspectiva + fundido entre las dos fotos.
     */
    setTurn(turn) {
      if (!back) return;
      const mix = smooth(0.3, 0.7, (1 - Math.cos(turn)) / 2);
      front.mesh.material.opacity = 1 - mix;
      back.mesh.material.opacity = mix;
      front.mesh.visible = mix < 0.99;
      back.mesh.visible = mix > 0.01;
      pivot.rotation.y = Math.sin(turn) * SWAY;
      pivot.scale.x = 1 - Math.abs(Math.sin(turn)) * 0.08;
    },
    /** Barrido de brillo satinado sobre la prenda (hover, entrada al producto). */
    sweepShine({ strength = 1, duration = 1.3 } = {}) {
      gsap.killTweensOf([shine.position, shine.strength]);
      shine.strength.value = strength;
      gsap.fromTo(shine.position, { value: -0.25 }, { value: 1.25, duration, ease: 'power2.inOut' });
      gsap.to(shine.strength, { value: 0, duration: 0.4, delay: duration - 0.3 });
    },
    brightnessTargets: faces.map((m) => m.material.color),
    baseBrightness: BASE_BRIGHTNESS,
  };
}
