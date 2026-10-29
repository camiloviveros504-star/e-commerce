/**
 * Genera el logo de Montevar en vectores (letras de Cinzel convertidas en trazos, sin depender de la
 * fuente instalada) y sus versiones PNG:
 *   client/public/brand/montevar-monograma.svg   monograma (marco doble de latón + M)
 *   client/public/brand/montevar-logo.svg        logo completo (monograma, MONTEVAR, filetes y oficio)
 *   client/public/brand/montevar-logo.png        logo sobre fondo negro, 2400 × 2400
 *   client/public/brand/montevar-logo-transparente.png
 *   client/public/brand/montevar-monograma.png   512 × 512 (perfiles, redes)
 *   client/public/favicon.svg                    ícono de la pestaña
 *
 * Uso: node scripts/build-logo.mjs
 */
import opentype from 'opentype.js';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'client', 'public', 'brand');
const FONT = opentype.loadSync(join(ROOT, 'node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff'));
const BRASS = '#b9a275';
const IVORY = '#f1ece3';
const INK = '#0b0a09';

/** Texto como trazo SVG, con espaciado entre letras, centrado en cx y con la línea base en y. */
function textPath(text, { size, cx, y, tracking = 0 }) {
  const scale = size / FONT.unitsPerEm;
  const glyphs = FONT.stringToGlyphs(text);
  const advance = (g) => g.advanceWidth * scale;
  const width = glyphs.reduce((sum, g) => sum + advance(g), 0) + tracking * (glyphs.length - 1);
  let x = cx - width / 2;
  const parts = glyphs.map((g) => {
    const d = g.getPath(x, y, size).toPathData(2);
    x += advance(g) + tracking;
    return d;
  });
  return { d: parts.join(' '), width };
}

/** Monograma en un cuadro de lado `s` con esquina superior izquierda en (x, y). */
function monogram(x, y, s, { ivory = IVORY } = {}) {
  const u = s / 64; // el diseño se pensó en una grilla de 64
  const at = (v) => +(v * u).toFixed(2);
  const m = textPath('M', { size: 40 * u, cx: x + 32 * u, y: y + 46.5 * u });
  const diamond = (cx, cy) => {
    const r = 2.1 * u;
    return `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;
  };
  // Rombos en los centros del marco exterior: detalle de orfebrería, como una marca de platero.
  const diamonds = [
    [x + 32 * u, y + 3 * u],
    [x + 32 * u, y + 61 * u],
    [x + 3 * u, y + 32 * u],
    [x + 61 * u, y + 32 * u],
  ]
    .map(([cx, cy]) => diamond(+cx.toFixed(2), +cy.toFixed(2)))
    .join('');
  return `
    <rect x="${at(3) + x}" y="${at(3) + y}" width="${at(58)}" height="${at(58)}" fill="none" stroke="${BRASS}" stroke-width="${at(1.8)}"/>
    <rect x="${at(8) + x}" y="${at(8) + y}" width="${at(48)}" height="${at(48)}" fill="none" stroke="${BRASS}" stroke-width="${at(0.7)}" opacity="0.6"/>
    <path d="${diamonds}" fill="${BRASS}"/>
    <path d="${m.d}" fill="${ivory}"/>`;
}

function svg(width, height, body, background) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${
    background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : ''
  }${body}</svg>\n`;
}

/** Logo completo, compuesto en un lienzo de 1000 × 1000. */
function fullLogo(background) {
  const word = textPath('MONTEVAR', { size: 92, cx: 500, y: 668, tracking: 30 });
  const craft = textPath('SASTRERÍA · RELOJERÍA', { size: 25, cx: 500, y: 748, tracking: 11 });
  const ruleGap = 22;
  const left = 500 - craft.width / 2 - ruleGap;
  const right = 500 + craft.width / 2 + ruleGap;
  const ruleLen = 70;
  const body = `
    ${monogram(380, 236, 240)}
    <path d="${word.d}" fill="${IVORY}"/>
    <path d="${craft.d}" fill="${BRASS}"/>
    <path d="M${left - ruleLen} 739.5H${left}M${right} 739.5H${right + ruleLen}" stroke="${BRASS}" stroke-width="1.6"/>`;
  return svg(1000, 1000, body, background);
}

mkdirSync(OUT, { recursive: true });
const monogramSvg = svg(64, 64, monogram(0, 0, 64));
writeFileSync(join(OUT, 'montevar-monograma.svg'), monogramSvg);
writeFileSync(join(OUT, 'montevar-logo.svg'), fullLogo(null));
// Ícono de la pestaña: monograma sobre fondo negro con esquinas apenas redondeadas.
writeFileSync(join(ROOT, 'client', 'public', 'favicon.svg'), svg(64, 64, `<rect width="64" height="64" rx="6" fill="${INK}"/>${monogram(2, 2, 60)}`));

await sharp(Buffer.from(fullLogo(INK)), { density: 220 })
  .resize(2400, 2400)
  .png()
  .toFile(join(OUT, 'montevar-logo.png'));
await sharp(Buffer.from(fullLogo(null)), { density: 220 })
  .resize(2400, 2400)
  .png()
  .toFile(join(OUT, 'montevar-logo-transparente.png'));
await sharp(Buffer.from(svg(64, 64, `<rect width="64" height="64" fill="${INK}"/>${monogram(4, 4, 56)}`)), { density: 800 })
  .resize(512, 512)
  .png()
  .toFile(join(OUT, 'montevar-monograma.png'));
console.log('Logo generado en client/public/brand/');
