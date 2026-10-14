import * as THREE from 'three';
import type { FighterDef } from '../data/roster';
import { pixelTexture } from './ps1Material';

/** Face texture resolution (PS1-ish but still recognisable). */
export const FACE_W = 72;
export const FACE_H = 96;

export interface FaceAssets {
  texture: THREE.CanvasTexture;
  skin: THREE.Color;
  /** small canvas for menus (CSS-scaled with pixelated rendering) */
  portrait: HTMLCanvasElement;
  /** data URL of the portrait */
  portraitUrl: string;
}

const cache = new Map<string, Promise<FaceAssets>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed: ' + src.slice(0, 64)));
    img.src = src;
  });
}

/** Posterise to 5 bits per channel with a 4x4 ordered dither: PS1 15-bit colour look. */
function ps1Posterize(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const t = (bayer[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 8;
      for (let c = 0; c < 3; c++) {
        const v = Math.max(0, Math.min(255, d[i + c] + t));
        d[i + c] = Math.round(v / 8) * 8;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function sampleSkin(ctx: CanvasRenderingContext2D, w: number, h: number): THREE.Color {
  // cheeks + nose bridge + chin-ish areas
  const regions: [number, number, number, number][] = [
    [0.16, 0.5, 0.14, 0.12],
    [0.7, 0.5, 0.14, 0.12],
    [0.42, 0.25, 0.16, 0.08],
  ];
  const samples: [number, number, number][] = [];
  for (const [rx, ry, rw, rh] of regions) {
    const data = ctx.getImageData(Math.floor(rx * w), Math.floor(ry * h), Math.max(1, Math.floor(rw * w)), Math.max(1, Math.floor(rh * h))).data;
    for (let i = 0; i < data.length; i += 4) samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  // median per channel (robust to glasses / shadows)
  const med = (c: number) => {
    const arr = samples.map((s) => s[c]).sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)] ?? 180;
  };
  return new THREE.Color(med(0) / 255, med(1) / 255, med(2) / 255);
}

/** Photos are often pinkish / over-saturated on the cheeks: pull the body tone toward a natural skin hue. */
function naturalSkin(c: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // typical skin hue is ~20-30 degrees
  const targetH = 0.07;
  let dh = targetH - hsl.h;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  hsl.h = (hsl.h + dh * 0.6 + 1) % 1;
  hsl.s = Math.min(hsl.s * 0.75, 0.5);
  hsl.l = hsl.l * 0.95;
  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
}

/** Draws a simple pixel-art face for fighters without a photo. */
export function drawProceduralFace(ctx: CanvasRenderingContext2D, w: number, h: number, def: FighterDef) {
  const skin = new THREE.Color(def.skin ?? '#c89070');
  const fg = def.faceGen ?? {};
  const css = (c: THREE.Color) => '#' + c.getHexString();
  const shade = (k: number) => css(skin.clone().multiplyScalar(k));
  ctx.fillStyle = css(skin);
  ctx.fillRect(0, 0, w, h);
  const px = (x: number, y: number, ww: number, hh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x * w), Math.round(y * h), Math.max(1, Math.round(ww * w)), Math.max(1, Math.round(hh * h)));
  };
  // cheek shading
  px(0.0, 0.0, 0.12, 1, shade(0.88));
  px(0.88, 0.0, 0.12, 1, shade(0.88));
  // brows
  const brow = fg.brows ?? '#2a1a10';
  px(0.2, 0.36, 0.22, 0.04, brow);
  px(0.58, 0.36, 0.22, 0.04, brow);
  // eyes
  px(0.22, 0.43, 0.18, 0.06, '#f4f0e8');
  px(0.6, 0.43, 0.18, 0.06, '#f4f0e8');
  const eye = fg.eyes ?? '#2a1a12';
  px(0.28, 0.43, 0.07, 0.06, eye);
  px(0.65, 0.43, 0.07, 0.06, eye);
  px(0.22, 0.49, 0.18, 0.015, shade(0.75));
  px(0.6, 0.49, 0.18, 0.015, shade(0.75));
  // nose
  px(0.46, 0.48, 0.08, 0.14, shade(0.92));
  px(0.42, 0.6, 0.16, 0.04, shade(0.72));
  // mouth
  px(0.34, 0.72, 0.32, 0.035, fg.lips ?? css(skin.clone().multiplyScalar(0.6)));
  px(0.38, 0.755, 0.24, 0.02, shade(0.8));
  if (fg.wrinkles) {
    px(0.22, 0.56, 0.06, 0.015, shade(0.8));
    px(0.72, 0.56, 0.06, 0.015, shade(0.8));
    px(0.3, 0.27, 0.4, 0.012, shade(0.85));
    px(0.3, 0.68, 0.04, 0.06, shade(0.82));
    px(0.66, 0.68, 0.04, 0.06, shade(0.82));
  }
  if (fg.beard) {
    const b = '#1c140e';
    px(0.26, 0.69, 0.48, 0.025, b); // moustache
    px(0.3, 0.8, 0.4, 0.12, b); // goatee
    px(0.12, 0.62, 0.08, 0.25, shade(0.6));
    px(0.8, 0.62, 0.08, 0.25, shade(0.6));
  }
  if (fg.glasses) {
    const g = '#202028';
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1, Math.round(w * 0.03));
    ctx.strokeRect(Math.round(0.18 * w), Math.round(0.4 * h), Math.round(0.26 * w), Math.round(0.13 * h));
    ctx.strokeRect(Math.round(0.56 * w), Math.round(0.4 * h), Math.round(0.26 * w), Math.round(0.13 * h));
    px(0.44, 0.44, 0.12, 0.02, g);
  }
}

function finish(canvas: HTMLCanvasElement, skin: THREE.Color): FaceAssets {
  const texture = pixelTexture(canvas);
  const portrait = document.createElement('canvas');
  portrait.width = 48;
  portrait.height = 64;
  const pctx = portrait.getContext('2d')!;
  pctx.imageSmoothingEnabled = true;
  pctx.drawImage(canvas, 0, 0, 48, 64);
  return { texture, skin, portrait, portraitUrl: portrait.toDataURL() };
}

export function loadFace(def: FighterDef): Promise<FaceAssets> {
  const key = def.id + '|' + def.face.slice(0, 80) + '|' + def.face.length + '|' + (def.skin ?? '');
  let p = cache.get(key);
  if (!p) {
    p = buildFace(def);
    cache.set(key, p);
  }
  return p;
}

async function buildFace(def: FighterDef): Promise<FaceAssets> {
  const canvas = document.createElement('canvas');
  canvas.width = FACE_W;
  canvas.height = FACE_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  if (def.face) {
    try {
      const img = await loadImage(def.face);
      // cover-crop to 3:4
      const target = FACE_W / FACE_H;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      let sx = 0;
      let sy = 0;
      if (sw / sh > target) {
        sw = sh * target;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = sw / target;
        sy = (img.naturalHeight - sh) / 2;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, FACE_W, FACE_H);
      const skin = def.skin ? new THREE.Color(def.skin) : naturalSkin(sampleSkin(ctx, FACE_W, FACE_H));
      ps1Posterize(ctx, FACE_W, FACE_H);
      return finish(canvas, skin);
    } catch (e) {
      console.warn(e);
    }
  }
  drawProceduralFace(ctx, FACE_W, FACE_H, def);
  return finish(canvas, new THREE.Color(def.skin ?? '#c89070'));
}

/** Read an uploaded File into a cropped data URL (used by the fighter lab). */
export async function cropFileToDataUrl(
  src: string,
  crop: { cx: number; cy: number; zoom: number },
  outW = 240,
  outH = 320,
): Promise<string> {
  const img = await loadImage(src);
  const c = document.createElement('canvas');
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext('2d')!;
  const aspect = outW / outH;
  // base box: largest 3:4 box inside the image, then zoomed
  let bw = img.naturalWidth;
  let bh = bw / aspect;
  if (bh > img.naturalHeight) {
    bh = img.naturalHeight;
    bw = bh * aspect;
  }
  bw /= crop.zoom;
  bh /= crop.zoom;
  const sx = crop.cx * img.naturalWidth - bw / 2;
  const sy = crop.cy * img.naturalHeight - bh / 2;
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, bw, bh, 0, 0, outW, outH);
  return c.toDataURL('image/jpeg', 0.85);
}
