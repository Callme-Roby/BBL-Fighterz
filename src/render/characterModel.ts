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

export function buildCharacter(def: FighterDef, face: FaceAssets): CharacterModel {
  const build = def.build ?? 1;
  const hs = def.headScale ?? 1.15;
  const o = def.outfit;
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
  const hairCol = C(def.hair.color);
  const wrist = o.wristColor ? C(o.wristColor) : null;

  const shoulderX = 0.235 * Math.sqrt(build);
  const hipX = 0.1 * Math.sqrt(build);
  const wb = build; // width factor for radii

  // ---------------- skeleton ----------------
  const bindPos: Record<BoneName, THREE.Vector3> = {
    hips: new THREE.Vector3(0, 0.98, 0),
    spine: new THREE.Vector3(0, 1.1, 0),
    chest: new THREE.Vector3(0, 1.27, 0),
    neck: new THREE.Vector3(0, 1.5, 0),
    head: new THREE.Vector3(0, 1.58, 0),
    shoulderL: new THREE.Vector3(0.07, 1.45, 0),
    upperArmL: new THREE.Vector3(shoulderX, 1.46, 0),
    foreArmL: new THREE.Vector3(shoulderX, 1.18, 0),
    handL: new THREE.Vector3(shoulderX, 0.94, 0),
    shoulderR: new THREE.Vector3(-0.07, 1.45, 0),
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

  g.tube(
    [
      { y: 0.84, rx: 0.12 * wb, rz: 0.1 * wb, w: [['hips', 1]], col: pants },
      { y: 0.93, rx: 0.165 * wb, rz: 0.115 * wb, w: [['hips', 1]], col: pants },
      { y: 1.0, rx: 0.172 * wb, rz: 0.118 * wb, w: [['hips', 1]], col: belt },
      { y: 1.045, rx: 0.168 * wb, rz: 0.115 * wb, w: [['hips', 0.6], ['spine', 0.4]], col: hemCol },
      { y: 1.07, rx: 0.165 * wb, rz: 0.113 * wb, w: [['hips', 0.4], ['spine', 0.6]], col: midCol },
      { y: 1.16, rx: 0.16 * wb, rz: 0.112 * wb, cz: 0.005, w: [['spine', 1]], col: midCol },
      { y: 1.27, rx: 0.185 * wb, rz: 0.125 * wb, cz: 0.01, w: [['spine', 0.5], ['chest', 0.5]], col: midCol },
      { y: 1.37, rx: 0.205 * wb, rz: 0.135 * wb, cz: 0.015, w: [['chest', 1]], col: upperChestCol },
      { y: 1.46, rx: 0.2 * wb, rz: 0.115 * wb, cz: 0.0, w: [['chest', 1]], col: shoulderCol },
      { y: 1.52, rx: 0.08, rz: 0.07, cz: 0.0, w: [['chest', 0.6], ['neck', 0.4]], col: skin },
    ],
    SEG,
    true,
    false,
  );
  // pecs / abs hint for shirtless & tank (darker line) — cheap: skip, PS1 relied on textures

  // neck
  g.tube(
    [
      { y: 1.49, rx: 0.062 * Math.sqrt(wb), rz: 0.06 * Math.sqrt(wb), cz: 0.005, w: [['chest', 0.3], ['neck', 0.7]], col: skin },
      { y: 1.62, rx: 0.056 * Math.sqrt(wb), rz: 0.056 * Math.sqrt(wb), cz: 0.012, w: [['neck', 0.4], ['head', 0.6]], col: skin },
    ],
    8,
    false,
    false,
  );

  // arms
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
        { y: 1.52, rx: 0.05 * wb, rz: 0.055 * wb, cx: x, w: [[ua, 1]], col: stripe(armTop) },
        { y: 1.46, rx: 0.072 * wb, rz: 0.078 * wb, cx: x, w: [[ua, 1]], col: stripe(armTop) },
        { y: 1.32, rx: 0.064 * wb, rz: 0.07 * wb, cx: x, w: [[ua, 1]], col: stripe(o.top === 'tshirt' ? skin : armTop) },
        { y: 1.18, rx: 0.05 * wb, rz: 0.054 * wb, cx: x, w: [[ua, 0.5], [fa, 0.5]], col: stripe(lowerCol) },
        { y: 1.09, rx: 0.053 * wb, rz: 0.057 * wb, cx: x, cz: 0.004, w: [[fa, 1]], col: stripe(lowerCol) },
        { y: 0.98, rx: 0.04 * wb, rz: 0.036 * wb, cx: x, w: [[fa, 1]], col: sleeves ? trim : wrist ?? skin },
        { y: 0.95, rx: 0.038 * wb, rz: 0.034 * wb, cx: x, w: [[fa, 0.6], [hand, 0.4]], col: skin },
      ],
      8,
      true,
      true,
    );
    // fist
    g.box(
      new THREE.Vector3(x, 0.885, 0.012),
      new THREE.Vector3(0.07 * wb, 0.09, 0.084 * Math.sqrt(wb)),
      [[hand, 1]],
      (n) => (n.z > 0.5 ? skinDark : skin),
    );

    // legs
    const th = `thigh${L}` as BoneName;
    const sh = `shin${L}` as BoneName;
    const ft = `foot${L}` as BoneName;
    const lx = s * hipX;
    const leg: ColorFn = (t) => (Math.abs(Math.cos(t) - s) < 0.3 && o.top === 'tracksuit' ? trim : pants);
    g.tube(
      [
        { y: 1.0, rx: 0.088 * wb, rz: 0.098 * wb, cx: lx, w: [['hips', 1]], col: leg },
        { y: 0.92, rx: 0.096 * wb, rz: 0.102 * wb, cx: lx, w: [['hips', 0.3], [th, 0.7]], col: leg },
        { y: 0.72, rx: 0.086 * wb, rz: 0.09 * wb, cx: lx, w: [[th, 1]], col: leg },
        { y: 0.51, rx: 0.072 * wb, rz: 0.076 * wb, cx: lx, cz: 0.006, w: [[th, 0.5], [sh, 0.5]], col: leg },
        { y: 0.3, rx: 0.074 * wb, rz: 0.076 * wb, cx: lx, w: [[sh, 1]], col: leg },
        { y: 0.12, rx: 0.084 * wb, rz: 0.084 * wb, cx: lx, w: [[sh, 1]], col: pantsDark },
        { y: 0.08, rx: 0.07 * wb, rz: 0.07 * wb, cx: lx, w: [[sh, 0.5], [ft, 0.5]], col: pantsDark },
      ],
      8,
      false,
      true,
    );
    // sneaker: upper + sole
    g.box(new THREE.Vector3(lx, 0.075, 0.055), new THREE.Vector3(0.11 * Math.sqrt(wb), 0.09, 0.27), [[ft, 1]], (n) => (n.y > 0.5 ? shoes.clone().multiplyScalar(1.1) : shoes), 0.85);
    g.box(new THREE.Vector3(lx, 0.016, 0.055), new THREE.Vector3(0.118 * Math.sqrt(wb), 0.032, 0.285), [[ft, 1]], sole);
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

  addHair(g, def.hair.style, hairCol, headCY, R);

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

function addHair(g: GeoBuilder, style: HairStyle, col: THREE.Color, cy: number, R: THREE.Vector3) {
  if (style === 'bald') return;
  const w: Weights = [['head', 1]];
  const vary = (p: THREE.Vector3, i: number) => col.clone().multiplyScalar(0.82 + 0.3 * hashNoise(i + p.x * 10));

  const cap = (scale: number, tilt: number, thetaLen: number) => {
    const geo = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, thetaLen);
    geo.rotateX(tilt);
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.z > 0) v.z *= 0.9;
      pos.setXYZ(i, v.x * R.x * scale, v.y * R.y * scale + cy, v.z * R.z * scale + 0.012);
    }
    geo.computeVertexNormals();
    g.addGeometry(geo, w, vary);
    geo.dispose();
  };

  switch (style) {
    case 'buzz':
      cap(1.03, -0.5, 1.3);
      break;
    case 'short':
      cap(1.07, -0.48, 1.38);
      break;
    case 'spiky': {
      cap(1.06, -0.45, 1.36);
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
        g.addGeometry(cone, w, vary);
        cone.dispose();
      }
      break;
    }
    case 'afro': {
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const pos = geo.getAttribute('position');
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        pos.setXYZ(i, v.x * R.x * 1.45, v.y * R.y * 1.15 + cy + R.y * 0.4, v.z * R.z * 1.3 - 0.04);
      }
      geo.computeVertexNormals();
      g.addGeometry(geo, w, vary);
      geo.dispose();
      break;
    }
    case 'long': {
      cap(1.07, -0.45, 1.4);
      g.box(new THREE.Vector3(0, cy - R.y * 0.5, -R.z * 0.7), new THREE.Vector3(R.x * 2.1, R.y * 2.2, 0.06), w, col);
      break;
    }
    case 'mohawk': {
      cap(1.02, -0.5, 1.25);
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const ang = -0.9 + t * 2.2; // from front to back over the top
        const dir = new THREE.Vector3(0, Math.cos(ang), Math.sin(-ang) * 0.9 + 0.15).normalize();
        const cone = new THREE.ConeGeometry(0.035, 0.16, 4);
        cone.translate(0, 0.08, 0);
        cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        cone.translate(dir.x * R.x * 0.9, dir.y * R.y * 0.9 + cy, dir.z * R.z * 0.9);
        g.addGeometry(cone, w, vary);
        cone.dispose();
      }
      break;
    }
  }
}
