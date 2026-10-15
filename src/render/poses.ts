import type { BoneName } from './characterModel';
import { MOVES, moveTotal } from '../sim/moves';
import type { MoveId } from '../sim/types';

/**
 * Keyframed poses for the procedural skeleton.
 * Angles are Euler XYZ in DEGREES relative to the bind pose (standing, arms down,
 * facing +Z, +X = character's left).
 *   - X < 0 on a thigh/upper arm swings it forward; X > 0 on a shin bends the knee.
 *   - X < 0 on a forearm bends the elbow.
 *   - Z > 0 raises the LEFT arm/leg sideways, Z < 0 raises the RIGHT one.
 *   - Y < 0 on hips/spine turns the chest toward the camera side.
 * `root` = hips offset in metres (x, y, z) in the character's local space.
 */
export type Euler3 = [number, number, number];
export type Pose = Partial<Record<BoneName, Euler3>> & { root?: Euler3 };

export interface Key {
  f: number;
  p: Pose;
  /** easing used to reach this key from the previous one */
  ease?: 'linear' | 'smooth' | 'out' | 'in';
}
export interface Clip {
  keys: Key[];
  loop?: boolean;
  length: number;
}

export const merge = (...poses: Pose[]): Pose => Object.assign({}, ...poses);

// ---------------------------------------------------------------------------
// base poses
// ---------------------------------------------------------------------------
const GUARD_ARMS: Pose = {
  upperArmL: [-58, 0, 14],
  foreArmL: [-112, 0, 0],
  handL: [10, 0, 0],
  upperArmR: [-42, 0, -22],
  foreArmR: [-128, 0, 0],
  handR: [10, 0, 0],
};

export const STANCE: Pose = merge(GUARD_ARMS, {
  root: [0, -0.06, 0],
  hips: [0, -32, 0],
  spine: [6, -4, 0],
  chest: [6, -4, 0],
  neck: [0, 4, 0],
  head: [-6, 6, 0],
  thighL: [-28, 0, 6],
  shinL: [40, 0, 0],
  footL: [-12, 0, 0],
  thighR: [15, 0, -6],
  shinR: [16, 0, 0],
  footR: [-31, 0, 0],
});

export const CROUCH: Pose = merge(GUARD_ARMS, {
  root: [0, -0.4, 0.04],
  hips: [0, -30, 0],
  spine: [16, -4, 0],
  chest: [12, -4, 0],
  neck: [-6, 0, 0],
  head: [-10, 8, 0],
  thighL: [-82, 0, 10],
  shinL: [118, 0, 0],
  footL: [-36, 0, 0],
  thighR: [-25, 0, -10],
  shinR: [118, 0, 0],
  footR: [-25, 0, 0],
  upperArmL: [-62, 0, 16],
  upperArmR: [-50, 0, -18],
});

export const AIR: Pose = merge(GUARD_ARMS, {
  root: [0, 0.05, 0],
  hips: [0, -25, 0],
  spine: [10, 0, 0],
  thighL: [-70, 0, 8],
  shinL: [95, 0, 0],
  footL: [-10, 0, 0],
  thighR: [-35, 0, -8],
  shinR: [100, 0, 0],
  footR: [-20, 0, 0],
});

export const LYING: Pose = {
  root: [0, -0.86, -0.05],
  hips: [-90, -10, 0],
  spine: [-4, 0, 0],
  chest: [-4, 0, 0],
  neck: [10, 0, 0],
  head: [8, -30, 0],
  upperArmL: [-10, 0, 70],
  foreArmL: [-30, 0, 0],
  upperArmR: [-20, 0, -60],
  foreArmR: [-50, 0, 0],
  handL: [0, 0, 0],
  handR: [0, 0, 0],
  thighL: [-6, 0, 10],
  shinL: [12, 0, 0],
  footL: [40, 0, 0],
  thighR: [-20, 0, -8],
  shinR: [30, 0, 0],
  footR: [40, 0, 0],
};

// ---------------------------------------------------------------------------
// loops & movement
// ---------------------------------------------------------------------------
function idle(): Clip {
  // light boxer bounce: knees flex twice per cycle, torso and guard sway a little
  const up = merge(STANCE, { root: [0, -0.05, 0], spine: [5, -6, 0], chest: [5, -5, 0] });
  const down = merge(STANCE, {
    root: [0, -0.085, 0.01],
    spine: [7, -2, 0],
    chest: [8, -3, 0],
    head: [-4, 6, 0],
    thighL: [-31, 0, 6],
    shinL: [46, 0, 0],
    thighR: [12, 0, -6],
    shinR: [24, 0, 0],
    upperArmL: [-61, 0, 15],
    foreArmL: [-115, 0, 0],
    upperArmR: [-45, 0, -21],
    foreArmR: [-131, 0, 0],
  });
  const down2 = merge(down, { spine: [7, -8, 0], chest: [8, -7, 0], upperArmL: [-56, 0, 12] });
  return {
    loop: true,
    length: 48,
    keys: [
      { f: 0, p: up },
      { f: 12, p: down, ease: 'smooth' },
      { f: 24, p: up, ease: 'smooth' },
      { f: 36, p: down2, ease: 'smooth' },
      { f: 48, p: up, ease: 'smooth' },
    ],
  };
}

function walk(forward: boolean): Clip {
  const L = 34;
  const s = forward ? 1 : -1;
  const p1 = merge(STANCE, {
    root: [0, -0.04, 0],
    thighL: [-40 * s - (forward ? 0 : 10), 0, 6],
    shinL: [30, 0, 0],
    footL: [forward ? 0 : -15, 0, 0],
    thighR: [12, 0, -6],
    shinR: [20, 0, 0],
  });
  const p2 = merge(STANCE, {
    root: [0, -0.08, 0],
    thighL: [-22, 0, 6],
    shinL: [36, 0, 0],
    thighR: [-8 * s + (forward ? 0 : 20), 0, -6],
    shinR: [55, 0, 0],
    footR: [-30, 0, 0],
  });
  return {
    loop: true,
    length: L,
    keys: [
      { f: 0, p: STANCE },
      { f: L * 0.25, p: forward ? p1 : p2, ease: 'smooth' },
      { f: L * 0.5, p: STANCE, ease: 'smooth' },
      { f: L * 0.75, p: forward ? p2 : p1, ease: 'smooth' },
      { f: L, p: STANCE, ease: 'smooth' },
    ],
  };
}

const single = (p: Pose, length = 1): Clip => ({ length, keys: [{ f: 0, p }] });

// ---------------------------------------------------------------------------
// attacks
// ---------------------------------------------------------------------------
export interface AttackPoses {
  windup: Pose;
  strike: Pose;
  /** optional pose between strike and recovery */
  follow?: Pose;
  base?: Pose;
  /** pose at the end of the recovery (defaults to base) */
  end?: Pose;
}

export const ATTACKS: Record<MoveId, AttackPoses> = {
  jab: {
    windup: merge(STANCE, { hips: [0, -22, 0], upperArmL: [-70, 0, 10], foreArmL: [-80, 0, 0] }),
    strike: merge(STANCE, {
      root: [0, -0.07, 0.05],
      hips: [0, -12, 0],
      chest: [6, 8, 0],
      head: [-4, -4, 0],
      upperArmL: [-90, 0, 4],
      foreArmL: [-4, 0, 0],
      handL: [0, 0, 0],
    }),
  },
  cross: {
    windup: merge(STANCE, { hips: [0, -40, 0], upperArmR: [-40, 0, -30] }),
    strike: merge(STANCE, {
      root: [0, -0.08, 0.1],
      hips: [0, 14, 0],
      spine: [8, 10, 0],
      chest: [8, 14, 0],
      head: [-6, -24, 0],
      upperArmR: [-92, 0, 0],
      foreArmR: [-4, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-50, 0, 18],
      foreArmL: [-125, 0, 0],
      thighR: [10, 0, -6],
      footR: [-26, 0, 0],
    }),
  },
  elbow: {
    windup: merge(STANCE, { hips: [0, -45, 0], upperArmL: [-40, 0, 50], foreArmL: [-140, 0, 0] }),
    strike: merge(STANCE, {
      root: [0, -0.1, 0.12],
      hips: [0, 5, 0],
      chest: [10, 20, 0],
      head: [-4, -15, 0],
      upperArmL: [-75, 25, 70],
      foreArmL: [-150, 0, 0],
      thighL: [-40, 0, 6],
      shinL: [45, 0, 0],
    }),
  },
  powerPunch: {
    windup: merge(STANCE, {
      root: [0, -0.1, -0.08],
      hips: [0, -70, 0],
      spine: [0, -15, 0],
      upperArmR: [-20, 0, -55],
      foreArmR: [-100, 0, 0],
    }),
    strike: merge(STANCE, {
      root: [0, -0.14, 0.2],
      hips: [0, 25, 0],
      spine: [14, 15, 0],
      chest: [12, 18, 0],
      head: [-10, -30, 0],
      upperArmR: [-95, 0, 2],
      foreArmR: [-2, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-30, 0, 30],
      foreArmL: [-110, 0, 0],
      thighL: [-55, 0, 6],
      shinL: [60, 0, 0],
      thighR: [25, 0, -6],
      shinR: [10, 0, 0],
      footR: [-30, 0, 0],
    }),
  },
  frontKick: {
    windup: merge(STANCE, { thighL: [-80, 0, 6], shinL: [100, 0, 0], spine: [-4, -4, 0] }),
    strike: merge(STANCE, {
      root: [0, -0.02, -0.04],
      hips: [0, -20, 0],
      spine: [-14, 0, 0],
      chest: [-6, 0, 0],
      thighL: [-98, 0, 4],
      shinL: [6, 0, 0],
      footL: [-30, 0, 0],
      thighR: [6, 0, -6],
      shinR: [10, 0, 0],
      footR: [-16, 0, 0],
    }),
  },
  roundhouse: {
    windup: merge(STANCE, { hips: [0, 30, 0], thighR: [-30, 0, -40], shinR: [80, 0, 0] }),
    strike: merge(STANCE, {
      root: [0, -0.02, 0],
      hips: [0, 78, 0],
      spine: [0, 0, -26],
      chest: [0, 0, -10],
      neck: [0, -30, 10],
      head: [0, -30, 10],
      upperArmL: [-30, 0, 60],
      foreArmL: [-90, 0, 0],
      upperArmR: [-40, 0, -10],
      thighR: [-10, 0, -128],
      shinR: [6, 0, 0],
      footR: [20, 0, 0],
      thighL: [0, 0, 18],
      shinL: [10, 0, 0],
      footL: [0, 0, 0],
    }),
  },
  knee: {
    windup: merge(STANCE, { upperArmL: [-90, 0, 10], foreArmL: [-40, 0, 0], upperArmR: [-90, 0, -10], foreArmR: [-40, 0, 0] }),
    strike: merge(STANCE, {
      root: [0, 0.04, 0.14],
      hips: [-10, -10, 0],
      spine: [10, 0, 0],
      upperArmL: [-70, 0, 10],
      foreArmL: [-70, 0, 0],
      upperArmR: [-70, 0, -10],
      foreArmR: [-70, 0, 0],
      thighL: [-115, 0, 0],
      shinL: [120, 0, 0],
      footL: [40, 0, 0],
      thighR: [8, 0, -6],
      shinR: [6, 0, 0],
      footR: [-10, 0, 0],
    }),
  },
  crouchJab: {
    base: CROUCH,
    windup: merge(CROUCH, { upperArmL: [-70, 0, 10], foreArmL: [-90, 0, 0] }),
    strike: merge(CROUCH, { hips: [0, -14, 0], upperArmL: [-82, 0, 4], foreArmL: [-6, 0, 0], handL: [0, 0, 0] }),
  },
  uppercut: {
    base: CROUCH,
    windup: merge(CROUCH, { root: [0, -0.45, 0.02], hips: [0, -50, 0], upperArmR: [-10, 0, -30], foreArmR: [-110, 0, 0] }),
    strike: merge(STANCE, {
      root: [0, 0.0, 0.1],
      hips: [0, 20, 0],
      spine: [-6, 12, 0],
      chest: [-10, 12, 0],
      head: [-14, -20, 0],
      upperArmR: [-160, 0, -8],
      foreArmR: [-40, 0, 0],
      handR: [0, 0, 0],
      thighL: [-35, 0, 6],
      shinL: [30, 0, 0],
      thighR: [12, 0, -6],
      shinR: [6, 0, 0],
      footR: [-30, 0, 0],
    }),
    follow: merge(STANCE, { root: [0, -0.02, 0.06], upperArmR: [-140, 0, -10], foreArmR: [-60, 0, 0], hips: [0, 10, 0] }),
  },
  lowKick: {
    base: CROUCH,
    windup: merge(CROUCH, { thighL: [-60, 0, 10], shinL: [130, 0, 0] }),
    strike: merge(CROUCH, {
      root: [0, -0.42, -0.04],
      hips: [0, -10, 0],
      spine: [6, 0, 0],
      thighL: [-62, 0, 6],
      shinL: [-4, 0, 0],
      footL: [-20, 0, 0],
    }),
  },
  sweep: {
    base: CROUCH,
    windup: merge(CROUCH, { root: [0, -0.5, 0], hips: [0, 10, 0] }),
    strike: merge(CROUCH, {
      root: [0, -0.52, 0],
      hips: [0, 85, 0],
      spine: [20, 0, -10],
      chest: [10, 0, 0],
      head: [0, -40, 0],
      upperArmL: [-30, 0, 70],
      foreArmL: [-20, 0, 0],
      upperArmR: [-60, 0, -10],
      foreArmR: [-20, 0, 0],
      thighR: [-6, 0, -88],
      shinR: [0, 0, 0],
      footR: [30, 0, 0],
      thighL: [-95, 0, 25],
      shinL: [140, 0, 0],
      footL: [-40, 0, 0],
    }),
    follow: merge(CROUCH, { root: [0, -0.5, 0], hips: [0, 160, 0], thighR: [-40, 0, -40], shinR: [60, 0, 0] }),
  },
  jumpPunch: {
    base: AIR,
    windup: merge(AIR, { upperArmR: [-20, 0, -40], foreArmR: [-120, 0, 0], hips: [0, -50, 0] }),
    strike: merge(AIR, { hips: [0, 10, 0], chest: [20, 10, 0], upperArmR: [-60, 0, 0], foreArmR: [-4, 0, 0], handR: [0, 0, 0] }),
  },
  jumpKick: {
    base: AIR,
    windup: merge(AIR, { thighL: [-100, 0, 6], shinL: [110, 0, 0] }),
    strike: merge(AIR, {
      hips: [10, -20, 0],
      spine: [-18, 0, 0],
      thighL: [-75, 0, 4],
      shinL: [-4, 0, 0],
      footL: [-20, 0, 0],
      thighR: [-10, 0, -6],
      shinR: [110, 0, 0],
      upperArmL: [-30, 0, 40],
      upperArmR: [-20, 0, -50],
    }),
  },
  // downward axe kick in the air: the lead leg goes up over the head, then the heel chops down
  airSmash: {
    base: AIR,
    windup: merge(AIR, {
      root: [0, 0.04, -0.04],
      hips: [-22, -12, 0],
      spine: [-14, 0, 0],
      chest: [-8, 0, 0],
      head: [-4, 4, 0],
      thighL: [-168, 0, 6],
      shinL: [4, 0, 0],
      footL: [-24, 0, 0],
      thighR: [-30, 0, -8],
      shinR: [104, 0, 0],
      footR: [-20, 0, 0],
      upperArmL: [-150, 0, 42],
      foreArmL: [-34, 0, 0],
      upperArmR: [-150, 0, -42],
      foreArmR: [-34, 0, 0],
    }),
    strike: merge(AIR, {
      root: [0, 0.06, 0.12],
      hips: [26, -10, 0],
      spine: [28, 0, 0],
      chest: [14, 0, 0],
      neck: [6, 0, 0],
      head: [10, 0, 0],
      thighL: [-42, 0, 6],
      shinL: [6, 0, 0],
      footL: [-34, 0, 0],
      thighR: [-62, 0, -8],
      shinR: [112, 0, 0],
      footR: [-10, 0, 0],
      upperArmL: [-14, 0, 58],
      foreArmL: [-58, 0, 0],
      upperArmR: [-24, 0, -58],
      foreArmR: [-58, 0, 0],
    }),
    follow: merge(AIR, {
      root: [0, 0.04, 0.08],
      hips: [16, -14, 0],
      spine: [18, 0, 0],
      thighL: [-26, 0, 6],
      shinL: [26, 0, 0],
      footL: [-20, 0, 0],
      upperArmL: [-30, 0, 46],
      foreArmL: [-80, 0, 0],
      upperArmR: [-36, 0, -46],
      foreArmR: [-80, 0, 0],
    }),
  },
  throw: {
    windup: merge(STANCE, { upperArmL: [-80, 0, 20], foreArmL: [-40, 0, 0], upperArmR: [-80, 0, -20], foreArmR: [-40, 0, 0], hips: [0, -10, 0] }),
    strike: merge(STANCE, {
      root: [0, -0.06, 0.1],
      hips: [0, -5, 0],
      spine: [10, 0, 0],
      upperArmL: [-88, 0, 8],
      foreArmL: [-20, 0, 0],
      upperArmR: [-88, 0, -8],
      foreArmR: [-20, 0, 0],
    }),
  },
  super: {
    base: merge(STANCE, {
      root: [0, -0.22, -0.05],
      hips: [0, -50, 0],
      spine: [20, -10, 0],
      upperArmR: [-20, 0, -60],
      foreArmR: [-110, 0, 0],
      upperArmL: [-80, 0, 20],
      foreArmL: [-40, 0, 0],
      thighL: [-60, 0, 8],
      shinL: [80, 0, 0],
      thighR: [30, 0, -6],
      shinR: [40, 0, 0],
      footR: [-40, 0, 0],
    }),
    windup: merge(STANCE, {
      root: [0, -0.2, 0.15],
      hips: [0, -40, 0],
      spine: [28, -10, 0],
      upperArmR: [-10, 0, -70],
      foreArmR: [-100, 0, 0],
      upperArmL: [-90, 0, 20],
      foreArmL: [-30, 0, 0],
      thighL: [-70, 0, 6],
      shinL: [60, 0, 0],
      thighR: [40, 0, -6],
      shinR: [20, 0, 0],
      footR: [-50, 0, 0],
    }),
    strike: merge(STANCE, {
      root: [0, -0.16, 0.3],
      hips: [0, 30, 0],
      spine: [20, 15, 0],
      chest: [15, 20, 0],
      head: [-10, -30, 0],
      upperArmR: [-100, 0, 0],
      foreArmR: [0, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-20, 0, 40],
      foreArmL: [-100, 0, 0],
      thighL: [-65, 0, 6],
      shinL: [70, 0, 0],
      thighR: [30, 0, -6],
      shinR: [10, 0, 0],
      footR: [-40, 0, 0],
    }),
    end: STANCE,
  },
};

function moveClip(id: MoveId): Clip {
  const m = MOVES[id];
  const a = ATTACKS[id];
  const base = a.base ?? STANCE;
  const total = moveTotal(m);
  const strikeEnd = m.startup + m.active - 1;
  const keys: Key[] = [
    { f: 0, p: base },
    { f: Math.max(1, Math.round(m.startup * 0.55)), p: a.windup, ease: 'out' },
    { f: m.startup, p: a.strike, ease: 'in' },
    { f: strikeEnd + 1, p: a.strike },
  ];
  if (a.follow) keys.push({ f: strikeEnd + Math.round(m.recovery * 0.4), p: a.follow, ease: 'smooth' });
  keys.push({ f: total, p: a.end ?? base, ease: 'smooth' });
  return { length: total, keys };
}

// ---------------------------------------------------------------------------
// reactions
// ---------------------------------------------------------------------------
export const HIT_HIGH = merge(STANCE, {
  root: [0, -0.06, -0.08],
  hips: [-6, -40, 0],
  spine: [-10, 0, 0],
  chest: [-12, 0, 0],
  neck: [-20, 10, 0],
  head: [-26, 10, 0],
  upperArmL: [-20, 0, 40],
  foreArmL: [-50, 0, 0],
  upperArmR: [-10, 0, -40],
  foreArmR: [-50, 0, 0],
});
export const HIT_MID = merge(STANCE, {
  root: [0, -0.1, -0.1],
  hips: [6, -30, 0],
  spine: [26, 0, 0],
  chest: [20, 0, 0],
  head: [14, 0, 0],
  upperArmL: [-30, 0, 10],
  foreArmL: [-100, 0, 0],
  upperArmR: [-30, 0, -10],
  foreArmR: [-100, 0, 0],
});
export const HIT_LOW = merge(STANCE, {
  root: [0, -0.14, -0.04],
  thighL: [-10, 0, 6],
  shinL: [55, 0, 0],
  footL: [-30, 0, 0],
  spine: [16, 0, 0],
  head: [10, 0, 0],
  upperArmL: [-30, 0, 30],
  foreArmL: [-60, 0, 0],
});
const CROUCH_HIT = merge(CROUCH, { spine: [0, 0, 0], chest: [-10, 0, 0], head: [-25, 0, 0], upperArmL: [-20, 0, 40], foreArmL: [-60, 0, 0] });
export const BLOCK = merge(STANCE, {
  root: [0, -0.08, -0.03],
  hips: [0, -26, 0],
  spine: [10, 0, 0],
  head: [12, 6, 0],
  upperArmL: [-68, 0, 10],
  foreArmL: [-140, 0, 0],
  upperArmR: [-70, 0, -10],
  foreArmR: [-140, 0, 0],
});
const CROUCH_BLOCK = merge(CROUCH, {
  head: [10, 6, 0],
  upperArmL: [-60, 0, 10],
  foreArmL: [-140, 0, 0],
  upperArmR: [-62, 0, -10],
  foreArmR: [-140, 0, 0],
});

function reaction(p: Pose, base: Pose, length = 20): Clip {
  return {
    length,
    keys: [
      { f: 0, p: base },
      { f: 3, p, ease: 'out' },
      { f: length * 0.6, p, ease: 'smooth' },
      { f: length, p: base, ease: 'smooth' },
    ],
  };
}

function juggle(): Clip {
  const a = merge(HIT_HIGH, { root: [0, 0, 0], hips: [-30, -20, 0], thighL: [-30, 0, 15], thighR: [-10, 0, -15], shinL: [40, 0, 0], shinR: [60, 0, 0] });
  const b = merge(a, {
    hips: [-75, -20, 0],
    spine: [-10, 0, 0],
    upperArmL: [-60, 0, 80],
    upperArmR: [-40, 0, -90],
    thighL: [-50, 0, 20],
    shinL: [70, 0, 0],
    thighR: [-20, 0, -20],
    shinR: [30, 0, 0],
  });
  const c = merge(b, { root: [0, 0.05, 0], hips: [-95, -15, 0] });
  return { length: 60, keys: [{ f: 0, p: a }, { f: 18, p: b, ease: 'smooth' }, { f: 60, p: c, ease: 'smooth' }] };
}

function getup(): Clip {
  const sit = merge(CROUCH, {
    root: [0, -0.62, -0.25],
    hips: [-40, -20, 0],
    spine: [30, 0, 0],
    thighL: [-80, 0, 15],
    shinL: [90, 0, 0],
    thighR: [-60, 0, -10],
    shinR: [120, 0, 0],
    upperArmL: [30, 0, 20],
    upperArmR: [30, 0, -20],
    foreArmL: [-10, 0, 0],
    foreArmR: [-10, 0, 0],
  });
  return { length: 26, keys: [{ f: 0, p: LYING }, { f: 10, p: sit, ease: 'smooth' }, { f: 18, p: CROUCH, ease: 'smooth' }, { f: 26, p: STANCE, ease: 'smooth' }] };
}

function throwing(): Clip {
  const grab = ATTACKS.throw.strike;
  const lift = merge(STANCE, {
    root: [0, -0.02, -0.05],
    hips: [0, -10, 0],
    spine: [-14, 0, 0],
    chest: [-10, 0, 0],
    upperArmL: [-165, 0, 10],
    foreArmL: [-20, 0, 0],
    upperArmR: [-165, 0, -10],
    foreArmR: [-20, 0, 0],
  });
  const slam = merge(STANCE, {
    root: [0, -0.3, 0.15],
    hips: [0, 0, 0],
    spine: [35, 0, 0],
    chest: [20, 0, 0],
    upperArmL: [-50, 0, 10],
    foreArmL: [-10, 0, 0],
    upperArmR: [-50, 0, -10],
    foreArmR: [-10, 0, 0],
    thighL: [-60, 0, 6],
    shinL: [80, 0, 0],
  });
  return {
    length: 58,
    keys: [
      { f: 0, p: grab },
      { f: 10, p: grab },
      { f: 24, p: lift, ease: 'smooth' },
      { f: 34, p: slam, ease: 'in' },
      { f: 46, p: slam },
      { f: 58, p: STANCE, ease: 'smooth' },
    ],
  };
}

function thrown(): Clip {
  const held = merge(HIT_HIGH, { root: [0, -0.02, 0] });
  const lifted = merge(HIT_HIGH, {
    root: [0, 0.75, -0.25],
    hips: [-150, 0, 0],
    upperArmL: [-20, 0, 80],
    upperArmR: [-20, 0, -80],
    thighL: [-20, 0, 10],
    thighR: [-30, 0, -10],
    shinL: [40, 0, 0],
  });
  const slammed = merge(LYING, { root: [0, -0.86, 0.05] });
  return {
    length: 58,
    keys: [
      { f: 0, p: held },
      { f: 10, p: held },
      { f: 24, p: lifted, ease: 'smooth' },
      { f: 34, p: slammed, ease: 'in' },
      { f: 58, p: LYING },
    ],
  };
}

function intro(variant: number): Clip {
  if (variant % 2 === 0) {
    // points at the opponent, then guard
    const point = merge(STANCE, {
      root: [0, 0, 0],
      hips: [0, -45, 0],
      thighL: [-10, 0, 6],
      shinL: [10, 0, 0],
      thighR: [5, 0, -6],
      shinR: [5, 0, 0],
      footL: [0, 0, 0],
      footR: [-10, 0, 0],
      upperArmL: [10, 0, 10],
      foreArmL: [-10, 0, 0],
      upperArmR: [-95, 30, -10],
      foreArmR: [-6, 0, 0],
      head: [-8, 15, 0],
    });
    return { length: 150, keys: [{ f: 0, p: point }, { f: 110, p: point }, { f: 140, p: STANCE, ease: 'smooth' }] };
  }
  // "come here" hand wave
  const a = merge(STANCE, { upperArmL: [-80, 0, 10], foreArmL: [-20, 0, 0], handL: [-30, 0, 0], hips: [0, -40, 0] });
  const b = merge(a, { foreArmL: [-80, 0, 0], handL: [-60, 0, 0] });
  return {
    length: 150,
    keys: [
      { f: 0, p: STANCE },
      { f: 15, p: a, ease: 'smooth' },
      { f: 30, p: b, ease: 'smooth' },
      { f: 45, p: a, ease: 'smooth' },
      { f: 60, p: b, ease: 'smooth' },
      { f: 75, p: a, ease: 'smooth' },
      { f: 110, p: STANCE, ease: 'smooth' },
    ],
  };
}

function win(variant: number): Clip {
  const relaxedLegs: Pose = { thighL: [-4, 0, 8], shinL: [6, 0, 0], footL: [-2, 0, 0], thighR: [2, 0, -8], shinR: [4, 0, 0], footR: [-6, 0, 0], root: [0, 0, 0] };
  let p: Pose;
  if (variant === 0) {
    p = merge(STANCE, relaxedLegs, {
      hips: [0, -40, 0],
      spine: [-6, 0, 0],
      chest: [-6, 0, 0],
      head: [-14, 10, 0],
      upperArmL: [0, 0, 150],
      foreArmL: [-10, 0, 0],
      upperArmR: [0, 0, -150],
      foreArmR: [-10, 0, 0],
    });
  } else if (variant === 1) {
    // double biceps
    p = merge(STANCE, relaxedLegs, {
      hips: [0, -12, 0],
      spine: [-4, 0, 0],
      chest: [-6, 0, 0],
      head: [-8, 6, 0],
      upperArmL: [0, 0, 88],
      foreArmL: [0, 0, 105],
      upperArmR: [0, 0, -88],
      foreArmR: [0, 0, -105],
      handL: [0, 0, 0],
      handR: [0, 0, 0],
    });
  } else {
    // arms crossed, chin up
    p = merge(STANCE, relaxedLegs, {
      hips: [0, -55, 0],
      spine: [-4, 0, 0],
      head: [-16, 25, 0],
      upperArmL: [-25, 0, 15],
      foreArmL: [-100, -60, 0],
      upperArmR: [-25, 0, -15],
      foreArmR: [-100, 60, 0],
    });
  }
  const bounce = merge(p, { root: [0, 0.02, 0] });
  return { length: 90, loop: false, keys: [{ f: 0, p: STANCE }, { f: 14, p: bounce, ease: 'out' }, { f: 24, p }, { f: 90, p }] };
}

export const LOSE = merge(STANCE, {
  root: [0, -0.12, 0],
  hips: [10, -40, 0],
  spine: [28, 0, 0],
  chest: [10, 0, 0],
  head: [30, 0, 0],
  upperArmL: [-40, 0, 6],
  foreArmL: [-20, 0, 0],
  upperArmR: [-40, 0, -6],
  foreArmR: [-20, 0, 0],
  thighL: [-30, 0, 6],
  shinL: [40, 0, 0],
  footL: [-10, 0, 0],
  thighR: [-10, 0, -6],
  shinR: [30, 0, 0],
  footR: [-20, 0, 0],
});

const DASH_F = merge(STANCE, { root: [0, -0.1, 0.06], spine: [16, 0, 0], thighL: [-50, 0, 6], shinL: [50, 0, 0], thighR: [30, 0, -6], shinR: [40, 0, 0] });
const DASH_B = merge(STANCE, { root: [0, -0.02, -0.06], spine: [-10, 0, 0], thighL: [-10, 0, 6], shinL: [20, 0, 0], thighR: [20, 0, -6], shinR: [60, 0, 0], footR: [-60, 0, 0] });

// ---------------------------------------------------------------------------
// parry
// ---------------------------------------------------------------------------
/** The defender sweeps the attack aside with the lead arm. */
function parry(): Clip {
  const deflect = merge(STANCE, {
    root: [0, -0.07, -0.03],
    hips: [0, -48, 0],
    spine: [4, -10, 0],
    chest: [2, -14, 0],
    head: [-6, 18, 0],
    upperArmL: [-95, 0, 70],
    foreArmL: [-55, 0, 0],
    handL: [-20, 0, 0],
    upperArmR: [-50, 0, -20],
    foreArmR: [-125, 0, 0],
  });
  return {
    length: 10,
    keys: [
      { f: 0, p: BLOCK },
      { f: 3, p: deflect, ease: 'out' },
      { f: 7, p: deflect },
      { f: 10, p: STANCE, ease: 'smooth' },
    ],
  };
}

/** The attacker is thrown off balance: arms flung wide, stumbling back. */
function parried(): Clip {
  const stagger = merge(STANCE, {
    root: [0, -0.04, -0.12],
    hips: [-8, -10, 0],
    spine: [-14, 0, 0],
    chest: [-12, 0, 0],
    neck: [-10, 0, 0],
    head: [-16, 0, 0],
    upperArmL: [-30, 0, 85],
    foreArmL: [-30, 0, 0],
    upperArmR: [-20, 0, -80],
    foreArmR: [-35, 0, 0],
    thighL: [-35, 0, 8],
    shinL: [30, 0, 0],
    thighR: [25, 0, -8],
    shinR: [35, 0, 0],
    footR: [-40, 0, 0],
  });
  const wobble = merge(stagger, { root: [0, -0.07, -0.1], chest: [-6, 8, 0], head: [-6, -10, 0], upperArmL: [-40, 0, 60], upperArmR: [-35, 0, -55] });
  return {
    length: 26,
    keys: [
      { f: 0, p: STANCE },
      { f: 4, p: stagger, ease: 'out' },
      { f: 14, p: wobble, ease: 'smooth' },
      { f: 26, p: STANCE, ease: 'smooth' },
    ],
  };
}

// ---------------------------------------------------------------------------
// BBL MAX (ultimate)
// ---------------------------------------------------------------------------
function superFlash(): Clip {
  const power = merge(STANCE, {
    root: [0, -0.12, 0],
    hips: [0, -22, 0],
    spine: [-8, 0, 0],
    chest: [-12, 0, 0],
    neck: [-6, 0, 0],
    head: [-20, 4, 0],
    upperArmL: [-18, 0, 38],
    foreArmL: [-75, 0, 0],
    upperArmR: [-18, 0, -38],
    foreArmR: [-75, 0, 0],
    handL: [20, 0, 0],
    handR: [20, 0, 0],
    thighL: [-12, 0, 20],
    shinL: [26, 0, 0],
    footL: [-14, 0, 0],
    thighR: [8, 0, -20],
    shinR: [24, 0, 0],
    footR: [-32, 0, 0],
  });
  const power2 = merge(power, { root: [0, -0.135, 0], chest: [-14, 4, 0], head: [-24, -4, 0], upperArmL: [-16, 0, 42], upperArmR: [-16, 0, -42] });
  const ready = ATTACKS.super.base!;
  const keys: Key[] = [
    { f: 0, p: STANCE },
    { f: 12, p: power, ease: 'out' },
  ];
  // trembling with power
  for (let f = 18, i = 0; f <= 72; f += 6, i++) keys.push({ f, p: i % 2 ? power : power2, ease: 'linear' });
  keys.push({ f: 86, p: ready, ease: 'smooth' }, { f: 96, p: ready });
  return { length: 96, keys };
}

export function superCombo(): Clip {
  const A = ATTACKS;
  const hammerUp = merge(AIR, {
    root: [0, 0, 0],
    spine: [-16, 0, 0],
    chest: [-10, 0, 0],
    head: [-10, 0, 0],
    upperArmL: [-170, 0, 12],
    foreArmL: [-40, 0, 0],
    upperArmR: [-170, 0, -12],
    foreArmR: [-40, 0, 0],
  });
  const smash = merge(AIR, {
    root: [0, 0, 0.1],
    hips: [0, -10, 0],
    spine: [34, 0, 0],
    chest: [16, 0, 0],
    head: [10, 0, 0],
    upperArmL: [-55, 0, 10],
    foreArmL: [-10, 0, 0],
    upperArmR: [-55, 0, -10],
    foreArmR: [-10, 0, 0],
    thighL: [-30, 0, 10],
    shinL: [40, 0, 0],
    thighR: [10, 0, -10],
    shinR: [60, 0, 0],
  });
  const land = merge(CROUCH, { root: [0, -0.35, 0.05], spine: [30, 0, 0], upperArmL: [-40, 0, 20], foreArmL: [-20, 0, 0], upperArmR: [-40, 0, -20], foreArmR: [-20, 0, 0] });
  const rise = merge(AIR, { root: [0, 0, 0], upperArmL: [-120, 0, 30], upperArmR: [-120, 0, -30], foreArmL: [-60, 0, 0], foreArmR: [-60, 0, 0] });
  const taunt = merge(STANCE, {
    root: [0, 0, 0],
    hips: [0, -45, 0],
    thighL: [-10, 0, 6],
    shinL: [10, 0, 0],
    footL: [0, 0, 0],
    thighR: [5, 0, -6],
    shinR: [5, 0, 0],
    footR: [-10, 0, 0],
    upperArmL: [10, 0, 10],
    foreArmL: [-10, 0, 0],
    upperArmR: [-95, 30, -10],
    foreArmR: [-6, 0, 0],
    head: [-8, 15, 0],
  });
  return {
    length: 132,
    keys: [
      { f: 0, p: A.super.strike },
      { f: 5, p: A.jab.windup, ease: 'out' },
      { f: 8, p: A.jab.strike, ease: 'in' },
      { f: 13, p: A.cross.windup, ease: 'smooth' },
      { f: 18, p: A.cross.strike, ease: 'in' },
      { f: 24, p: A.knee.windup, ease: 'smooth' },
      { f: 30, p: A.knee.strike, ease: 'in' },
      { f: 38, p: A.elbow.windup, ease: 'smooth' },
      { f: 44, p: A.elbow.strike, ease: 'in' },
      { f: 51, p: A.uppercut.windup, ease: 'smooth' },
      { f: 58, p: A.uppercut.strike, ease: 'in' },
      { f: 66, p: merge(CROUCH, { root: [0, -0.3, 0] }), ease: 'smooth' },
      { f: 76, p: rise, ease: 'out' },
      { f: 86, p: hammerUp, ease: 'smooth' },
      { f: 92, p: smash, ease: 'in' },
      { f: 100, p: smash },
      { f: 108, p: land, ease: 'in' },
      { f: 120, p: taunt, ease: 'smooth' },
      { f: 132, p: taunt },
    ],
  };
}

export function superVictim(): Clip {
  const hitHigh2 = merge(HIT_HIGH, { head: [-34, -20, 0], neck: [-24, -10, 0], chest: [-16, -10, 0] });
  const elbowHit = merge(HIT_HIGH, { head: [-14, 45, 0], neck: [-10, 25, 0], chest: [-8, 15, 0] });
  const kneeHit = merge(HIT_MID, { root: [0, 0.02, -0.06], spine: [34, 0, 0], chest: [24, 0, 0], head: [20, 0, 0] });
  const j = CLIP_JUGGLE_POSES();
  return {
    length: 132,
    keys: [
      { f: 0, p: HIT_MID },
      { f: 8, p: HIT_HIGH, ease: 'out' },
      { f: 13, p: merge(HIT_HIGH, { head: [-12, 6, 0] }), ease: 'smooth' },
      { f: 18, p: hitHigh2, ease: 'out' },
      { f: 30, p: kneeHit, ease: 'out' },
      { f: 44, p: elbowHit, ease: 'out' },
      { f: 58, p: j.a, ease: 'out' },
      { f: 76, p: j.b, ease: 'smooth' },
      { f: 91, p: j.c, ease: 'smooth' },
      { f: 102, p: LYING, ease: 'in' },
      { f: 132, p: LYING },
    ],
  };
}

export function CLIP_JUGGLE_POSES() {
  const a = merge(HIT_HIGH, { root: [0, 0, 0], hips: [-30, -20, 0], thighL: [-30, 0, 15], thighR: [-10, 0, -15], shinL: [40, 0, 0], shinR: [60, 0, 0] });
  const b = merge(a, {
    hips: [-75, -20, 0],
    spine: [-10, 0, 0],
    upperArmL: [-60, 0, 80],
    upperArmR: [-40, 0, -90],
    thighL: [-50, 0, 20],
    shinL: [70, 0, 0],
    thighR: [-20, 0, -20],
    shinR: [30, 0, 0],
  });
  const c = merge(b, { root: [0, 0.05, 0], hips: [-110, -15, 0] });
  return { a, b, c };
}

// ---------------------------------------------------------------------------
// air combos, bounces
// ---------------------------------------------------------------------------
/** chase jump after a launcher: deep crouch, explosive spring, rising toward the opponent */
function superJump(): Clip {
  const load = merge(CROUCH, {
    root: [0, -0.46, 0.02],
    spine: [26, 0, 0],
    chest: [10, 0, 0],
    head: [-18, 6, 0],
    upperArmL: [24, 0, 22],
    foreArmL: [-34, 0, 0],
    upperArmR: [26, 0, -22],
    foreArmR: [-34, 0, 0],
  });
  const spring = merge(STANCE, {
    root: [0, 0.06, 0.06],
    hips: [-6, -16, 0],
    spine: [-10, 0, 0],
    chest: [-8, 0, 0],
    neck: [-8, 0, 0],
    head: [-18, 4, 0],
    upperArmL: [-172, 0, 10],
    foreArmL: [-10, 0, 0],
    handL: [0, 0, 0],
    upperArmR: [-36, 0, -34],
    foreArmR: [-96, 0, 0],
    thighL: [-8, 0, 4],
    shinL: [8, 0, 0],
    footL: [34, 0, 0],
    thighR: [10, 0, -4],
    shinR: [22, 0, 0],
    footR: [44, 0, 0],
  });
  const rise = merge(AIR, {
    root: [0, 0.05, 0.04],
    hips: [-8, -20, 0],
    spine: [-4, 0, 0],
    head: [-14, 4, 0],
    upperArmL: [-130, 0, 22],
    foreArmL: [-50, 0, 0],
    upperArmR: [-50, 0, -30],
    foreArmR: [-110, 0, 0],
    thighL: [-58, 0, 8],
    shinL: [86, 0, 0],
    thighR: [-18, 0, -8],
    shinR: [70, 0, 0],
    footR: [-10, 0, 0],
  });
  // the sim's super jump homes in for ~13 frames (attacks allowed from frame 5)
  return {
    length: 24,
    keys: [
      { f: 0, p: load },
      { f: 1, p: load },
      { f: 4, p: spring, ease: 'out' },
      { f: 11, p: rise, ease: 'smooth' },
      { f: 24, p: AIR, ease: 'smooth' },
    ],
  };
}

/** air dash: horizontal lunge, lead arm forward, trailing leg stretched back */
const AIR_DASH: Pose = merge(AIR, {
  root: [0, 0.02, 0.12],
  hips: [24, -18, 0],
  spine: [18, 0, 0],
  chest: [8, 0, 0],
  neck: [-12, 0, 0],
  head: [-22, 4, 0],
  upperArmL: [-84, 0, 18],
  foreArmL: [-36, 0, 0],
  upperArmR: [34, 0, -26],
  foreArmR: [-24, 0, 0],
  thighL: [-62, 0, 6],
  shinL: [84, 0, 0],
  footL: [-10, 0, 0],
  thighR: [34, 0, -6],
  shinR: [36, 0, 0],
  footR: [-30, 0, 0],
});
function airDash(): Clip {
  return {
    length: 24,
    keys: [
      { f: 0, p: AIR },
      { f: 3, p: AIR_DASH, ease: 'out' },
      { f: 14, p: merge(AIR_DASH, { hips: [18, -20, 0], upperArmR: [24, 0, -30] }), ease: 'smooth' },
      { f: 24, p: AIR, ease: 'smooth' },
    ],
  };
}

/** flattened against the wall (starfish), then peeling off into a fall */
const SPLAT: Pose = merge(STANCE, {
  root: [0, 0.02, -0.14],
  hips: [-12, -8, 0],
  spine: [-14, 0, 0],
  chest: [-10, 0, 0],
  neck: [-10, 0, 0],
  head: [-22, 14, 0],
  upperArmL: [-16, 0, 116],
  foreArmL: [-24, 0, 0],
  handL: [0, 0, 0],
  upperArmR: [-16, 0, -116],
  foreArmR: [-24, 0, 0],
  handR: [0, 0, 0],
  thighL: [2, 0, 24],
  shinL: [10, 0, 0],
  footL: [34, 0, 0],
  thighR: [2, 0, -24],
  shinR: [12, 0, 0],
  footR: [34, 0, 0],
});
function wallSplat(): Clip {
  const wobble = merge(SPLAT, { head: [-12, 34, 6], upperArmL: [-12, 0, 104], upperArmR: [-22, 0, -110] });
  // pinned for 16 frames by the sim, then thrown back into a juggle ('wallBounce' clip)
  return {
    length: 16,
    keys: [
      { f: 0, p: HIT_HIGH },
      { f: 2, p: SPLAT, ease: 'out' },
      { f: 8, p: SPLAT },
      { f: 12, p: wobble, ease: 'smooth' },
      { f: 16, p: PEEL, ease: 'in' },
    ],
  };
}

/** wall splat peel pose (start of the bounce back) */
const PEEL: Pose = merge(STANCE, {
  root: [0, -0.1, -0.02],
  hips: [10, -20, 0],
  spine: [26, 0, 0],
  chest: [14, 0, 0],
  neck: [14, 0, 0],
  head: [26, 10, 0],
  upperArmL: [-6, 0, 40],
  foreArmL: [-24, 0, 0],
  upperArmR: [-6, 0, -40],
  foreArmR: [-24, 0, 0],
  thighL: [-22, 0, 10],
  shinL: [44, 0, 0],
  thighR: [-12, 0, -10],
  shinR: [40, 0, 0],
  footL: [20, 0, 0],
  footR: [20, 0, 0],
});

/** thrown back off the wall: peeling off, then tumbling into the juggle */
function wallBounce(): Clip {
  const j = CLIP_JUGGLE_POSES();
  return {
    length: 24,
    keys: [
      { f: 0, p: PEEL },
      { f: 8, p: merge(j.a, { spine: [20, 0, 0], head: [20, 0, 0] }), ease: 'smooth' },
      { f: 24, p: j.b, ease: 'smooth' },
    ],
  };
}

/** dizzy (stun assist): swaying on wobbly legs, arms hanging, head rolling */
function dizzy(): Clip {
  const a = merge(STANCE, {
    root: [0.04, -0.1, 0],
    hips: [0, -30, 8],
    spine: [14, 0, -10],
    chest: [6, 0, -6],
    neck: [10, 0, -10],
    head: [16, 20, -18],
    upperArmL: [6, 0, 16],
    foreArmL: [-20, 0, 0],
    upperArmR: [4, 0, -14],
    foreArmR: [-24, 0, 0],
    thighL: [-20, 0, 8],
    shinL: [36, 0, 0],
    thighR: [6, 0, -8],
    shinR: [30, 0, 0],
  });
  const b = merge(a, { root: [-0.04, -0.12, 0], hips: [0, -38, -8], spine: [12, 0, 10], neck: [8, 0, 10], head: [12, 30, 16], upperArmL: [2, 0, 20], upperArmR: [8, 0, -20] });
  return {
    length: 48,
    loop: true,
    keys: [
      { f: 0, p: a },
      { f: 24, p: b, ease: 'smooth' },
      { f: 48, p: a, ease: 'smooth' },
    ],
  };
}

/** slammed flat on the floor, limbs flung up by the bounce, then back to the juggle */
function groundBounce(): Clip {
  const j = CLIP_JUGGLE_POSES();
  const flat = merge(LYING, {
    root: [0, -0.8, -0.05],
    head: [-10, -20, 0],
    upperArmL: [-60, 0, 100],
    foreArmL: [-20, 0, 0],
    upperArmR: [-70, 0, -100],
    foreArmR: [-20, 0, 0],
    thighL: [-56, 0, 22],
    shinL: [50, 0, 0],
    thighR: [-46, 0, -22],
    shinR: [40, 0, 0],
  });
  return {
    length: 30,
    keys: [
      { f: 0, p: flat },
      { f: 3, p: flat },
      { f: 12, p: merge(j.b, { root: [0, -0.3, 0] }), ease: 'smooth' },
      { f: 30, p: j.c, ease: 'smooth' },
    ],
  };
}

/** K.O. through the wall: spread-eagle tumble */
function blownAway(): Clip {
  const a = merge(HIT_HIGH, {
    root: [0, 0, 0],
    hips: [-40, -10, 0],
    spine: [-16, 0, 0],
    head: [-30, 10, 0],
    upperArmL: [-40, 0, 120],
    foreArmL: [-20, 0, 0],
    upperArmR: [-30, 0, -120],
    foreArmR: [-20, 0, 0],
    thighL: [-30, 0, 30],
    shinL: [30, 0, 0],
    thighR: [-10, 0, -30],
    shinR: [50, 0, 0],
  });
  const b = merge(a, { upperArmL: [-70, 0, 100], upperArmR: [-10, 0, -130], thighL: [-50, 0, 20], thighR: [0, 0, -36], head: [-20, -14, 0] });
  return { length: 24, loop: true, keys: [{ f: 0, p: a }, { f: 12, p: b, ease: 'smooth' }, { f: 24, p: a, ease: 'smooth' }] };
}

// ---------------------------------------------------------------------------
// assists (the friend called with the assist button)
// ---------------------------------------------------------------------------
function assistEnter(): Clip {
  const landing = merge(CROUCH, { root: [0, -0.32, 0], upperArmL: [-40, 0, 60], upperArmR: [-40, 0, -60], foreArmL: [-40, 0, 0], foreArmR: [-40, 0, 0] });
  return {
    length: 16,
    keys: [
      { f: 0, p: AIR },
      { f: 5, p: landing, ease: 'in' },
      { f: 14, p: STANCE, ease: 'smooth' },
      { f: 16, p: STANCE },
    ],
  };
}

function assistLeave(): Clip {
  // quick thumbs up, then springs away (12 frames before the poof)
  const thumbs = merge(STANCE, {
    root: [0, -0.02, 0],
    hips: [0, -40, 0],
    head: [-8, 20, 0],
    upperArmL: [-80, 0, 20],
    foreArmL: [-70, 0, 0],
    handL: [0, 0, 60],
    thighL: [-10, 0, 6],
    shinL: [10, 0, 0],
  });
  return {
    length: 14,
    keys: [
      { f: 0, p: STANCE },
      { f: 3, p: thumbs, ease: 'out' },
      { f: 7, p: thumbs },
      { f: 10, p: merge(CROUCH, { root: [0, -0.3, 0] }), ease: 'smooth' },
      { f: 13, p: AIR, ease: 'out' },
      { f: 14, p: AIR },
    ],
  };
}

const RUN_A = merge(DASH_F, { root: [0, -0.12, 0.1], spine: [24, 0, 0], upperArmL: [-90, 0, 20], foreArmL: [-60, 0, 0], upperArmR: [10, 0, -40], foreArmR: [-60, 0, 0] });
const RUN_B = merge(RUN_A, {
  thighL: [-20, 0, 6],
  shinL: [70, 0, 0],
  thighR: [-40, 0, -6],
  shinR: [30, 0, 0],
  upperArmL: [-40, 0, 20],
  upperArmR: [-70, 0, -30],
});

/** rush assist: crouched start (the sim's dash starts on frame 7) */
function assistRushStart(): Clip {
  return {
    length: 7,
    keys: [
      { f: 0, p: STANCE },
      { f: 5, p: merge(CROUCH, { root: [0, -0.3, 0.05], spine: [30, 0, 0] }), ease: 'out' },
      { f: 7, p: RUN_A, ease: 'in' },
    ],
  };
}

/** rush assist: sprint cycle until the punch */
function assistRushRun(): Clip {
  return { length: 12, loop: true, keys: [{ f: 0, p: RUN_A }, { f: 6, p: RUN_B, ease: 'smooth' }, { f: 12, p: RUN_A, ease: 'smooth' }] };
}

/** rush assist: the big punch (started a few frames before contact) */
function assistRushPunch(): Clip {
  const P = ATTACKS.powerPunch;
  return {
    length: 26,
    keys: [
      { f: 0, p: RUN_A },
      { f: 2, p: P.windup, ease: 'out' },
      { f: 5, p: P.strike, ease: 'in' },
      { f: 14, p: P.strike },
      { f: 26, p: STANCE, ease: 'smooth' },
    ],
  };
}

function assistLauncher(): Clip {
  // strikes on frame 8 (sim: startup 8, active 5, total 26)
  const U = ATTACKS.uppercut;
  const high = merge(U.strike, { root: [0, 0.1, 0.1], thighL: [-60, 0, 6], shinL: [70, 0, 0], footR: [30, 0, 0], footL: [10, 0, 0] });
  return {
    length: 26,
    keys: [
      { f: 0, p: STANCE },
      { f: 4, p: U.windup, ease: 'out' },
      { f: 5, p: U.windup },
      { f: 8, p: high, ease: 'in' },
      { f: 15, p: high },
      { f: 21, p: U.follow ?? STANCE, ease: 'smooth' },
      { f: 26, p: STANCE, ease: 'smooth' },
    ],
  };
}

function assistBeam(): Clip {
  // overhand throw
  const cock = merge(STANCE, {
    root: [0, -0.06, -0.06],
    hips: [0, -62, 0],
    spine: [-10, -18, 0],
    chest: [-8, -10, 0],
    head: [-6, 30, 0],
    upperArmR: [-160, 0, -14],
    foreArmR: [-110, 0, 0],
    upperArmL: [-80, 0, 30],
    foreArmL: [-20, 0, 0],
    thighL: [-50, 0, 6],
    shinL: [60, 0, 0],
  });
  const release = merge(STANCE, {
    root: [0, -0.1, 0.12],
    hips: [0, 30, 0],
    spine: [22, 14, 0],
    chest: [12, 14, 0],
    head: [-10, -26, 0],
    upperArmR: [-84, 0, 0],
    foreArmR: [-6, 0, 0],
    handR: [-20, 0, 0],
    upperArmL: [-20, 0, 40],
    foreArmL: [-60, 0, 0],
    thighL: [-46, 0, 6],
    shinL: [50, 0, 0],
    thighR: [22, 0, -6],
    shinR: [14, 0, 0],
    footR: [-30, 0, 0],
  });
  const follow = merge(release, { upperArmR: [-30, 0, 20], foreArmR: [-30, 0, 0], spine: [28, 18, 0] });
  // the projectile leaves on frame 10 (sim: startup 10, total 26)
  return {
    length: 26,
    keys: [
      { f: 0, p: STANCE },
      { f: 5, p: cock, ease: 'out' },
      { f: 7, p: cock },
      { f: 10, p: release, ease: 'in' },
      { f: 16, p: follow, ease: 'smooth' },
      { f: 21, p: follow },
      { f: 26, p: STANCE, ease: 'smooth' },
    ],
  };
}

function assistStun(): Clip {
  // goofy dance: hip sway, waving arm, head tilt with a wink
  const relaxed: Pose = { thighL: [-10, 0, 8], shinL: [18, 0, 0], footL: [-6, 0, 0], thighR: [4, 0, -8], shinR: [10, 0, 0], footR: [-6, 0, 0] };
  const a = merge(STANCE, relaxed, {
    root: [0.03, -0.04, 0],
    hips: [0, -26, 10],
    spine: [0, 0, -12],
    chest: [0, 0, -6],
    head: [-6, 24, 16],
    upperArmL: [0, 0, 150],
    foreArmL: [0, 0, 30],
    handL: [0, 0, 20],
    upperArmR: [-20, 0, -30],
    foreArmR: [-90, 0, 0],
  });
  const b = merge(STANCE, relaxed, {
    root: [-0.03, -0.08, 0],
    hips: [0, -40, -10],
    spine: [0, 0, 12],
    chest: [0, 0, 6],
    head: [-6, 10, -16],
    upperArmL: [0, 0, 118],
    foreArmL: [0, 0, 70],
    handL: [0, 0, -20],
    upperArmR: [-10, 0, -40],
    foreArmR: [-100, 0, 0],
    thighL: [-24, 0, 8],
    shinL: [44, 0, 0],
  });
  return {
    length: 40,
    loop: true,
    keys: [
      { f: 0, p: a },
      { f: 10, p: b, ease: 'smooth' },
      { f: 20, p: a, ease: 'smooth' },
      { f: 30, p: b, ease: 'smooth' },
      { f: 40, p: a, ease: 'smooth' },
    ],
  };
}

// ---------------------------------------------------------------------------
// library
// ---------------------------------------------------------------------------
export type ClipId = string;

function buildLibrary(): Record<ClipId, Clip> {
  const lib: Record<ClipId, Clip> = {
    idle: idle(),
    walkF: walk(true),
    walkB: walk(false),
    crouch: single(CROUCH),
    prejump: single(merge(CROUCH, { root: [0, -0.22, 0] })),
    jump: { length: 34, keys: [{ f: 0, p: merge(STANCE, { root: [0, 0, 0] }) }, { f: 8, p: AIR, ease: 'out' }, { f: 34, p: AIR }] },
    land: single(merge(CROUCH, { root: [0, -0.2, 0] })),
    dashF: { length: 15, keys: [{ f: 0, p: STANCE }, { f: 5, p: DASH_F, ease: 'out' }, { f: 15, p: STANCE, ease: 'smooth' }] },
    dashB: { length: 18, keys: [{ f: 0, p: STANCE }, { f: 5, p: DASH_B, ease: 'out' }, { f: 18, p: STANCE, ease: 'smooth' }] },
    hitHigh: reaction(HIT_HIGH, STANCE),
    hitMid: reaction(HIT_MID, STANCE),
    hitLow: reaction(HIT_LOW, STANCE),
    crouchHit: reaction(CROUCH_HIT, CROUCH),
    block: reaction(BLOCK, STANCE, 14),
    crouchBlock: reaction(CROUCH_BLOCK, CROUCH, 14),
    juggle: juggle(),
    lying: single(LYING),
    getup: getup(),
    throwing: throwing(),
    thrown: thrown(),
    throwBreak: reaction(merge(HIT_HIGH, { head: [-10, 0, 0] }), STANCE, 20),
    intro0: intro(0),
    intro1: intro(1),
    win0: win(0),
    win1: win(1),
    win2: win(2),
    lose: { length: 30, keys: [{ f: 0, p: STANCE }, { f: 30, p: LOSE, ease: 'smooth' }] },
    stance: single(STANCE),
    guard: { length: 1, keys: [{ f: 0, p: BLOCK }] },
    crouchGuard: { length: 1, keys: [{ f: 0, p: CROUCH_BLOCK }] },
    parry: parry(),
    parried: parried(),
    superFlash: superFlash(),
    superCombo: superCombo(),
    superVictim: superVictim(),
    // relaxed pose used by the select screen
    showcase: idle(),
    superJump: superJump(),
    airDash: airDash(),
    wallSplat: wallSplat(),
    wallBounce: wallBounce(),
    groundBounce: groundBounce(),
    blownAway: blownAway(),
    'assist:enter': assistEnter(),
    'assist:leave': assistLeave(),
    'assist:rush': assistRushStart(),
    'assist:rushRun': assistRushRun(),
    'assist:rushPunch': assistRushPunch(),
    dizzy: dizzy(),
    'assist:launcher': assistLauncher(),
    'assist:beam': assistBeam(),
    'assist:stun': assistStun(),
  };
  for (const id of Object.keys(MOVES) as MoveId[]) lib['move:' + id] = moveClip(id);
  return lib;
}

export const CLIPS = buildLibrary();
