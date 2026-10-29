import * as THREE from 'three';

/** Texturas generadas en canvas: todo el arte visual es propio del proyecto. */

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

function toTexture(canvas, { repeat = [1, 1], srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Generador pseudoaleatorio con semilla para que las texturas sean estables entre recargas. */
export function seededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function paintNoise(ctx, w, h, rand, { blotches = 220, specks = 9000, light = 255, dark = 0 }) {
  for (let i = 0; i < blotches; i++) {
    const r = 10 + rand() * 90;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    const tone = rand() > 0.5 ? light : dark;
    g.addColorStop(0, `rgba(${tone},${tone},${tone},${0.04 + rand() * 0.06})`);
    g.addColorStop(1, `rgba(${tone},${tone},${tone},0)`);
    ctx.save();
    ctx.translate(rand() * w, rand() * h);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  for (let i = 0; i < specks; i++) {
    const tone = rand() > 0.5 ? light : dark;
    ctx.fillStyle = `rgba(${tone},${tone},${tone},${rand() * 0.18})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
}

export function concreteTexture({ base = '#6b6b6d', seed = 7, repeat = [1, 1] } = {}) {
  const { canvas, ctx } = makeCanvas(512, 512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  paintNoise(ctx, 512, 512, seededRandom(seed), {});
  return toTexture(canvas, { repeat });
}

/** Nogal: veta vertical con variaciones de tono (boiserie y molduras). */
export function walnutTexture({ repeat = [1, 1], base = '#3d2618', seed = 5 } = {}) {
  const { canvas, ctx } = makeCanvas(512, 512);
  const rand = seededRandom(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    const x = rand() * 512;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(20,10,5,0.16)' : 'rgba(120,80,50,0.08)';
    ctx.lineWidth = 0.6 + rand() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + Math.sin(y * 0.02 + i) * (2 + rand() * 4), y);
    ctx.stroke();
  }
  return toTexture(canvas, { repeat });
}

/** Mármol negro (tipo Nero Marquina) con vetas claras finas. */
export function marbleTexture({ repeat = [6, 6], seed = 19, veins = 14 } = {}) {
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size, size);
  const rand = seededRandom(seed);
  ctx.fillStyle = '#111012';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < veins; i++) {
    let x = rand() * size;
    let y = rand() * size;
    const angle = rand() * Math.PI * 2;
    ctx.strokeStyle = `rgba(225,220,210,${0.08 + rand() * 0.22})`;
    ctx.lineWidth = 0.6 + rand() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 40; s++) {
      x += Math.cos(angle + (rand() - 0.5) * 1.6) * 22;
      y += Math.sin(angle + (rand() - 0.5) * 1.6) * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return toTexture(canvas, { repeat });
}
