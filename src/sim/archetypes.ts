import { MOVES, type MoveDef } from './moves';
import { GUARD_MAX, MAX_HP, type Archetype, type MoveId, type Strength } from './types';

/**
 * Character profiles (who is what: src/data/roster.ts). Modelled on well-balanced
 * templates of existing games; `balanced` is the reference (= the original values).
 * Numbers tuned on CPU vs CPU matrices (hard and normal: every profile 46-54 % overall).
 *  heavy    Zangief / Hugo / Jack: more health, damage and guard, strong throws; slow
 *           walk, dash and jump, slower normals.
 *  fast     Chun-Li / Cammy: quick lights, fast movement, one more move per string;
 *           less health, damage and guard.
 *  ranged   Guile / Dhalsim: the projectile (forward + RP) and longer kicks / heavies;
 *           a bit less health, slower walk.
 * Pure data: the simulation reads it (deterministic, rollback-safe).
 */
export interface ArchetypeStats {
  /** health at the start of each round */
  hp: number;
  /** damage multiplier of the fighter's strikes and projectile (before combo scaling) */
  damage: number;
  /** throw damage multiplier, and extra throw reach (m) */
  throwDamage: number;
  throwReach: number;
  /** guard gauge size */
  guardMax: number;
  /** multiplier of the gauge drained by each blocked hit */
  guardDrain: number;
  /** multiplier of the gauge refill speed */
  guardRefill: number;
  /** walk speeds (m / frame) */
  walkF: number;
  walkB: number;
  /** dashes: peak speed (m / frame) and length (frames) */
  dashF: number;
  dashFFrames: number;
  dashB: number;
  dashBFrames: number;
  /** jump: take-off frames and horizontal speed (m / frame) */
  prejump: number;
  jumpVx: number;
  /** frame-data deltas of the ground normals by strength (integers, + = slower) */
  startup: Record<Strength, number>;
  recovery: Record<Strength, number>;
  /** reach multipliers: kicks / heavy normals (a move gets the bigger one that applies) */
  reachKick: number;
  reachHeavy: number;
  /** extra moves allowed in a chained string */
  extraChain: number;
}

export const ARCHETYPES: Record<Archetype, ArchetypeStats> = {
  // Ryu / Ken: the reference, exactly the original values
  balanced: {
    hp: MAX_HP, damage: 1, throwDamage: 1, throwReach: 0,
    guardMax: GUARD_MAX, guardDrain: 1, guardRefill: 1,
    walkF: 0.038, walkB: 0.03, dashF: 0.105, dashFFrames: 15, dashB: 0.1, dashBFrames: 18,
    prejump: 4, jumpVx: 0.046,
    startup: { light: 0, medium: 0, heavy: 0 }, recovery: { light: 0, medium: 0, heavy: 0 },
    reachKick: 1, reachHeavy: 1, extraChain: 0,
  },
  // Zangief / Hugo / Jack: +12.5 % health, +10 % damage, +25 % throws (longer), big guard;
  // 25 % slower walk, slower dash / jump, normals +1 / +2 / +3 frames (light / medium / heavy)
  heavy: {
    hp: 225, damage: 1.1, throwDamage: 1.25, throwReach: 0.1,
    guardMax: 140, guardDrain: 1, guardRefill: 1,
    walkF: 0.0285, walkB: 0.0225, dashF: 0.088, dashFFrames: 17, dashB: 0.085, dashBFrames: 20,
    prejump: 5, jumpVx: 0.039,
    startup: { light: 1, medium: 2, heavy: 3 }, recovery: { light: 0, medium: 1, heavy: 1 },
    reachKick: 1, reachHeavy: 1.02, extraChain: 0,
  },
  // Chun-Li / Cammy: -12.5 % health, -13 % damage, small guard; normals 1 frame faster with
  // 2 frames less recovery, +24 % walk / dash, longer jumps, one more move per string
  fast: {
    hp: 175, damage: 0.87, throwDamage: 0.87, throwReach: 0,
    guardMax: 70, guardDrain: 1, guardRefill: 1.15,
    walkF: 0.047, walkB: 0.037, dashF: 0.13, dashFFrames: 14, dashB: 0.12, dashBFrames: 16,
    prejump: 3, jumpVx: 0.056,
    startup: { light: -1, medium: -1, heavy: -1 }, recovery: { light: -2, medium: -2, heavy: -2 },
    reachKick: 1, reachHeavy: 1, extraChain: 1,
  },
  // Guile / Dhalsim: the projectile (forward + RP), longer kicks / heavies; -5 % health, 16 % slower walk
  ranged: {
    hp: 190, damage: 1, throwDamage: 1, throwReach: 0,
    guardMax: GUARD_MAX, guardDrain: 1, guardRefill: 1,
    walkF: 0.032, walkB: 0.027, dashF: 0.105, dashFFrames: 15, dashB: 0.1, dashBFrames: 18,
    prejump: 4, jumpVx: 0.046,
    startup: { light: 0, medium: 0, heavy: 0 }, recovery: { light: 0, medium: 0, heavy: 0 },
    reachKick: 1.04, reachHeavy: 1.02, extraChain: 0,
  },
};

const GROUND_NORMALS: ReadonlySet<MoveId> = new Set<MoveId>([
  'jab', 'cross', 'frontKick', 'roundhouse', 'elbow', 'powerPunch', 'knee', 'crouchJab', 'uppercut', 'lowKick', 'sweep',
]);
const KICKS: ReadonlySet<MoveId> = new Set<MoveId>(['frontKick', 'roundhouse', 'knee', 'lowKick', 'sweep', 'jumpKick', 'airSmash']);
const AIR_NORMALS: ReadonlySet<MoveId> = new Set<MoveId>(['jumpPunch', 'jumpKick', 'airSmash']);
const MIN_STARTUP = 4;
const MIN_RECOVERY = 5;

/** Frame data of a move for a profile (the BBL MAX strike is never changed). */
function adjust(p: ArchetypeStats, m: MoveDef): MoveDef {
  if (m.id === 'super') return m;
  const r: MoveDef = { ...m };
  if (m.id === 'throw') {
    r.damage = m.damage * p.throwDamage;
    r.reach = m.reach + p.throwReach;
    return r;
  }
  r.damage = m.damage * p.damage;
  if (GROUND_NORMALS.has(m.id)) {
    r.startup = Math.max(MIN_STARTUP, m.startup + p.startup[m.strength]);
    r.recovery = Math.max(MIN_RECOVERY, m.recovery + p.recovery[m.strength]);
  }
  if (GROUND_NORMALS.has(m.id) || AIR_NORMALS.has(m.id)) {
    const k = Math.max(KICKS.has(m.id) ? p.reachKick : 1, m.strength === 'heavy' ? p.reachHeavy : 1);
    r.reach = m.reach * k;
  }
  return r;
}

function buildTable(): Record<Archetype, Record<MoveId, MoveDef>> {
  const out = {} as Record<Archetype, Record<MoveId, MoveDef>>;
  for (const a of Object.keys(ARCHETYPES) as Archetype[]) {
    const t = {} as Record<MoveId, MoveDef>;
    for (const id of Object.keys(MOVES) as MoveId[]) t[id] = adjust(ARCHETYPES[a], MOVES[id]);
    out[a] = t;
  }
  return out;
}

/** profile-adjusted MOVES, per profile (built once) */
export const PROFILE_MOVES: Readonly<Record<Archetype, Readonly<Record<MoveId, MoveDef>>>> = buildTable();

/** The move as this profile performs it (frame data, reach and damage adjusted). */
export function moveFor(a: Archetype, id: MoveId): MoveDef {
  return PROFILE_MOVES[a][id];
}

export function statsOf(a: Archetype): ArchetypeStats {
  return ARCHETYPES[a];
}

/**
 * For the renderer: maps a frame of the profile's move to the matching frame of the
 * base clip (built from MOVES), so the strike pose still lands on the active frame
 * when a profile changes the startup / recovery.
 */
export function baseMoveFrame(a: Archetype, id: MoveId, frame: number): number {
  const e = PROFILE_MOVES[a][id];
  const b = MOVES[id];
  if (e.startup === b.startup && e.recovery === b.recovery) return frame;
  if (frame <= e.startup) return (frame * b.startup) / e.startup;
  const ae = e.startup + e.active - 1;
  if (frame <= ae) return b.startup + (frame - e.startup);
  return b.startup + b.active - 1 + ((frame - ae) * b.recovery) / e.recovery;
}
