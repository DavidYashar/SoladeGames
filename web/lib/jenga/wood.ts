/**
 * Procedural wood: two canvas textures, generated once at runtime.
 *
 * No external asset is used, so there is nothing to download and nothing to license.
 * The grain is deterministic (seeded), because a plank that changes appearance on every
 * reload looks like a bug.
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

export interface WoodTextures {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export function makeWoodTextures(size = 512): WoodTextures {
  const random = rng(0x5eed);

  const color = document.createElement("canvas");
  color.width = size;
  color.height = size;
  const ctx = color.getContext("2d")!;

  // Base tone: warm beech.
  ctx.fillStyle = "#d8ab73";
  ctx.fillRect(0, 0, size, size);

  // Long grain: vertical fibres with slight wander.
  for (let i = 0; i < 320; i++) {
    const x = random() * size;
    const width = 0.6 + random() * 2.4;
    const alpha = 0.03 + random() * 0.10;
    const dark = random() < 0.72;
    ctx.strokeStyle = dark
      ? `rgba(120, 78, 38, ${alpha})`
      : `rgba(255, 234, 198, ${alpha * 0.8})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    let cx = x;
    ctx.moveTo(cx, 0);
    for (let y = 0; y <= size; y += 24) {
      cx += (random() - 0.5) * 3.2;
      ctx.lineTo(cx, y);
    }
    ctx.stroke();
  }

  // A few softer bands, like cathedral grain.
  for (let i = 0; i < 14; i++) {
    const x = random() * size;
    const r = 30 + random() * 90;
    const grad = ctx.createRadialGradient(x, random() * size, r * 0.2, x, size / 2, r);
    grad.addColorStop(0, "rgba(150, 100, 52, 0.10)");
    grad.addColorStop(1, "rgba(150, 100, 52, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Fine pores.
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(105, 70, 34, ${0.04 + random() * 0.06})`;
    ctx.fillRect(random() * size, random() * size, 0.8 + random() * 1.6, 0.8 + random() * 2.2);
  }

  const roughness = document.createElement("canvas");
  roughness.width = size;
  roughness.height = size;
  const rctx = roughness.getContext("2d")!;
  rctx.fillStyle = "#9a9a9a";
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = random() * size;
    rctx.strokeStyle = `rgba(${random() < 0.5 ? 70 : 210}, 0, 0, 0.05)`;
    rctx.strokeStyle = `rgba(0, 0, 0, ${0.03 + random() * 0.05})`;
    rctx.lineWidth = 0.8 + random() * 2;
    rctx.beginPath();
    rctx.moveTo(x, 0);
    rctx.lineTo(x + (random() - 0.5) * 20, size);
    rctx.stroke();
  }

  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 2.5);

  const roughnessMap = new THREE.CanvasTexture(roughness);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1, 2.5);

  return { map, roughnessMap };
}
