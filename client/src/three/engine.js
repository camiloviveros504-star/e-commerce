import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Renderer, escena, cámara, post-procesado (bloom) y bucle de animación compartidos. */
export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#09090a');
  scene.fog = new THREE.FogExp2('#09090a', 0.07);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;

  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 120);

  // El post-procesado dibuja en un render target propio: sin muestras MSAA los bordes finos
  // (anillos, cantos, franjas) salen dentados aunque el canvas pida antialias.
  const pixelRatio = renderer.getPixelRatio();
  const target = new THREE.WebGLRenderTarget(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio, {
    type: THREE.HalfFloatType,
    samples: renderer.capabilities.isWebGL2 ? 4 : 0,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const tickers = new Set();
  const resizeListeners = new Set();
  const clock = new THREE.Clock();

  let lastW = 0;
  let lastH = 0;
  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    resizeListeners.forEach((fn) => fn(w, h));
  }
  window.addEventListener('resize', resize);

  let paused = false;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    // Algunos navegadores no avisan con "resize" cuando una pestaña oculta (tamaño 0) se vuelve visible:
    // si el tamaño cambió, se avisa a todos (motor, reflejos, scroll) para que se ajusten.
    if (Math.max(1, window.innerWidth) !== lastW || Math.max(1, window.innerHeight) !== lastH) {
      resize();
      window.dispatchEvent(new Event('resize'));
    }
    if (paused) return; // la escena está tapada por el contenido: no gastamos GPU
    const t = clock.elapsedTime;
    tickers.forEach((fn) => fn(dt, t));
    composer.render();
  });

  /** Transición del "ambiente" (fondo, niebla, exposición y bloom). */
  function setMood(mood, duration = 1.2) {
    const tl = gsap.timeline({ defaults: { duration, ease: 'power2.inOut', overwrite: 'auto' } });
    const bg = new THREE.Color(mood.background);
    const fog = new THREE.Color(mood.fog ?? mood.background);
    tl.to(scene.background, { r: bg.r, g: bg.g, b: bg.b }, 0)
      .to(scene.fog.color, { r: fog.r, g: fog.g, b: fog.b }, 0)
      .to(scene.fog, { density: mood.fogDensity ?? 0.07 }, 0)
      .to(renderer, { toneMappingExposure: mood.exposure ?? 1 }, 0)
      .to(scene, { environmentIntensity: mood.envIntensity ?? 0.25 }, 0)
      .to(bloom, { strength: mood.bloom?.strength ?? 0.7, radius: mood.bloom?.radius ?? 0.55, threshold: mood.bloom?.threshold ?? 0.82 }, 0);
    return tl;
  }

  return {
    renderer,
    scene,
    camera,
    bloom,
    setMood,
    setPaused(value) {
      paused = value;
    },
    onTick(fn) {
      tickers.add(fn);
      return () => tickers.delete(fn);
    },
    onResize(fn) {
      resizeListeners.add(fn);
      fn(window.innerWidth, window.innerHeight);
      return () => resizeListeners.delete(fn);
    },
    /** Compila shaders por adelantado para evitar tirones en la primera transición. */
    warmUp() {
      renderer.compile(scene, camera);
    },
  };
}

/**
 * Cámara con amortiguación: el resto del código solo fija posición/objetivo deseados
 * y la cámara los persigue suavemente cada fotograma (+ parallax con el puntero).
 */
export function createCameraRig(engine) {
  const { camera } = engine;
  const desiredPos = new THREE.Vector3(0, 1.6, 9);
  const desiredTarget = new THREE.Vector3(0, 1.3, 0);
  const currentTarget = desiredTarget.clone();
  const pointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const rig = { desiredPos, desiredTarget, damping: 3.2, parallax: 0.35 };

  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  });

  camera.position.copy(desiredPos);
  engine.onTick((dt) => {
    const k = 1 - Math.exp(-rig.damping * dt);
    smoothPointer.lerp(pointer, 1 - Math.exp(-2.5 * dt));
    tmp.copy(desiredPos);
    tmp.x += smoothPointer.x * rig.parallax;
    tmp.y += smoothPointer.y * rig.parallax * 0.5;
    camera.position.lerp(tmp, k);
    currentTarget.lerp(desiredTarget, k);
    camera.lookAt(currentTarget);
  });

  rig.pointer = pointer;
  rig.jumpTo = (pos, target) => {
    desiredPos.copy(pos);
    desiredTarget.copy(target);
    camera.position.copy(pos);
    currentTarget.copy(target);
    camera.lookAt(currentTarget);
  };
  return rig;
}
