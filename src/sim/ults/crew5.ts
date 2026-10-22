import { relDist, type CineCam, type CineEvent, type CurveKeys, type UltimateHit, type UltimateScript } from '../ultimates';
import { PK, PK_AIR, PK_FRONT, PK_HITS, PK_SIDE_Z, PK_SPOTS, PK_V0, type PkBlow, type PkSide } from './peekaboo';

/**
 * BBL MAX scripts of the second roster page (continued): Aroa (peek-a-boo barrage).
 * Built lazily (called from src/sim/ultimates.ts) so the helpers imported from
 * '../ultimates' are ready.
 *
 * Clips: src/render/ults/crew5.ts (same frame base: frame k of the script = frame k of the clips).
 * One script frame lasts 1/36 s (cinematics play at 3/5 speed).
 */
export function crew5Scripts(): UltimateScript[] {
  return [peekaboo()];
}

// (function declarations: hoisted, so they are usable even through the import cycle with '../ultimates')
type SfxEvent = Extract<CineEvent, { t: 'sfx' }>;
function sfx(f: number, id: SfxEvent['id'], vol?: number, pitch?: number): CineEvent {
  const e: SfxEvent = { f, t: 'sfx', id };
  if (vol !== undefined) e.vol = vol;
  if (pitch !== undefined) e.pitch = pitch;
  return e;
}
type TextEvent = Extract<CineEvent, { t: 'text' }>;
function txt(f: number, text: string, style: NonNullable<TextEvent['style']>, dur: number, color?: string): CineEvent {
  const e: TextEvent = { f, t: 'text', text, style, dur };
  if (color) e.color = color;
  return e;
}

/**
 * Scripted camera circling a point: angle in degrees around the vertical (0 = beyond the point
 * along the attacker's axis, 90 = toward the gameplay camera, 180 = back toward the attacker's start).
 */
function orbit(
  from: number,
  to: number,
  c: [x: number, z: number],
  r: [number, number],
  a: [number, number],
  y: [number, number],
  look: CineCam['look'],
): CineCam {
  const x: CurveKeys = [];
  const yy: CurveKeys = [];
  const z: CurveKeys = [];
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  for (let f = from; ; f = Math.min(to, f + 4)) {
    const t = (f - from) / (to - from);
    const ang = ((a[0] + (a[1] - a[0]) * t) * Math.PI) / 180;
    const rr = r[0] + (r[1] - r[0]) * t;
    x.push([f, r3(c[0] + Math.cos(ang) * rr)]);
    z.push([f, r3(c[1] + Math.sin(ang) * rr)]);
    yy.push([f, r3(y[0] + (y[1] - y[0]) * t)]);
    if (f >= to) break;
  }
  return { from, to, x, y: yy, z, look };
}

/** straight camera move between two points */
function track(from: number, to: number, p0: [number, number, number], p1: [number, number, number], look: CineCam['look']): CineCam {
  return { from, to, x: [[from, p0[0]], [to, p1[0]]], y: [[from, p0[1]], [to, p1[1]]], z: [[from, p0[2]], [to, p1[2]]], look };
}

// ---------------------------------------------------------------------------
// Aroa — PEEK-A-BOO
// She puts her boxing gloves on, drops into Tyson's peek-a-boo guard (high gloves, bobbing,
// weaving: the dempsey roll), slips the victim's two swings, then ~25 s of punches in every
// direction: she vanishes in a puff of smoke and pops up behind, beside, above the victim and
// chains again, faster and faster. One huge uppercut sends the victim flying across the arena.
// ---------------------------------------------------------------------------
/** Aroa's forward position / sideways offset at each spot */
const SPOT_X: Record<PkSide, number> = {
  front: PK_V0 - PK_FRONT,
  back: PK_V0 + PK_FRONT,
  far: PK_V0,
  near: PK_V0,
  air: PK_V0 - 0.45,
};
const SPOT_Z: Record<PkSide, number> = { front: 0, back: 0, far: -PK_SIDE_Z, near: PK_SIDE_Z, air: 0 };

const HEAD_BLOWS = new Set<PkBlow>(['jab', 'cross', 'hookL', 'hookR', 'upper']);

function peekaboo(): UltimateScript {
  const L = PK.length;
  const FRONT_X = SPOT_X.front;

  // --- Aroa's position: steps back for the gloves, weaves in, then spot to spot ---
  const ax: CurveKeys = [
    [2, 0],
    [8, -0.15],
    [14, -0.3],
    [96, -0.3],
    [104, -0.18],
    [114, -0.05],
    [124, 0.1],
    [134, 0.24],
    [146, FRONT_X],
  ];
  const az: CurveKeys = [[0, 0]];
  const hidden: [number, number][] = [];
  const ay: CurveKeys = [[0, 0]];
  let air = 0;
  for (let i = 0; i < PK_SPOTS.length; i++) {
    const sp = PK_SPOTS[i];
    const prev = PK_SPOTS[i - 1];
    if (i > 0 && sp.from > prev.to) {
      // vanished: she moves while nobody sees her
      hidden.push([prev.to, sp.from]);
      ax.push([prev.to, ax[ax.length - 1][1]]);
      az.push([prev.to, az[az.length - 1][1]]);
    }
    if (i === 0) continue;
    if (sp.side === 'air') {
      // appears up there, dives, lands in front of the victim
      const keys = PK_AIR[air++];
      ay.push([prev.to, 0]);
      ax.push([sp.from, SPOT_X.air]);
      ax.push([sp.to, FRONT_X]);
      for (const k of keys) ay.push(k);
      az.push([sp.from, 0]);
      continue;
    }
    if (ax[ax.length - 1][0] < sp.from) ax.push([sp.from, SPOT_X[sp.side]]);
    else ax[ax.length - 1] = [sp.from, SPOT_X[sp.side]];
    az.push([sp.from, SPOT_Z[sp.side]]);
  }
  // the finish: steps in, uppercut, follow-through hop
  const F = PK.finish;
  ax.push([800, FRONT_X], [834, FRONT_X + 0.04], [F, FRONT_X + 0.1], [F + 10, FRONT_X + 0.2]);
  ay.push([F, 0], [F + 6, 0.22], [F + 12, 0.3], [F + 20, 0]);

  // --- the victim: staggers back after the dash strike, stands there, then flies away ---
  const vx: CurveKeys = [
    [2, 0.85],
    [8, 1.02],
    [14, PK_V0],
    [F, PK_V0],
    [F + 10, PK_V0 + 0.5],
    [F + 22, PK_V0 + 1.25],
    [F + 32, PK_V0 + 1.9],
    [F + 44, PK_V0 + 2.65],
    [PK.fall, PK_V0 + 3.45],
    [PK.fall + 8, PK_V0 + 3.7],
    [PK.fall + 16, PK_V0 + 3.8],
  ];
  const vy: CurveKeys = [
    [F, 0],
    [F + 10, 1.35],
    [F + 22, 2.55],
    [F + 32, 3.05],
    [F + 40, 2.95],
    [F + 52, 1.85],
    [PK.fall, 0],
  ];

  // --- the blows (most of them do 1 damage, the flurries are pure show; the uppercut does the rest) ---
  const TOTAL = 60;
  const hits: UltimateHit[] = [];
  for (const h of PK_HITS) {
    const side = spotSide(h.f);
    const head = HEAD_BLOWS.has(h.blow);
    const hit: UltimateHit = {
      f: h.f,
      dmg: h.flurry ? 0 : 1,
      strength: h.flurry || h.blow === 'jab' || h.blow.startsWith('body') ? 'light' : h.blow === 'upper' || h.blow === 'hammer' || h.blow === 'finish' ? 'heavy' : 'medium',
      y: h.blow === 'finish' ? 1.45 : h.blow === 'hammer' ? 1.62 : head ? 1.5 : 1.0,
      stop: h.flurry ? 1 : h.blow === 'upper' || h.blow === 'hammer' ? 6 : h.blow === 'jab' || h.blow.startsWith('body') ? 2 : 3,
    };
    // impact point on the side Aroa hits from
    if (side === 'back') hit.dx = 0.16;
    else if (side === 'far' || side === 'near') hit.dx = 0;
    else if (side === 'air') hit.dx = -0.1;
    hits.push(hit);
  }
  const fin = hits[hits.length - 1];
  fin.dmg = TOTAL - hits.reduce((t, h) => t + (h === fin ? 0 : h.dmg), 0);

  // --- comic hit counters on the 10th, 25th, 50th, 75th blow ---
  const counters: CineEvent[] = [];
  for (const [n, label, color] of [
    [10, '10 COUPS', '#ffffff'],
    [25, '25 COUPS !', '#ffd23a'],
    [50, '50 COUPS !!', '#ff9a3a'],
    [75, '75 COUPS !!!', '#ff5a3a'],
  ] as const) {
    const h = hits[n - 1];
    if (h && h !== fin) counters.push(txt(h.f + 1, label, 'caption', 40, color));
  }

  const mid = (PK_V0 + FRONT_X) / 2;
  return {
    id: 'peekaboo',
    length: L,
    hits,
    ay,
    vy,
    ax,
    dist: relDist(vx, ax),
    fall: PK.fall,
    cams: [
      [0, 'two'],
      [18, 'path'],
      [62, 'path'],
      [96, 'side'],
      [124, 'vface'],
      [146, 'over'],
      [182, 'path'],
      [242, 'close'],
      [258, 'low'],
      [296, 'side'],
      [304, 'vface'],
      [312, 'path'],
      [396, 'path'],
      [470, 'path'],
      [516, 'side'],
      [546, 'path'],
      [600, 'path'],
      [722, 'front'],
      [764, 'vface'],
      [778, 'close'],
      [800, 'path'],
      [F, 'low'],
      [F + 10, 'path'],
      [PK.fall + 4, 'path'],
      [908, 'close'],
    ],
    cine: {
      props: [
        { prop: 'glove', on: 'a', bone: 'handL', from: PK.gloveL, to: L },
        { prop: 'glove', on: 'a', bone: 'handR', from: PK.gloveR, to: L },
      ],
      place: [{ who: 'a', z: az, hidden }],
      cams: [
        // gloves going on: close, in front of her
        track(18, 62, [0.75, 1.45, 2.15], [0.65, 1.4, 1.95], { at: 'a', dy: -0.3 }),
        // the peek-a-boo guard: slow push-in, slightly low, in front of her
        track(62, 96, [1.05, 1.0, 1.9], [0.8, 1.12, 1.45], { at: 'a', dy: -0.12 }),
        // the dempsey roll: slow arc around both
        orbit(182, 242, [mid, 0], [2.5, 2.3], [62, 118], [1.35, 1.25], { x: [[182, mid]], y: [[182, 1.2]], z: [[182, 0]] }),
        // she's behind: three-quarter view of her face over the victim's shoulder
        track(312, 396, [0.2, 1.5, 1.55], [0.35, 1.45, 1.4], { at: 'a', dy: -0.2 }),
        // beside the victim (far side): looking at both from the front corner
        orbit(396, 470, [PK_V0, -PK_SIDE_Z / 2], [2.4, 2.2], [126, 148], [1.45, 1.4], { x: [[396, PK_V0 - 0.15]], y: [[396, 1.25]], z: [[396, -PK_SIDE_Z / 2]] }),
        // from the air (slow motion): low, looking up at her
        track(470, 516, [PK_V0 - 2.1, 0.9, 2.7], [PK_V0 - 1.9, 0.75, 2.5], { x: [[470, PK_V0 - 0.3]], y: [[470, 1.9], [516, 1.2]], z: [[470, 0]] }),
        // endless dempsey roll: circling
        orbit(546, 600, [PK_V0 - 0.35, 0], [2.6, 2.4], [100, 150], [1.4, 1.3], { at: 'v', dy: -0.3 }),
        // the blitz: high wide shot circling the victim (she pops up everywhere)
        orbit(600, 722, [PK_V0, 0], [3.5, 3.3], [12, 150], [2.7, 2.4], { x: [[600, PK_V0]], y: [[600, 1.0]], z: [[600, 0]] }),
        // the windup: low orbit around her
        orbit(800, F, [FRONT_X + 0.3, 0], [2.5, 2.25], [116, 80], [0.7, 0.6], { at: 'a', dy: -0.4 }),
        // the victim flies across the arena
        track(F + 10, PK.fall + 4, [PK_V0 + 0.2, 1.9, 5.4], [PK_V0 + 2.6, 1.5, 5.0], { at: 'v', dy: -0.2 }),
        // crashed far away
        track(PK.fall + 4, 908, [PK_V0 + 2.0, 1.5, 3.3], [PK_V0 + 2.2, 1.4, 3.0], { x: [[PK.fall, PK_V0 + 3.4]], y: [[PK.fall, 0.4]], z: [[PK.fall, 0]] }),
      ],
      events: [
        { f: 4, t: 'say', who: 'a', text: 'Attends, attends… je mets mes gants.', rate: 1.1, dur: 54 },
        // gloves on
        sfx(24, 'whiff', 0.4, 1.3),
        sfx(28, 'block', 0.6),
        sfx(31, 'clutch', 0.6),
        sfx(38, 'whiff', 0.4, 1.3),
        sfx(42, 'block', 0.6),
        sfx(45, 'clutch', 0.6),
        sfx(52, 'block', 0.9, 0.9),
        sfx(57, 'block', 0.9, 0.9),
        txt(53, 'TOC TOC', 'boom', 18, '#ffffff'),
        { f: 58, t: 'fx', fx: 'shine', at: 'a', bone: 'handR', scale: 0.6 },
        { f: 58, t: 'say', who: 'v', text: 'T’es sérieuse, là ?', rate: 1.15, dur: 26 },
        { f: 62, t: 'fx', fx: 'question', at: 'v' },
        // the peek-a-boo guard
        sfx(66, 'whiffHeavy', 0.6, 1.2),
        txt(86, 'PEEK-A-BOO !', 'punch', 36, '#ff6fae'),
        { f: 86, t: 'say', who: 'a', text: 'Peek-a-boo !', rate: 1.05, pitch: 1.1, dur: 24 },
        sfx(80, 'step', 0.5),
        sfx(88, 'step', 0.5),
        // the victim swings twice: slipped
        sfx(102, 'whiffHeavy', 0.8),
        txt(106, 'RATÉ !', 'boom', 20, '#ffffff'),
        sfx(118, 'whiffHeavy', 0.8),
        txt(122, 'RE-RATÉ !', 'boom', 20, '#ffffff'),
        { f: 124, t: 'say', who: 'v', text: 'Mais arrête de bouger !', rate: 1.2, dur: 30 },
        { f: 126, t: 'fx', fx: 'sweat', at: 'v' },
        sfx(134, 'step', 0.5),
        { f: 140, t: 'music', id: 'rap' },
        // front: Tyson combos
        txt(153, 'BAM !', 'boom', 16, '#ffd23a'),
        txt(187, 'POW !', 'boom', 16, '#ff9a3a'),
        txt(195, 'PAF !', 'boom', 16, '#ffd23a'),
        txt(205, 'TA-TA-TA !', 'punch', 30, '#ffd23a'),
        { f: 230, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        // the uppercut feint
        sfx(240, 'whiff', 0.7, 0.8),
        txt(244, 'FEINTE !', 'boom', 20, '#7ad0ff'),
        { f: 245, t: 'fx', fx: 'exclaim', at: 'v' },
        txt(257, 'BIM !', 'boom', 14, '#ffffff'),
        txt(267, 'TA-TA-TA-TA !', 'punch', 26, '#ffd23a'),
        { f: 292, t: 'shake', amt: 0.25 },
        // vanished… behind!
        { f: 304, t: 'fx', fx: 'question', at: 'v' },
        txt(313, 'COUCOU !', 'boom', 22, '#ff6fae'),
        { f: 314, t: 'say', who: 'a', text: 'Coucou ! Derrière toi !', rate: 1.15, dur: 34 },
        txt(325, 'TA-TA-TA !', 'punch', 24, '#ffd23a'),
        txt(353, 'TA-TA-TA-TA !', 'punch', 24, '#ffd23a'),
        txt(385, 'PAF !', 'boom', 18, '#ffd23a'),
        { f: 386, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        // …beside
        txt(403, 'PAR ICI !', 'boom', 20, '#ff6fae'),
        { f: 404, t: 'say', who: 'v', text: 'Elle est où ?!', rate: 1.2, dur: 26 },
        txt(437, 'TA-TA-TA-TA !', 'punch', 24, '#ffd23a'),
        txt(461, 'UPPER !', 'boom', 16, '#ff9a3a'),
        // …from the air (slow motion)
        txt(477, 'D’EN HAUT !', 'punch', 26, '#7ad0ff'),
        txt(480, 'RALENTI…', 'caption', 30, '#7ad0ff'),
        sfx(478, 'whiffHeavy', 0.8, 0.45),
        sfx(486, 'whiffHeavy', 0.7, 0.55),
        { f: 489, t: 'shake', amt: 0.3 },
        { f: 497, t: 'shake', amt: 0.3 },
        { f: 505, t: 'shake', amt: 0.4 },
        sfx(512, 'land', 0.8),
        // front again: endless
        txt(513, 'ET ÇA CONTINUE !', 'punch', 34, '#ff6fae'),
        { f: 516, t: 'say', who: 'a', text: 'On enchaîne, on enchaîne !', rate: 1.2, dur: 32 },
        txt(575, 'TA-TA-TA-TA !', 'punch', 22, '#ffd23a'),
        // the blitz: here, there, everywhere
        txt(607, 'ICI !', 'boom', 16, '#ff6fae'),
        { f: 608, t: 'say', who: 'v', text: 'Mais t’es partout !', rate: 1.25, dur: 30 },
        { f: 610, t: 'fx', fx: 'sweat', at: 'v' },
        txt(637, 'LÀ !', 'boom', 16, '#ff6fae'),
        txt(667, 'ET LÀ !', 'boom', 16, '#ff6fae'),
        txt(697, 'COUCOU !', 'boom', 16, '#ff6fae'),
        sfx(720, 'land', 0.7),
        txt(729, 'TA-TA-TA-TA-TA-TA !', 'punch', 32, '#ffd23a'),
        { f: 760, t: 'shake', amt: 0.3 },
        // the finish
        { f: 766, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        { f: 780, t: 'say', who: 'a', text: 'Allez… au dodo.', rate: 0.95, dur: 34 },
        { f: 800, t: 'music', id: null },
        sfx(806, 'powerUp', 0.6, 0.9),
        { f: 808, t: 'fx', fx: 'veins', at: 'a', y: 1.7, dx: -0.1, scale: 0.7 },
        { f: 826, t: 'fx', fx: 'shine', at: 'a', bone: 'handR', scale: 0.9 },
        sfx(826, 'shine', 0.7),
        sfx(832, 'whiffHeavy', 1, 0.8),
        { f: F, t: 'flash', amt: 0.75 },
        { f: F, t: 'shake', amt: 1.0 },
        txt(F + 1, 'UPPERCUT !!!', 'punch', 46, '#ffd23a'),
        sfx(F + 4, 'crowdOoh', 1),
        { f: F + 12, t: 'fx', fx: 'speed', at: 'v' },
        sfx(F + 20, 'whiff', 0.6, 0.7),
        { f: PK.fall, t: 'shake', amt: 0.6 },
        sfx(PK.fall + 2, 'crash', 0.6),
        { f: PK.fall + 10, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        sfx(PK.fall + 12, 'roundBell', 0.8),
        { f: 910, t: 'say', who: 'a', text: 'Ding ding. Rentre chez toi.', rate: 1.05, dur: 44 },
        { f: 918, t: 'fx', fx: 'confetti', at: 'a', y: 2.2, scale: 1.0 },
        txt(922, 'K.O. EN PEEK-A-BOO', 'caption', 36, '#ff6fae'),
        ...counters,
      ],
    },
  };
}

/** side Aroa hits from at frame f */
function spotSide(f: number): PkSide {
  let side: PkSide = 'front';
  for (const sp of PK_SPOTS) if (f >= sp.from) side = sp.side;
  return side;
}
