import * as THREE from 'three';
import gsap from 'gsap';

const CANVAS_W = 2048;
const CANVAS_H = 256;
const GAP = String.fromCharCode(0x2002, 0x2002); // espacio entre repeticiones del texto
const ROWS = [
  { y: 2.05, speed: 0.025, style: 'fill' },
  { y: 0.0, speed: -0.035, style: 'fill' },
  { y: -2.05, speed: 0.03, style: 'fill' },
];

function drawRow(ctx, text, color, style) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.font = '230px Anton, Impact, sans-serif';
  ctx.textBaseline = 'middle';
  const token = `${text}${GAP}`;
  const tokenWidth = ctx.measureText(token).width;
  // Se estira levemente para que el patrón repita sin costura.
  const count = Math.max(1, Math.round(CANVAS_W / tokenWidth));
  ctx.setTransform(CANVAS_W / (count * tokenWidth), 0, 0, 1, 0, 0);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  for (let i = 0; i < count; i++) {
    if (style === 'fill') ctx.fillText(token, i * tokenWidth, CANVAS_H / 2 + 8);
    else ctx.strokeText(token, i * tokenWidth, CANVAS_H / 2 + 8);
  }
}

/** Texto gigante en movimiento detrás de la prenda (la marca de la colección). */
export function createMarquee(defaultText) {
  const group = new THREE.Group();
  group.name = 'marquee';
  group.position.set(0, 1.45, -2.4);
  group.visible = false;

  const rows = ROWS.map((row) => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = 1.4;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), material);
    mesh.position.y = row.y;
    mesh.userData.marquee = true;
    group.add(mesh);
    return { ...row, canvas, ctx: canvas.getContext('2d'), texture, material, mesh };
  });

  const text = defaultText;
  let color = '#ffffff';
  let targetOpacity = 0.2;

  function redraw() {
    rows.forEach((row) => {
      drawRow(row.ctx, text, '#ffffff', row.style);
      row.texture.needsUpdate = true;
      row.material.color.set(color);
    });
  }
  redraw();

  return {
    group,
    meshes: rows.map((r) => r.mesh),
    setStyle(style) {
      color = style.color;
      targetOpacity = style.opacity;
      rows.forEach((r) => r.material.color.set(color));
    },
    show(visible) {
      if (visible) group.visible = true;
      gsap.to(
        rows.map((r) => r.material),
        {
          opacity: visible ? targetOpacity : 0,
          duration: visible ? 1.1 : 0.5,
          ease: 'power2.out',
          overwrite: 'auto',
          onComplete: () => {
            if (!visible) group.visible = false;
          },
        },
      );
    },
    tick(dt) {
      if (!group.visible) return;
      rows.forEach((r) => (r.texture.offset.x += r.speed * dt));
    },
  };
}
