import { MOVES, moveTotal, type MoveDef } from './moves';
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
  IN_UP,
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
  type Action,
  type FighterState,
  type GameState,
  type MoveId,
  type Phase,
} from './types';

// ---------------------------------------------------------------------------
// tuning
// ---------------------------------------------------------------------------
const GRAVITY = 0.0088;
const JUGGLE_GRAVITY = 0.0094;
const JUMP_VY = 0.142;
const JUMP_VX = 0.046;
const WALK_F = 0.034;
const WALK_B = 0.027;
const DASH_F_FRAMES = 15;
const DASH_B_FRAMES = 18;
const PREJUMP_FRAMES = 4;
const LAND_FRAMES = 4;
const BUFFER_FRAMES = 6;
const DOUBLE_TAP_FRAMES = 12;
const KNOCKDOWN_MIN = 26;
const KNOCKDOWN_MAX = 62;
const GETUP_FRAMES = 26;
const THROW_FRAMES = 58;
const THROW_SLAM_FRAME = 34;
const THROW_BREAK_WINDOW = 10;
const HITSTOP = { light: 6, medium: 8, heavy: 12 } as const;

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
  };
}

export interface MatchOptions {
  roundsToWin?: number;
  skipIntro?: boolean;
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
    events: [],
    roundWinner: -1,
    matchWinner: -1,
    skipIntro: !!opts.skipIntro,
    timeUp: false,
  };
  for (const f of s.fighters) setAction(f, s.phase === 'intro' ? 'intro' : 'idle');
  return s;
}

export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
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
  return r | (input & IN_BUTTONS);
}

function isAirborne(f: FighterState): boolean {
  return f.action === 'jump' || f.action === 'airAttack' || f.action === 'juggle' || f.y > 0.12;
}

function isCrouching(f: FighterState): boolean {
  if (f.action === 'crouch') return true;
  if ((f.action === 'hitstun' || f.action === 'blockstun') && f.crouching) return true;
  if (f.action === 'attack' && f.moveId && MOVES[f.moveId].crouching) return true;
  return false;
}

function isNeutral(f: FighterState): boolean {
  return f.action === 'idle' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'crouch';
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
  if (qcf && (btn & (IN_RP | IN_LP)) && f.meter >= MAX_METER) return 'super';
  const down = (dir & R_D) !== 0;
  const fwd = (dir & R_F) !== 0;
  if (down) {
    if (btn & IN_RP) return 'uppercut';
    if (btn & IN_RK) return 'sweep';
    if (btn & IN_LK) return 'lowKick';
    if (btn & IN_LP) return fwd ? 'elbow' : 'crouchJab';
  }
  if (fwd) {
    if (btn & IN_RP) return 'powerPunch';
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

function chooseAirMove(btn: number): MoveId | null {
  if (btn & (IN_LK | IN_RK)) return 'jumpKick';
  if (btn & (IN_LP | IN_RP)) return 'jumpPunch';
  return null;
}

function startMove(s: GameState, f: FighterState, o: FighterState, id: MoveId, idx: number) {
  const m = MOVES[id];
  if (m.meterCost) {
    if (f.meter < m.meterCost) return;
    f.meter -= m.meterCost;
  }
  f.action = m.air ? 'airAttack' : 'attack';
  f.actionFrame = 1;
  f.moveId = id;
  f.moveHit = false;
  f.crouching = !!m.crouching;
  if (m.air) f.airAttackUsed = true;
  if (!m.air) f.vx = 0;
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

  const pressed = f.rel & ~f.prevRel & IN_BUTTONS;
  if (pressed) {
    // presses within 2 frames are merged (for LP+LK throws)
    f.bufBtn = (f.bufAge <= 2 ? f.bufBtn : 0) | pressed;
    f.bufDir = dir;
    f.bufQcf = detectQcf(f.dirHist);
    f.bufAge = 0;
  } else if (f.bufAge < 99) {
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

  switch (f.action) {
    case 'idle':
    case 'walkF':
    case 'walkB':
    case 'crouch':
      neutral(s, f, o, idx, dir);
      break;

    case 'prejump':
      if (f.actionFrame >= PREJUMP_FRAMES) {
        setAction(f, 'jump');
        f.vy = JUMP_VY;
        f.vx = f.jumpDir * f.facing * JUMP_VX;
        f.y = 0.01;
        f.airAttackUsed = false;
      }
      break;

    case 'jump': {
      const b = consumeBuffer(f);
      if (b && !f.airAttackUsed) {
        const id = chooseAirMove(b.btn);
        if (id) startMove(s, f, o, id, idx);
      }
      break;
    }

    case 'airAttack':
      if (f.moveId) {
        const m = MOVES[f.moveId];
        if (f.actionFrame === m.startup) s.events.push({ t: 'whiff', p: idx, heavy: m.strength === 'heavy' });
      }
      break;

    case 'land':
      if (f.actionFrame >= LAND_FRAMES) toNeutral(f);
      break;

    case 'dashF':
      f.x += f.facing * 0.105 * (1 - f.actionFrame / (DASH_F_FRAMES + 4));
      if (f.actionFrame >= 5) {
        const b = consumeBuffer(f);
        if (b) {
          const id = chooseGroundMove(f, b.btn, b.dir, b.qcf);
          if (id) {
            startMove(s, f, o, id, idx);
            break;
          }
        }
      }
      if (f.actionFrame >= DASH_F_FRAMES) toNeutral(f);
      break;

    case 'dashB':
      f.x -= f.facing * 0.1 * (1 - f.actionFrame / (DASH_B_FRAMES + 4));
      if (f.actionFrame >= DASH_B_FRAMES) toNeutral(f);
      break;

    case 'attack': {
      const m = MOVES[f.moveId!];
      if (m.advance && f.actionFrame < m.startup) f.x += (f.facing * m.advance) / (m.startup - 1);
      if (f.actionFrame === m.startup && !m.throw) s.events.push({ t: 'whiff', p: idx, heavy: m.strength === 'heavy' });
      // jab -> throw conversion (LK pressed right after LP)
      if (f.moveId === 'jab' && f.actionFrame <= 3 && f.bufAge <= 2 && f.bufBtn & IN_LK) {
        startMove(s, f, o, 'throw', idx);
        break;
      }
      if (f.moveId === 'frontKick' && f.actionFrame <= 3 && f.bufAge <= 2 && f.bufBtn & IN_LP) {
        startMove(s, f, o, 'throw', idx);
        break;
      }
      // chains
      if (f.moveHit && m.cancels && f.actionFrame >= m.startup && f.actionFrame <= m.startup + m.active + 12) {
        if (f.bufBtn && f.bufAge <= BUFFER_FRAMES) {
          const next = chooseGroundMove(f, f.bufBtn, f.bufDir, false);
          if (next && m.cancels.includes(next)) {
            startMove(s, f, o, next, idx);
            break;
          }
        }
      }
      if (f.actionFrame >= moveTotal(m)) {
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
        f.comboCount = 0;
        f.comboDamage = 0;
      }
      break;

    case 'throwing':
      if (f.actionFrame === THROW_SLAM_FRAME) s.events.push({ t: 'throw', p: idx });
      if (f.actionFrame >= THROW_FRAMES) toNeutral(f);
      break;

    case 'thrown': {
      // throw escape: press a punch right after being grabbed
      const pressed = f.rel & ~f.prevRel & (IN_LP | IN_RP);
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
        const dmg = MOVES.throw.damage;
        f.hp = Math.max(0, f.hp - dmg);
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
  f.vy = 0;
  if (f.y < 0.001) f.y = 0;
}

function neutral(s: GameState, f: FighterState, o: FighterState, idx: number, dir: number) {
  // combo counter resets once the victim is back in control
  f.comboCount = 0;
  f.comboDamage = 0;
  f.juggleCount = 0;

  const b = consumeBuffer(f);
  if (b) {
    // directions held at press time, merged with the current down (for crouch moves while crouching)
    const d = b.dir | (f.action === 'crouch' ? dir & R_D : 0);
    const id = chooseGroundMove(f, b.btn, d, b.qcf);
    if (id) {
      startMove(s, f, o, id, idx);
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
    f.x += f.facing * WALK_F;
  } else if (dir & R_B) {
    if (f.action !== 'walkB') setAction(f, 'walkB');
    f.x -= f.facing * WALK_B;
  } else if (f.action !== 'idle') {
    setAction(f, 'idle');
  }
}

// ---------------------------------------------------------------------------
// physics
// ---------------------------------------------------------------------------
function physics(s: GameState, f: FighterState, idx: number) {
  if (f.frozen > 0) return;
  const airborne = f.action === 'jump' || f.action === 'airAttack' || f.action === 'juggle' || f.y > 0;
  if (airborne) {
    f.x += f.vx;
    f.y += f.vy;
    f.vy -= f.action === 'juggle' ? JUGGLE_GRAVITY : GRAVITY;
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      if (f.action === 'juggle') {
        f.vx *= 0.4;
        s.events.push({ t: 'fall', p: idx });
        if (f.koed) {
          setAction(f, 'ko');
        } else {
          setAction(f, 'knockdown');
        }
      } else if (f.action === 'jump' || f.action === 'airAttack') {
        f.vx = 0;
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

function resolvePositions(s: GameState) {
  const [a, b] = s.fighters;
  const lim = ARENA_HALF_WIDTH;
  for (const f of s.fighters) {
    if (f.x < -lim) f.x = -lim;
    if (f.x > lim) f.x = lim;
  }
  // push boxes (only when both are close to the ground, so jumps can cross a little)
  const thrown = a.action === 'thrown' || b.action === 'thrown';
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
}

function checkHit(a: FighterState, d: FighterState, ai: number): PendingHit | null {
  if ((a.action !== 'attack' && a.action !== 'airAttack') || !a.moveId || a.moveHit || a.frozen > 0) return null;
  const m = MOVES[a.moveId];
  if (a.actionFrame < m.startup || a.actionFrame >= m.startup + m.active) return null;

  const dx = (d.x - a.x) * a.facing;
  if (dx < -0.1) return null;
  if (dx - BODY_RADIUS > m.reach) return null;

  if (d.invuln > 0) return null;
  switch (d.action) {
    case 'knockdown':
    case 'getup':
    case 'ko':
    case 'thrown':
    case 'throwing':
    case 'throwBreak':
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

  // jumping attacks only connect when the attacker is low enough
  if (m.air && a.y > 1.5) return null;
  if (m.level === 'high' && dCrouch && !dAir) return null;
  if (m.level === 'low' && dAir && d.y > 0.3) return null;
  // vertical distance for juggles
  if (dAir && d.y > 1.6 && !m.air) return null;

  const holdingBack = (d.rel & R_B) !== 0;
  const canBlock =
    !dAir &&
    (d.action === 'idle' || d.action === 'walkB' || d.action === 'crouch' || d.action === 'blockstun' || d.action === 'land');
  let blocked = false;
  if (canBlock && holdingBack) {
    const crouchBlock = dCrouch || (d.rel & R_D) !== 0;
    if (m.level === 'low') blocked = crouchBlock;
    else blocked = !crouchBlock;
  }
  const counter =
    !blocked && (d.action === 'attack' || d.action === 'airAttack') && !!d.moveId && d.actionFrame < MOVES[d.moveId].startup;
  return { a: ai, d: 1 - ai, move: m, blocked, counter, grab: false };
}

function applyHit(s: GameState, h: PendingHit) {
  const a = s.fighters[h.a];
  const d = s.fighters[h.d];
  const m = h.move;
  a.moveHit = true;
  const hx = a.x + a.facing * Math.min(m.reach, Math.abs(d.x - a.x) - 0.1);
  const hy = isAirborne(d) ? d.y + 0.9 : m.hitY;

  if (h.grab) {
    setAction(a, 'throwing');
    setAction(d, 'thrown');
    d.facing = (a.facing * -1) as 1 | -1;
    d.vx = 0;
    a.vx = 0;
    d.crouching = false;
    return;
  }

  if (h.blocked) {
    d.action = 'blockstun';
    d.actionFrame = 0;
    d.moveId = null;
    d.crouching = isCrouching(d) || (d.rel & R_D) !== 0;
    d.stun = m.blockstun;
    d.stunTotal = m.blockstun;
    d.hitLevel = m.level;
    d.vx = a.facing * m.pushBlock;
    if (Math.abs(d.x) > ARENA_HALF_WIDTH - 0.3 && Math.sign(d.x) === a.facing) a.vx = -a.facing * m.pushBlock * 0.8;
    a.meter = Math.min(MAX_METER, a.meter + 2);
    d.meter = Math.min(MAX_METER, d.meter + 3);
    s.hitstop = Math.max(s.hitstop, 5);
    s.events.push({ t: 'block', p: h.d, x: hx, y: hy });
    return;
  }

  const dAir = isAirborne(d);
  let scale = Math.max(0.35, 1 - 0.1 * d.comboCount);
  if (dAir) scale *= 0.8;
  if (h.counter) scale *= 1.25;
  const dmg = Math.max(1, Math.round(m.damage * scale));
  d.hp = Math.max(0, d.hp - dmg);
  d.comboCount++;
  d.comboDamage += dmg;
  a.meter = Math.min(MAX_METER, a.meter + dmg * 0.6);
  d.meter = Math.min(MAX_METER, d.meter + dmg * 0.45);
  d.counterHit = h.counter;
  d.hitLevel = m.level;
  d.moveHit = false;
  d.frozen = 0;

  const atWall = Math.abs(d.x) > ARENA_HALF_WIDTH - 0.3 && Math.sign(d.x) === a.facing;

  if (d.hp <= 0) {
    d.koed = true;
    setAction(d, 'juggle');
    d.vy = Math.max(m.launch ?? 0, 0.11);
    d.vx = a.facing * 0.055;
    d.y = Math.max(d.y, 0.02);
    d.crouching = false;
  } else if (m.launch || dAir || m.knockdown) {
    setAction(d, 'juggle');
    if (m.launch) d.vy = m.launch;
    else if (dAir) d.vy = Math.max(0.02, 0.105 - 0.014 * d.juggleCount);
    else d.vy = 0.075;
    d.vx = a.facing * (m.knockdown && !m.launch ? 0.05 : m.pushHit * 0.35 + 0.012);
    d.y = Math.max(d.y, 0.02);
    d.juggleCount++;
    d.crouching = false;
  } else {
    const wasCrouch = isCrouching(d);
    setAction(d, 'hitstun');
    d.crouching = wasCrouch;
    d.stun = m.hitstun + (h.counter ? 6 : 0);
    d.stunTotal = d.stun;
    d.vx = a.facing * m.pushHit;
  }
  if (atWall) a.vx = -a.facing * m.pushHit * 0.7;

  s.hitstop = Math.max(s.hitstop, HITSTOP[m.strength] + (h.counter ? 3 : 0));
  s.events.push({ t: 'hit', p: h.a, x: hx, y: hy, strength: m.strength, counter: h.counter, dmg });
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
    Object.assign(f, createFighter(i as 0 | 1));
    f.wins = wins;
    f.meter = meter;
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
    if (w.hp >= MAX_HP) s.events.push({ t: 'perfect' });
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
        simulateFighters(s);
      }
      if (s.phaseFrame >= KO_FRAMES) {
        let winner: number;
        if (a.koed && b.koed) winner = 2;
        else winner = a.koed ? 1 : 0;
        endRound(s, winner);
      }
      return;
    }

    case 'roundOver':
      simulateFighters(s);
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

  s.timer--;

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
  }
  mix(s.timer);
  return h >>> 0;
}
