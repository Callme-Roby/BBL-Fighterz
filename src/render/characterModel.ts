import * as THREE from 'three';
import type { FighterDef, HairStyle } from '../data/roster';
import { createFaceMaterial, createPS1Material, type PS1Material } from './ps1Material';
import type { FaceAssets } from './faceTexture';

/**
 * Procedural low-poly fighter with a real skeleton (THREE.Skeleton + skinned
 * meshes). Limbs and torso are continuous tubes whose joint rings are weighted
 * between two bones, so elbows / knees / waist bend smoothly.
 *
 * Bind pose: standing, arms down, facing +Z. +X is the character's LEFT side.
 */

export const BONE_NAMES = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'shoulderL',
  'upperArmL',
  'foreArmL',
  'handL',
  'shoulderR',
  'upperArmR',
  'foreArmR',
  'handR',
  'thighL',
  'shinL',
  'footL',
  'thighR',
  'shinR',
  'footR',
] as const;
export type BoneName = (typeof BONE_NAMES)[number];

const PARENT: Record<BoneName, BoneName | null> = {
  hips: null,
  spine: 'hips',
  chest: 'spine',
  neck: 'chest',
  head: 'neck',
  shoulderL: 'chest',
  upperArmL: 'shoulderL',
  foreArmL: 'upperArmL',
  handL: 'foreArmL',
  shoulderR: 'chest',
  upperArmR: 'shoulderR',
  foreArmR: 'upperArmR',
  handR: 'foreArmR',
  thighL: 'hips',
  shinL: 'thighL',
  footL: 'shinL',
  thighR: 'hips',
  shinR: 'thighR',
  footR: 'shinR',
};

const BI = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i])) as Record<BoneName, number>;

type Weights = [BoneName, number][];
type ColorFn = (theta: number, end: 0 | 1) => THREE.Color;

interface Ring {
  y: number;
  rx: number;
  rz: number;
  cx?: number;
  cz?: number;
  w: Weights;
  /** colour of the band going from this ring to the next one */
  col: THREE.Color | ColorFn;
}

/** Accumulates skinned, vertex-coloured geometry. */
class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  si: number[] = [];
  sw: number[] = [];
  idx: number[] = [];

  vert(p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color, w: Weights, u = 0, v = 0): number {
    const i = this.pos.length / 3;
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.col.push(c.r, c.g, c.b);
    this.uv.push(u, v);
    const ww = [...w, ...([['hips', 0], ['hips', 0], ['hips', 0], ['hips', 0]] as Weights)].slice(0, 4);
    const total = ww.reduce((a, b) => a + b[1], 0) || 1;
    for (const [b, wt] of ww) {
      this.si.push(BI[b]);
      this.sw.push(wt / total);
    }
    return i;
  }

  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }

  /** Elliptic tube through horizontal rings (listed top to bottom or bottom to top). */
  tube(rings: Ring[], segs: number, capStart = true, capEnd = true) {
    const n = new THREE.Vector3();
    const p = new THREE.Vector3();
    const ringVerts = (r: Ring, col: THREE.Color | ColorFn, end: 0 | 1) => {
      const out: number[] = [];
      for (let s = 0; s <= segs; s++) {
        const th = (s / segs) * Math.PI * 2;
        const c = Math.cos(th);
        const sn = Math.sin(th);
        p.set((r.cx ?? 0) + r.rx * c, r.y, (r.cz ?? 0) + r.rz * sn);
        n.set(c / Math.max(r.rx, 1e-3), 0, sn / Math.max(r.rz, 1e-3)).normalize();
        const cc = typeof col === 'function' ? col(th, end) : col;
        out.push(this.vert(p, n, cc, r.w, s / segs, r.y));
      }
      return out;
    };
    for (let i = 0; i < rings.length - 1; i++) {
      const a = ringVerts(rings[i], rings[i].col, 0);
      const b = ringVerts(rings[i + 1], rings[i].col, 1);
      const up = rings[i + 1].y > rings[i].y;
      for (let s = 0; s < segs; s++) {
        if (up) {
          this.tri(a[s], b[s + 1], a[s + 1]);
          this.tri(a[s], b[s], b[s + 1]);
        } else {
          this.tri(a[s], a[s + 1], b[s + 1]);
          this.tri(a[s], b[s + 1], b[s]);
        }
      }
    }
    const cap = (r: Ring, top: boolean, col: THREE.Color) => {
      const nn = new THREE.Vector3(0, top ? 1 : -1, 0);
      const center = this.vert(new THREE.Vector3(r.cx ?? 0, r.y + (top ? 0.012 : -0.012), r.cz ?? 0), nn, col, r.w);
      const vs: number[] = [];
      for (let s = 0; s <= segs; s++) {
        const th = (s / segs) * Math.PI * 2;
        p.set((r.cx ?? 0) + r.rx * Math.cos(th), r.y, (r.cz ?? 0) + r.rz * Math.sin(th));
        vs.push(this.vert(p, nn, col, r.w));
      }
      for (let s = 0; s < segs; s++) {
        if (top) this.tri(center, vs[s + 1], vs[s]);
        else this.tri(center, vs[s], vs[s + 1]);
      }
    };
    const colOf = (r: Ring) => (typeof r.col === 'function' ? r.col(Math.PI / 2, 0) : r.col);
    const first = rings[0];
    const last = rings[rings.length - 1];
    const firstIsTop = first.y > last.y;
    if (capStart) cap(first, firstIsTop, colOf(first));
    if (capEnd) cap(last, !firstIsTop, colOf(rings[rings.length - 2]));
  }

  /** Axis-aligned box with flat normals; colour may depend on the face normal. */
  box(center: THREE.Vector3, size: THREE.Vector3, w: Weights, col: THREE.Color | ((n: THREE.Vector3, p: THREE.Vector3) => THREE.Color), taperTop = 1) {
    const hx = size.x / 2;
    const hy = size.y / 2;
    const hz = size.z / 2;
    const faces: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
      [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)],
    ];
    for (const [nrm, u, v] of faces) {
      const ids: number[] = [];
      for (const [a, b] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const p = new THREE.Vector3()
          .addScaledVector(nrm, 1)
          .addScaledVector(u, a)
          .addScaledVector(v, b);
        p.set(p.x * hx, p.y * hy, p.z * hz);
        if (p.y > 0) {
          p.x *= taperTop;
          p.z *= taperTop;
        }
        p.add(center);
        const c = typeof col === 'function' ? col(nrm, p) : col;
        ids.push(this.vert(p, nrm, c, w));
      }
      this.tri(ids[0], ids[1], ids[2]);
      this.tri(ids[0], ids[2], ids[3]);
    }
  }

  /** Add an arbitrary (non-indexed or indexed) three.js geometry, rigidly bound to one bone. */
  addGeometry(g: THREE.BufferGeometry, w: Weights, col: THREE.Color | ((p: THREE.Vector3, i: number) => THREE.Color)) {
    const geo = g;
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const base = this.pos.length / 3;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      this.vert(p, n, typeof col === 'function' ? col(p, i) : col, w);
    }
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
    } else {
      for (let i = 0; i < pos.count; i++) this.idx.push(base + i);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export interface CharacterModel {
  root: THREE.Group;
  /** child of root: apply facing mirror / yaw here */
  body: THREE.Group;
  bones: Record<BoneName, THREE.Bone>;
  bindPos: Record<BoneName, THREE.Vector3>;
  materials: PS1Material[];
  skeleton: THREE.Skeleton;
  /** world-space height of the eyes in bind pose (camera framing) */
  headY: number;
  dispose(): void;
}

function hashNoise(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}


const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Silhouette multipliers applied to bone positions and ring radii (all 1 = standard body). */
interface Shape {
  shoulder: number;
  chest: number;
  chestZ: number;
  waist: number;
  hip: number;
  hipX: number;
  arm: number;
  thigh: number;
  shin: number;
  neck: number;
  fist: number;
  foot: number;
}
const STANDARD: Shape = { shoulder: 1, chest: 1, chestZ: 1, waist: 1, hip: 1, hipX: 1, arm: 1, thigh: 1, shin: 1, neck: 1, fist: 1, foot: 1 };
const FINE: Shape = { shoulder: 0.88, chest: 0.86, chestZ: 0.92, waist: 0.9, hip: 1.08, hipX: 1.06, arm: 0.8, thigh: 0.9, shin: 0.86, neck: 0.84, fist: 0.84, foot: 0.92 };

export function buildCharacter(def: FighterDef, face: FaceAssets): CharacterModel {
  const build = def.build ?? 1;
  const hs = def.headScale ?? 1.15;
  const o = def.outfit;
  const F = def.body === 'fine' ? FINE : STANDARD;
  const belly = clamp01(def.belly ?? 0);
  const baggy = o.baggy ? 1 : 0;
  const C = (h: string) => new THREE.Color(h);
  const skin = face.skin.clone();
  const skinDark = skin.clone().multiplyScalar(0.85);
  const top = C(o.topColor);
  const trim = C(o.trimColor);
  const pants = C(o.pantsColor);
  const pantsDark = pants.clone().multiplyScalar(0.8);
  const shoes = C(o.shoesColor);
  const sole = C('#e8e6e0');
  const belt = C(o.beltColor ?? o.pantsColor).multiplyScalar(o.beltColor ? 1 : 0.7);
  const wrist = o.wristColor ? C(o.wristColor) : null;
  const stain = o.stains ? C(o.stains) : null;

  const shoulderX = 0.235 * Math.sqrt(build) * F.shoulder;
  const hipX = 0.1 * Math.sqrt(build) * F.hipX;
  const wb = build; // width factor for radii

  // ---------------- skeleton ----------------
  const bindPos: Record<BoneName, THREE.Vector3> = {
    hips: new THREE.Vector3(0, 0.98, 0),
    spine: new THREE.Vector3(0, 1.1, 0),
    chest: new THREE.Vector3(0, 1.27, 0),
    neck: new THREE.Vector3(0, 1.5, 0),
    head: new THREE.Vector3(0, 1.58, 0),
    shoulderL: new THREE.Vector3(0.07 * F.shoulder, 1.45, 0),
    upperArmL: new THREE.Vector3(shoulderX, 1.46, 0),
    foreArmL: new THREE.Vector3(shoulderX, 1.18, 0),
    handL: new THREE.Vector3(shoulderX, 0.94, 0),
    shoulderR: new THREE.Vector3(-0.07 * F.shoulder, 1.45, 0),
    upperArmR: new THREE.Vector3(-shoulderX, 1.46, 0),
    foreArmR: new THREE.Vector3(-shoulderX, 1.18, 0),
    handR: new THREE.Vector3(-shoulderX, 0.94, 0),
    thighL: new THREE.Vector3(hipX, 0.95, 0),
    shinL: new THREE.Vector3(hipX, 0.51, 0),
    footL: new THREE.Vector3(hipX, 0.09, 0),
    thighR: new THREE.Vector3(-hipX, 0.95, 0),
    shinR: new THREE.Vector3(-hipX, 0.51, 0),
    footR: new THREE.Vector3(-hipX, 0.09, 0),
  };
  const bones = {} as Record<BoneName, THREE.Bone>;
  for (const name of BONE_NAMES) {
    const b = new THREE.Bone();
    b.name = name;
    const parent = PARENT[name];
    const wp = bindPos[name];
    if (parent) {
      b.position.copy(wp).sub(bindPos[parent]);
      bones[parent].add(b);
    } else {
      b.position.copy(wp);
    }
    bones[name] = b;
  }

  // ---------------- body geometry ----------------
  const g = new GeoBuilder();
  const SEG = 10;
  const isTank = o.top === 'tank';
  const bare = o.top === 'shirtless';
  const sleeves = o.top === 'tracksuit' || o.top === 'hoodie';
  const torsoTop = bare ? skin : top;

  // tank top: shoulders and arm holes show skin; tracksuit: front zip stripe
  const upperChestCol: ColorFn = (th) => {
    const side = Math.abs(Math.cos(th));
    if (isTank && side > 0.82) return skin;
    if (o.top === 'tracksuit' && Math.abs(th - Math.PI / 2) < 0.2) return trim;
    return torsoTop;
  };
  const shoulderCol: ColorFn = (th) => {
    const side = Math.abs(Math.cos(th));
    if (isTank && side > 0.5) return skin;
    if (o.top === 'tracksuit' && Math.abs(th - Math.PI / 2) < 0.2) return trim;
    return torsoTop;
  };
  const midCol: ColorFn = (th) => {
    if (o.top === 'tracksuit' && Math.abs(th - Math.PI / 2) < 0.2) return trim;
    return torsoTop;
  };
  const hemCol: ColorFn = () => (o.top === 'tank' || o.top === 'tshirt' ? trim : torsoTop);
  // a few blotches on the front of the top (vertex colours: free)
  let stainSeed = 0;
  const stained = (fn: ColorFn): ColorFn => {
    if (!stain || bare) return fn;
    const seed = ++stainSeed;
    return (th, end) => {
      const c = fn(th, end);
      if (c !== torsoTop || Math.sin(th) < 0.15) return c;
      const s = Math.round((th / (Math.PI * 2)) * SEG);
      const n = hashNoise(seed * 17.3 + s * 3.7 + end * 1.9);
      return n > 0.78 ? c.clone().lerp(stain, 0.4 + 0.3 * hashNoise(s * 5.1 + seed)) : c;
    };
  };

  // torso rings, bottom to top (also used to lay the chain on the chest)
  const torso: Ring[] = [
    { y: 0.84, rx: 0.12 * wb * F.hip, rz: 0.1 * wb, w: [['hips', 1]], col: pants },
    { y: 0.93, rx: 0.165 * wb * F.hip, rz: 0.115 * wb, w: [['hips', 1]], col: pants },
    { y: 1.0, rx: 0.172 * wb * F.hip + 0.01 * belly, rz: 0.118 * wb + 0.022 * belly, cz: 0.016 * belly, w: [['hips', 1]], col: belt },
    {
      y: 1.045,
      rx: 0.168 * wb * lerp(F.hip, F.waist, 0.5) + 0.018 * belly,
      rz: 0.115 * wb + 0.055 * belly,
      cz: 0.045 * belly,
      w: [['hips', 0.6], ['spine', 0.4]],
      col: stained(hemCol),
    },
    { y: 1.07, rx: 0.165 * wb * F.waist + 0.022 * belly, rz: 0.113 * wb + 0.07 * belly, cz: 0.058 * belly, w: [['hips', 0.4], ['spine', 0.6]], col: stained(midCol) },
    { y: 1.16, rx: 0.16 * wb * F.waist + 0.025 * belly, rz: 0.112 * wb + 0.078 * belly, cz: 0.005 + 0.066 * belly, w: [['spine', 1]], col: stained(midCol) },
    {
      y: 1.27,
      rx: 0.185 * wb * lerp(F.waist, F.chest, 0.5) + 0.012 * belly,
      rz: 0.125 * wb * lerp(1, F.chestZ, 0.5) + 0.04 * belly,
      cz: 0.01 + 0.032 * belly,
      w: [['spine', 0.5], ['chest', 0.5]],
      col: stained(midCol),
    },
    { y: 1.37, rx: 0.205 * wb * F.chest, rz: 0.135 * wb * F.chestZ, cz: 0.015, w: [['chest', 1]], col: stained(upperChestCol) },
    { y: 1.46, rx: 0.2 * wb * F.chest, rz: 0.115 * wb * F.chestZ, cz: 0.0, w: [['chest', 1]], col: shoulderCol },
    { y: 1.52, rx: 0.08 * F.neck, rz: 0.07 * F.neck, cz: 0.0, w: [['chest', 0.6], ['neck', 0.4]], col: skin },
  ];
  g.tube(torso, SEG, true, false);

  // neck
  const nk = Math.sqrt(wb) * F.neck;
  g.tube(
    [
      { y: 1.49, rx: 0.062 * nk, rz: 0.06 * nk, cz: 0.005, w: [['chest', 0.3], ['neck', 0.7]], col: skin },
      { y: 1.62, rx: 0.056 * nk, rz: 0.056 * nk, cz: 0.012, w: [['neck', 0.4], ['head', 0.6]], col: skin },
    ],
    8,
    false,
    false,
  );

  // arms
  const aw = wb * F.arm;
  for (const s of [1, -1] as const) {
    const L = s === 1 ? 'L' : 'R';
    const ua = `upperArm${L}` as BoneName;
    const fa = `foreArm${L}` as BoneName;
    const hand = `hand${L}` as BoneName;
    const x = s * shoulderX;
    const armTop = sleeves || o.top === 'tshirt' ? top : skin;
    const stripe = (base: THREE.Color): ColorFn => (th) => {
      // outer side stripe for tracksuits
      if (o.top === 'tracksuit' && Math.abs(Math.cos(th) - s) < 0.25) return trim;
      return base;
    };
    const lowerCol = sleeves ? top : skin;
    g.tube(
      [
        { y: 1.52, rx: 0.05 * aw, rz: 0.055 * aw, cx: x, w: [[ua, 1]], col: stripe(armTop) },
        { y: 1.46, rx: 0.072 * aw, rz: 0.078 * aw, cx: x, w: [[ua, 1]], col: stripe(armTop) },
        { y: 1.32, rx: 0.064 * aw, rz: 0.07 * aw, cx: x, w: [[ua, 1]], col: stripe(o.top === 'tshirt' ? skin : armTop) },
        { y: 1.18, rx: 0.05 * aw, rz: 0.054 * aw, cx: x, w: [[ua, 0.5], [fa, 0.5]], col: stripe(lowerCol) },
        { y: 1.09, rx: 0.053 * aw, rz: 0.057 * aw, cx: x, cz: 0.004, w: [[fa, 1]], col: stripe(lowerCol) },
        { y: 0.98, rx: 0.04 * aw, rz: 0.036 * aw, cx: x, w: [[fa, 1]], col: sleeves ? trim : wrist ?? skin },
        { y: 0.95, rx: 0.038 * aw, rz: 0.034 * aw, cx: x, w: [[fa, 0.6], [hand, 0.4]], col: skin },
      ],
      8,
      true,
      true,
    );
    // fist
    g.box(
      new THREE.Vector3(x, 0.885, 0.012),
      new THREE.Vector3(0.07 * wb * F.fist, 0.09 * lerp(1, F.fist, 0.5), 0.084 * Math.sqrt(wb) * F.fist),
      [[hand, 1]],
      (n) => (n.z > 0.5 ? skinDark : skin),
    );

    // legs (baggy trousers get wider toward the ankles)
    const th = `thigh${L}` as BoneName;
    const sh = `shin${L}` as BoneName;
    const ft = `foot${L}` as BoneName;
    const lx = s * hipX;
    const leg: ColorFn = (t) => (Math.abs(Math.cos(t) - s) < 0.3 && o.top === 'tracksuit' ? trim : pants);
    const bw = (k: number) => wb * (1 + k * baggy);
    g.tube(
      [
        { y: 1.0, rx: 0.088 * wb, rz: 0.098 * wb, cx: lx, w: [['hips', 1]], col: leg },
        { y: 0.92, rx: 0.096 * bw(0.06), rz: 0.102 * bw(0.06), cx: lx, w: [['hips', 0.3], [th, 0.7]], col: leg },
        { y: 0.72, rx: 0.086 * bw(0.16) * F.thigh, rz: 0.09 * bw(0.16) * F.thigh, cx: lx, w: [[th, 1]], col: leg },
        { y: 0.51, rx: 0.072 * bw(0.26) * lerp(F.thigh, F.shin, 0.5), rz: 0.076 * bw(0.26) * lerp(F.thigh, F.shin, 0.5), cx: lx, cz: 0.006, w: [[th, 0.5], [sh, 0.5]], col: leg },
        { y: 0.3, rx: 0.074 * bw(0.34) * F.shin, rz: 0.076 * bw(0.34) * F.shin, cx: lx, w: [[sh, 1]], col: leg },
        { y: 0.12, rx: 0.084 * bw(0.36) * F.shin, rz: 0.084 * bw(0.4) * F.shin, cx: lx, cz: 0.012 * baggy, w: [[sh, 1]], col: pantsDark },
        { y: 0.08, rx: 0.07 * bw(0.4) * F.shin, rz: 0.07 * bw(0.5) * F.shin, cx: lx, cz: 0.016 * baggy, w: [[sh, 0.5], [ft, 0.5]], col: pantsDark },
      ],
      8,
      false,
      true,
    );
    // sneaker: upper + sole
    const fw = Math.sqrt(wb) * F.foot;
    g.box(new THREE.Vector3(lx, 0.075, 0.055), new THREE.Vector3(0.11 * fw, 0.09, 0.27), [[ft, 1]], (n) => (n.y > 0.5 ? shoes.clone().multiplyScalar(1.1) : shoes), 0.85);
    g.box(new THREE.Vector3(lx, 0.016, 0.055), new THREE.Vector3(0.118 * fw, 0.032, 0.285), [[ft, 1]], sole);
  }

  // ---------------- head ----------------
  const headCY = 1.58 + 0.12 * hs;
  const R = new THREE.Vector3(0.1 * hs, 0.125 * hs, 0.112 * hs);
  const headGeo = new THREE.SphereGeometry(1, 12, 10);
  {
    const pos = headGeo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // jaw taper + flatter face
      const below = Math.max(0, -v.y);
      v.x *= 1 - 0.22 * below * below;
      v.z *= 1 - 0.08 * below * below;
      if (v.z > 0) v.z *= 0.86;
      v.set(v.x * R.x, v.y * R.y, v.z * R.z + 0.012);
      v.y += headCY;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    headGeo.computeVertexNormals();
  }
  const hb = new GeoBuilder();
  hb.addGeometry(headGeo, [['head', 1]], new THREE.Color(1, 1, 1));
  headGeo.dispose();

  // ears (skin)
  for (const s of [1, -1]) {
    g.box(new THREE.Vector3(s * R.x * 0.97, headCY - 0.005, -0.01), new THREE.Vector3(0.03, 0.055 * hs, 0.035), [['head', 1]], skinDark);
  }

  addHair(g, def, headCY, R);
  if (def.accessories?.chain) addChain(g, torso, wb, !!def.accessories.whistle);

  // ---------------- meshes ----------------
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(bones.hips);

  const bodyMat = createPS1Material({ vertexColors: true });
  const faceRect = new THREE.Vector4(0, headCY + 0.004 * hs, 0.094 * hs, 0.128 * hs);
  const faceMat = createFaceMaterial(face.texture, skin, faceRect);

  const bodyGeo = g.build();
  const headGeom = hb.build();
  const bodyMesh = new THREE.SkinnedMesh(bodyGeo, bodyMat);
  const headMesh = new THREE.SkinnedMesh(headGeom, faceMat);
  bodyMesh.frustumCulled = false;
  headMesh.frustumCulled = false;
  body.add(bodyMesh, headMesh);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONE_NAMES.map((n) => bones[n]));
  bodyMesh.bind(skeleton);
  headMesh.bind(skeleton);

  const scale = def.height ?? 1;
  body.scale.setScalar(scale);

  return {
    root,
    body,
    bones,
    bindPos,
    materials: [bodyMat, faceMat],
    skeleton,
    headY: headCY * scale,
    dispose() {
      bodyGeo.dispose();
      headGeom.dispose();
      bodyMat.dispose();
      faceMat.dispose();
      skeleton.dispose();
    },
  };
}

/** Triangle count of a model (both meshes), for budgets / dev tools. */
export function countTriangles(m: CharacterModel): number {
  let n = 0;
  m.body.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) n += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.getAttribute('position').count) / 3;
  });
  return n;
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const WHITE = new THREE.Color(1, 1, 1);

/** Hair & headwear: everything rigidly skinned to the head bone, kept above the hairline / behind the ears. */
function addHair(g: GeoBuilder, def: FighterDef, cy: number, R: THREE.Vector3) {
  const style: HairStyle = def.hair.style;
  if (style === 'bald') return;
  const col = new THREE.Color(def.hair.color);
  const w: Weights = [['head', 1]];
  const k = R.x / 0.1; // = head scale
  const varyOf = (c: THREE.Color, amt = 0.3) => (p: THREE.Vector3, i: number) => c.clone().multiplyScalar(0.82 + amt * hashNoise(i + p.x * 10));
  const vary = varyOf(col);
  const headwear = def.accessories?.cap ? new THREE.Color(def.accessories.cap) : null;
  const tieCol = new THREE.Color(def.outfit.topColor);

  /** maps a point of the (tilted) unit sphere onto the skull, `scale` x the head radii */
  const onSkull = (v: THREE.Vector3, scale: number) => {
    if (v.z > 0) v.z *= 0.9;
    return v.set(v.x * R.x * scale, v.y * R.y * scale + cy, v.z * R.z * scale + 0.012);
  };
  /** skull point in a direction given before tilt (unit sphere), after rotating by `tilt` around X */
  const skullPoint = (dir: THREE.Vector3, scale: number, tilt = 0) => onSkull(dir.clone().normalize().applyAxisAngle(AXIS_X, tilt), scale);
  const add = (geo: THREE.BufferGeometry, color: THREE.Color | ((p: THREE.Vector3, i: number) => THREE.Color)) => {
    g.addGeometry(geo, w, color);
    geo.dispose();
  };

  /** spherical cap covering the top of the skull (front edge = hairline) */
  const dome = (scale: number, tilt: number, thetaLen: number, color: (p: THREE.Vector3, i: number) => THREE.Color = vary) => {
    const geo = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, thetaLen);
    geo.rotateX(tilt);
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      onSkull(v.fromBufferAttribute(pos, i), scale);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    add(geo, color);
  };

  switch (style) {
    case 'buzz':
      dome(1.03, -0.5, 1.3);
      break;
    case 'short':
      dome(1.07, -0.48, 1.38);
      break;
    case 'spiky': {
      dome(1.06, -0.45, 1.36);
      const spikes = 22;
      for (let i = 0; i < spikes; i++) {
        // golden-angle distribution over the top / back of the skull
        const a = i * 2.39996;
        const r = Math.sqrt((i + 0.5) / spikes) * 0.95;
        const dir = new THREE.Vector3(Math.cos(a) * r, 1.0, Math.sin(a) * r * 0.9 - 0.2).normalize();
        const len = 0.07 + 0.05 * hashNoise(i * 3.1);
        const cone = new THREE.ConeGeometry(0.03 + 0.012 * hashNoise(i), len, 4);
        cone.translate(0, len / 2, 0);
        // spikes lean up and slightly back
        const tip = dir.clone().add(new THREE.Vector3(0, 0.5, -0.25)).normalize();
        cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip));
        const base = new THREE.Vector3(dir.x * R.x * 0.98, dir.y * R.y * 0.98 + cy, dir.z * R.z * 0.98 + 0.012);
        cone.translate(base.x, base.y, base.z);
        add(cone, vary);
      }
      break;
    }
    case 'afro': {
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const pos = geo.getAttribute('position');
      const v = new THREE.Vector3();
      const hairline = cy + R.y * 0.6;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        let y = v.y * R.y * 1.15 + cy + R.y * 0.4;
        // keep the face clear: the front-lower part is lifted up to the hairline
        const front = clamp01(v.z * 1.8 - 0.25);
        if (y < hairline) y = lerp(y, hairline, front);
        pos.setXYZ(i, v.x * R.x * 1.45, y, v.z * R.z * 1.3 - 0.04);
      }
      geo.computeVertexNormals();
      add(geo, vary);
      break;
    }
    case 'long': {
      dome(1.07, -0.45, 1.4);
      g.box(new THREE.Vector3(0, cy - R.y * 0.5, -R.z * 0.7), new THREE.Vector3(R.x * 2.1, R.y * 2.2, 0.06), w, col);
      break;
    }
    case 'mohawk': {
      dome(1.02, -0.5, 1.25);
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const ang = -0.9 + t * 2.2; // from front to back over the top
        const dir = new THREE.Vector3(0, Math.cos(ang), Math.sin(-ang) * 0.9 + 0.15).normalize();
        const cone = new THREE.ConeGeometry(0.035, 0.16, 4);
        cone.translate(0, 0.08, 0);
        cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        cone.translate(dir.x * R.x * 0.9, dir.y * R.y * 0.9 + cy, dir.z * R.z * 0.9);
        add(cone, vary);
      }
      break;
    }
    case 'ponytail': {
      dome(1.07, -0.46, 1.4);
      // scrunchie at the back of the crown, tail curving back then down the nape
      const anchor = skullPoint(new THREE.Vector3(0, 0.5, -0.87), 1.04);
      const tie = new THREE.CylinderGeometry(0.034 * k, 0.034 * k, 0.026 * k, 6);
      tie.rotateX(Math.PI / 2 - 0.5);
      tie.translate(anchor.x, anchor.y, anchor.z - 0.008 * k);
      add(tie, varyOf(tieCol, 0.15));
      const L = 0.22 * k;
      const tail = new THREE.CylinderGeometry(1, 1, 1, 6, 4);
      const pos = tail.getAttribute('position');
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const t = 0.5 - v.y; // 0 at the tie, 1 at the tip
        const r = k * (0.03 * (1 - t) + 0.01 * t + 0.012 * Math.sin(Math.PI * t));
        const back = 0.075 * k * (1 - (1 - t) * (1 - t));
        pos.setXYZ(i, anchor.x + v.x * r, anchor.y - L * Math.pow(t, 1.2), anchor.z - 0.02 * k - back + v.z * r);
      }
      tail.computeVertexNormals();
      add(tail, vary);
      break;
    }
    case 'bun': {
      dome(1.07, -0.46, 1.4);
      const dir = new THREE.Vector3(0, 0.8, -0.6).normalize();
      const base = skullPoint(dir, 1.05);
      const tie = new THREE.CylinderGeometry(0.046 * k, 0.05 * k, 0.022 * k, 8);
      tie.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      tie.translate(base.x, base.y, base.z);
      add(tie, varyOf(tieCol, 0.15));
      const bun = new THREE.IcosahedronGeometry(1, 1);
      bun.scale(0.075 * k, 0.066 * k, 0.075 * k);
      bun.translate(base.x + dir.x * 0.05 * k, base.y + dir.y * 0.05 * k, base.z + dir.z * 0.05 * k);
      add(bun, vary);
      break;
    }
    case 'cap': {
      // backwards baseball cap; with a separate cap colour, the hair shows at the sides and back
      const capCol = headwear ?? col;
      if (headwear) dome(1.05, -0.5, 1.46);
      const tilt = -0.3;
      const tl = 1.24;
      const sc = 1.12;
      // six panels, alternately shaded
      dome(sc, tilt, tl, (p, i) => {
        const a = Math.atan2(p.x, p.z - 0.012) + Math.PI;
        const panel = Math.floor((a / (Math.PI * 2)) * 6 + 0.5) % 2;
        return capCol.clone().multiplyScalar((panel ? 0.9 : 1.02) + 0.06 * hashNoise(i));
      });
      // button on top
      const apex = skullPoint(new THREE.Vector3(0, 1, 0), sc + 0.02, tilt);
      const btn = new THREE.BoxGeometry(0.022 * k, 0.012 * k, 0.022 * k);
      btn.rotateX(tilt);
      btn.translate(apex.x, apex.y, apex.z);
      add(btn, capCol.clone().multiplyScalar(0.8));
      // brim at the back, pointing backwards and slightly down
      const backEdge = skullPoint(new THREE.Vector3(0, Math.cos(tl), -Math.sin(tl)), sc, tilt);
      const brim = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false, Math.PI / 2, Math.PI);
      brim.scale(R.x * 0.95, 0.014 * k, 0.11 * k);
      brim.rotateX(-0.32);
      brim.translate(0, backEdge.y + 0.004 * k, backEdge.z + 0.018 * k);
      add(brim, (p) => (p.y > backEdge.y + 0.004 * k ? capCol.clone().multiplyScalar(0.92) : capCol.clone().multiplyScalar(0.62)));
      break;
    }
    case 'bandana': {
      // GTA-style bandana: tight cloth over the skull, rolled edge, knot + two tails at the back
      const band = headwear ?? col;
      if (headwear) dome(1.04, -0.52, 1.5);
      const tilt = -0.4;
      const tl = 1.4;
      const sc = 1.09;
      const pattern = (p: THREE.Vector3, i: number) =>
        hashNoise(i * 7.13 + 1.7) > 0.8 ? band.clone().lerp(WHITE, 0.42) : band.clone().multiplyScalar(0.86 + 0.18 * hashNoise(i + p.y * 30));
      dome(sc, tilt, tl, pattern);
      // rolled edge following the rim of the cloth
      const rim = new THREE.TorusGeometry(Math.sin(tl), 0.06, 3, 14);
      rim.rotateX(Math.PI / 2);
      rim.translate(0, Math.cos(tl), 0);
      rim.rotateX(tilt);
      {
        const pos = rim.getAttribute('position');
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          onSkull(v.fromBufferAttribute(pos, i), sc);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        rim.computeVertexNormals();
      }
      add(rim, band.clone().multiplyScalar(0.8));
      // knot
      const knotPos = skullPoint(new THREE.Vector3(0, Math.cos(tl), -Math.sin(tl)), sc + 0.06, tilt);
      const knot = new THREE.IcosahedronGeometry(0.03 * k, 0);
      knot.scale(1.25, 1, 0.9);
      knot.translate(knotPos.x, knotPos.y + 0.008 * k, knotPos.z - 0.006 * k);
      add(knot, band.clone().multiplyScalar(0.9));
      // tails
      for (const s of [1, -1]) {
        const tl2 = new THREE.BoxGeometry(0.034 * k, 0.1 * k, 0.008 * k);
        tl2.translate(0, -0.05 * k, 0);
        tl2.rotateZ(s * 0.38);
        tl2.rotateX(0.28);
        tl2.translate(knotPos.x + s * 0.008 * k, knotPos.y, knotPos.z - 0.01 * k);
        add(tl2, (_p, i) => band.clone().multiplyScalar(i % 4 < 2 ? 0.95 : 0.78));
      }
      break;
    }
  }
}

/** Torso cross-section (rx, rz, cz) at height y, interpolated between rings sorted by y. */
function torsoAt(rings: Ring[], y: number): { rx: number; rz: number; cz: number } {
  let i = 0;
  while (i < rings.length - 2 && rings[i + 1].y < y) i++;
  const a = rings[i];
  const b = rings[i + 1];
  const t = clamp01((y - a.y) / (b.y - a.y));
  return { rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t), cz: lerp(a.cz ?? 0, b.cz ?? 0, t) };
}

/** Gold chain lying around the neck base and down the chest, with a medallion or a whistle. Skinned to the chest. */
function addChain(g: GeoBuilder, torso: Ring[], wb: number, whistle: boolean) {
  const gold = new THREE.Color('#e8c040');
  const w: Weights = [['chest', 1]];
  const inside = (p: THREE.Vector3) => {
    const s = torsoAt(torso, p.y);
    return (p.x / s.rx) ** 2 + ((p.z - s.cz) / s.rz) ** 2 < 1;
  };
  const yBack = 1.505;
  const yFront = 1.385;
  const back = torsoAt(torso, yBack);
  const front = torsoAt(torso, yFront);
  const B = new THREE.Vector3(0, yBack, back.cz - back.rz - 0.012);
  const Fp = new THREE.Vector3(0, yFront, front.cz + front.rz + 0.013);
  const M = B.clone().add(Fp).multiplyScalar(0.5);
  const U = Fp.clone().sub(B).multiplyScalar(0.5);
  const halfW = 0.088 * Math.sqrt(wb);
  const pts: THREE.Vector3[] = [];
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const p = M.clone().addScaledVector(U, Math.cos(a)).add(new THREE.Vector3(Math.sin(a) * halfW, 0, 0));
    // rest on the shoulders: lift points that sink into the torso
    if (inside(p)) {
      let lo = p.y;
      let hi = 1.6;
      for (let it = 0; it < 14; it++) {
        const mid = (lo + hi) / 2;
        if (inside(new THREE.Vector3(p.x, mid, p.z))) lo = mid;
        else hi = mid;
      }
      p.y = hi + 0.01;
    }
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const radial = 3;
  const tube = new THREE.TubeGeometry(curve, 26, 0.0075, radial, true);
  // alternate bright / dark rings: reads as links
  g.addGeometry(tube, w, (_p, i) => gold.clone().multiplyScalar(Math.floor(i / (radial + 1)) % 2 ? 0.72 : 1.05));
  tube.dispose();

  const hang = Fp.clone().add(new THREE.Vector3(0, -0.026, 0.004));
  if (whistle) {
    const metal = new THREE.Color('#c8ccd4');
    const body = new THREE.BoxGeometry(0.044, 0.024, 0.026);
    body.translate(hang.x - 0.004, hang.y - 0.006, hang.z + 0.006);
    g.addGeometry(body, w, (_p, i) => metal.clone().multiplyScalar(i < 8 ? 1.1 : 0.85));
    body.dispose();
    const mouth = new THREE.BoxGeometry(0.024, 0.012, 0.016);
    mouth.translate(hang.x + 0.028, hang.y - 0.001, hang.z + 0.006);
    g.addGeometry(mouth, w, metal.clone().multiplyScalar(0.75));
    mouth.dispose();
  } else {
    const medal = new THREE.CylinderGeometry(0.022, 0.022, 0.008, 8);
    medal.rotateX(Math.PI / 2);
    medal.translate(hang.x, hang.y, hang.z);
    g.addGeometry(medal, w, (p) => (p.z > hang.z + 0.002 ? gold.clone().multiplyScalar(1.15) : gold.clone().multiplyScalar(0.7)));
    medal.dispose();
  }
}
