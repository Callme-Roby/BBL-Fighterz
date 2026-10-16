import {
  ASSIST_COOLDOWN,
  ASSIST_MOVES,
  BEAM_SPEED,
  BEAM_Y,
  PROJ_CLEAR_Y,
  PROJ_RADIUS,
  PROJ_SPAWN,
  PROJ_SPEED,
  PROJ_Y,
  RUSH_SPEED,
  moveTotal,
  type AssistMove,
  type MoveDef,
  type Strike,
} from './moves';
import { cineFrame, cineTime, curve, getUltimate } from './ultimates';
import { ARCHETYPES, moveFor, type ArchetypeStats } from './archetypes';
import {
  ARENA_HALF_WIDTH,
  BODY_RADIUS,
  FIGHT_CALL_FRAME,
  IN_BUTTONS,
  IN_DOWN,
  IN_LEFT,
  IN_LK,
  IN_LP,
  IN_RIGHT,
  IN_RK,
  IN_RP,
  IN_EXTRA,
  IN_ASSIST,
  IN_GRAB,
  IN_GUARD,
  IN_SUPER,
  IN_UP,
  type AssistSpec,
  type AssistState,
  INTRO_FRAMES,
  KO_FRAMES,
  MAX_HP,
  MAX_METER,
  MAX_SEPARATION,
  MIN_SEPARATION,
  R_B,
  R_D,
  R_DIRS,
  R_F,
  R_U,
  ROUND_INTRO_FRAMES,
  ROUND_OVER_FRAMES,
  ROUND_TIME,
  START_X,
  SUPER_FLASH_FRAMES,
  type Action,
  type FighterState,
  type GameState,
  type MoveId,
  type Phase,
  GUARD_MAX,
  type Archetype,
  type ProjectileState,
} from './types';

// ---------------------------------------------------------------------------
// tuning
// ---------------------------------------------------------------------------
const GRAVITY = 0.0088;
const JUGGLE_GRAVITY = 0.0094;
const JUMP_VY = 0.142;
// walk / dash / jump speeds and frame data depend on the profile: see sim/archetypes.ts
const LAND_FRAMES = 4;
const BUFFER_FRAMES = 8;
/** frames after the active window during which a connecting move can be cancelled */
const CHAIN_WINDOW = 12;
/** max moves in one chained string */
const MAX_CHAIN = 6;
const SUPER_BUFFER = 8;
/** a guard tap parries attacks landing within this many frames */
const PARRY_WINDOW = 7;
/** a missed parry tap locks new parry windows for a while (no mashing) */
const PARRY_COOLDOWN = 24;
/** recovery of a fighter whose attack got parried */
const PARRIED_STUN = 26;
const PARRY_RECOVERY = 10;
const DOUBLE_TAP_FRAMES = 12;
const KNOCKDOWN_MIN = 26;
const KNOCKDOWN_MAX = 62;
const GETUP_FRAMES = 26;
const THROW_FRAMES = 58;
const THROW_SLAM_FRAME = 34;
const THROW_BREAK_WINDOW = 10;
const HITSTOP = { light: 6, medium: 8, heavy: 12 } as const;

// ---- combo system -------------------------------------------------------------
/**
 * Auto-combo: mashing LP (no direction) on the ground follows this route while every
 * step connects (hit or block). 'superJump' = chase jump after the launcher.
 */
const AUTO_ROUTE: readonly (MoveId | 'superJump')[] = ['jab', 'jab', 'cross', 'frontKick', 'uppercut', 'superJump', 'jumpPunch', 'jumpKick', 'airSmash'];
const AUTO_SJ_STEP = 5;
/** damage multiplier of the moves picked by the auto-combo (manual combos stay more rewarding) */
const AUTO_DAMAGE = 0.85;
/** damage scaling: x(1 - SCALE_STEP * hits already in the combo), never below SCALE_MIN */
const SCALE_STEP = 0.1;
const SCALE_MIN = 0.3;
const AIR_DAMAGE = 0.8;
const COUNTER_DAMAGE = 1.25;
/** ground hitstun decay: full for the first HITSTUN_FREE hits, then -HITSTUN_DECAY per hit (min HITSTUN_MIN_SCALE) */
const HITSTUN_FREE = 3;
const HITSTUN_DECAY = 0.085;
const HITSTUN_MIN_SCALE = 0.2;
/** juggles: every juggle hit lifts less (0 at JUGGLE_LIMIT) and the victim falls faster */
const JUGGLE_LIMIT = 10;
const JUGGLE_LIFT = 0.105;
/** lift of an air attack on an airborne victim (air combos stay at about the same height) */
const AIR_COMBO_LIFT = 0.05;
const JUGGLE_GRAVITY_GROWTH = 0.06;
/** super jump (chase jump after a launcher) */
const SJ_WINDOW = 20;
const SJ_FRAMES = 13;
/** UP pressed this many frames before (e.g. during the launcher's hitstop) still counts (= dirHist length) */
const SJ_BUFFER = 20;
/** the super jumper can attack from this frame of the super jump */
const SJ_ATTACK_FRAME = 5;
/** distance kept in front of the victim while homing */
const SJ_GAP = 0.5;
/** a launcher only opens the super jump window while the juggle is fresh (one air combo per combo) */
const SJ_MAX_JUGGLE = 1;
/** air combos */
const AIR_CHAIN_MAX = 4;
const AIR_DASH_FRAMES = 14;
const AIR_DASH_SPEED = 0.15;
const AIR_DASH_ATTACK_FRAME = 4;
const AIR_DASH_MIN_Y = 0.45;
/** airSmash on an airborne victim: spike velocity, then the floor bounce */
const SPIKE_VY = -0.24;
const GROUND_BOUNCE_VY = 0.15;
const GROUND_BOUNCE_GRAVITY = 0.0085;
/** wall bounce: heavy enders send the victim flying; splat if it reaches the wall */
const WALL_FLIGHT_VX = 0.15;
const WALL_FLIGHT_VY = 0.07;
const WALL_FLIGHT_GRAVITY = 0.006;
const WALL_SPLAT_FRAMES = 16;
const WALL_BOUNCE_VX = 0.07;
const WALL_BOUNCE_VY = 0.12;
/** destruction finish: K.O. flight through the arena wall, landing KO_FLIGHT_OUT metres outside */
const KO_FLIGHT_VY = 0.1;
const KO_FLIGHT_GRAVITY = 0.0045;
const KO_FLIGHT_OUT = 3.2;
/** assists */
const ASSIST_BUFFER = 10;
/** dizzy of the stun assist shrinks a lot when it lands mid-combo */
const DIZZY_DECAY = 0.15;
/**
 * Guard gauge (FighterState.guard): every blocked blow drains it (by strength, x the
 * defender's profile), parries give a little back; it refills after GUARD_DELAY frames
 * without blocking, full in GUARD_REFILL_FRAMES. Empty = guard crush (staggered, wide open).
 */
const GUARD_DRAIN = { light: 5, medium: 8, heavy: 13 } as const;
const GUARD_PARRY_BONUS = 4;
const GUARD_DELAY = 54;
const GUARD_REFILL_FRAMES = 180;
const GUARD_CRUSH_FRAMES = 62;
const GUARD_CRUSH_HITSTOP = 16;
const GUARD_CRUSH_PUSH = 0.03;

// ---------------------------------------------------------------------------
// creation
// ---------------------------------------------------------------------------
export function createFighter(side: 0 | 1): FighterState {
  return {
    x: side === 0 ? -START_X : START_X,
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    hp: MAX_HP,
    meter: 0,
    action: 'idle',
    actionFrame: 0,
    moveId: null,
    moveHit: false,
    stun: 0,
    stunTotal: 0,
    hitLevel: 'mid',
    crouching: false,
    jumpDir: 0,
    airAttackUsed: false,
    juggleCount: 0,
    comboCount: 0,
    comboDamage: 0,
    invuln: 0,
    frozen: 0,
    koed: false,
    rel: 0,
    prevRel: 0,
    bufBtn: 0,
    bufDir: 0,
    bufQcf: false,
    bufAge: 99,
    lastFTap: -100,
    lastBTap: -100,
    dashReq: 0,
    dirHist: [],
    wins: 0,
    variant: 0,
    throwTimer: 0,
    counterHit: false,
    superReq: 0,
    chain: 0,
    lastMove: null,
    repeat: 0,
    ult: 'rush',
    ultOrigin: 0,
    ultBy: 'rush',
    parryTimer: 0,
    parryCooldown: 0,
    autoStep: 0,
    airDashUsed: false,
    airChain: 0,
    wallBounced: false,
    groundBounced: false,
    sjWindow: 0,
    flight: 'none',
    wallBroken: false,
    assistReq: 0,
    dizzy: false,
    archetype: 'balanced',
    maxHp: MAX_HP,
    guard: GUARD_MAX,
    guardMax: GUARD_MAX,
    guardDelay: 0,
  };
}

export function createAssist(spec: AssistSpec): AssistState {
  return { id: spec.id, kind: spec.kind, phase: 'off', frame: 0, x: 0, y: 0, facing: 1, hit: false, shot: false, shotX: 0, cooldown: 0 };
}

export interface MatchOptions {
  roundsToWin?: number;
  skipIntro?: boolean;
  /** BBL MAX script id of each side (sim/ultimates.ts) */
  ultimates?: [string, string];
  /** friend called with the assist button, per side (null / missing = none) */
  assists?: [AssistSpec | null, AssistSpec | null];
  /** character profile of each side (default: balanced) */
  archetypes?: [Archetype, Archetype];
  /** training mode (no timer, no K.O.) */
  training?: boolean;
}

export function createGame(opts: MatchOptions = {}): GameState {
  const s: GameState = {
    frame: 0,
    phase: opts.skipIntro ? 'roundIntro' : 'intro',
    phaseFrame: 0,
    round: 1,
    roundsToWin: opts.roundsToWin ?? 2,
    timer: ROUND_TIME,
    hitstop: 0,
    fighters: [createFighter(0), createFighter(1)],
    assists: [opts.assists?.[0] ? createAssist(opts.assists[0]) : null, opts.assists?.[1] ? createAssist(opts.assists[1]) : null],
    projectiles: [null, null],
    training: !!opts.training,
    events: [],
    roundWinner: -1,
    matchWinner: -1,
    skipIntro: !!opts.skipIntro,
    timeUp: false,
  };
  for (const f of s.fighters) setAction(f, s.phase === 'intro' ? 'intro' : 'idle');
  if (opts.archetypes) for (const i of [0, 1] as const) s.fighters[i].archetype = opts.archetypes[i];
  for (const f of s.fighters) applyProfile(f);
  if (opts.ultimates) {
    s.fighters[0].ult = getUltimate(opts.ultimates[0]).id;
    s.fighters[1].ult = getUltimate(opts.ultimates[1]).id;
  }
  return s;
}

export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

/** health and guard gauge of the fighter's profile (match start and every round) */
function applyProfile(f: FighterState) {
  const p = ARCHETYPES[f.archetype];
  f.maxHp = p.hp;
  f.hp = p.hp;
  f.guardMax = p.guardMax;
  f.guard = p.guardMax;
  f.guardDelay = 0;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function prof(f: FighterState): ArchetypeStats {
  return ARCHETYPES[f.archetype];
}

/** the fighter's own move as its profile performs it (frame data, reach, damage) */
function mv(f: FighterState, id: MoveId): MoveDef {
  return moveFor(f.archetype, id);
}

function setAction(f: FighterState, a: Action) {
  f.action = a;
  f.actionFrame = 0;
  if (a !== 'attack' && a !== 'airAttack') f.moveId = null;
}

function toRel(input: number, facing: 1 | -1): number {
  let r = 0;
  if (input & IN_UP) r |= R_U;
  if (input & IN_DOWN) r |= R_D;
  const fwd = facing === 1 ? IN_RIGHT : IN_LEFT;
  const back = facing === 1 ? IN_LEFT : IN_RIGHT;
  if (input & fwd) r |= R_F;
  if (input & back) r |= R_B;
  // left+right together cancel out
  if ((r & R_F) && (r & R_B)) r &= ~(R_F | R_B);
  return r | (input & (IN_BUTTONS | IN_EXTRA));
}

function isAirborne(f: FighterState): boolean {
  return (
    f.action === 'jump' ||
    f.action === 'airAttack' ||
    f.action === 'juggle' ||
    f.action === 'superJump' ||
    f.action === 'airDash' ||
    f.action === 'wallSplat' ||
    f.y > 0.12
  );
}

function isCrouching(f: FighterState): boolean {
  if (f.action === 'crouch') return true;
  if (f.action === 'guard' && f.crouching) return true;
  if ((f.action === 'hitstun' || f.action === 'blockstun') && f.crouching) return true;
  if (f.action === 'attack' && f.moveId && mv(f, f.moveId).crouching) return true;
  return false;
}

function isNeutral(f: FighterState): boolean {
  return f.action === 'idle' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'crouch' || f.action === 'guard';
}

/** Detect a quarter-circle-forward (D, DF, F) in the recent direction history. */
function detectQcf(hist: number[]): boolean {
  let stage = 0;
  const start = Math.max(0, hist.length - 18);
  for (let i = start; i < hist.length; i++) {
    const d = hist[i];
    if (stage === 0 && (d & R_D) && !(d & R_F)) stage = 1;
    else if (stage === 1 && (d & R_D) && (d & R_F)) stage = 2;
    else if (stage === 2 && (d & R_F) && !(d & R_D)) stage = 3;
  }
  return stage === 3 || (stage === 2 && (hist[hist.length - 1] & R_F) !== 0);
}

function chooseGroundMove(f: FighterState, btn: number, dir: number, qcf: boolean): MoveId | null {
  // throw: LP + LK together
  if ((btn & IN_LP) && (btn & IN_LK)) return 'throw';
  void qcf;
  const down = (dir & R_D) !== 0;
  const fwd = (dir & R_F) !== 0;
  if (down) {
    if (btn & IN_RP) return 'uppercut';
    if (btn & IN_RK) return 'sweep';
    if (btn & IN_LK) return 'lowKick';
    if (btn & IN_LP) return fwd ? 'elbow' : 'crouchJab';
  }
  if (fwd) {
    // ranged profile: forward + RP throws the projectile instead of the power punch
    if (btn & IN_RP) return f.archetype === 'ranged' ? 'projectile' : 'powerPunch';
    if (btn & IN_LP) return 'elbow';
    if (btn & IN_LK) return 'knee';
    if (btn & IN_RK) return 'roundhouse';
  }
  if (btn & IN_RP) return 'cross';
  if (btn & IN_LP) return 'jab';
  if (btn & IN_RK) return 'roundhouse';
  if (btn & IN_LK) return 'frontKick';
  return null;
}

function chooseAirMove(btn: number, dir: number): MoveId | null {
  if (btn & (IN_LK | IN_RK)) return dir & R_D ? 'airSmash' : 'jumpKick';
  if (btn & (IN_LP | IN_RP)) return 'jumpPunch';
  return null;
}

/** a press that continues the auto-combo: LP alone, no direction */
function isAutoPress(btn: number, dir: number): boolean {
  return btn === IN_LP && (dir & R_DIRS) === 0;
}

/** next auto-combo move if the buffered press asks for it (null = manual input) */
function autoNext(f: FighterState): MoveId | 'superJump' | null {
  if (f.autoStep <= 0 || f.autoStep >= AUTO_ROUTE.length) return null;
  if (!f.bufBtn || f.bufAge > BUFFER_FRAMES || !isAutoPress(f.bufBtn, f.bufDir | (f.rel & R_D))) return null;
  return AUTO_ROUTE[f.autoStep];
}

/** auto-combo step of a move started from a fresh press (1 = the route's opening jab) */
function openerStep(id: MoveId, btn: number, dir: number): number {
  return id === 'jab' && isAutoPress(btn, dir) ? 1 : 0;
}

/**
 * @param skip  frames of startup skipped (chained moves come out faster and blend from the previous one)
 * @param chained true when the move cancels a previous one in a string
 */
function startMove(s: GameState, f: FighterState, o: FighterState, id: MoveId, idx: number, skip = 0, chained = false, auto = 0) {
  const m = mv(f, id);
  if (m.meterCost) {
    if (f.meter < m.meterCost) return;
    f.meter -= m.meterCost;
  }
  // auto-combo: index of the next route step (0 = manual move)
  f.autoStep = auto;
  f.chain = chained ? f.chain + 1 : 1;
  f.repeat = f.lastMove === id ? f.repeat + 1 : 1;
  f.lastMove = id;
  f.action = m.air ? 'airAttack' : 'attack';
  f.actionFrame = 1 + Math.max(0, Math.min(skip, m.startup - 2));
  f.moveId = id;
  f.moveHit = false;
  f.crouching = !!m.crouching;
  if (m.air) {
    f.airAttackUsed = true;
    f.airChain++;
  }
  if (!m.air) f.vx = 0;
  // auto-combo steps glide toward the opponent so the route doesn't drop on pushback
  if (auto > 1 && !m.air && !isAirborne(o)) {
    // where the opponent's pushback will leave them (ground friction: x0.82 per frame)
    const ox = o.x + o.vx / 0.18;
    const gap = Math.abs(ox - f.x) - (m.reach + BODY_RADIUS * 0.4) - (m.advance ?? 0);
    if (gap > 0) f.vx = f.facing * Math.min(gap, 0.6) * 0.3;
  }
  if (m.invulnFrames) f.invuln = m.invulnFrames;
  if (m.freezeOpponent) {
    o.frozen = m.freezeOpponent;
    s.events.push({ t: 'super', p: idx });
  }
  f.bufBtn = 0;
  f.bufAge = 99;
}

function consumeBuffer(f: FighterState): { btn: number; dir: number; qcf: boolean } | null {
  if (f.bufBtn && f.bufAge <= BUFFER_FRAMES) {
    const r = { btn: f.bufBtn, dir: f.bufDir, qcf: f.bufQcf };
    f.bufBtn = 0;
    f.bufAge = 99;
    return r;
  }
  return null;
}

// ---------------------------------------------------------------------------
// input processing (runs even during hitstop so presses are buffered)
// ---------------------------------------------------------------------------
function processInput(s: GameState, f: FighterState, input: number) {
  f.prevRel = f.rel;
  f.rel = toRel(input, f.facing);
  const dir = f.rel & R_DIRS;
  f.dirHist.push(dir);
  if (f.dirHist.length > 20) f.dirHist.shift();

  if (f.rel & IN_SUPER && !(f.prevRel & IN_SUPER)) f.superReq = SUPER_BUFFER;
  else if (f.superReq > 0) f.superReq--;
  // assist call: buffered, consumed (or aged) by runFight outside hitstop
  if (f.rel & IN_ASSIST && !(f.prevRel & IN_ASSIST)) f.assistReq = ASSIST_BUFFER;

  // guard tap = parry window (with an anti-mash cooldown)
  if (f.parryTimer > 0) f.parryTimer--;
  if (f.parryCooldown > 0) f.parryCooldown--;
  if (f.rel & IN_GUARD && !(f.prevRel & IN_GUARD) && f.parryCooldown === 0) {
    f.parryTimer = PARRY_WINDOW;
    f.parryCooldown = PARRY_COOLDOWN;
  }

  let pressed = f.rel & ~f.prevRel & IN_BUTTONS;
  // the grab button is a shortcut for LP + LK (throw)
  if (f.rel & IN_GRAB && !(f.prevRel & IN_GRAB)) pressed |= IN_LP | IN_LK;
  if (pressed) {
    // presses within 2 frames are merged (for LP+LK throws)
    f.bufBtn = (f.bufAge <= 2 ? f.bufBtn : 0) | pressed;
    f.bufDir = dir;
    f.bufQcf = detectQcf(f.dirHist);
    f.bufAge = 0;
  } else if (f.bufAge < 99 && s.hitstop === 0) {
    // presses made during hitstop stay buffered until the action resumes
    f.bufAge++;
  }

  // dash double taps (neutral -> F -> neutral -> F)
  const fPressed = (f.rel & R_F) && !(f.prevRel & R_F) && !(f.rel & (R_D | R_U));
  const bPressed = (f.rel & R_B) && !(f.prevRel & R_B) && !(f.rel & (R_D | R_U));
  if (fPressed) {
    if (s.frame - f.lastFTap <= DOUBLE_TAP_FRAMES) {
      f.dashReq = 1;
      f.lastFTap = -100;
    } else f.lastFTap = s.frame;
  }
  if (bPressed) {
    if (s.frame - f.lastBTap <= DOUBLE_TAP_FRAMES) {
      f.dashReq = -1;
      f.lastBTap = -100;
    } else f.lastBTap = s.frame;
  }
}

// ---------------------------------------------------------------------------
// fighter state machine
// ---------------------------------------------------------------------------
function updateFighter(s: GameState, f: FighterState, o: FighterState, idx: number) {
  if (f.frozen > 0) {
    f.frozen--;
    return;
  }
  f.actionFrame++;
  if (f.invuln > 0) f.invuln--;
  const dir = f.rel & R_DIRS;

  // super jump: UP (or the auto-combo's LP) right after a launcher connected
  if (f.sjWindow > 0) {
    f.sjWindow--;
    if (canSuperJump(f, o)) {
      const auto = f.autoStep === AUTO_SJ_STEP && autoNext(f) === 'superJump';
      if (upRecently(f) || auto) {
        const wasAuto = f.autoStep === AUTO_SJ_STEP;
        startSuperJump(s, f, o, idx);
        f.autoStep = wasAuto ? AUTO_SJ_STEP + 1 : 0;
        return;
      }
    }
  }

  switch (f.action) {
    case 'idle':
    case 'walkF':
    case 'walkB':
    case 'crouch':
    case 'guard':
      neutral(s, f, o, idx, dir);
      break;

    case 'parry':
      // deflected an attack: short recovery, can attack right away to punish
      if (f.actionFrame >= 4) {
        const b = consumeBuffer(f);
        if (b) {
          const id = chooseGroundMove(f, b.btn, b.dir, b.qcf);
          if (id) {
            startMove(s, f, o, id, idx, 0, false, openerStep(id, b.btn, b.dir));
            break;
          }
        }
      }
      if (f.actionFrame >= PARRY_RECOVERY) toNeutral(f);
      break;

    case 'parried':
      f.stun--;
      if (f.stun <= 0) toNeutral(f);
      break;

    case 'prejump':
      if (f.actionFrame >= prof(f).prejump) {
        setAction(f, 'jump');
        f.vy = JUMP_VY;
        f.vx = f.jumpDir * f.facing * prof(f).jumpVx;
        f.y = 0.01;
        f.airAttackUsed = false;
        f.airChain = 0;
        f.airDashUsed = false;
      }
      break;

    case 'jump':
      if (tryAirDash(s, f, idx)) break;
      tryAirMove(s, f, o, idx);
      break;

    case 'superJump':
      runSuperJump(s, f, o, idx);
      break;

    case 'airDash':
      // fast horizontal dash, no gravity; can attack after a few frames
      f.x += f.facing * AIR_DASH_SPEED * (1 - f.actionFrame / (AIR_DASH_FRAMES + 8));
      if (f.actionFrame >= AIR_DASH_ATTACK_FRAME && tryAirMove(s, f, o, idx)) {
        f.vx = f.facing * 0.06;
        f.vy = 0;
        break;
      }
      if (f.actionFrame >= AIR_DASH_FRAMES) toAirborne(f, f.facing * 0.05, 0);
      break;

    case 'airAttack': {
      const m = mv(f, f.moveId!);
      if (f.actionFrame === m.startup) s.events.push({ t: 'whiff', p: idx, heavy: m.strength === 'heavy' });
      // air chains: a connecting air attack flows into the next one (max AIR_CHAIN_MAX per jump)
      const inWindow = f.actionFrame >= m.startup && f.actionFrame <= m.startup + m.active + CHAIN_WINDOW;
      if (f.moveHit && inWindow && f.airChain < AIR_CHAIN_MAX && f.bufBtn && f.bufAge <= BUFFER_FRAMES) {
        const route = autoNext(f);
        let next: MoveId | null = null;
        let auto = 0;
        if (route && route !== 'superJump' && mv(f, route).air) {
          next = route;
          auto = f.autoStep + 1;
        } else if (!route) {
          next = chooseAirMove(f.bufBtn, f.bufDir | (f.rel & R_D));
          if (next === f.moveId && f.repeat >= 2) next = null;
        }
        if (next) {
          startMove(s, f, o, next, idx, Math.floor(mv(f, next).startup * 0.4), true, auto);
          break;
        }
      }
      if (f.actionFrame >= moveTotal(m)) {
        // recovered in the air: back to a plain jump (the jump clip starts on its airborne pose)
        if (!f.moveHit) f.autoStep = 0;
        toAirborne(f, f.vx, f.vy);
      }
      break;
    }

    case 'wallSplat':
      // pinned against the wall, then thrown back toward the middle into a juggle
      if (f.actionFrame >= WALL_SPLAT_FRAMES) {
        const side = f.x > 0 ? 1 : -1;
        setAction(f, 'juggle');
        f.vx = -side * WALL_BOUNCE_VX;
        f.vy = WALL_BOUNCE_VY;
        f.y = Math.max(f.y, 0.05);
      }
      break;

    case 'land':
      if (tryStartSuper(s, f, o, idx)) break;
      if (f.actionFrame >= LAND_FRAMES) toNeutral(f);
      break;

    case 'superFlash':
      // close-up & shout, then the dash strike
      if (f.actionFrame >= SUPER_FLASH_FRAMES) startMove(s, f, o, 'super', idx);
      break;

    case 'superCombo':
      runSuperCombo(s, f, o, idx);
      break;

    case 'superVictim':
      // driven by the attacker's script
      break;

    case 'dashF':
      if (tryStartSuper(s, f, o, idx)) break;
      f.x += f.facing * prof(f).dashF * (1 - f.actionFrame / (prof(f).dashFFrames + 4));
      if (f.actionFrame >= 5) {
        const b = consumeBuffer(f);
        if (b) {
          const id = chooseGroundMove(f, b.btn, b.dir, b.qcf);
          if (id) {
            startMove(s, f, o, id, idx, 0, false, openerStep(id, b.btn, b.dir));
            break;
          }
        }
      }
      if (f.actionFrame >= prof(f).dashFFrames) toNeutral(f);
      break;

    case 'dashB':
      f.x -= f.facing * prof(f).dashB * (1 - f.actionFrame / (prof(f).dashBFrames + 4));
      if (f.actionFrame >= prof(f).dashBFrames) toNeutral(f);
      break;

    case 'attack': {
      const m = mv(f, f.moveId!);
      if (m.advance && f.actionFrame < m.startup) f.x += (f.facing * m.advance) / (m.startup - 1);
      if (f.moveId === 'projectile') {
        if (f.actionFrame === m.startup) spawnProjectile(s, f, idx);
      } else if (f.actionFrame === m.startup && !m.throw) s.events.push({ t: 'whiff', p: idx, heavy: m.strength === 'heavy' });
      // jab -> throw conversion (LK pressed right after LP)
      if (f.moveId === 'jab' && f.actionFrame <= 3 && f.bufAge <= 2 && f.bufBtn & IN_LK) {
        startMove(s, f, o, 'throw', idx);
        break;
      }
      if (f.moveId === 'frontKick' && f.actionFrame <= 3 && f.bufAge <= 2 && f.bufBtn & IN_LP) {
        startMove(s, f, o, 'throw', idx);
        break;
      }
      // (the projectile throw is not cancellable: its recovery is the punish window)
      if (!m.throw && f.moveId !== 'super' && f.moveId !== 'projectile') {
        const inWindow = f.actionFrame >= m.startup && f.actionFrame <= m.startup + m.active + CHAIN_WINDOW;
        // BBL MAX can cancel any connecting move
        if (f.moveHit && inWindow && tryStartSuper(s, f, o, idx)) break;
        if (f.bufBtn && f.bufAge <= BUFFER_FRAMES) {
          // auto-combo: LP mashed while the previous step connected follows the route
          const route = f.moveHit && inWindow ? autoNext(f) : null;
          if (route && route !== 'superJump') {
            startMove(s, f, o, route, idx, Math.floor(mv(f, route).startup * 0.4), true, f.autoStep + 1);
            break;
          }
          const next = chooseGroundMove(f, f.bufBtn, f.bufDir | (f.rel & R_D), false);
          // chains: any move that connected (hit or block) can flow into another one
          if (!route && next && next !== 'throw' && f.moveHit && inWindow && f.chain < MAX_CHAIN + prof(f).extraChain && !(next === f.moveId && f.repeat >= 2)) {
            startMove(s, f, o, next, idx, Math.floor(mv(f, next).startup * 0.4), true);
            break;
          }
          // whiffs: the second half of the recovery can be interrupted by the next attack
          if (next && !f.moveHit && f.actionFrame >= m.startup + m.active + Math.ceil(m.recovery * 0.5)) {
            startMove(s, f, o, next, idx, 0, false, openerStep(next, f.bufBtn, f.bufDir));
            break;
          }
        }
      }
      if (f.actionFrame >= moveTotal(m)) {
        if (!f.moveHit) f.autoStep = 0;
        toNeutral(f);
        neutral(s, f, o, idx, dir);
      }
      break;
    }

    case 'hitstun':
    case 'blockstun':
      f.stun--;
      if (f.stun <= 0) {
        toNeutral(f);
        if (dir & R_D) {
          setAction(f, 'crouch');
          f.crouching = true;
        }
      }
      break;

    case 'guardCrush':
      // guard broken: staggered, wide open; the gauge comes back full once it's over
      // (or when a hit interrupts it, see updateGuard)
      f.stun--;
      if (f.stun <= 0) {
        toNeutral(f);
        f.guard = f.guardMax;
        f.guardDelay = 0;
      }
      break;

    case 'juggle':
      // handled by physics (landing)
      break;

    case 'knockdown': {
      if (f.koed) break;
      const wantsUp = (f.rel & (IN_BUTTONS | R_U | R_F | R_B)) !== 0;
      if (f.actionFrame >= KNOCKDOWN_MAX || (f.actionFrame >= KNOCKDOWN_MIN && wantsUp)) {
        setAction(f, 'getup');
        f.invuln = GETUP_FRAMES + 2;
      }
      break;
    }

    case 'getup':
      if (f.actionFrame >= GETUP_FRAMES) {
        toNeutral(f);
        endCombo(f);
      }
      break;

    case 'throwing':
      if (f.actionFrame === THROW_SLAM_FRAME) s.events.push({ t: 'throw', p: idx });
      if (f.actionFrame >= THROW_FRAMES) toNeutral(f);
      break;

    case 'thrown': {
      // throw escape: press a punch right after being grabbed
      const pressed = f.rel & ~f.prevRel & (IN_LP | IN_RP | IN_GRAB);
      if (f.actionFrame <= THROW_BREAK_WINDOW && pressed && o.action === 'throwing') {
        setAction(f, 'throwBreak');
        setAction(o, 'throwBreak');
        f.vx = -f.facing * 0.09;
        o.vx = -o.facing * 0.09;
        s.events.push({ t: 'throwBreak', p: idx });
        break;
      }
      // glue to the thrower
      f.x = o.x + o.facing * 0.62;
      if (f.actionFrame === THROW_SLAM_FRAME) {
        // the thrower's profile (heavy = bigger throws)
        const dmg = Math.round(mv(o, 'throw').damage);
        f.hp = Math.max(hpFloor(s), f.hp - dmg);
        f.comboCount++;
        f.comboDamage += dmg;
        o.meter = Math.min(MAX_METER, o.meter + 12);
        f.meter = Math.min(MAX_METER, f.meter + 8);
        s.hitstop = HITSTOP.heavy;
        s.events.push({ t: 'hit', p: 1 - idx, x: f.x, y: 0.3, strength: 'heavy', counter: false, dmg });
        if (f.hp <= 0) f.koed = true;
      }
      if (f.actionFrame >= THROW_FRAMES - 6) {
        f.x = o.x + o.facing * 1.15;
        setAction(f, 'knockdown');
        f.y = 0;
        f.vx = o.facing * 0.02;
        s.events.push({ t: 'fall', p: idx });
        if (f.koed) setAction(f, 'ko');
      }
      break;
    }

    case 'throwBreak':
      if (f.actionFrame >= 20) toNeutral(f);
      break;

    case 'ko':
    case 'intro':
    case 'win':
    case 'lose':
      break;
  }
}

function toNeutral(f: FighterState) {
  setAction(f, 'idle');
  f.crouching = false;
  f.moveHit = false;
  f.dizzy = false;
  f.vy = 0;
  if (f.y < 0.001) f.y = 0;
}

/** The victim is back in control: the combo (and its once-per-combo bounces) is over. */
function endCombo(f: FighterState) {
  f.comboCount = 0;
  f.comboDamage = 0;
  f.juggleCount = 0;
  f.wallBounced = false;
  f.groundBounced = false;
  f.dizzy = false;
  if (!f.koed) f.flight = 'none';
}

function neutral(s: GameState, f: FighterState, o: FighterState, idx: number, dir: number) {
  // combo counter resets once the victim is back in control
  endCombo(f);
  f.chain = 0;
  f.lastMove = null;
  f.repeat = 0;
  // back in neutral: the auto-combo is over (unless its super jump step is still possible)
  if (!(f.autoStep === AUTO_SJ_STEP && f.sjWindow > 0)) f.autoStep = 0;

  if (tryStartSuper(s, f, o, idx)) return;

  const b = consumeBuffer(f);
  if (b) {
    // directions held at press time, merged with the current down (for crouch moves while crouching)
    const d = b.dir | (f.action === 'crouch' ? dir & R_D : 0);
    const id = chooseGroundMove(f, b.btn, d, b.qcf);
    if (id) {
      startMove(s, f, o, id, idx, 0, false, openerStep(id, b.btn, d));
      if (f.action === 'attack') return;
    }
  }

  if (f.dashReq !== 0) {
    const req = f.dashReq;
    f.dashReq = 0;
    if (!(dir & (R_D | R_U))) {
      setAction(f, req > 0 ? 'dashF' : 'dashB');
      return;
    }
  }

  // guard button held: stay in place, guarding (crouched with down)
  if (f.rel & IN_GUARD) {
    if (f.action !== 'guard') setAction(f, 'guard');
    f.crouching = (dir & R_D) !== 0;
    return;
  }

  if (dir & R_U) {
    setAction(f, 'prejump');
    f.jumpDir = dir & R_F ? 1 : dir & R_B ? -1 : 0;
    f.crouching = false;
    return;
  }
  if (dir & R_D) {
    if (f.action !== 'crouch') setAction(f, 'crouch');
    f.crouching = true;
    return;
  }
  f.crouching = false;
  if (dir & R_F) {
    if (f.action !== 'walkF') setAction(f, 'walkF');
    f.x += f.facing * prof(f).walkF;
  } else if (dir & R_B) {
    if (f.action !== 'walkB') setAction(f, 'walkB');
    f.x -= f.facing * prof(f).walkB;
  } else if (f.action !== 'idle') {
    setAction(f, 'idle');
  }
}

// ---------------------------------------------------------------------------
// air combos: super jump, air dash, air strings
// ---------------------------------------------------------------------------
/** UP held or pressed during the last few frames (super jump input, buffered through hitstop) */
function upRecently(f: FighterState): boolean {
  const h = f.dirHist;
  for (let i = Math.max(0, h.length - SJ_BUFFER); i < h.length; i++) if (h[i] & R_U) return true;
  return false;
}

/** A super jump can start from these states while the launched victim is still juggled. */
function canSuperJump(f: FighterState, o: FighterState): boolean {
  if ((o.action !== 'juggle' && o.action !== 'wallSplat') || o.koed || o.flight === 'ko') return false;
  switch (f.action) {
    case 'attack':
      return f.moveHit;
    case 'idle':
    case 'walkF':
    case 'walkB':
    case 'crouch':
    case 'guard':
    case 'land':
    case 'prejump':
    case 'dashF':
      return true;
  }
  return false;
}

function startSuperJump(s: GameState, f: FighterState, o: FighterState, idx: number) {
  setAction(f, 'superJump');
  f.sjWindow = 0;
  f.facing = o.x >= f.x ? 1 : -1;
  f.vx = 0;
  f.vy = 0;
  f.y = Math.max(f.y, 0.01);
  f.crouching = false;
  f.airAttackUsed = false;
  f.airChain = 0;
  f.airDashUsed = false;
  f.chain = 0;
  f.lastMove = null;
  f.repeat = 0;
  f.dashReq = 0;
  f.bufBtn = 0;
  f.bufAge = 99;
  s.events.push({ t: 'superJump', p: idx });
}

function clampAbs(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Super jump: homes in fast on the airborne victim, then can attack (or ends as a normal jump). */
function runSuperJump(s: GameState, f: FighterState, o: FighterState, idx: number) {
  const lead = 4;
  const tx = o.x + o.vx * lead - f.facing * SJ_GAP;
  const ty = Math.max(0.35, o.y + o.vy * lead - 0.2);
  const dx = clampAbs((tx - f.x) * 0.3, -0.25, 0.25);
  const dy = clampAbs((ty - f.y) * 0.3, -0.2, 0.32);
  f.x += dx;
  f.y += dy;
  if (f.actionFrame >= SJ_ATTACK_FRAME && tryAirMove(s, f, o, idx)) {
    // match the victim's motion so the air string connects
    f.vx = o.vx;
    f.vy = o.action === 'juggle' ? o.vy : 0;
    return;
  }
  if (f.actionFrame >= SJ_FRAMES) toAirborne(f, o.vx, o.action === 'juggle' ? Math.max(0, o.vy) : 0);
}

/** back to a plain jump in mid-air (the jump clip starts on its airborne pose) */
function toAirborne(f: FighterState, vx: number, vy: number) {
  setAction(f, 'jump');
  f.actionFrame = 10;
  f.vx = vx;
  f.vy = vy;
}

/** double-tap forward in the air: one air dash per jump */
function tryAirDash(s: GameState, f: FighterState, idx: number): boolean {
  if (f.dashReq === 0) return false;
  const req = f.dashReq;
  f.dashReq = 0;
  if (req < 0 || f.airDashUsed || f.y < AIR_DASH_MIN_Y) return false;
  setAction(f, 'airDash');
  f.airDashUsed = true;
  // a fresh air attack is allowed after the dash
  f.airAttackUsed = false;
  f.vx = 0;
  f.vy = 0;
  s.events.push({ t: 'airDash', p: idx });
  return true;
}

/** start an air attack from a buffered press (auto-combo route or manual) */
function tryAirMove(s: GameState, f: FighterState, o: FighterState, idx: number): boolean {
  const route = autoNext(f);
  const b = consumeBuffer(f);
  if (!b || f.airAttackUsed || f.airChain >= AIR_CHAIN_MAX) return false;
  let id: MoveId | null;
  let auto = 0;
  if (route && route !== 'superJump' && mv(f, route).air) {
    id = route;
    auto = f.autoStep + 1;
  } else id = chooseAirMove(b.btn, b.dir | (f.rel & R_D));
  if (!id) return false;
  startMove(s, f, o, id, idx, 0, false, auto);
  return true;
}

// ---------------------------------------------------------------------------
// BBL MAX (ultimate)
// ---------------------------------------------------------------------------
function isSuperAction(a: Action) {
  return a === 'superFlash' || a === 'superCombo' || a === 'superVictim';
}

/** Start the BBL MAX if the button was pressed with a full gauge. */
function tryStartSuper(s: GameState, f: FighterState, o: FighterState, idx: number): boolean {
  if (f.superReq <= 0 || f.meter < MAX_METER || f.y > 0.001) return false;
  if (isSuperAction(o.action) || o.action === 'thrown' || o.action === 'throwing') return false;
  f.superReq = 0;
  f.meter = 0;
  setAction(f, 'superFlash');
  f.vx = 0;
  f.crouching = false;
  f.invuln = SUPER_FLASH_FRAMES + 18;
  f.facing = o.x >= f.x ? 1 : -1;
  // the whole world stops while the fighter powers up
  o.frozen = Math.max(o.frozen, SUPER_FLASH_FRAMES);
  s.events.push({ t: 'super', p: idx });
  return true;
}

function startSuperCombo(s: GameState, a: FighterState, v: FighterState, idx: number) {
  setAction(a, 'superCombo');
  setAction(v, 'superVictim');
  a.actionFrame = 1;
  v.actionFrame = 1;
  a.ultOrigin = a.x;
  v.ultBy = a.ult;
  v.facing = (a.facing * -1) as 1 | -1;
  v.crouching = false;
  v.frozen = 0;
  s.events.push({ t: 'superCombo', p: idx });
}

/** Scripted cinematic combo: positions and hits are a pure function of the frame. */
function runSuperCombo(s: GameState, a: FighterState, v: FighterState, idx: number) {
  const u = getUltimate(a.ult);
  // the script plays slower than the game clock: `kt` = smooth script time for positions,
  // events fire when the whole script frame `k` reaches their frame
  const t = a.actionFrame;
  v.actionFrame = t;
  const kt = cineTime(t);
  const k = cineFrame(t);
  const kPrev = cineFrame(t - 1);
  const reached = (f: number) => f > kPrev && f <= k;
  a.vx = a.vy = v.vx = v.vy = 0;
  a.x = a.ultOrigin + a.facing * curve(u.ax, kt);
  a.y = curve(u.ay, kt);
  v.y = curve(u.vy, kt);
  const d = curve(u.dist, kt);
  let vx = a.x + a.facing * d;
  // keep both fighters inside the arena: slide the whole scene back from the wall
  const lim = ARENA_HALF_WIDTH;
  const over = vx > lim ? vx - lim : vx < -lim ? vx + lim : 0;
  if (over !== 0) {
    vx -= over;
    a.x -= over;
    a.ultOrigin -= over;
  }
  const last = u.hits.length - 1;
  // once every blow has landed the attacker may leave on their own (e.g. running away):
  // they stop at the wall instead of dragging the victim along
  const done = last < 0 || k > u.hits[last].f;
  if (a.x > lim || a.x < -lim) {
    const o2 = a.x > lim ? a.x - lim : a.x + lim;
    a.x -= o2;
    if (!done) {
      vx -= o2;
      a.ultOrigin -= o2;
    }
  }
  v.x = vx;
  // the victim faces the attacker, unless the script makes them turn around
  let turned = false;
  if (u.victimTurn) for (const [t0, t1] of u.victimTurn) if (k >= t0 && k < t1) turned = true;
  v.facing = (turned ? a.facing : -a.facing) as 1 | -1;
  for (let i = 0; i <= last; i++) {
    const hit = u.hits[i];
    if (!reached(hit.f)) continue;
    // the victim can only be finished by the last blow (the cinematic always plays out)
    v.hp = i === last ? Math.max(hpFloor(s), v.hp - hit.dmg) : Math.max(1, v.hp - hit.dmg);
    v.comboCount++;
    v.comboDamage += hit.dmg;
    // no freeze for verbal / off-screen blows and bullet bursts (keeps the fire rate)
    const still = hit.kind === 'word' || hit.kind === 'none' || hit.kind === 'shot';
    s.hitstop = Math.max(s.hitstop, i === last ? 16 : still ? 0 : hit.strength === 'heavy' ? 10 : hit.strength === 'medium' ? 6 : 4);
    s.events.push({
      t: 'hit',
      p: idx,
      x: hit.dx !== undefined ? v.x + a.facing * hit.dx : (a.x + v.x) / 2 + a.facing * 0.12,
      y: hit.y < 0 ? v.y + 0.9 : hit.y,
      strength: hit.strength,
      counter: i === last,
      dmg: hit.dmg,
      kind: hit.kind,
    });
  }
  if (u.selfHits) {
    for (const sh of u.selfHits) {
      if (!reached(sh.f)) continue;
      a.hp = Math.max(1, a.hp - sh.dmg);
      s.hitstop = Math.max(s.hitstop, 6);
      s.events.push({ t: 'hit', p: 1 - idx, x: a.x, y: a.y + sh.y, strength: 'medium', counter: false, dmg: sh.dmg, self: true });
    }
  }
  if (reached(u.fall)) s.events.push({ t: 'fall', p: 1 - idx });
  if (k >= u.length) {
    toNeutral(a);
    a.y = 0;
    v.y = 0;
    if (v.hp <= 0) {
      v.koed = true;
      setAction(v, 'ko');
    } else {
      setAction(v, 'knockdown');
    }
  }
}

// ---------------------------------------------------------------------------
// physics
// ---------------------------------------------------------------------------
function gravityOf(f: FighterState): number {
  if (f.action !== 'juggle') return GRAVITY;
  switch (f.flight) {
    case 'wall':
      return WALL_FLIGHT_GRAVITY;
    case 'ko':
      return KO_FLIGHT_GRAVITY;
    case 'bounce':
      return GROUND_BOUNCE_GRAVITY;
    case 'spike':
      return JUGGLE_GRAVITY;
  }
  // juggle decay: the longer the juggle, the faster the fall
  return JUGGLE_GRAVITY * (1 + JUGGLE_GRAVITY_GROWTH * f.juggleCount);
}

function physics(s: GameState, f: FighterState, idx: number) {
  if (f.frozen > 0 || f.action === 'superCombo' || f.action === 'superVictim') return;
  // moved by the state machine
  if (f.action === 'superJump' || f.action === 'airDash' || f.action === 'wallSplat') return;
  const airborne = f.action === 'jump' || f.action === 'airAttack' || f.action === 'juggle' || f.y > 0;
  if (airborne) {
    f.x += f.vx;
    f.y += f.vy;
    f.vy -= gravityOf(f);
    if (f.action === 'juggle') {
      const lim = ARENA_HALF_WIDTH;
      // heavy ender: splat against the wall
      if (f.flight === 'wall' && Math.abs(f.x) >= lim - 0.02 && f.x * f.vx > 0) {
        wallSplat(s, f, idx);
        return;
      }
      // destruction finish: crash through the wall and keep flying a few metres outside
      if (f.flight === 'ko') {
        const side = f.x > 0 ? 1 : -1;
        if (!f.wallBroken && Math.abs(f.x) > lim) {
          f.wallBroken = true;
          s.events.push({ t: 'wallBreak', p: idx, x: side * lim, y: f.y });
        }
        if (Math.abs(f.x) > lim + KO_FLIGHT_OUT) {
          f.x = side * (lim + KO_FLIGHT_OUT);
          f.vx = 0;
        }
      }
    }
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      if (f.action === 'juggle') {
        // airSmash spike: bounce back up once per combo
        if (f.flight === 'spike' && !f.groundBounced && !f.koed) {
          setAction(f, 'juggle');
          f.groundBounced = true;
          f.flight = 'bounce';
          f.y = 0.02;
          f.vy = GROUND_BOUNCE_VY;
          f.vx *= 0.5;
          s.hitstop = Math.max(s.hitstop, 4);
          s.events.push({ t: 'groundBounce', p: idx, x: f.x });
          return;
        }
        if (f.flight === 'ko') f.vx = 0;
        else {
          f.flight = 'none';
          f.vx *= 0.4;
        }
        s.events.push({ t: 'fall', p: idx });
        if (f.koed) {
          setAction(f, 'ko');
        } else {
          setAction(f, 'knockdown');
        }
      } else if (f.action === 'jump' || f.action === 'airAttack') {
        f.vx = 0;
        f.airChain = 0;
        f.airDashUsed = false;
        f.autoStep = 0;
        setAction(f, 'land');
        s.events.push({ t: 'land', p: idx });
      }
    }
  } else {
    f.x += f.vx;
    f.vx *= 0.82;
    if (Math.abs(f.vx) < 0.0005) f.vx = 0;
  }
}

/** Pinned against the wall by a heavy ender (then thrown back into a juggle by the state machine). */
function wallSplat(s: GameState, f: FighterState, idx: number) {
  const side = f.x > 0 ? 1 : -1;
  setAction(f, 'wallSplat');
  f.x = side * ARENA_HALF_WIDTH;
  f.y = Math.max(f.y, 0.3);
  f.vx = 0;
  f.vy = 0;
  f.flight = 'bounce';
  f.wallBounced = true;
  s.hitstop = Math.max(s.hitstop, 6);
  s.events.push({ t: 'wallBounce', p: idx, x: f.x, y: f.y });
}

function resolvePositions(s: GameState) {
  const [a, b] = s.fighters;
  const lim = ARENA_HALF_WIDTH;
  // a K.O.'d fighter in its destruction flight leaves the arena
  const free0 = a.flight === 'ko';
  const free1 = b.flight === 'ko';
  for (const f of s.fighters) {
    if (f.flight === 'ko') continue;
    if (f.x < -lim) f.x = -lim;
    if (f.x > lim) f.x = lim;
  }
  // push boxes (only when both are close to the ground, so jumps can cross a little)
  const thrown =
    a.action === 'thrown' || b.action === 'thrown' || a.action === 'superVictim' || b.action === 'superVictim' || free0 || free1;
  if (!thrown) {
    const dx = b.x - a.x;
    const dist = Math.abs(dx);
    const bothLow = a.y < 0.9 && b.y < 0.9;
    if (bothLow && dist < MIN_SEPARATION) {
      const push = (MIN_SEPARATION - dist) / 2;
      const sign = dx >= 0 ? 1 : -1;
      // a fighter stuck at a wall can't be pushed: move the other one fully
      const aWall = (sign > 0 && a.x - push < -lim) || (sign < 0 && a.x + push > lim);
      const bWall = (sign > 0 && b.x + push > lim) || (sign < 0 && b.x - push < -lim);
      if (aWall) b.x = a.x + sign * MIN_SEPARATION;
      else if (bWall) a.x = b.x - sign * MIN_SEPARATION;
      else {
        a.x -= sign * push;
        b.x += sign * push;
      }
    }
    // the camera can't zoom out forever: limit separation
    const d2 = b.x - a.x;
    if (Math.abs(d2) > MAX_SEPARATION) {
      const excess = (Math.abs(d2) - MAX_SEPARATION) / 2;
      const sign = d2 >= 0 ? 1 : -1;
      a.x += sign * excess;
      b.x -= sign * excess;
    }
  }
  for (const f of s.fighters) {
    if (f.flight === 'ko') continue;
    if (f.x < -lim) f.x = -lim;
    if (f.x > lim) f.x = lim;
  }
}

function updateFacing(s: GameState) {
  const [a, b] = s.fighters;
  for (const [f, o] of [
    [a, b],
    [b, a],
  ] as const) {
    if (isNeutral(f) || f.action === 'land' || f.action === 'getup' || f.action === 'prejump') {
      const d = o.x - f.x;
      if (Math.abs(d) > 0.05) f.facing = d > 0 ? 1 : -1;
    }
  }
}

// ---------------------------------------------------------------------------
// hit detection
// ---------------------------------------------------------------------------
interface PendingHit {
  a: number;
  d: number;
  move: MoveDef;
  blocked: boolean;
  counter: boolean;
  grab: boolean;
  /** deflected by a well-timed guard tap */
  parried?: boolean;
}

/** standing/crouching guard is possible in this state */
function canBlockNow(d: FighterState): boolean {
  return (
    !isAirborne(d) &&
    (d.action === 'idle' ||
      d.action === 'walkB' ||
      d.action === 'crouch' ||
      d.action === 'guard' ||
      d.action === 'blockstun' ||
      d.action === 'parry' ||
      d.action === 'land')
  );
}

/** standing guard stops highs & mids, crouching guard stops lows */
function guardsHeight(d: FighterState, level: Strike['level']): boolean {
  const crouchBlock = isCrouching(d) || (d.rel & R_D) !== 0;
  return level === 'low' ? crouchBlock : !crouchBlock;
}

function isHoldingGuard(d: FighterState): boolean {
  return (d.rel & (R_B | IN_GUARD)) !== 0;
}

/** caught during the startup of an attack (or reeling from a parry) */
function isCounterState(d: FighterState): boolean {
  return ((d.action === 'attack' || d.action === 'airAttack') && !!d.moveId && d.actionFrame < mv(d, d.moveId).startup) || d.action === 'parried';
}

function checkHit(a: FighterState, d: FighterState, ai: number): PendingHit | null {
  if ((a.action !== 'attack' && a.action !== 'airAttack') || !a.moveId || a.moveHit || a.frozen > 0) return null;
  // the projectile throw has no hitbox of its own (the projectile carries the hit)
  if (a.moveId === 'projectile') return null;
  const m = mv(a, a.moveId);
  if (a.actionFrame < m.startup || a.actionFrame >= m.startup + m.active) return null;

  const dx = (d.x - a.x) * a.facing;
  if (dx < -0.1) return null;
  if (dx - BODY_RADIUS > m.reach) return null;

  if (d.invuln > 0 || d.flight === 'ko') return null;
  switch (d.action) {
    case 'knockdown':
    case 'getup':
    case 'ko':
    case 'thrown':
    case 'throwing':
    case 'throwBreak':
    case 'superFlash':
    case 'superCombo':
    case 'superVictim':
    case 'win':
    case 'lose':
      return null;
  }

  const dAir = isAirborne(d);
  const dCrouch = isCrouching(d);

  if (m.throw) {
    if (dAir || dCrouch || d.action === 'hitstun' || d.action === 'juggle') return null;
    return { a: ai, d: 1 - ai, move: m, blocked: false, counter: false, grab: true };
  }

  if (m.air) {
    // air vs air (air combos): both must be at about the same height
    if (dAir) {
      if (Math.abs(a.y - d.y) > 0.95) return null;
    }
    // jumping attacks on a grounded opponent only connect when the attacker is low enough
    else if (a.y > 1.5) return null;
  }
  if (m.level === 'high' && dCrouch && !dAir) return null;
  if (m.level === 'low' && dAir && d.y > 0.3) return null;
  // vertical distance for juggles
  if (dAir && d.y > 1.6 && !m.air) return null;

  // guard: hold back (or the guard button)
  const rightHeight = guardsHeight(d, m.level);
  // parry: guard tapped just before the hit, at the right height
  const canParry = canBlockNow(d) || d.action === 'walkF' || d.action === 'dashB';
  if (d.parryTimer > 0 && canParry && rightHeight) {
    return { a: ai, d: 1 - ai, move: m, blocked: false, counter: false, grab: false, parried: true };
  }
  const blocked = canBlockNow(d) && isHoldingGuard(d) && rightHeight;
  const counter = !blocked && isCounterState(d);
  return { a: ai, d: 1 - ai, move: m, blocked, counter, grab: false };
}

/** blockstun + pushback for a guarded blow (fighters and assists) */
function applyBlock(s: GameState, di: number, d: FighterState, m: Strike, dir: 1 | -1, hx: number, hy: number) {
  d.action = 'blockstun';
  d.actionFrame = 0;
  d.moveId = null;
  d.crouching = isCrouching(d) || (d.rel & R_D) !== 0;
  d.stun = m.blockstun;
  d.stunTotal = m.blockstun;
  d.hitLevel = m.level;
  d.vx = dir * m.pushBlock;
  d.meter = Math.min(MAX_METER, d.meter + 3);
  s.hitstop = Math.max(s.hitstop, 5);
  s.events.push({ t: 'block', p: di, x: hx, y: hy });
  // the guard wears down; empty = guard crush
  d.guard -= GUARD_DRAIN[m.strength] * prof(d).guardDrain;
  d.guardDelay = GUARD_DELAY;
  if (d.guard <= 0) guardCrush(s, di, d, dir);
}

/** The guard gauge emptied on a blocked blow: staggered and wide open, then the gauge comes back full. */
function guardCrush(s: GameState, di: number, d: FighterState, dir: 1 | -1) {
  setAction(d, 'guardCrush');
  d.guard = 0;
  d.guardDelay = 0;
  d.stun = GUARD_CRUSH_FRAMES;
  d.stunTotal = GUARD_CRUSH_FRAMES;
  d.crouching = false;
  d.vx = dir * GUARD_CRUSH_PUSH;
  d.parryTimer = 0;
  s.hitstop = Math.max(s.hitstop, GUARD_CRUSH_HITSTOP);
  s.events.push({ t: 'guardBreak', p: di, x: d.x, y: 1.2 });
}

/** guard gauge: back to full after a crush, refills after a pause without blocking */
function updateGuard(f: FighterState) {
  if (f.action === 'guardCrush') return;
  if (f.guard <= 0) {
    // the crush is over (or was interrupted by a hit): the gauge comes back full
    f.guard = f.guardMax;
    f.guardDelay = 0;
    return;
  }
  if (f.action === 'blockstun') return;
  if (f.guardDelay > 0) {
    f.guardDelay--;
    return;
  }
  if (f.guard < f.guardMax) f.guard = Math.min(f.guardMax, f.guard + (f.guardMax * prof(f).guardRefill) / GUARD_REFILL_FRAMES);
}

/** a parry gives back a little guard */
function parryGuard(d: FighterState) {
  d.guard = Math.min(d.guardMax, d.guard + GUARD_PARRY_BONUS);
}

/** training mode: nobody can be K.O.'d */
function hpFloor(s: GameState): number {
  return s.training ? 1 : 0;
}

interface HitOpts {
  counter: boolean;
  /** extra damage multiplier (auto-combo steps) */
  scale: number;
  /** heavy ender: sends the victim flying toward the wall (wall bounce, once per combo) */
  wallBounce: boolean;
  /** the blow is a destruction-finish candidate even if not heavy (assists) */
  finisher: boolean;
}

function comboScale(n: number): number {
  return Math.max(SCALE_MIN, 1 - SCALE_STEP * n);
}

/** ground hitstun decay: long combos drop by themselves */
function hitstunScale(n: number): number {
  return n <= HITSTUN_FREE ? 1 : Math.max(HITSTUN_MIN_SCALE, 1 - HITSTUN_DECAY * (n - HITSTUN_FREE));
}

/**
 * A blow connects (not blocked): damage with combo scaling, then the victim's reaction
 * (hitstun with decay, juggle with decay, spike / wall flight, K.O. flight).
 * `oi` = index of the fighter credited with the hit (the attacker, or an assist's caller).
 * Returns the damage dealt.
 */
function landHit(s: GameState, oi: number, d: FighterState, m: Strike, dir: 1 | -1, hx: number, hy: number, o: HitOpts): number {
  const owner = s.fighters[oi];
  const dAir = isAirborne(d);
  const n = d.comboCount;
  let scale = comboScale(n) * o.scale;
  if (dAir) scale *= AIR_DAMAGE;
  if (o.counter) scale *= COUNTER_DAMAGE;
  const dmg = m.damage > 0 ? Math.max(1, Math.round(m.damage * scale)) : 0;
  d.hp = Math.max(hpFloor(s), d.hp - dmg);
  d.comboCount++;
  d.comboDamage += dmg;
  d.meter = Math.min(MAX_METER, d.meter + dmg * 0.45);
  d.counterHit = o.counter;
  d.hitLevel = m.level;
  d.moveHit = false;
  d.frozen = 0;
  d.dizzy = false;
  // the victim's own pending options are gone
  d.autoStep = 0;
  d.sjWindow = 0;
  const wasCrouch = isCrouching(d);
  const jc = d.juggleCount;
  const lift = Math.max(0, 1 - jc / JUGGLE_LIMIT);

  if (d.hp <= 0) {
    d.koed = true;
    setAction(d, 'juggle');
    d.crouching = false;
    d.y = Math.max(d.y, 0.02);
    if (m.strength === 'heavy' || !!m.launch || o.wallBounce || o.counter || o.finisher) {
      // destruction finish: blown away through the arena wall (slow motion during the K.O. phase)
      d.flight = 'ko';
      d.vy = KO_FLIGHT_VY;
      const target = dir * (ARENA_HALF_WIDTH + KO_FLIGHT_OUT);
      const t = (2 * KO_FLIGHT_VY) / KO_FLIGHT_GRAVITY;
      d.vx = dir * Math.max(0.12, Math.abs(target - d.x) / t);
    } else {
      d.flight = 'none';
      d.vy = Math.max(m.launch ?? 0, 0.11);
      d.vx = dir * 0.055;
    }
  } else if (m.id === 'airSmash' && dAir) {
    // spiked to the floor: bounces once per combo (see physics), a second spike is a plain knockdown
    setAction(d, 'juggle');
    d.flight = 'spike';
    d.vy = SPIKE_VY;
    d.vx = dir * 0.02;
    d.y = Math.max(d.y, 0.02);
    d.juggleCount++;
    d.crouching = false;
  } else if (o.wallBounce && !d.wallBounced) {
    // heavy ender: flies toward the wall (splat if it gets there, knockdown otherwise)
    setAction(d, 'juggle');
    d.flight = 'wall';
    d.vy = WALL_FLIGHT_VY;
    d.vx = dir * WALL_FLIGHT_VX;
    d.y = Math.max(d.y, 0.02);
    d.juggleCount++;
    d.crouching = false;
  } else if (m.launch || dAir || m.knockdown) {
    setAction(d, 'juggle');
    d.flight = 'none';
    // juggle decay: the lift fades with every juggle hit, and a falling victim keeps
    // (part of) its fall instead of being caught in mid-air
    const fall = (1 - lift) * Math.min(d.vy, 0);
    if (m.launch) {
      d.vy = m.launch * lift + fall;
      // a fresh launch opens the super jump window (one air combo per combo)
      if (jc <= SJ_MAX_JUGGLE) owner.sjWindow = SJ_WINDOW;
    } else if (dAir) d.vy = (m.air ? AIR_COMBO_LIFT : JUGGLE_LIFT) * lift + fall;
    else d.vy = 0.075;
    d.vx = dir * (m.knockdown && !m.launch ? 0.05 : m.pushHit * 0.35 + 0.012);
    d.y = Math.max(d.y, 0.02);
    d.juggleCount++;
    d.crouching = false;
  } else {
    setAction(d, 'hitstun');
    d.flight = 'none';
    d.crouching = wasCrouch;
    d.stun = Math.max(1, Math.round((m.hitstun + (o.counter ? 6 : 0)) * hitstunScale(n)));
    d.stunTotal = d.stun;
    d.vx = dir * m.pushHit;
  }

  s.hitstop = Math.max(s.hitstop, HITSTOP[m.strength] + (o.counter ? 3 : 0));
  s.events.push({ t: 'hit', p: oi, x: hx, y: hy, strength: m.strength, counter: o.counter, dmg });
  return dmg;
}

function applyHit(s: GameState, h: PendingHit) {
  const a = s.fighters[h.a];
  const d = s.fighters[h.d];
  // the other fighter's BBL MAX cinematic started on this very frame
  if (a.action === 'superVictim' || d.action === 'superCombo') return;
  const m = h.move;
  a.moveHit = true;
  const hx = a.x + a.facing * Math.min(m.reach, Math.abs(d.x - a.x) - 0.1);
  const hy = isAirborne(d) ? d.y + 0.9 : m.hitY;

  if (h.parried) {
    // the attacker is thrown off balance, the defender can punish
    setAction(a, 'parried');
    a.stun = PARRIED_STUN;
    a.stunTotal = PARRIED_STUN;
    a.vx = -a.facing * 0.05;
    a.crouching = false;
    setAction(d, 'parry');
    d.vx = 0;
    d.parryTimer = 0;
    d.parryCooldown = 0;
    d.meter = Math.min(MAX_METER, d.meter + 8);
    parryGuard(d);
    s.hitstop = Math.max(s.hitstop, 10);
    s.events.push({ t: 'parry', p: h.d, x: hx, y: hy });
    return;
  }

  if (h.grab) {
    s.events.push({ t: 'grab', p: h.a });
    setAction(a, 'throwing');
    setAction(d, 'thrown');
    d.facing = (a.facing * -1) as 1 | -1;
    d.vx = 0;
    a.vx = 0;
    d.crouching = false;
    return;
  }

  if (h.blocked) {
    applyBlock(s, h.d, d, m, a.facing, hx, hy);
    if (Math.abs(d.x) > ARENA_HALF_WIDTH - 0.3 && Math.sign(d.x) === a.facing) a.vx = -a.facing * m.pushBlock * 0.8;
    a.meter = Math.min(MAX_METER, a.meter + 2);
    return;
  }

  const atWall = Math.abs(d.x) > ARENA_HALF_WIDTH - 0.3 && Math.sign(d.x) === a.facing;
  const dAir = isAirborne(d);
  // heavy enders: powerPunch / roundhouse at the end of a chain or on a counter hit send the victim flying
  const ender = (m.id === 'powerPunch' || m.id === 'roundhouse') && (a.chain >= 2 || h.counter);
  const dmg = landHit(s, h.a, d, m, a.facing, hx, hy, {
    counter: h.counter,
    scale: a.autoStep >= 2 ? AUTO_DAMAGE : 1,
    wallBounce: ender,
    finisher: false,
  });
  a.meter = Math.min(MAX_METER, a.meter + dmg * 0.6);
  if (atWall) a.vx = -a.facing * m.pushHit * 0.7;
  if (m.air && dAir && d.action === 'juggle' && !d.koed) {
    if (d.flight === 'spike') {
      // after the smash the attacker drops down to follow the bounce
      a.vy = Math.min(a.vy, -0.04);
    } else {
      // air combos: the attacker floats along with the victim (it falls a little slower)
      a.vy = d.vy * 0.85;
      a.vx = d.vx;
    }
  }

  // BBL MAX dash strike connected: cinematic combo
  if (m.id === 'super' && d.hp > 0) startSuperCombo(s, a, d, h.a);
}

// ---------------------------------------------------------------------------
// assists
// ---------------------------------------------------------------------------
function superRunning(s: GameState): boolean {
  return isSuperAction(s.fighters[0].action) || isSuperAction(s.fighters[1].action);
}

/** the caller must be free (not hit, not knocked down, not thrown, not in a cinematic) */
function canCallAssist(f: FighterState): boolean {
  if (f.koed || f.frozen > 0) return false;
  switch (f.action) {
    case 'hitstun':
    case 'blockstun':
    case 'juggle':
    case 'knockdown':
    case 'getup':
    case 'thrown':
    case 'throwing':
    case 'throwBreak':
    case 'wallSplat':
    case 'parried':
    case 'guardCrush':
    case 'superFlash':
    case 'superCombo':
    case 'superVictim':
    case 'ko':
    case 'win':
    case 'lose':
    case 'intro':
      return false;
  }
  return true;
}

function callAssist(s: GameState, i: number, as: AssistState) {
  const f = s.fighters[i];
  const o = s.fighters[1 - i];
  const dir: 1 | -1 = o.x >= f.x ? 1 : -1;
  as.phase = 'enter';
  as.frame = 0;
  as.hit = false;
  as.shot = false;
  as.shotX = 0;
  as.cooldown = ASSIST_COOLDOWN;
  as.facing = dir;
  // launcher / stun pop up right in front of the opponent, rush / beam come from behind the caller
  as.x = as.kind === 'launcher' || as.kind === 'stun' ? o.x - dir * 0.7 : f.x - dir * 0.85;
  as.x = clampAbs(as.x, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
  as.y = 0;
  f.assistReq = 0;
  s.events.push({ t: 'assist', p: i });
}

function assistLeave(s: GameState, i: number, as: AssistState) {
  as.phase = 'leave';
  as.frame = 0;
  s.events.push({ t: 'assistLeave', p: i });
}

/** can an assist's blow touch this fighter right now? */
function assistCanTouch(d: FighterState): boolean {
  if (d.invuln > 0 || d.flight === 'ko' || d.koed) return false;
  switch (d.action) {
    case 'knockdown':
    case 'getup':
    case 'ko':
    case 'thrown':
    case 'throwing':
    case 'throwBreak':
    case 'superFlash':
    case 'superCombo':
    case 'superVictim':
    case 'win':
    case 'lose':
      return false;
  }
  return true;
}

/** an assist's blow reaches the opponent: normal hit pipeline (blockable, never parried), counts in the caller's combo */
function assistStrike(s: GameState, i: number, as: AssistState, m: AssistMove, hx: number) {
  const d = s.fighters[1 - i];
  const caller = s.fighters[i];
  as.hit = true;
  const hy = isAirborne(d) ? d.y + 0.9 : m.hitY;
  if (canBlockNow(d) && isHoldingGuard(d) && guardsHeight(d, m.level)) {
    applyBlock(s, 1 - i, d, m, as.facing, hx, hy);
    caller.meter = Math.min(MAX_METER, caller.meter + 1);
    return;
  }
  const dmg = landHit(s, i, d, m, as.facing, hx, hy, {
    counter: isCounterState(d),
    scale: 1,
    wallBounce: as.kind === 'rush',
    finisher: as.kind !== 'stun',
  });
  caller.meter = Math.min(MAX_METER, caller.meter + dmg * 0.3);
}

/** stun assist: a goofy distraction. Guarded = pushback, otherwise a long dizzy (no damage) */
function assistDizzy(s: GameState, i: number, as: AssistState, m: AssistMove) {
  const d = s.fighters[1 - i];
  as.hit = true;
  const hx = d.x - as.facing * 0.2;
  if (canBlockNow(d) && isHoldingGuard(d)) {
    applyBlock(s, 1 - i, d, m, as.facing, hx, 1.5);
    return;
  }
  const n = d.comboCount;
  setAction(d, 'hitstun');
  d.crouching = false;
  // a free opener; it shrinks a lot when used to extend a combo
  d.stun = Math.max(8, Math.round(m.hitstun * Math.max(DIZZY_DECAY, 1 - DIZZY_DECAY * n)));
  d.stunTotal = d.stun;
  d.hitLevel = 'mid';
  d.dizzy = true;
  d.vx = 0;
  d.counterHit = false;
  d.moveHit = false;
  d.frozen = 0;
  d.autoStep = 0;
  d.sjWindow = 0;
  d.flight = 'none';
  d.comboCount++;
  s.hitstop = Math.max(s.hitstop, 6);
  // a verbal blow: no spark (see HitKind 'word')
  s.events.push({ t: 'hit', p: i, x: hx, y: 1.6, strength: 'light', counter: false, dmg: 0, kind: 'word' });
}

function runAssistAttack(s: GameState, i: number, as: AssistState, m: AssistMove, o: FighterState) {
  const t = as.frame;
  switch (as.kind) {
    case 'rush': {
      if (as.hit || t <= m.startup || t > m.startup + m.active) return;
      as.x = clampAbs(as.x + as.facing * RUSH_SPEED, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
      const dx = (o.x - as.x) * as.facing;
      if (dx <= m.reach + BODY_RADIUS && dx >= -0.2 && o.y < 1.6 && assistCanTouch(o)) assistStrike(s, i, as, m, as.x + as.facing * Math.max(0, dx - 0.1));
      return;
    }
    case 'launcher':
    case 'stun': {
      if (as.hit || t < m.startup || t >= m.startup + m.active) return;
      const dx = (o.x - as.x) * as.facing;
      if (dx > m.reach + BODY_RADIUS || dx < -0.3 || !assistCanTouch(o)) return;
      if (as.kind === 'launcher') {
        if (o.y < 1.6) assistStrike(s, i, as, m, as.x + as.facing * Math.max(0, dx - 0.1));
      } else if (!isAirborne(o)) assistDizzy(s, i, as, m);
      return;
    }
    case 'beam':
      if (t === m.startup) {
        as.shot = true;
        as.shotX = as.x + as.facing * 0.5;
      }
      return;
  }
}

/**
 * Assists: enter (poof in, untouchable) -> attack -> leave -> off. `live` = during the fight
 * (otherwise: K.O. / round over, the assists just leave).
 */
function updateAssists(s: GameState, live: boolean) {
  const sup = superRunning(s);
  for (let i = 0; i < 2; i++) {
    const as = s.assists[i];
    if (!as) continue;
    if (live && as.cooldown > 0) as.cooldown--;
    const o = s.fighters[1 - i];
    const m = ASSIST_MOVES[as.kind];
    // a BBL MAX cinematic or the end of the round sends the assist away
    if (!live || sup) {
      as.shot = false;
      if (as.phase === 'enter' || as.phase === 'attack') assistLeave(s, i, as);
    }
    // beam projectile: travels until the first contact or the edge of the arena
    if (as.shot) {
      as.shotX += as.facing * BEAM_SPEED;
      const dx = (o.x - as.shotX) * as.facing;
      if (dx <= m.reach && dx >= -m.reach && o.y < BEAM_Y - 0.3 && assistCanTouch(o)) {
        as.shot = false;
        assistStrike(s, i, as, m, as.shotX);
      } else if (Math.abs(as.shotX) > ARENA_HALF_WIDTH + 0.5) as.shot = false;
    }
    if (as.phase === 'off') continue;
    as.frame++;
    switch (as.phase) {
      case 'enter':
        if (as.frame >= m.enter) {
          as.phase = 'attack';
          as.frame = 0;
        }
        break;
      case 'attack':
        runAssistAttack(s, i, as, m, o);
        if (as.frame >= m.total) assistLeave(s, i, as);
        break;
      case 'leave':
        if (as.frame >= m.leave) {
          as.phase = 'off';
          as.frame = 0;
        }
        break;
    }
  }
}

function tryCallAssists(s: GameState) {
  const sup = superRunning(s);
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i];
    if (f.assistReq <= 0) continue;
    const as = s.assists[i];
    if (as && !sup && as.phase === 'off' && as.cooldown === 0 && !as.shot && canCallAssist(f)) callAssist(s, i, as);
    else f.assistReq--;
  }
}

// ---------------------------------------------------------------------------
// projectiles (ranged profile)
// ---------------------------------------------------------------------------
/** the projectile throw reached its active frame: one projectile per owner on screen */
function spawnProjectile(s: GameState, f: FighterState, idx: number) {
  if (s.projectiles[idx]) return;
  const p: ProjectileState = { owner: idx as 0 | 1, x: f.x + f.facing * PROJ_SPAWN, y: PROJ_Y, vx: f.facing * PROJ_SPEED, frame: 0 };
  s.projectiles[idx] = p;
  s.events.push({ t: 'projectile', p: idx, x: p.x, y: p.y });
}

function endProjectile(s: GameState, i: number, how: 'hit' | 'block' | 'clash' | 'out', x: number) {
  const p = s.projectiles[i];
  if (!p) return;
  s.projectiles[i] = null;
  s.events.push({ t: 'projectileEnd', p: i, x, y: p.y, how });
}

/** the projectile reaches the opponent: parried, blocked (drains the guard) or a hit (combo scaling, counter hits) */
function projectileContact(s: GameState, i: number, p: ProjectileState) {
  const d = s.fighters[1 - i];
  const owner = s.fighters[i];
  const dir: 1 | -1 = p.vx >= 0 ? 1 : -1;
  const dx = (d.x - p.x) * dir;
  if (dx > PROJ_RADIUS + BODY_RADIUS || dx < -(PROJ_RADIUS + BODY_RADIUS)) return;
  // jumped over, or untouchable (knocked down, getting up, thrown, cinematic...)
  if (d.y >= PROJ_CLEAR_Y || !assistCanTouch(d)) return;
  const m = moveFor(owner.archetype, 'projectile');
  const hx = d.x - dir * BODY_RADIUS;
  const hy = p.y;
  // like a fireball: guarded (or parried) standing or crouching, crouching doesn't dodge it
  const canParry = canBlockNow(d) || d.action === 'walkF' || d.action === 'dashB';
  if (d.parryTimer > 0 && canParry) {
    setAction(d, 'parry');
    d.vx = 0;
    d.parryTimer = 0;
    d.parryCooldown = 0;
    d.meter = Math.min(MAX_METER, d.meter + 8);
    parryGuard(d);
    s.hitstop = Math.max(s.hitstop, 8);
    s.events.push({ t: 'parry', p: 1 - i, x: hx, y: hy });
    endProjectile(s, i, 'block', hx);
    return;
  }
  // guard: hold away from the projectile (or the guard button)
  const away = dir === -d.facing ? R_B : R_F;
  if (canBlockNow(d) && (d.rel & (away | IN_GUARD)) !== 0) {
    applyBlock(s, 1 - i, d, m, dir, hx, hy);
    owner.meter = Math.min(MAX_METER, owner.meter + 2);
    endProjectile(s, i, 'block', hx);
    return;
  }
  const dmg = landHit(s, i, d, m, dir, hx, hy, { counter: isCounterState(d), scale: 1, wallBounce: false, finisher: false });
  owner.meter = Math.min(MAX_METER, owner.meter + dmg * 0.5);
  endProjectile(s, i, 'hit', hx);
}

/**
 * Projectiles fly straight; two opposite ones clash; they leave at the edge of the arena.
 * `live` = during the fight (otherwise they just fly away without touching anyone).
 * A BBL MAX sends them away (like the assists).
 */
function updateProjectiles(s: GameState, live: boolean) {
  if (superRunning(s)) {
    for (let i = 0; i < 2; i++) {
      const p = s.projectiles[i];
      if (p) endProjectile(s, i, 'out', p.x);
    }
    return;
  }
  for (const p of s.projectiles) {
    if (!p) continue;
    p.x += p.vx;
    p.frame++;
  }
  const [p0, p1] = s.projectiles;
  if (live && p0 && p1 && p0.vx * p1.vx < 0 && (p1.x - p0.x) * (p0.vx > 0 ? 1 : -1) <= 2 * PROJ_RADIUS) {
    const mid = (p0.x + p1.x) / 2;
    endProjectile(s, 0, 'clash', mid);
    endProjectile(s, 1, 'clash', mid);
  }
  for (let i = 0; i < 2; i++) {
    const p = s.projectiles[i];
    if (!p) continue;
    if (live) projectileContact(s, i, p);
    if (s.projectiles[i] && Math.abs(p.x) > ARENA_HALF_WIDTH + 0.6) endProjectile(s, i, 'out', p.x);
  }
}

// ---------------------------------------------------------------------------
// phases
// ---------------------------------------------------------------------------
function setPhase(s: GameState, p: Phase) {
  s.phase = p;
  s.phaseFrame = 0;
  s.events.push({ t: 'phase', phase: p, round: s.round });
}

function resetRound(s: GameState) {
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i];
    const wins = f.wins;
    const meter = f.meter;
    const ult = f.ult;
    const archetype = f.archetype;
    Object.assign(f, createFighter(i as 0 | 1));
    f.wins = wins;
    f.meter = meter;
    f.ult = ult;
    f.archetype = archetype;
    applyProfile(f);
  }
  s.projectiles[0] = null;
  s.projectiles[1] = null;
  for (const as of s.assists) {
    if (!as) continue;
    as.phase = 'off';
    as.frame = 0;
    as.hit = false;
    as.shot = false;
    as.shotX = 0;
    as.cooldown = 0;
  }
  s.timer = ROUND_TIME;
  s.hitstop = 0;
  s.roundWinner = -1;
  s.timeUp = false;
}

function endRound(s: GameState, winner: number) {
  s.roundWinner = winner;
  const [a, b] = s.fighters;
  if (winner === 0 || winner === 2) a.wins++;
  if (winner === 1 || winner === 2) b.wins++;
  if (winner !== 2) {
    const w = s.fighters[winner];
    if (w.hp >= w.maxHp) s.events.push({ t: 'perfect' });
  }
  setPhase(s, 'roundOver');
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i];
    if (f.action === 'ko' || f.action === 'knockdown' || f.action === 'juggle') continue;
    if (winner === i) {
      setAction(f, 'win');
      f.variant = (s.round + i) % 3;
    } else if (winner !== 2) setAction(f, 'lose');
    else setAction(f, 'idle');
  }
}

/**
 * Advance the game by one frame (1/60 s) with the inputs of both players.
 * Events produced during the frame are left in `s.events`.
 */
export function step(s: GameState, inputs: readonly [number, number]) {
  s.events.length = 0;
  s.frame++;
  s.phaseFrame++;
  const [a, b] = s.fighters;

  switch (s.phase) {
    case 'intro': {
      for (const f of s.fighters) f.actionFrame++;
      // any button skips the intro after a short moment
      const anyPress = s.fighters.some((f, i) => {
        const now = inputs[i] & IN_BUTTONS;
        const pressed = now & ~(f.prevRel & IN_BUTTONS);
        f.prevRel = now;
        return pressed !== 0;
      });
      if (s.phaseFrame >= INTRO_FRAMES || (anyPress && s.phaseFrame > 40)) {
        for (const f of s.fighters) setAction(f, 'idle');
        setPhase(s, 'roundIntro');
      }
      return;
    }

    case 'roundIntro':
      for (let i = 0; i < 2; i++) processInput(s, s.fighters[i], 0);
      for (const f of s.fighters) f.actionFrame++;
      if (s.phaseFrame === FIGHT_CALL_FRAME) s.events.push({ t: 'fight' });
      if (s.phaseFrame >= ROUND_INTRO_FRAMES) {
        for (const f of s.fighters) {
          f.rel = 0;
          f.prevRel = 0;
          f.dirHist.length = 0;
        }
        setPhase(s, 'fight');
      }
      return;

    case 'fight':
      runFight(s, inputs);
      return;

    case 'ko': {
      // slow motion: fighters only advance every 3rd frame for a while
      const slow = s.phaseFrame < 54 && s.phaseFrame % 3 !== 0;
      if (!slow) {
        for (let i = 0; i < 2; i++) processInput(s, s.fighters[i], 0);
        const stopped = s.hitstop > 0;
        simulateFighters(s);
        if (!stopped) updateProjectiles(s, false);
        updateAssists(s, false);
      }
      if (s.phaseFrame >= KO_FRAMES) {
        let winner: number;
        if (a.koed && b.koed) winner = 2;
        else winner = a.koed ? 1 : 0;
        endRound(s, winner);
      }
      return;
    }

    case 'roundOver': {
      const stopped = s.hitstop > 0;
      simulateFighters(s);
      if (!stopped) updateProjectiles(s, false);
      updateAssists(s, false);
      // a winner that was still on the floor celebrates once back up
      for (let i = 0; i < 2; i++) {
        const f = s.fighters[i];
        if (f.action === 'idle') {
          if (s.roundWinner === i) {
            setAction(f, 'win');
            f.variant = (s.round + i) % 3;
          } else if (s.roundWinner === 1 - i) setAction(f, 'lose');
        }
      }
      if (s.phaseFrame >= ROUND_OVER_FRAMES) {
        const need = s.roundsToWin;
        if (a.wins >= need || b.wins >= need) {
          if (a.wins >= need && b.wins >= need) s.matchWinner = 2;
          else s.matchWinner = a.wins >= need ? 0 : 1;
          setPhase(s, 'matchOver');
        } else {
          s.round++;
          resetRound(s);
          setPhase(s, 'roundIntro');
        }
      }
      return;
    }

    case 'matchOver':
      for (const f of s.fighters) f.actionFrame++;
      return;
  }
}

function simulateFighters(s: GameState) {
  const [a, b] = s.fighters;
  if (s.hitstop > 0) {
    s.hitstop--;
    return;
  }
  for (const f of s.fighters) {
    if (f.action === 'win' || f.action === 'lose' || f.action === 'ko') {
      f.actionFrame++;
      continue;
    }
    // automatic transitions without new inputs
    updateFighterPassive(s, f, f === a ? b : a, f === a ? 0 : 1);
  }
  physics(s, a, 0);
  physics(s, b, 1);
  resolvePositions(s);
}

/** During KO / round over the fighters keep falling, getting up, recovering. */
function updateFighterPassive(s: GameState, f: FighterState, o: FighterState, idx: number) {
  f.rel = 0;
  f.bufBtn = 0;
  if (f.action === 'idle' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'crouch') {
    f.actionFrame++;
    if (f.action !== 'idle') setAction(f, 'idle');
    return;
  }
  // Don't let attacks connect any more but let animations finish
  if (f.action === 'attack' || f.action === 'airAttack') f.moveHit = true;
  updateFighter(s, f, o, idx);
}

function runFight(s: GameState, inputs: readonly [number, number]) {
  const [a, b] = s.fighters;
  processInput(s, a, inputs[0]);
  processInput(s, b, inputs[1]);

  if (s.hitstop > 0) {
    s.hitstop--;
    return;
  }

  tryCallAssists(s);
  updateGuard(a);
  updateGuard(b);
  updateFighter(s, a, b, 0);
  updateFighter(s, b, a, 1);
  physics(s, a, 0);
  physics(s, b, 1);
  resolvePositions(s);
  updateFacing(s);

  // simultaneous hit detection (trades are possible)
  const h1 = checkHit(a, b, 0);
  const h2 = checkHit(b, a, 1);
  // a throw loses to a strike that connects on the same frame
  if (h1 && h2 && h1.grab !== h2.grab) {
    applyHit(s, h1.grab ? h2 : h1);
  } else {
    if (h1) applyHit(s, h1);
    if (h2) applyHit(s, h2);
  }
  updateProjectiles(s, true);
  updateAssists(s, true);

  // the clock and KOs wait for the BBL MAX cinematic to finish
  if (isSuperAction(a.action) || isSuperAction(b.action)) return;
  // training: the clock never runs out
  if (!s.training) s.timer--;

  // KO / time up
  const aDead = a.hp <= 0;
  const bDead = b.hp <= 0;
  if (aDead || bDead) {
    if (aDead) {
      a.koed = true;
      s.events.push({ t: 'ko', p: 0 });
    }
    if (bDead) {
      b.koed = true;
      s.events.push({ t: 'ko', p: 1 });
    }
    setPhase(s, 'ko');
    return;
  }
  if (s.timer <= 0) {
    s.timer = 0;
    s.timeUp = true;
    s.events.push({ t: 'timeUp' });
    const winner = a.hp === b.hp ? 2 : a.hp > b.hp ? 0 : 1;
    endRound(s, winner);
  }
}

/** Small deterministic checksum of the gameplay-relevant state (desync detection). */
export function checksum(s: GameState): number {
  let h = s.frame | 0;
  const mix = (v: number) => {
    h = (Math.imul(h ^ Math.round(v * 1000), 2654435761) + 0x9e3779b9) | 0;
  };
  for (const f of s.fighters) {
    mix(f.x);
    mix(f.y);
    mix(f.hp);
    mix(f.actionFrame);
    mix(f.meter);
    mix(f.guard);
    mix(f.guardDelay);
    mix(f.maxHp);
  }
  for (const p of s.projectiles) {
    if (!p) mix(-99);
    else {
      mix(p.x);
      mix(p.frame);
    }
  }
  for (const as of s.assists) {
    if (!as) continue;
    mix(as.frame);
    mix(as.x);
    mix(as.cooldown);
    mix(as.shot ? as.shotX : -99);
  }
  mix(s.timer);
  return h >>> 0;
}
