import type { HitKind } from './ultimates';
/**
 * Deterministic fighting-game simulation types.
 * The simulation only uses plain data + basic arithmetic so that two browsers
 * running it with the same inputs stay in sync (needed for online rollback).
 */

// ---- input bits (absolute: as pressed on the device) ----
export const IN_UP = 1;
export const IN_DOWN = 2;
export const IN_LEFT = 4;
export const IN_RIGHT = 8;
export const IN_LP = 16;
export const IN_RP = 32;
export const IN_LK = 64;
export const IN_RK = 128;
export const IN_BUTTONS = IN_LP | IN_RP | IN_LK | IN_RK;
/** dedicated "BBL MAX" (ultimate) button */
export const IN_SUPER = 256;
/** guard button: hold to block, tap right before a hit to PARRY */
export const IN_GUARD = 512;
/** grab button (throw) */
export const IN_GRAB = 1024;
/** assist button: calls the friend chosen before the fight */
export const IN_ASSIST = 2048;
/** buttons that are forwarded to the relative input */
export const IN_EXTRA = IN_SUPER | IN_GUARD | IN_GRAB | IN_ASSIST;

// ---- relative bits (B/F depend on which side the fighter faces) ----
export const R_U = 1;
export const R_D = 2;
export const R_B = 4;
export const R_F = 8;
export const R_DIRS = R_U | R_D | R_B | R_F;

export type MoveId =
  | 'jab'
  | 'cross'
  | 'frontKick'
  | 'roundhouse'
  | 'elbow'
  | 'powerPunch'
  | 'knee'
  | 'crouchJab'
  | 'uppercut'
  | 'lowKick'
  | 'sweep'
  | 'jumpPunch'
  | 'jumpKick'
  /** air: down + kick — spikes an airborne opponent to the floor (ground bounce, once per combo) */
  | 'airSmash'
  | 'throw'
  | 'super'
  /** ranged profile only: forward + RP throws the fighter's projectile (one on screen at a time) */
  | 'projectile';

/**
 * Character profile (stats in src/sim/archetypes.ts, who is what in src/data/roster.ts):
 *  heavy    = strong but slow (Zangief / Jack): more health, damage and guard, slow moves
 *  fast     = quick but fragile (Chun-Li / Cammy): fast moves and movement, less health / damage
 *  ranged   = keeps away (Guile / Dhalsim): a projectile + long pokes
 *  balanced = all-rounder (Ryu / Ken): the reference
 */
export type Archetype = 'heavy' | 'fast' | 'ranged' | 'balanced';

export type HitLevel = 'high' | 'mid' | 'low';
export type Strength = 'light' | 'medium' | 'heavy';

export type Action =
  | 'idle'
  | 'walkF'
  | 'walkB'
  | 'crouch'
  | 'prejump'
  | 'jump'
  | 'land'
  | 'dashF'
  | 'dashB'
  | 'attack'
  | 'airAttack'
  | 'hitstun'
  | 'blockstun'
  | 'juggle'
  | 'knockdown'
  | 'getup'
  | 'throwing'
  | 'thrown'
  | 'throwBreak'
  | 'superFlash'
  | 'superCombo'
  | 'superVictim'
  | 'guard'
  | 'parry'
  | 'parried'
  /** chase jump after a launcher: rises toward the airborne opponent (air combos) */
  | 'superJump'
  /** air dash (double-tap forward in the air) */
  | 'airDash'
  /** victim splatted against the wall for a few frames, then falls back into a juggle */
  | 'wallSplat'
  /** guard gauge emptied: staggered and wide open for a moment (guard crush) */
  | 'guardCrush'
  | 'ko'
  | 'intro'
  | 'win'
  | 'lose';

export interface FighterState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  meter: number;
  action: Action;
  actionFrame: number;
  moveId: MoveId | null;
  moveHit: boolean;
  /** remaining hit/block stun frames */
  stun: number;
  /** total stun of the current reaction (for animation timing) */
  stunTotal: number;
  hitLevel: HitLevel;
  crouching: boolean;
  jumpDir: number;
  airAttackUsed: boolean;
  juggleCount: number;
  comboCount: number;
  comboDamage: number;
  invuln: number;
  /** frames the fighter is frozen (opponent's super flash) */
  frozen: number;
  koed: boolean;
  /** current relative input & previous one */
  rel: number;
  prevRel: number;
  /** input buffer */
  bufBtn: number;
  bufDir: number;
  bufQcf: boolean;
  bufAge: number;
  /** frame (sim frame) of the last forward / back tap, for dashes */
  lastFTap: number;
  lastBTap: number;
  dashReq: number; // 1 = forward dash requested, -1 = back dash
  /** recent relative directions for motion inputs (newest last) */
  dirHist: number[];
  wins: number;
  /** variant index for win / intro animations */
  variant: number;
  /** grab partner bookkeeping */
  throwTimer: number;
  counterHit: boolean;
  /** frames left to honour a BBL MAX button press */
  superReq: number;
  /** number of moves chained in the current string (cancel limit) */
  chain: number;
  /** last move of the current string and how many times in a row */
  lastMove: MoveId | null;
  repeat: number;
  /** id of this fighter's BBL MAX cinematic script (see sim/ultimates.ts) */
  ult: string;
  /** attacker x when the cinematic started */
  ultOrigin: number;
  /** script id of the cinematic this fighter is the victim of */
  ultBy: string;
  /** frames left in the parry window opened by a guard tap */
  parryTimer: number;
  /** anti-mash: frames before another parry window can open */
  parryCooldown: number;
  /** auto-combo: index of the next step of the mash-LP route (0 = not in an auto-combo) */
  autoStep: number;
  /** air dash already used during this jump */
  airDashUsed: boolean;
  /** number of air attacks chained during this jump */
  airChain: number;
  /** victim: a wall bounce / ground bounce already happened in this combo (once each) */
  wallBounced: boolean;
  groundBounced: boolean;
  /** frames left to start a super jump (UP, or LP in the auto-combo) after one of this fighter's launchers connected */
  sjWindow: number;
  /**
   * special trajectory of an airborne victim:
   *  'spike' = slammed to the floor by an airSmash (ground bounce, once per combo),
   *  'wall'  = sent flying by a heavy ender (wall splat if it reaches the arena wall),
   *  'bounce' = rebounding off the floor / the wall (floaty, until the next hit),
   *  'ko'    = destruction finish flight (crashes through the wall, lands outside)
   */
  flight: 'none' | 'spike' | 'wall' | 'bounce' | 'ko';
  /** destruction finish: this K.O.'d fighter crashed through the arena wall (no longer kept inside until the next round) */
  wallBroken: boolean;
  /** frames left to honour an assist button press */
  assistReq: number;
  /** the current hitstun is the 'stun' assist's dizzy distraction (long, no damage) */
  dizzy: boolean;
  /** character profile: stats come from ARCHETYPES[archetype] (sim/archetypes.ts) */
  archetype: Archetype;
  /** health at the start of a round (depends on the profile) */
  maxHp: number;
  /** guard gauge: blocked hits drain it, it refills while not blocking; empty = guard crush */
  guard: number;
  guardMax: number;
  /** frames before the guard gauge starts refilling */
  guardDelay: number;
}

/** Projectile of a ranged fighter (part of GameState: rollback-safe). */
export interface ProjectileState {
  /** fighter who threw it */
  owner: 0 | 1;
  x: number;
  y: number;
  /** horizontal speed (m / frame, signed) */
  vx: number;
  /** frames since it was thrown */
  frame: number;
}

/** What an assist does when called (see src/data/assists.ts for who does what). */
export type AssistKind =
  /** dashes in from behind the caller and lands a heavy blow (knockdown) */
  | 'rush'
  /** pops up next to the opponent and launches them (follow up with an air combo) */
  | 'launcher'
  /** throws a projectile from behind the caller, travels across the screen */
  | 'beam'
  /** a goofy distraction that stuns the opponent in place for a moment */
  | 'stun';

/** The friend chosen before the fight, per side. */
export interface AssistSpec {
  /** roster id of the friend (visual / name only for the sim) */
  id: string;
  kind: AssistKind;
}

/** Runtime state of a side's assist (part of GameState: rollback-safe). */
export interface AssistState {
  id: string;
  kind: AssistKind;
  /** 'off' = not on screen; enter → attack → leave */
  phase: 'off' | 'enter' | 'attack' | 'leave';
  /** frames since the current phase started */
  frame: number;
  x: number;
  y: number;
  facing: 1 | -1;
  /** the attack already connected (one hit per call) */
  hit: boolean;
  /** projectile position (beam), meaningful while `shot` is true */
  shot: boolean;
  shotX: number;
  /** frames before the assist can be called again (0 = ready) */
  cooldown: number;
}

export type Phase = 'intro' | 'roundIntro' | 'fight' | 'ko' | 'roundOver' | 'matchOver';

export type SimEvent =
  | { t: 'hit'; p: number; x: number; y: number; strength: Strength; counter: boolean; dmg: number; kind?: HitKind; self?: boolean }
  | { t: 'block'; p: number; x: number; y: number }
  | { t: 'whiff'; p: number; heavy: boolean }
  | { t: 'land'; p: number }
  | { t: 'fall'; p: number }
  | { t: 'throw'; p: number }
  | { t: 'throwBreak'; p: number }
  | { t: 'grab'; p: number }
  | { t: 'parry'; p: number; x: number; y: number }
  | { t: 'super'; p: number }
  | { t: 'superCombo'; p: number }
  /** p called their assist */
  | { t: 'assist'; p: number }
  /** p's assist leaves the screen */
  | { t: 'assistLeave'; p: number }
  /** p (the victim) bounced off the wall / the floor */
  | { t: 'wallBounce'; p: number; x: number; y: number }
  | { t: 'groundBounce'; p: number; x: number }
  /** destruction finish: the K.O.'d fighter p crashed through the arena wall */
  | { t: 'wallBreak'; p: number; x: number; y: number }
  /** p's guard gauge emptied (guard crush) */
  | { t: 'guardBreak'; p: number; x: number; y: number }
  /** p threw their projectile */
  | { t: 'projectile'; p: number; x: number; y: number }
  /** p's projectile is gone: it hit, was blocked, clashed with the other one, or left the arena */
  | { t: 'projectileEnd'; p: number; x: number; y: number; how: 'hit' | 'block' | 'clash' | 'out' }
  /** p started a chase super jump / an air dash */
  | { t: 'superJump'; p: number }
  | { t: 'airDash'; p: number }
  | { t: 'ko'; p: number }
  | { t: 'phase'; phase: Phase; round: number }
  | { t: 'fight' }
  | { t: 'timeUp' }
  | { t: 'perfect' };

export interface GameState {
  frame: number;
  phase: Phase;
  phaseFrame: number;
  round: number;
  roundsToWin: number;
  /** remaining round time in frames */
  timer: number;
  hitstop: number;
  fighters: [FighterState, FighterState];
  /** each side's assist (null = no assist chosen) */
  assists: [AssistState | null, AssistState | null];
  /** each side's projectile on screen (ranged profile, one at a time) */
  projectiles: [ProjectileState | null, ProjectileState | null];
  /** training mode: the clock never runs out and nobody gets K.O.'d (the screen refills the bars) */
  training: boolean;
  events: SimEvent[];
  /** winner of the last round: 0, 1, or 2 = draw, -1 = none yet */
  roundWinner: number;
  /** winner of the match: 0, 1, 2 = draw, -1 = not decided */
  matchWinner: number;
  /** skip the intro (practice / rematch) */
  skipIntro: boolean;
  timeUp: boolean;
}

export const FPS = 60;
/** health of the balanced profile (each fighter's own is FighterState.maxHp) */
export const MAX_HP = 200;
/** guard gauge of the balanced profile (each fighter's own is FighterState.guardMax) */
export const GUARD_MAX = 100;
export const MAX_METER = 100;
export const ROUND_TIME = 60 * FPS;
export const ARENA_HALF_WIDTH = 7;
export const START_X = 1.5;
export const MIN_SEPARATION = 0.76;
export const MAX_SEPARATION = 6.2;
export const BODY_RADIUS = 0.25;

export const INTRO_FRAMES = 330;
export const INTRO_SPLIT = 165;
export const ROUND_INTRO_FRAMES = 105;
export const FIGHT_CALL_FRAME = 62;
export const KO_FRAMES = 170;
export const ROUND_OVER_FRAMES = 160;

/** BBL MAX: freeze + close-up before the dash strike */
export const SUPER_FLASH_FRAMES = 96;
/** length of the cinematic combo when the dash strike connects */
export const SUPER_COMBO_FRAMES = 132;
