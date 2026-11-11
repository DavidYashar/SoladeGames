/**
 * Procedural surface textures for the six brick materials.
 *
 * The wall is seen from about three metres, so detail has to survive at roughly 25 px
 * per brick: the textures carry colour variation, a roughness map and a bump map rather
 * than fine engraving that would disappear.
 */

import * as THREE from "three";

export type BrickSurface = "clay" | "stone" | "keg" | "gold" | "glass" | "iron";

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

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return [c, c.getContext("2d")!];
}

function finish(c: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

function greyFinish(c: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

/** Per-pixel grain: multiplies the base colour by a little noise. */
function grain(
  ctx: CanvasRenderingContext2D,
  size: number,
  random: () => number,
  amount: number,
): void {
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = 1 - amount / 2 + random() * amount;
    data[i] = Math.min(255, data[i] * n);
    data[i + 1] = Math.min(255, data[i + 1] * n);
    data[i + 2] = Math.min(255, data[i + 2] * n);
  }
  ctx.putImageData(img, 0, 0);
}

function speckles(
  ctx: CanvasRenderingContext2D,
  size: number,
  random: () => number,
  count: number,
  colors: string[],
  maxRadius: number,
): void {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, random() * maxRadius + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Horizontal brushed grain, as on a machined metal face. */
function brushed(
  ctx: CanvasRenderingContext2D,
  size: number,
  random: () => number,
  count: number,
  light: string,
  dark: string,
): void {
  for (let i = 0; i < count; i += 1) {
    const y = random() * size;
    ctx.strokeStyle = random() > 0.5 ? light : dark;
    ctx.globalAlpha = 0.05 + random() * 0.18;
    ctx.lineWidth = 0.5 + random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (random() - 0.5) * 1.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export interface BrickTextures {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  bumpMap: THREE.Texture;
}

export function makeBrickTextures(kind: BrickSurface, size = 128): BrickTextures {
  const [colorCanvas, ctx] = canvas(size);
  const [roughCanvas, rctx] = canvas(size);
  const random = rng(0xb21c + kind.length * 977);

  switch (kind) {
    case "clay": {
      ctx.fillStyle = "#93472f";
      ctx.fillRect(0, 0, size, size);
      grain(ctx, size, random, 0.22);
      speckles(ctx, size, random, 260, ["#5a2a1c", "#6d3524", "#a55a3a"], 1.6);
      // Fine horizontal striations from the mould.
      ctx.globalAlpha = 0.035;
      for (let y = 0; y < size; y += 5) {
        ctx.fillStyle = y % 10 === 0 ? "#7a3a26" : "#b0603f";
        ctx.fillRect(0, y, size, 1);
      }
      ctx.globalAlpha = 1;
      rctx.fillStyle = "#d8d8d8";
      rctx.fillRect(0, 0, size, size);
      speckles(rctx, size, random, 180, ["#f2f2f2", "#bdbdbd"], 2);
      return {
        map: finish(colorCanvas),
        roughnessMap: greyFinish(roughCanvas),
        bumpMap: greyFinish(roughCanvas),
      };
    }

    case "stone": {
      ctx.fillStyle = "#6a6d71";
      ctx.fillRect(0, 0, size, size);
      grain(ctx, size, random, 0.12);
      speckles(ctx, size, random, 900, ["#3d4044", "#8d9094", "#a7aaae", "#565a5e"], 1.9);
      rctx.fillStyle = "#ececec";
      rctx.fillRect(0, 0, size, size);
      speckles(rctx, size, random, 500, ["#ffffff", "#d0d0d0"], 2);
      return {
        map: finish(colorCanvas),
        roughnessMap: greyFinish(roughCanvas),
        bumpMap: greyFinish(roughCanvas),
      };
    }

    case "iron": {
      ctx.fillStyle = "#565b61";
      ctx.fillRect(0, 0, size, size);
      grain(ctx, size, random, 0.1);
      brushed(ctx, size, random, 220, "#9aa1a8", "#32363b");
      rctx.fillStyle = "#8a8a8a";
      rctx.fillRect(0, 0, size, size);
      brushed(rctx, size, random, 220, "#b8b8b8", "#6a6a6a");
      return {
        map: finish(colorCanvas),
        roughnessMap: greyFinish(roughCanvas),
        bumpMap: greyFinish(roughCanvas),
      };
    }

    case "gold": {
      ctx.fillStyle = "#c99a35";
      ctx.fillRect(0, 0, size, size);
      grain(ctx, size, random, 0.08);
      brushed(ctx, size, random, 90, "#f4d98a", "#9c7524");
      rctx.fillStyle = "#5a5a5a";
      rctx.fillRect(0, 0, size, size);
      brushed(rctx, size, random, 90, "#4a4a4a", "#787878");
      return {
        map: finish(colorCanvas),
        roughnessMap: greyFinish(roughCanvas),
        bumpMap: greyFinish(roughCanvas),
      };
    }

    case "keg": {
      ctx.fillStyle = "#7d2622";
      ctx.fillRect(0, 0, size, size);
      grain(ctx, size, random, 0.2);
      speckles(ctx, size, random, 220, ["#4d1411", "#96352c", "#a34a3a"], 2.2);
      rctx.fillStyle = "#c8c8c8";
      rctx.fillRect(0, 0, size, size);
      speckles(rctx, size, random, 200, ["#eeeeee", "#a8a8a8"], 2);
      return {
        map: finish(colorCanvas),
        roughnessMap: greyFinish(roughCanvas),
        bumpMap: greyFinish(roughCanvas),
      };
    }

    case "glass":
    default: {
      // Cloudy cast glass: pale base with soft swirls, almost smooth.
      ctx.fillStyle = "#a9e2ef";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 26; i += 1) {
        ctx.strokeStyle = random() > 0.5 ? "rgba(255,255,255,0.4)" : "rgba(110,190,210,0.35)";
        ctx.lineWidth = 1 + random() * 4;
        ctx.beginPath();
        for (let x = 0; x <= size; x += 8) {
          const y = random() * size;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y + (random() - 0.5) * 6);
        }
        ctx.stroke();
      }
      rctx.fillStyle = "#1a1a1a";
      rctx.fillRect(0, 0, size, size);
      speckles(rctx, size, random, 120, ["#3a3a3a", "#101010"], 2);
      return {
        map: finish(colorCanvas),
        roughnessMap: greyFinish(roughCanvas),
        bumpMap: greyFinish(roughCanvas),
      };
    }
  }
}
