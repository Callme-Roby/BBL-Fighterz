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
/** buttons that are forwarded to the relative input */
export const IN_EXTRA = IN_SUPER | IN_GUARD | IN_GRAB;

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
  | 'throw'
  | 'super';

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
export const MAX_HP = 200;
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
