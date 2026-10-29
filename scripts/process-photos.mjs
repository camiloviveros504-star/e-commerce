/**
 * Procesa las fotos generadas (design/photos/raw/<slug>-<tipo>.jpg) para la web:
 *  - frente y espalda: recorta el fondo con un modelo de IA local (@imgly/background-removal-node),
 *    refuerza la opacidad de las zonas oscuras, limpia el borde (sin halo claro del fondo), ajusta al
 *    contenido y exporta WebP con transparencia;
 *  - detalle y lifestyle: redimensiona y exporta WebP.
 * Escribe las dimensiones finales en design/photos/processed.json.
 *
 * Uso: node scripts/process-photos.mjs
 */
import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'design', 'photos', 'raw');
const OUT = join(ROOT, 'client', 'public', 'images', 'products');
// Los productos se detectan por los archivos <slug>-<tipo>.jpg presentes en raw/.
const SLUGS = [
  ...new Set(
    readdirSync(RAW)
      .map((f) => f.match(/^(.+)-(front|back|detail|lifestyle)\.jpg$/)?.[1])
      .filter(Boolean),
  ),
];
const CUTOUT_MAX_HEIGHT = 1600;
// Curva de opacidad: el modelo deja semitransparentes algunas zonas oscuras (puños); las volvemos sólidas.
const ALPHA_LOW = 40;
const ALPHA_HIGH = 150;

/**
 * Limpieza de bordes del recorte. Los píxeles semitransparentes del contorno conservan el gris claro
 * del fondo original y sobre la escena oscura se ven como una silueta blanca. Se corrige en dos pasos:
 *  1. el contorno se contrae 1 px (mínimo de la vecindad 3×3 en el canal alfa);
 *  2. los píxeles que siguen siendo semitransparentes toman el color de la prenda (promedio de los píxeles
 *     opacos cercanos), en lugar del color del fondo.
 */
function defringe(data, { width, height }) {
  const n = width * height;
  const alpha = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) alpha[i] = data[i * 4 + 3];

  // 1. Contracción del contorno.
  const eroded = new Uint8ClampedArray(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let min = 255;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx));
          min = Math.min(min, alpha[yy * width + xx]);
        }
      }
      eroded[y * width + x] = min;
    }
  }

  // 2. Color de la prenda hacia el borde: desenfoque de caja (horizontal + vertical) solo de píxeles opacos.
  const OPAQUE = 245;
  const R = 4;
  const sums = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    if (alpha[i] < OPAQUE) continue;
    sums[0][i] = data[i * 4];
    sums[1][i] = data[i * 4 + 1];
    sums[2][i] = data[i * 4 + 2];
    sums[3][i] = 1;
  }
  const blurPass = (src, horizontal) => {
    const out = new Float32Array(n);
    const len = horizontal ? width : height;
    const lines = horizontal ? height : width;
    for (let line = 0; line < lines; line++) {
      const at = (k) => (horizontal ? line * width + k : k * width + line);
      let acc = 0;
      for (let k = -R; k <= R; k++) acc += src[at(Math.min(len - 1, Math.max(0, k)))];
      for (let k = 0; k < len; k++) {
        out[at(k)] = acc;
        acc += src[at(Math.min(len - 1, k + R + 1))] - src[at(Math.max(0, k - R))];
      }
    }
    return out;
  };
  const blurred = sums.map((s) => blurPass(blurPass(s, true), false));
  for (let i = 0; i < n; i++) {
    data[i * 4 + 3] = eroded[i];
    // También los píxeles ya transparentes junto al borde: al filtrar la textura en 3D se mezclan con el contorno.
    if (alpha[i] >= OPAQUE) continue;
    const weight = blurred[3][i];
    if (weight <= 0) continue;
    data[i * 4] = blurred[0][i] / weight;
    data[i * 4 + 1] = blurred[1][i] / weight;
    data[i * 4 + 2] = blurred[2][i] / weight;
  }
}

async function cutout(input, output) {
  const blob = await removeBackground(new Blob([readFileSync(input)], { type: 'image/jpeg' }), {
    model: 'medium',
    output: { format: 'image/png' },
  });
  const { data, info } = await sharp(Buffer.from(await blob.arrayBuffer()))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) {
    const a = (data[i] - ALPHA_LOW) / (ALPHA_HIGH - ALPHA_LOW);
    data[i] = Math.round(Math.min(1, Math.max(0, a)) * 255);
  }
  defringe(data, info);
  const trimmed = await sharp(data, { raw: info })
    .trim({ threshold: 1 })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer({ resolveWithObject: true });
  const result = await sharp(trimmed.data)
    .resize({ height: Math.min(CUTOUT_MAX_HEIGHT, trimmed.info.height), withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 95, effort: 5 })
    .toFile(output);
  return { width: result.width, height: result.height };
}

async function photo(input, output, width) {
  const result = await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 86, effort: 5 }).toFile(output);
  return { width: result.width, height: result.height };
}

const PIPELINE = [
  ['front', (src, dir) => cutout(src, join(dir, 'front.webp'))],
  ['back', (src, dir) => cutout(src, join(dir, 'back.webp'))],
  ['detail', (src, dir) => photo(src, join(dir, 'detail.webp'), 1100)],
  ['lifestyle', (src, dir) => photo(src, join(dir, 'lifestyle.webp'), 1300)],
];

const report = {};
for (const slug of SLUGS) {
  const dir = join(OUT, slug);
  mkdirSync(dir, { recursive: true });
  report[slug] = {};
  for (const [kind, run] of PIPELINE) {
    const src = join(RAW, `${slug}-${kind}.jpg`);
    if (!existsSync(src)) {
      console.warn(`Falta ${slug}-${kind}.jpg`);
      continue;
    }
    report[slug][kind] = await run(src, dir);
    console.log(`${slug}/${kind}.webp`, report[slug][kind]);
  }
}
writeFileSync(join(ROOT, 'design', 'photos', 'processed.json'), JSON.stringify(report, null, 2));
