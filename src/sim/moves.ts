import type { AssistKind, HitLevel, MoveId, Strength } from './types';

/**
 * Frame data (60 fps). `startup` = first active frame (counting from 1 the way
 * fighting-game frame data does: a 10-frame move hits on its 10th frame).
 */
export interface MoveDef {
  id: MoveId;
  name: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  level: HitLevel;
  /** reach from the attacker's centre to the front of the hitbox (metres) */
  reach: number;
  /** height of the impact for effects (metres) */
  hitY: number;
  hitstun: number;
  blockstun: number;
  pushHit: number;
  pushBlock: number;
  strength: Strength;
  /** knocks the opponent down on hit */
  knockdown?: boolean;
  /** vertical launch velocity on hit (juggle starter) */
  launch?: number;
  /** moves that can be chained into after this one connects */
  cancels?: MoveId[];
  /** distance travelled forward during startup */
  advance?: number;
  /** attacker is crouching during the move (ducks high attacks) */
  crouching?: boolean;
  /** jumping attack */
  air?: boolean;
  throw?: boolean;
  meterCost?: number;
  /** invulnerable during these first frames */
  invulnFrames?: number;
  /** freeze the opponent for N frames when the move starts (super flash) */
  freezeOpponent?: number;
}

const M = (m: MoveDef) => m;

export const MOVES: Record<MoveId, MoveDef> = {
  jab: M({
    id: 'jab', name: 'Jab', startup: 7, active: 3, recovery: 9, damage: 8, level: 'high',
    reach: 0.74, hitY: 1.6, hitstun: 18, blockstun: 10, pushHit: 0.035, pushBlock: 0.04,
    strength: 'light', cancels: ['cross', 'jab', 'powerPunch'],
  }),
  cross: M({
    id: 'cross', name: 'Direct', startup: 9, active: 3, recovery: 13, damage: 12, level: 'high',
    reach: 0.84, hitY: 1.6, hitstun: 21, blockstun: 12, pushHit: 0.05, pushBlock: 0.05,
    strength: 'medium', cancels: ['roundhouse', 'frontKick'], advance: 0.08,
  }),
  frontKick: M({
    id: 'frontKick', name: 'Front kick', startup: 12, active: 4, recovery: 15, damage: 15, level: 'mid',
    reach: 0.98, hitY: 1.15, hitstun: 20, blockstun: 12, pushHit: 0.07, pushBlock: 0.06,
    strength: 'medium', cancels: ['roundhouse'], advance: 0.06,
  }),
  roundhouse: M({
    id: 'roundhouse', name: 'Roundhouse', startup: 15, active: 4, recovery: 20, damage: 22, level: 'high',
    reach: 1.02, hitY: 1.65, hitstun: 22, blockstun: 14, pushHit: 0.08, pushBlock: 0.07,
    strength: 'heavy', knockdown: true, advance: 0.08,
  }),
  elbow: M({
    id: 'elbow', name: 'Coude', startup: 11, active: 3, recovery: 12, damage: 14, level: 'mid',
    reach: 0.7, hitY: 1.3, hitstun: 20, blockstun: 11, pushHit: 0.06, pushBlock: 0.05,
    strength: 'medium', cancels: ['powerPunch'], advance: 0.18,
  }),
  powerPunch: M({
    id: 'powerPunch', name: 'Grosse patate', startup: 16, active: 4, recovery: 20, damage: 24, level: 'mid',
    reach: 0.92, hitY: 1.35, hitstun: 26, blockstun: 16, pushHit: 0.16, pushBlock: 0.1,
    strength: 'heavy', knockdown: true, advance: 0.3,
  }),
  knee: M({
    id: 'knee', name: 'Genou', startup: 13, active: 4, recovery: 19, damage: 16, level: 'mid',
    reach: 0.62, hitY: 1.1, hitstun: 20, blockstun: 12, pushHit: 0.02, pushBlock: 0.05,
    strength: 'heavy', launch: 0.15, advance: 0.32,
  }),
  crouchJab: M({
    id: 'crouchJab', name: 'Jab bas', startup: 8, active: 3, recovery: 9, damage: 7, level: 'low',
    reach: 0.74, hitY: 0.55, hitstun: 16, blockstun: 9, pushHit: 0.03, pushBlock: 0.035,
    strength: 'light', crouching: true, cancels: ['crouchJab', 'lowKick', 'uppercut'],
  }),
  uppercut: M({
    id: 'uppercut', name: 'Uppercut', startup: 13, active: 4, recovery: 21, damage: 18, level: 'mid',
    reach: 0.72, hitY: 1.45, hitstun: 22, blockstun: 14, pushHit: 0.02, pushBlock: 0.05,
    strength: 'heavy', launch: 0.165, advance: 0.12,
  }),
  lowKick: M({
    id: 'lowKick', name: 'Low kick', startup: 10, active: 3, recovery: 13, damage: 10, level: 'low',
    reach: 0.92, hitY: 0.25, hitstun: 16, blockstun: 10, pushHit: 0.04, pushBlock: 0.04,
    strength: 'medium', crouching: true, cancels: ['sweep'],
  }),
  sweep: M({
    id: 'sweep', name: 'Balayette', startup: 15, active: 5, recovery: 23, damage: 16, level: 'low',
    reach: 1.05, hitY: 0.2, hitstun: 20, blockstun: 14, pushHit: 0.04, pushBlock: 0.05,
    strength: 'heavy', crouching: true, knockdown: true,
  }),
  jumpPunch: M({
    id: 'jumpPunch', name: 'Poing saute', startup: 7, active: 8, recovery: 6, damage: 12, level: 'mid',
    reach: 0.72, hitY: 1.4, hitstun: 18, blockstun: 11, pushHit: 0.05, pushBlock: 0.05,
    strength: 'medium', air: true,
  }),
  jumpKick: M({
    id: 'jumpKick', name: 'Coup de pied saute', startup: 9, active: 10, recovery: 6, damage: 16, level: 'mid',
    reach: 0.95, hitY: 1.3, hitstun: 20, blockstun: 12, pushHit: 0.07, pushBlock: 0.06,
    strength: 'heavy', air: true,
  }),
  // air: down + kick. Spikes an airborne opponent to the floor (ground bounce once per combo)
  airSmash: M({
    id: 'airSmash', name: 'Smash aérien', startup: 10, active: 5, recovery: 12, damage: 16, level: 'mid',
    reach: 0.88, hitY: 1.0, hitstun: 22, blockstun: 13, pushHit: 0.03, pushBlock: 0.06,
    strength: 'heavy', air: true,
  }),
  throw: M({
    id: 'throw', name: 'Choppe', startup: 10, active: 3, recovery: 26, damage: 30, level: 'high',
    reach: 0.68, hitY: 1.3, hitstun: 0, blockstun: 0, pushHit: 0, pushBlock: 0,
    strength: 'heavy', throw: true, advance: 0.12,
  }),
  super: M({
    id: 'super', name: 'BBL MAX', startup: 10, active: 6, recovery: 34, damage: 6, level: 'mid',
    reach: 1.05, hitY: 1.35, hitstun: 30, blockstun: 24, pushHit: 0.2, pushBlock: 0.17,
    strength: 'heavy', advance: 1.5, invulnFrames: 16,
  }),
  // ranged profile: the throw itself (the projectile carries the hit); placeholder values, tuned in the sim
  projectile: M({
    id: 'projectile', name: 'Projectile', startup: 13, active: 1, recovery: 30, damage: 12, level: 'mid',
    reach: 0, hitY: 1.3, hitstun: 18, blockstun: 14, pushHit: 0.06, pushBlock: 0.06,
    strength: 'medium',
  }),
};

export function moveTotal(m: MoveDef): number {
  return m.startup + m.active + m.recovery - 1;
}

/** What a blow needs for the hit pipeline (moves and assist attacks). */
export interface Strike {
  /** the fighter move (null for an assist's attack) */
  id: MoveId | null;
  damage: number;
  level: HitLevel;
  hitY: number;
  hitstun: number;
  blockstun: number;
  pushHit: number;
  pushBlock: number;
  strength: Strength;
  knockdown?: boolean;
  launch?: number;
  /** jumping attack */
  air?: boolean;
}

/**
 * Assist frame data. Phases: enter (poof in, untouchable) -> attack -> leave -> off.
 * `startup` / `active` count frames of the attack phase (1 = first attack frame).
 */
export interface AssistMove extends Strike {
  kind: AssistKind;
  /** frames of the 'enter' phase */
  enter: number;
  startup: number;
  active: number;
  /** length of the 'attack' phase */
  total: number;
  /** frames of the 'leave' phase */
  leave: number;
  /** horizontal reach from the assist (or its projectile) */
  reach: number;
}

const A = (m: AssistMove) => m;

export const ASSIST_MOVES: Record<AssistKind, AssistMove> = {
  // dashes in from behind the caller (RUSH_SPEED m/frame from `startup`), one heavy mid blow: knockdown + wall bounce
  rush: A({
    kind: 'rush', id: null, enter: 14, startup: 6, active: 30, total: 46, leave: 12, reach: 0.72,
    damage: 18, level: 'mid', hitY: 1.3, hitstun: 26, blockstun: 18, pushHit: 0.12, pushBlock: 0.12, strength: 'heavy', knockdown: true,
  }),
  // pops up next to the opponent: uppercut launch (the caller can super jump after it)
  launcher: A({
    kind: 'launcher', id: null, enter: 12, startup: 8, active: 5, total: 26, leave: 12, reach: 0.95,
    damage: 12, level: 'mid', hitY: 1.4, hitstun: 22, blockstun: 16, pushHit: 0.02, pushBlock: 0.06, strength: 'heavy', launch: 0.165,
  }),
  // from behind the caller: a projectile (BEAM_SPEED m/frame) spawned at `startup`, hits mid at the first contact
  beam: A({
    kind: 'beam', id: null, enter: 14, startup: 10, active: 1, total: 26, leave: 12, reach: 0.35,
    damage: 14, level: 'mid', hitY: 1.2, hitstun: 40, blockstun: 16, pushHit: 0.025, pushBlock: 0.06, strength: 'medium',
  }),
  // pops in front of the opponent: dizzy (no damage) if not guarding, pushback if guarded
  stun: A({
    kind: 'stun', id: null, enter: 14, startup: 10, active: 10, total: 32, leave: 12, reach: 1.3,
    damage: 0, level: 'mid', hitY: 1.5, hitstun: 70, blockstun: 14, pushHit: 0, pushBlock: 0.08, strength: 'light',
  }),
};

/** rush assist dash speed (m/frame) */
export const RUSH_SPEED = 0.2;
/** beam assist projectile speed (m/frame) and height (m) */
export const BEAM_SPEED = 0.12;
export const BEAM_Y = 1.2;
/** frames before an assist can be called again (from the call) */
export const ASSIST_COOLDOWN = 480;
