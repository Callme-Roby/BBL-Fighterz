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

function hash01(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function seedOf(s: string): number {
  let n = 7;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 100003;
  return n;
}

/**
 * Draws a pixel-art face for fighters without a photo.
 * Designed on a 72x96 grid (scaled to w x h): the texture covers hairline → chin and
 * cheek → cheek; eyes at ~42% from the top, mouth at ~74%, chin at ~93%.
 * The light comes from the upper right of the picture (the fighter's left).
 */
export function drawProceduralFace(ctx: CanvasRenderingContext2D, w: number, h: number, def: FighterDef) {
  const fg = def.faceGen ?? {};
  const skin = new THREE.Color(def.skin ?? '#c89070');
  const seed = seedOf(def.id);
  const sx = w / 72;
  const sy = h / 96;
  const C = (c: string | THREE.Color) => (typeof c === 'string' ? new THREE.Color(c) : c.clone());
  const css = (c: THREE.Color) => '#' + c.getHexString();
  const tone = (k: number) => skin.clone().multiplyScalar(k);
  const mix = (a: string | THREE.Color, b: string | THREE.Color, t: number) => C(a).lerp(C(b), t);
  /** fill a rectangle given in 72x96 design pixels */
  const R = (x: number, y: number, ww: number, hh: number, col: THREE.Color | string) => {
    ctx.fillStyle = typeof col === 'string' ? col : css(col);
    ctx.fillRect(Math.round(x * sx), Math.round(y * sy), Math.max(1, Math.round(ww * sx)), Math.max(1, Math.round(hh * sy)));
  };
  const P = (x: number, y: number, col: THREE.Color | string) => R(x, y, 1, 1, col);
  const lum = (c: THREE.Color) => 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;

  // ---- 1. base skin with soft volume shading (per pixel) ----
  const eyeL = 23;
  const eyeR = 49;
  const eyeY = 40;
  {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const g2 = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => Math.exp(-(((x - cx) / rx) ** 2) - ((y - cy) / ry) ** 2);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5) / sx;
        const y = (py + 0.5) / sy;
        const dx = (x - 36) / 36;
        let f = 1 - 0.17 * Math.abs(dx) ** 2.2 + 0.035 * dx;
        f -= 0.1 * Math.max(0, (y - 76) / 20) ** 2 * (0.3 + Math.abs(dx)); // jaw
        f += 0.035 * g2(x, y, 40, 22, 14, 8); // forehead
        f += 0.04 * g2(x, y, 54, 50, 6, 5) + 0.02 * g2(x, y, 18, 50, 6, 5); // cheekbones
        f -= 0.07 * (g2(x, y, eyeL + 1, eyeY - 1, 9, 4.5) + g2(x, y, eyeR - 1, eyeY - 1, 9, 4.5)); // eye sockets
        f -= 0.05 * g2(x, y, 36, 80, 9, 2.5); // under the lower lip
        f += 0.03 * g2(x, y, 37, 86, 6, 3); // chin
        const i = (py * w + px) * 4;
        d[i] = Math.min(255, skin.r * f * 255);
        d[i + 1] = Math.min(255, skin.g * f * 255);
        d[i + 2] = Math.min(255, skin.b * f * 255);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const browCol = C(fg.brows ?? mix(def.hair.style === 'bald' ? '#2a1a10' : def.hair.color, '#20140c', 0.45));
  const beardCol = C(fg.beardColor ?? browCol);
  const dark = mix(tone(0.3), '#140c0a', 0.5);
  const lips = C(fg.lips ?? mix(skin, '#a84a48', 0.38).multiplyScalar(0.9));
  const mouth = fg.mouth ?? 'neutral';
  const angry = mouth === 'frown';

  // ---- 2. beards (under the features) ----
  const inBeard = (x: number, y: number) => {
    const dd = Math.abs(x - 35.5);
    let topY: number;
    if (dd >= 30) topY = 46;
    else if (dd >= 12) topY = 68 - (dd - 12);
    else topY = 74;
    return y >= topY ? y - topY : -1;
  };
  const speckle = (x: number, y: number) => hash01(seed + x * 13.1 + y * 71.7);
  if (fg.beard || fg.stubble) {
    for (let y = 44; y < 96; y++) {
      for (let x = 0; x < 72; x++) {
        const depth = inBeard(x + 0.5, y + 0.5);
        if (depth < 0) continue;
        const n = speckle(x, y);
        if (fg.beard) {
          const edge = depth < 2 ? 0.5 : 1;
          if (depth < 2 && n < 0.4) continue;
          P(x, y, mix(skin, beardCol.clone().multiplyScalar(0.85 + 0.3 * n), edge * 0.92));
        } else if (n < 0.5) {
          P(x, y, mix(skin, beardCol, 0.28 + 0.12 * n));
        }
      }
    }
  }
  if (fg.goatee) {
    for (let y = 76; y < 93; y++) {
      const half = y > 85 ? 8 - (y - 85) * 0.9 : 8;
      for (let x = Math.round(36 - half); x < 36 + half; x++) {
        const n = speckle(x, y);
        if ((x < 36 - half + 1.5 || x > 36 + half - 2 || y > 90) && n < 0.5) continue;
        P(x, y, beardCol.clone().multiplyScalar(0.85 + 0.3 * n));
      }
    }
    if (fg.moustache) {
      // thin lines joining the moustache to the goatee around the mouth
      for (let y = 67; y < 77; y++) {
        const x = y < 72 ? 27 : 28;
        P(x, y, beardCol.clone().multiplyScalar(0.9));
        P(71 - x, y, beardCol.clone().multiplyScalar(0.9));
      }
    }
  }

  // ---- 3. eyes ----
  const white = mix('#f2eee6', skin, 0.14);
  const iris = C(fg.eyes ?? '#3a2616');
  for (const cx of [eyeL, eyeR]) {
    const outer = cx < 36 ? -1 : 1;
    R(cx - 4, 34, 9, 1, tone(0.82)); // lid crease
    R(cx - 4, 37, 9, 1, white);
    R(cx - 5, 38, 11, 3, white);
    R(cx - 4, 41, 9, 1, white);
    R(cx - 2, 37, 5, 5, iris);
    R(cx - 2, 37, 5, 1, iris.clone().multiplyScalar(0.6));
    R(cx - 1, 38, 3, 2, '#0c0808');
    P(cx + 1, 38, '#ffffff');
    R(cx - 5, 36, 11, 1, dark); // upper lid + lashes
    R(cx - 4, 35, 9, 1, mix(dark, skin, 0.55));
    P(cx + outer * 6, 36, dark);
    P(cx + outer * 6, 37, mix(dark, skin, 0.35));
    P(cx - outer * 5, 41, mix(white, skin, 0.5));
    R(cx - 4, 42, 9, 1, tone(0.8)); // lower lid
    if (fg.wrinkles) {
      R(cx - 3, 43, 7, 1, tone(0.86)); // bags
      P(cx + outer * 7, 38, tone(0.8));
      P(cx + outer * 8, 40, tone(0.82));
      P(cx + outer * 7, 42, tone(0.8));
    }
  }

  // ---- 4. eyebrows ----
  const browSize = Math.min(2, Math.max(0.5, fg.browSize ?? 1));
  const thick = Math.max(1, Math.round(2 * browSize));
  for (const cx of [eyeL, eyeR]) {
    for (let i = 0; i <= 16; i++) {
      // u: 0 at the outer end, 1 at the inner end
      const x = cx < 36 ? cx - 8 + i : cx + 8 - i;
      const u = i / 16;
      let y = 31.6 - 1.8 * Math.sin(Math.PI * Math.pow(u, 0.75));
      if (angry) y += 2.4 * u * u;
      const t = thick + (u > 0.55 && browSize > 1.2 ? 1 : 0) - (u < 0.12 ? 1 : 0);
      const c = browCol.clone().multiplyScalar(0.9 + 0.2 * hash01(seed + i + cx));
      R(x, Math.round(y), 1, Math.max(1, t), c);
    }
  }

  // ---- 5. nose ----
  R(33, 41, 1, 13, tone(0.9));
  R(32, 49, 1, 7, tone(0.87));
  R(37, 43, 1, 12, tone(1.07));
  R(34, 55, 5, 3, tone(1.04));
  R(36, 55, 2, 1, tone(1.1));
  R(30, 56, 2, 3, tone(0.84));
  R(41, 56, 2, 3, tone(0.92));
  R(31, 59, 11, 1, tone(0.76));
  R(32, 59, 2, 1, tone(0.45));
  R(39, 59, 2, 1, tone(0.5));
  R(32, 60, 9, 1, tone(0.86));
  R(35, 62, 1, 5, tone(0.93)); // philtrum
  if (fg.wrinkles) {
    for (let i = 0; i < 9; i++) {
      P(Math.round(29 - i * 0.4), 61 + i, tone(0.84));
      P(Math.round(43 + i * 0.4), 61 + i, tone(0.88));
    }
    R(26, 23, 20, 1, tone(0.88));
    R(29, 27, 16, 1, tone(0.88));
    R(31, 31, 10, 1, tone(0.9));
  }

  // ---- 6. cheeks: blush, freckles ----
  if (fg.blush) {
    const rose = new THREE.Color('#e0505c');
    for (const cx of [17, 55]) {
      for (let y = 47; y <= 57; y++) {
        for (let x = cx - 7; x <= cx + 7; x++) {
          const r = ((x - cx) / 7) ** 2 + ((y - 52) / 5) ** 2;
          if (r > 1) continue;
          const px = ctx.getImageData(Math.floor(x * sx), Math.floor(y * sy), 1, 1).data;
          const base = new THREE.Color(px[0] / 255, px[1] / 255, px[2] / 255);
          P(x, y, base.lerp(rose, 0.28 * (1 - r)));
        }
      }
    }
  }
  if (fg.freckles) {
    const fr = mix(tone(0.78), '#a0502a', 0.3);
    for (let i = 0; i < 34; i++) {
      const x = Math.round(14 + hash01(seed + i * 3.3) * 44);
      const y = Math.round(44 + hash01(seed + i * 7.7) * 13);
      if (Math.abs(x - 36) < 3 && y > 50) continue;
      if (y < 45 && (Math.abs(x - eyeL) < 6 || Math.abs(x - eyeR) < 6)) continue;
      P(x, y, fr);
    }
  }

  // ---- 7. moustache ----
  if (fg.moustache) {
    const m = (x: number, y: number) => P(x, y, beardCol.clone().multiplyScalar(0.85 + 0.3 * speckle(x, y)));
    for (let x = 31; x <= 41; x++) m(x, 63);
    for (let y = 64; y <= 66; y++) for (let x = 28; x <= 44; x++) m(x, y);
    for (let x = 27; x <= 31; x++) m(x, 67);
    for (let x = 41; x <= 45; x++) m(x, 67);
    m(27, 68);
    m(26, 68);
    m(45, 68);
    m(46, 68);
    for (let x = 30; x <= 42; x++) P(x, 67, beardCol.clone().multiplyScalar(0.6)); // shadow under it
  }

  // ---- 8. mouth ----
  const lineCol = mix(dark, lips, 0.3);
  if (!fg.moustache) {
    R(29, 69, 5, 1, lips.clone().multiplyScalar(0.85));
    R(38, 69, 5, 1, lips.clone().multiplyScalar(0.85));
  }
  R(28, 70, 16, 1, lips.clone().multiplyScalar(0.78));
  if (mouth === 'grin') {
    R(28, 71, 16, 1, lineCol);
    R(29, 72, 14, 1, '#ece6da');
    R(30, 73, 12, 1, '#5a1c1c');
    R(30, 74, 12, 2, lips);
    R(33, 74, 6, 1, lips.clone().multiplyScalar(1.15));
    P(27, 70, lineCol);
    P(44, 70, lineCol);
    P(26, 69, lineCol);
    P(45, 69, lineCol);
  } else {
    R(28, 71, 16, 1, lineCol);
    R(30, 72, 12, 2, lips);
    R(33, 72, 6, 1, lips.clone().multiplyScalar(1.15));
    if (mouth === 'smile' || mouth === 'smirk') {
      P(44, 70, lineCol);
      P(45, 69, lineCol);
      P(46, 70, tone(0.86));
      if (mouth === 'smile') {
        P(27, 70, lineCol);
        P(26, 69, lineCol);
        P(25, 70, tone(0.86));
      }
    } else if (mouth === 'frown') {
      P(27, 72, lineCol);
      P(44, 72, lineCol);
      P(26, 73, tone(0.84));
      P(45, 73, tone(0.84));
    }
  }
  R(31, 75, 10, 1, tone(lum(skin) > 0.35 ? 0.86 : 0.8));

  // ---- 9. scar (across the left eyebrow, picture right) ----
  if (fg.scar) {
    const sc = mix(tone(1.15), '#e8a8a0', 0.35);
    for (let i = 0; i < 9; i++) {
      const x = 51 + Math.round(i * 0.45);
      P(x, 27 + i, sc);
      P(x + 1, 27 + i, tone(0.82));
    }
    P(50, 29, tone(0.85));
    P(53, 29, tone(0.85));
    P(51, 33, tone(0.85));
    P(54, 33, tone(0.85));
  }

  // ---- 10. glasses ----
  if (fg.sunglasses) {
    for (const cx of [eyeL, eyeR]) {
      for (let y = 35; y <= 45; y++) {
        const corner = y === 45 ? 2 : y === 44 ? 1 : 0;
        for (let x = cx - 8 + corner; x <= cx + 7 - corner; x++) {
          const t = (y - 35) / 10;
          P(x, y, mix('#0a0c12', '#20283a', t));
        }
      }
      R(cx - 8, 34, 16, 1, '#050506');
      for (let i = 0; i < 6; i++) {
        P(cx - 4 + i, 43 - i, '#4a5a74');
        P(cx - 3 + i, 43 - i, '#3a4860');
      }
      P(cx + 4, 37, '#c8d8f0');
    }
    R(31, 36, 10, 2, '#08080a');
    R(0, 36, eyeL - 8, 1, '#08080a');
    R(eyeR + 8, 36, 72 - eyeR - 8, 1, '#08080a');
  } else if (fg.glasses) {
    const fc = '#1e1e24';
    for (const cx of [eyeL, eyeR]) {
      R(cx - 8, 34, 16, 1, fc);
      R(cx - 8, 45, 16, 1, fc);
      R(cx - 9, 35, 1, 10, fc);
      R(cx + 8, 35, 1, 10, fc);
      P(cx + 5, 36, '#ffffff');
      P(cx + 6, 37, '#dde8f0');
    }
    R(32, 37, 8, 1, fc);
    R(0, 36, eyeL - 9, 1, fc);
    R(eyeR + 9, 36, 72 - eyeR - 9, 1, fc);
  }

  ps1Posterize(ctx, w, h);
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
  let key = def.id + '|' + def.face.slice(0, 80) + '|' + def.face.length + '|' + (def.skin ?? '');
  // procedural faces also depend on their options (lab edits)
  if (!def.face) key += '|' + JSON.stringify(def.faceGen ?? {}) + def.hair.style + def.hair.color;
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
