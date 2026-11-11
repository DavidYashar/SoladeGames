/**
 * Ball skin: a blue sphere with a denser, marbled pattern.
 *
 * The point of the pattern is motion. A flat colour hides rotation completely; a
 * surface with varied density makes the spin legible, so a rolling ball looks like it
 * is rolling rather than sliding.
 */

import * as THREE from "three";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeBallTexture(size = 1024): THREE.CanvasTexture {
  const random = rng(0xba11);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Base, with the colour density rising toward the centre of the sheet.
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#17427a");
  base.addColorStop(0.5, "#2f7fd8");
  base.addColorStop(1, "#123a6b");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Marbled bands: darker where the marble is dense.
  for (let i = 0; i < 26; i++) {
    const y = random() * size;
    const amp = 18 + random() * 46;
    const thickness = 6 + random() * 26;
    ctx.strokeStyle = `rgba(10, 40, 80, ${0.10 + random() * 0.22})`;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 * (1 + random() * 0.02)) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // Lighter veins, for contrast in the other direction.
  for (let i = 0; i < 14; i++) {
    const y = random() * size;
    ctx.strokeStyle = `rgba(160, 210, 255, ${0.05 + random() * 0.12})`;
    ctx.lineWidth = 2 + random() * 6;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 20) {
      const yy = y + Math.sin((x / size) * Math.PI * (1 + random())) * (10 + random() * 30);
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // A few specks, so rotation is readable even at a glance.
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(190, 225, 255, ${0.05 + random() * 0.16})`;
    const r = 1 + random() * 3;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.anisotropy = 4;
  return texture;
}

/**
 * A soft round contact shadow. Real lamp shadows are too diffuse on a bright cloth to
 * read at gameplay distance, so the ball carries its own, drawn flat on the felt.
 */
export function makeShadowTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(0,0,0,0.80)");
  grad.addColorStop(0.40, "rgba(0,0,0,0.38)");
  grad.addColorStop(0.75, "rgba(0,0,0,0.06)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}