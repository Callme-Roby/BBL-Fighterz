/**
 * Timeline of Aroa's BBL MAX « PEEK-A-BOO » (script: crew5.ts, clips: src/render/ults/crew5.ts).
 * Plain data shared by the script and the clips (no imports: safe through the module cycle
 * of '../ultimates'), so the punches, where Aroa stands and the victim's reactions can't drift
 * apart.
 *
 * Script frames (1/36 s each: cinematics play at 3/5 speed).
 */

/**
 * Where Aroa stands around the victim:
 *  front – facing the victim the normal way
 *  back  – behind the victim (turned around, she faces the victim's back)
 *  far   – beside the victim, on the side away from the gameplay camera
 *  near  – beside the victim, on the camera side
 *  air   – above the victim, diving down on them (lands in front)
 */
export type PkSide = 'front' | 'back' | 'far' | 'near' | 'air';

/** jab / cross = straights (left / right), hooks to the head, hooks to the body, uppercut, overhead hammer fists (from the air), the final uppercut */
export type PkBlow = 'jab' | 'cross' | 'hookL' | 'hookR' | 'bodyL' | 'bodyR' | 'upper' | 'hammer' | 'finish';

export interface PkHit {
  f: number;
  blow: PkBlow;
  /** part of a very fast flurry (3 frames apart): no damage, tiny freeze */
  flurry?: boolean;
}

/** Aroa is visible at `side` during [from, to); she is vanished (smoke) between two spots that don't touch. */
export interface PkSpot {
  from: number;
  to: number;
  side: PkSide;
}

/** victim's spot during the barrage (forward from Aroa's start point) */
export const PK_V0 = 1.15;
/** distance in front of / behind the victim, sideways offset beside them */
export const PK_FRONT = 0.72;
export const PK_SIDE_Z = 0.78;

/** frames of the story beats */
export const PK = {
  /** gloves on (left, right) */
  gloveL: 28,
  gloveR: 42,
  /** drops into the peek-a-boo guard */
  stance: 66,
  /** the victim swings twice, Aroa slips both */
  swing1: 104,
  swing2: 120,
  /** the barrage starts */
  start: 150,
  /** the uppercut feint (no blow) */
  feint: 244,
  /** the final uppercut, the victim crashes far away */
  finish: 836,
  fall: 900,
  length: 960,
} as const;

/** Every spot, in order (no overlap). */
export const PK_SPOTS: PkSpot[] = [
  { from: 0, to: 300, side: 'front' },
  { from: 312, to: 392, side: 'back' },
  { from: 402, to: 466, side: 'far' },
  { from: 476, to: 512, side: 'air' },
  { from: 512, to: 600, side: 'front' },
  // the blitz: vanishes and pops up all around
  { from: 606, to: 630, side: 'near' },
  { from: 636, to: 660, side: 'back' },
  { from: 666, to: 690, side: 'far' },
  { from: 696, to: 722, side: 'air' },
  { from: 722, to: PK.length + 1, side: 'front' },
];

/** height of the air spots: [frame, height] (lands at the end of the spot) */
export const PK_AIR: [number, number][][] = [
  [
    [476, 1.75],
    [484, 1.15],
    [488, 1.0],
    [496, 0.95],
    [504, 0.88],
    [512, 0],
  ],
  [
    [696, 1.6],
    [704, 1.0],
    [712, 0.92],
    [720, 0],
  ],
];

const H: PkHit[] = [];
const one = (f: number, blow: PkBlow) => H.push({ f, blow });
const series = (f0: number, step: number, blows: PkBlow[], flurry = false) =>
  blows.forEach((blow, i) => H.push(flurry ? { f: f0 + i * step, blow, flurry } : { f: f0 + i * step, blow }));

// --- front: Tyson combos ---
series(152, 5, ['jab', 'jab']);
one(164, 'cross');
one(172, 'bodyR');
one(178, 'bodyL');
one(186, 'hookL');
one(194, 'upper');
// dempsey roll: weaving hooks, left / right
series(204, 6, ['hookL', 'hookR', 'hookL', 'hookR', 'hookL', 'hookR']);
// (244: the uppercut feint)
one(256, 'bodyR');
series(266, 3, ['jab', 'cross', 'jab', 'cross', 'jab', 'cross', 'jab'], true);
one(292, 'cross');
// --- behind ---
series(324, 5, ['bodyL', 'bodyR', 'bodyL', 'bodyR']);
series(352, 3, ['jab', 'cross', 'jab', 'cross', 'jab', 'cross', 'jab'], true);
one(384, 'hookR');
// --- beside (far side) ---
series(410, 6, ['hookR', 'hookL', 'bodyR', 'bodyL']);
series(436, 3, ['jab', 'cross', 'jab', 'cross', 'jab', 'cross', 'jab'], true);
one(460, 'upper');
// --- from the air ---
series(488, 8, ['hammer', 'hammer', 'hammer']);
// --- front again: endless dempsey roll ---
series(524, 6, ['hookL', 'hookR', 'hookL', 'hookR', 'hookL', 'hookR', 'hookL']);
series(574, 3, ['jab', 'cross', 'jab', 'cross', 'jab', 'cross'], true);
one(594, 'cross');
// --- the blitz ---
series(612, 6, ['hookL', 'hookR', 'bodyL']);
series(642, 6, ['bodyR', 'bodyL', 'hookR']);
series(672, 6, ['hookR', 'hookL', 'bodyR']);
series(704, 8, ['hammer', 'hammer']);
series(728, 3, ['jab', 'cross', 'jab', 'cross', 'jab', 'cross', 'jab', 'cross', 'jab'], true);
one(760, 'cross');
// --- the finish ---
one(PK.finish, 'finish');

export const PK_HITS: PkHit[] = H;

/** Spot of frame f (the last spot whose start is reached). */
export function pkSpotAt(f: number): PkSpot {
  let s = PK_SPOTS[0];
  for (const sp of PK_SPOTS) if (f >= sp.from) s = sp;
  return s;
}
