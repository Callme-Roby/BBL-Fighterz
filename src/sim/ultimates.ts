import type { Strength } from './types';

/**
 * BBL MAX cinematic combos ("ultimates").
 *
 * When the BBL MAX dash strike connects, the attacker plays a scripted
 * sequence. Everything here is plain data evaluated frame by frame by the
 * deterministic simulation (online play stays in sync); the matching
 * animations live in `src/render/ultimatePoses.ts` (clips `ult:<id>:a` for the
 * attacker and `ult:<id>:v` for the victim) and the camera follows `cams`.
 *
 * Frames are counted from 1 (first frame of the cinematic).
 */

/** [frame, value] keys, linear interpolation, clamped at both ends */
export type CurveKeys = [number, number][];

export interface UltimateHit {
  f: number;
  dmg: number;
  strength: Strength;
  /** impact height in metres; -1 = on the victim's body (follows their height) */
  y: number;
}

/**
 * Camera shots (see FightWorld):
 *  over   – over the attacker's shoulder, looking at the victim
 *  front  – from behind the victim, looking at the attacker
 *  low    – low wide angle looking up (good for launches)
 *  high   – high wide angle looking down (good for slams)
 *  side   – classic side view, a bit closer than gameplay
 *  close  – close-up on the attacker's face
 *  victim – close-up on the victim
 *  wide   – very wide establishing shot
 */
export type CamShot = 'over' | 'front' | 'low' | 'high' | 'side' | 'close' | 'victim' | 'wide';

export interface UltimateScript {
  id: string;
  /** total length in frames (≈ 120–170) */
  length: number;
  /** hits in chronological order; the LAST one is the finisher (the only one that can KO) */
  hits: UltimateHit[];
  /** attacker height above the ground */
  ay: CurveKeys;
  /** victim height above the ground */
  vy: CurveKeys;
  /** distance from attacker to victim along the attacker's facing */
  dist: CurveKeys;
  /** attacker forward travel from the starting point (metres, can be negative) */
  ax?: CurveKeys;
  /** frame at which the victim crashes on the floor (dust + sound) */
  fall: number;
  /** camera cuts: [first frame, shot] */
  cams: [number, CamShot][];
}

export function curve(keys: CurveKeys | undefined, f: number): number {
  if (!keys || keys.length === 0) return 0;
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    if (f <= f1) {
      const [f0, v0] = keys[i - 1];
      const t = (f - f0) / (f1 - f0);
      return v0 + (v1 - v0) * t;
    }
  }
  return keys[keys.length - 1][1];
}

/** Generic boxing rush: jab, cross, knee, elbow, uppercut launch, jumping hammer smash. */
const rush: UltimateScript = {
  id: 'rush',
  length: 132,
  hits: [
    { f: 8, dmg: 6, strength: 'light', y: 1.55 },
    { f: 18, dmg: 7, strength: 'medium', y: 1.6 },
    { f: 30, dmg: 8, strength: 'medium', y: 1.15 },
    { f: 44, dmg: 8, strength: 'medium', y: 1.5 },
    { f: 58, dmg: 12, strength: 'heavy', y: 1.4 },
    { f: 92, dmg: 19, strength: 'heavy', y: -1 },
  ],
  ay: [
    [66, 0],
    [75, 1.3],
    [84, 1.8],
    [92, 1.8],
    [106, 0],
  ],
  vy: [
    [58, 0],
    [69, 1.05],
    [80, 1.5],
    [92, 1.62],
    [102, 0],
  ],
  dist: [
    [58, 0.7],
    [92, 0.9],
  ],
  fall: 102,
  cams: [
    [0, 'over'],
    [26, 'front'],
    [56, 'low'],
    [92, 'high'],
  ],
};

export const ULTIMATES: Record<string, UltimateScript> = {
  rush,
};

export function getUltimate(id: string | undefined): UltimateScript {
  return (id && ULTIMATES[id]) || rush;
}

/** Total damage of a script (dash strike excluded). */
export function ultimateDamage(u: UltimateScript): number {
  return u.hits.reduce((a, h) => a + h.dmg, 0);
}
