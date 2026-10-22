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

/**
 * throw (ranged profile), seen side-on: torso twisted away and leaning back, lead arm
 * aiming at the opponent, throwing (right, camera-side) elbow up with the hand behind the head
 */
const THROW_COCK: Pose = merge(STANCE, {
  root: [0, -0.07, -0.08],
  hips: [0, -38, 0],
  spine: [-10, -8, 0],
  chest: [-8, -6, 0],
  neck: [0, 8, 0],
  head: [-2, 14, 0],
  upperArmL: [-76, 0, 10],
  foreArmL: [-14, 0, 0],
  handL: [0, 0, 0],
  upperArmR: [-160, 0, -12],
  foreArmR: [-118, 0, 0],
  handR: [24, 0, 0],
  thighL: [-44, 0, 6],
  shinL: [58, 0, 0],
  footL: [-6, 0, 0],
  thighR: [14, 0, -6],
  shinR: [30, 0, 0],
  footR: [-34, 0, 0],
});
/** extra pull just before the whip (anticipation): lead knee up, elbow further back */
const THROW_PULL: Pose = merge(THROW_COCK, {
  root: [0, -0.05, -0.13],
  hips: [-4, -42, 0],
  spine: [-17, -10, 0],
  chest: [-10, -8, 0],
  head: [0, 16, 0],
  upperArmR: [-176, 0, -14],
  foreArmR: [-126, 0, 0],
  handR: [30, 0, 0],
  upperArmL: [-72, 0, 12],
  thighL: [-74, 0, 6],
  shinL: [86, 0, 0],
  footL: [10, 0, 0],
  thighR: [10, 0, -6],
  shinR: [26, 0, 0],
});
/** release: the body whips forward, throwing arm straight at the opponent */
const THROW_RELEASE: Pose = merge(STANCE, {
  root: [0, -0.12, 0.15],
  hips: [0, 24, 0],
  spine: [18, 14, 0],
  chest: [10, 12, 0],
  neck: [0, -8, 0],
  head: [-8, -20, 0],
  upperArmR: [-94, 0, -2],
  foreArmR: [-6, 0, 0],
  handR: [-16, 0, 0],
  upperArmL: [-24, 0, 36],
  foreArmL: [-72, 0, 0],
  thighL: [-50, 0, 6],
  shinL: [54, 0, 0],
  footL: [-4, 0, 0],
  thighR: [24, 0, -6],
  shinR: [12, 0, 0],
  footR: [-34, 0, 0],
});
/** grenade: the same release, arm pointing up and forward (lob) */
const THROW_RELEASE_LOB: Pose = merge(THROW_RELEASE, {
  spine: [8, 14, 0],
  chest: [4, 12, 0],
  head: [-16, -20, 0],
  upperArmR: [-126, 0, -4],
  foreArmR: [-10, 0, 0],
  handR: [-24, 0, 0],
});
/** follow-through: the arm swings down across the body */
const THROW_FOLLOW: Pose = merge(THROW_RELEASE, {
  root: [0, -0.16, 0.17],
  hips: [0, 34, 0],
  spine: [30, 18, 0],
  chest: [14, 14, 0],
  head: [4, -22, 0],
  upperArmR: [-46, 0, 18],
  foreArmR: [-38, 0, 0],
  handR: [0, 0, 0],
  thighR: [30, 0, -6],
  shinR: [26, 0, 0],
});

// ---------------------------------------------------------------------------
// grabs (throw, back throw, whiff, escape)
// ---------------------------------------------------------------------------
/** grab anticipation: low, shoulders forward, both hands open and drawn back to the hips */
const GRAB_LOAD: Pose = merge(STANCE, {
  root: [0, -0.16, -0.02],
  hips: [0, -14, 0],
  spine: [18, -2, 0],
  chest: [10, 0, 0],
  neck: [-8, 0, 0],
  head: [-12, 4, 0],
  upperArmL: [-36, 0, 34],
  foreArmL: [-70, 0, 0],
  handL: [-30, 0, 0],
  upperArmR: [-30, 0, -34],
  foreArmR: [-70, 0, 0],
  handR: [-30, 0, 0],
  thighL: [-46, 0, 8],
  shinL: [62, 0, 0],
  thighR: [18, 0, -8],
  shinR: [36, 0, 0],
});
/** lunge: lead foot steps in, both arms fully out at collar height, hands open */
const GRAB_REACH: Pose = merge(STANCE, {
  root: [0, -0.1, 0.16],
  hips: [0, -6, 0],
  spine: [16, 0, 0],
  chest: [6, 0, 0],
  neck: [-6, 0, 0],
  head: [-10, 0, 0],
  upperArmL: [-92, 0, 20],
  foreArmL: [-12, 0, 0],
  handL: [-34, 0, 0],
  upperArmR: [-92, 0, -20],
  foreArmR: [-12, 0, 0],
  handR: [-34, 0, 0],
  thighL: [-56, 0, 6],
  shinL: [52, 0, 0],
  footL: [-4, 0, 0],
  thighR: [26, 0, -6],
  shinR: [14, 0, 0],
  footR: [-36, 0, 0],
});
/** whiff: the hands close on nothing, the body falls forward past its lead foot */
const GRAB_MISS: Pose = merge(STANCE, {
  root: [0, -0.2, 0.2],
  hips: [8, 4, 0],
  spine: [30, 0, 0],
  chest: [16, 0, 0],
  neck: [10, 0, 0],
  head: [12, -6, 0],
  upperArmL: [-70, 0, -6],
  foreArmL: [-92, 0, 0],
  handL: [30, 0, 0],
  upperArmR: [-66, 0, 8],
  foreArmR: [-96, 0, 0],
  handR: [30, 0, 0],
  thighL: [-64, 0, 6],
  shinL: [78, 0, 0],
  footL: [-8, 0, 0],
  thighR: [40, 0, -6],
  shinR: [46, 0, 0],
  footR: [-30, 0, 0],
});
/** hold: fists twisted in the collar, elbows down, pulled in chest to chest */
const GRAB_HOLD: Pose = merge(STANCE, {
  root: [0, -0.08, 0.08],
  hips: [0, -8, 0],
  spine: [10, 0, 0],
  chest: [4, 0, 0],
  head: [-6, 0, 0],
  upperArmL: [-70, 0, 10],
  foreArmL: [-60, 0, 0],
  handL: [20, 0, 0],
  upperArmR: [-70, 0, -10],
  foreArmR: [-60, 0, 0],
  handR: [20, 0, 0],
  thighL: [-40, 0, 8],
  shinL: [48, 0, 0],
  thighR: [18, 0, -8],
  shinR: [24, 0, 0],
});
/** throw escape: the lead arm slaps the grab away, body jerked back */
const TECH_SLAP: Pose = merge(STANCE, {
  root: [0, -0.1, -0.1],
  hips: [-6, -46, 0],
  spine: [-10, -10, 0],
  chest: [-8, -14, 0],
  neck: [-6, 0, 0],
  head: [-14, 14, 0],
  upperArmL: [-96, 0, 74],
  foreArmL: [-22, 0, 0],
  handL: [-30, 0, 0],
  upperArmR: [-56, 0, -26],
  foreArmR: [-120, 0, 0],
  thighL: [-22, 0, 8],
  shinL: [30, 0, 0],
  thighR: [30, 0, -8],
  shinR: [40, 0, 0],
  footR: [-44, 0, 0],
});

// ---------------------------------------------------------------------------
// v6 chains and finishers: key poses
// ---------------------------------------------------------------------------
/** rear hook landing: rear shoulder through, elbow at 90 degrees, heel pivoting */
const HOOK_HIT: Pose = merge(STANCE, {
  root: [0, -0.1, 0.08],
  hips: [0, 22, 0],
  spine: [8, 12, 0],
  chest: [6, 14, 0],
  neck: [0, -6, 0],
  head: [-4, -22, 0],
  // (Euler worked out so the upper arm is level at shoulder height, pointing forward-out,
  // and the elbow bends horizontally inward: a true hook arc)
  upperArmR: [-12, 46, -90],
  foreArmR: [-92, 0, 0],
  handR: [0, 0, 0],
  upperArmL: [-46, 0, 24],
  foreArmL: [-130, 0, 0],
  thighL: [-40, 0, 8],
  shinL: [50, 0, 0],
  thighR: [22, 0, -6],
  shinR: [22, 0, 0],
  footR: [-44, 0, 0],
});
/** liver shot: low, leaning in, lead fist driven up into the ribs */
const BODY_HIT: Pose = merge(STANCE, {
  root: [0, -0.26, 0.14],
  hips: [0, -14, 0],
  spine: [24, -4, 0],
  chest: [10, -8, 0],
  neck: [-6, 0, 0],
  head: [-2, 8, 0],
  upperArmL: [-58, 0, 6],
  foreArmL: [-64, 0, 0],
  handL: [0, 0, 0],
  upperArmR: [-52, 0, -18],
  foreArmR: [-126, 0, 0],
  thighL: [-68, 0, 8],
  shinL: [82, 0, 0],
  footL: [-6, 0, 0],
  thighR: [26, 0, -6],
  shinR: [42, 0, 0],
  footR: [-40, 0, 0],
});
/** spinning heel, half way: back turned to the opponent, head looking over the shoulder */
const SPIN_BACK: Pose = merge(STANCE, {
  root: [0, -0.1, 0.02],
  hips: [0, -150, 0],
  spine: [6, -10, 0],
  chest: [4, -10, 0],
  neck: [0, -20, 0],
  head: [-4, -40, 0],
  upperArmL: [-30, 0, 46],
  foreArmL: [-100, 0, 0],
  upperArmR: [-40, 0, -40],
  foreArmR: [-100, 0, 0],
  thighL: [-14, 0, 6],
  shinL: [20, 0, 0],
  thighR: [-30, 0, -40],
  shinR: [70, 0, 0],
});
/** spinning heel, impact: the straight rear leg whips round at head height, torso leaning away */
const SPIN_HEEL: Pose = merge(STANCE, {
  root: [0, -0.02, 0.02],
  hips: [0, -268, 0],
  spine: [0, 0, -30],
  chest: [0, 0, -14],
  neck: [0, -20, 12],
  head: [0, -26, 12],
  upperArmL: [-26, 0, 70],
  foreArmL: [-70, 0, 0],
  upperArmR: [-36, 0, -16],
  foreArmR: [-90, 0, 0],
  thighR: [-14, 0, -124],
  shinR: [2, 0, 0],
  footR: [30, 0, 0],
  thighL: [0, 0, 16],
  shinL: [12, 0, 0],
  footL: [0, 0, 0],
});
/** hammer fist windup: up on the toes, leaning back, both fists joined high over the head */
const HAMMER_UP: Pose = merge(STANCE, {
  root: [0, 0.03, -0.06],
  hips: [-6, -10, 0],
  spine: [-16, 0, 0],
  chest: [-10, 0, 0],
  neck: [-6, 0, 0],
  head: [-18, 0, 0],
  upperArmL: [-172, 0, -10],
  foreArmL: [-44, 0, 0],
  handL: [10, 0, 0],
  upperArmR: [-172, 0, 10],
  foreArmR: [-44, 0, 0],
  handR: [10, 0, 0],
  thighL: [-30, 0, 6],
  shinL: [24, 0, 0],
  footL: [20, 0, 0],
  thighR: [14, 0, -6],
  shinR: [10, 0, 0],
  footR: [10, 0, 0],
});
/** hammer fist impact: the joined fists smashed down in front, whole body folded into it */
const HAMMER_DOWN: Pose = merge(STANCE, {
  root: [0, -0.18, 0.2],
  hips: [6, -6, 0],
  spine: [24, 0, 0],
  chest: [12, 0, 0],
  neck: [4, 0, 0],
  head: [4, 0, 0],
  upperArmL: [-108, 0, -14],
  foreArmL: [-14, 0, 0],
  handL: [-10, 0, 0],
  upperArmR: [-108, 0, 14],
  foreArmR: [-14, 0, 0],
  handR: [-10, 0, 0],
  thighL: [-74, 0, 8],
  shinL: [92, 0, 0],
  footL: [-14, 0, 0],
  thighR: [28, 0, -6],
  shinR: [56, 0, 0],
  footR: [-40, 0, 0],
});
const HAMMER_SETTLE: Pose = merge(HAMMER_DOWN, {
  root: [0, -0.26, 0.16],
  spine: [26, 0, 0],
  upperArmL: [-50, 0, -4],
  foreArmL: [-30, 0, 0],
  upperArmR: [-50, 0, 4],
  foreArmR: [-30, 0, 0],
});
/** rising uppercut: deep crouch, rear fist cocked low at the hip */
const SHORYU_LOAD: Pose = merge(CROUCH, {
  root: [0, -0.46, 0.02],
  hips: [0, -56, 0],
  spine: [22, -12, 0],
  chest: [10, -10, 0],
  head: [-14, 10, 0],
  upperArmR: [0, 0, -24],
  foreArmR: [-120, 0, 0],
  upperArmL: [-62, 0, 20],
  foreArmL: [-110, 0, 0],
});
/** rising uppercut, take-off: rear fist driven straight up, lead knee up, toes leaving the floor */
const SHORYU_RISE: Pose = merge(STANCE, {
  root: [0, 0.16, 0.1],
  hips: [-6, 26, 0],
  spine: [-8, 14, 0],
  chest: [-10, 14, 0],
  neck: [-8, 0, 0],
  head: [-22, -16, 0],
  upperArmR: [-168, 0, -6],
  foreArmR: [-16, 0, 0],
  handR: [0, 0, 0],
  upperArmL: [-26, 0, 30],
  foreArmL: [-90, 0, 0],
  thighL: [-86, 0, 8],
  shinL: [104, 0, 0],
  footL: [16, 0, 0],
  thighR: [8, 0, -6],
  shinR: [26, 0, 0],
  footR: [44, 0, 0],
});
/** top of the rising uppercut: fully stretched, about to fall back down */
const SHORYU_TOP: Pose = merge(SHORYU_RISE, {
  root: [0, 0.42, 0.12],
  hips: [-10, 40, 0],
  spine: [-12, 18, 0],
  upperArmR: [-176, 0, -2],
  foreArmR: [-6, 0, 0],
  thighL: [-70, 0, 8],
  shinL: [110, 0, 0],
  thighR: [-10, 0, -6],
  shinR: [60, 0, 0],
});
/** tornado: loaded low, shoulders wound back the other way */
const TORNADO_LOAD: Pose = merge(CROUCH, {
  root: [0, -0.34, 0],
  hips: [0, -80, 0],
  spine: [18, -20, 0],
  chest: [8, -14, 0],
  head: [-10, 26, 0],
  upperArmL: [-40, 0, 60],
  foreArmL: [-60, 0, 0],
  upperArmR: [-70, 0, -30],
  foreArmR: [-90, 0, 0],
});
/** tornado, in the air with the back to the opponent: legs tucked, arms wrapped in to spin fast */
const TORNADO_AIR: Pose = merge(AIR, {
  root: [0, 0.3, 0.06],
  hips: [0, -190, 0],
  spine: [4, -10, 0],
  chest: [0, -10, 0],
  neck: [0, -16, 0],
  head: [-6, -30, 0],
  upperArmL: [-60, 0, 10],
  foreArmL: [-120, 0, 0],
  upperArmR: [-60, 0, -10],
  foreArmR: [-120, 0, 0],
  thighL: [-80, 0, 8],
  shinL: [110, 0, 0],
  thighR: [-50, 0, -20],
  shinR: [100, 0, 0],
});
/** tornado impact: still airborne, the rear leg slashes across at chest height */
const TORNADO_SLASH: Pose = merge(AIR, {
  root: [0, 0.34, 0.08],
  hips: [0, -286, 0],
  spine: [0, 0, -26],
  chest: [0, 0, -10],
  neck: [0, -24, 10],
  head: [0, -24, 10],
  upperArmL: [-20, 0, 80],
  foreArmL: [-50, 0, 0],
  upperArmR: [-30, 0, -40],
  foreArmR: [-80, 0, 0],
  thighR: [-10, 0, -112],
  shinR: [4, 0, 0],
  footR: [24, 0, 0],
  thighL: [-60, 0, 14],
  shinL: [100, 0, 0],
  footL: [-10, 0, 0],
});
/** tornado landing: crouched, the spin running out */
const TORNADO_LAND: Pose = merge(CROUCH, {
  root: [0, -0.3, 0.02],
  hips: [0, -370, 0],
  spine: [20, -6, 0],
  upperArmL: [-40, 0, 50],
  foreArmL: [-70, 0, 0],
  upperArmR: [-40, 0, -40],
  foreArmR: [-90, 0, 0],
});
/** axe kick: the straight lead leg raised above the head, arms out for balance */
const AXE_UP: Pose = merge(STANCE, {
  root: [0, 0.0, -0.08],
  hips: [-18, -16, 0],
  spine: [-14, 0, 0],
  chest: [-8, 0, 0],
  neck: [-4, 0, 0],
  head: [-8, 6, 0],
  thighL: [-168, 0, 8],
  shinL: [4, 0, 0],
  footL: [-24, 0, 0],
  thighR: [10, 0, -6],
  shinR: [8, 0, 0],
  footR: [-10, 0, 0],
  upperArmL: [-40, 0, 64],
  foreArmL: [-50, 0, 0],
  upperArmR: [-30, 0, -60],
  foreArmR: [-60, 0, 0],
});
/** axe kick impact: the heel chopped down in front, body folding forward over it */
const AXE_DOWN: Pose = merge(STANCE, {
  root: [0, -0.06, 0.14],
  hips: [4, -14, 0],
  spine: [14, 0, 0],
  chest: [12, 0, 0],
  neck: [6, 0, 0],
  head: [8, 4, 0],
  thighL: [-130, 0, 6],
  shinL: [4, 0, 0],
  footL: [-34, 0, 0],
  thighR: [12, 0, -6],
  shinR: [14, 0, 0],
  footR: [-20, 0, 0],
  upperArmL: [-20, 0, 46],
  foreArmL: [-70, 0, 0],
  upperArmR: [-26, 0, -46],
  foreArmR: [-70, 0, 0],
});
const AXE_LAND: Pose = merge(STANCE, {
  root: [0, -0.18, 0.12],
  hips: [6, -20, 0],
  spine: [16, -2, 0],
  thighL: [-52, 0, 8],
  shinL: [64, 0, 0],
  footL: [-10, 0, 0],
  thighR: [22, 0, -6],
  shinR: [36, 0, 0],
  footR: [-36, 0, 0],
});
/** missed grab, after the clap: staggering a half step past the lead foot, arms flailing for balance */
const GRAB_STUMBLE: Pose = merge(STANCE, {
  root: [0, -0.16, 0.14],
  hips: [4, -18, 0],
  spine: [20, -4, 0],
  chest: [10, 0, 0],
  head: [6, 10, 0],
  upperArmL: [-40, 0, 50],
  foreArmL: [-40, 0, 0],
  upperArmR: [-20, 0, -46],
  foreArmR: [-50, 0, 0],
  thighL: [-50, 0, 8],
  shinL: [56, 0, 0],
  thighR: [30, 0, -8],
  shinR: [50, 0, 0],
  footR: [-40, 0, 0],
});

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
  // ranged profile: overarm throw with the rear (right) hand, see projectileClip()
  projectile: {
    windup: THROW_COCK,
    strike: THROW_RELEASE,
    follow: THROW_FOLLOW,
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
  // the grab: both hands shoot out, open; on a connect the 'throwing' clip takes over,
  // so the rest of this clip is the whiff (clutching empty air, off balance, back to guard)
  throw: {
    windup: GRAB_LOAD,
    strike: GRAB_REACH,
    follow: GRAB_MISS,
  },
  // ---- v6 button chains ----
  // RP chain step 2: rear hook to the head, hips and shoulders twist hard through
  hook: {
    windup: merge(STANCE, {
      root: [0, -0.1, -0.02],
      hips: [0, -50, 0],
      spine: [4, -10, 0],
      chest: [4, -14, 0],
      head: [-6, 14, 0],
      upperArmR: [-30, 0, -70],
      foreArmR: [-100, 0, 0],
      thighR: [18, 0, -6],
      shinR: [30, 0, 0],
    }),
    strike: HOOK_HIT,
    follow: merge(HOOK_HIT, { hips: [0, 50, 0], chest: [6, 30, 0], upperArmR: [-8, 80, -90], foreArmR: [-104, 0, 0], head: [-2, -30, 0] }),
  },
  // RP chain step 3: knees dip, the LEAD fist digs up into the ribs (alternates with the rear hook)
  bodyBlow: {
    windup: merge(STANCE, {
      root: [0, -0.24, 0.0],
      hips: [0, -54, 0],
      spine: [18, -12, 0],
      chest: [10, -10, 0],
      head: [-4, 14, 0],
      upperArmL: [-14, 0, 30],
      foreArmL: [-112, 0, 0],
      upperArmR: [-58, 0, -18],
      foreArmR: [-128, 0, 0],
      thighL: [-60, 0, 8],
      shinL: [84, 0, 0],
      thighR: [12, 0, -6],
      shinR: [58, 0, 0],
      footR: [-34, 0, 0],
    }),
    strike: BODY_HIT,
    follow: merge(BODY_HIT, { root: [0, -0.2, 0.1], upperArmL: [-80, 0, 6], foreArmL: [-70, 0, 0] }),
  },
  // LK / RK chain: knee chambers, the shin snaps out to the belly and straight back
  snapKick: {
    windup: merge(STANCE, {
      root: [0, -0.03, -0.02],
      hips: [0, -26, 0],
      spine: [-4, -4, 0],
      thighL: [-104, 0, 6],
      shinL: [122, 0, 0],
      footL: [24, 0, 0],
      thighR: [8, 0, -6],
      shinR: [14, 0, 0],
      upperArmR: [-40, 0, -30],
    }),
    strike: merge(STANCE, {
      root: [0, -0.02, -0.03],
      hips: [0, -22, 0],
      spine: [-12, -4, 0],
      chest: [-4, 0, 0],
      head: [2, 6, 0],
      thighL: [-86, 0, 4],
      shinL: [6, 0, 0],
      footL: [-40, 0, 0],
      thighR: [6, 0, -6],
      shinR: [10, 0, 0],
      footR: [-14, 0, 0],
      upperArmR: [-34, 0, -34],
      foreArmR: [-110, 0, 0],
    }),
    follow: merge(STANCE, { thighL: [-96, 0, 6], shinL: [118, 0, 0], footL: [20, 0, 0], thighR: [8, 0, -6], shinR: [14, 0, 0] }),
  },
  // RK chain step 2: spinning back heel (clip: spinClip, the hips keep turning the same way)
  spinHeel: {
    windup: SPIN_BACK,
    strike: SPIN_HEEL,
    follow: merge(SPIN_HEEL, { hips: [0, -300, 0], thighR: [-30, 0, -80], shinR: [40, 0, 0] }),
    end: merge(STANCE, { hips: [0, -392, 0] }),
  },
  // ---- v6 two-button finishers (custom clips below, these are their key poses) ----
  hammerFist: { windup: HAMMER_UP, strike: HAMMER_DOWN, follow: HAMMER_SETTLE },
  risingUppercut: { base: CROUCH, windup: SHORYU_LOAD, strike: SHORYU_RISE, follow: SHORYU_TOP },
  tornadoKick: { windup: TORNADO_LOAD, strike: TORNADO_SLASH, follow: TORNADO_LAND, end: merge(STANCE, { hips: [0, -392, 0] }) },
  axeKick: { windup: AXE_UP, strike: AXE_DOWN, follow: AXE_LAND },
  // a grab that caught nothing (follows the throw's reach): hands clap shut on air, stumble, recover
  throwWhiff: { base: GRAB_REACH, windup: GRAB_REACH, strike: GRAB_MISS, follow: GRAB_STUMBLE },
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

/**
 * Clip of a move from timed keys: `at` = 'S' + offset (startup), 'A' + offset (last active
 * frame), 'T' + offset (total), or a fraction of the startup / recovery. Strike keys land
 * exactly on the move's active frames (MOVES = base timings; fighterView maps the profiles).
 */
type At = number | `S${string}` | `A${string}` | `T${string}` | `R${string}`;
function timedClip(id: MoveId, keys: [At, Pose, Key['ease']?][]): Clip {
  const m = MOVES[id];
  const total = moveTotal(m);
  const lastActive = m.startup + m.active - 1;
  const at = (a: At): number => {
    if (typeof a === 'number') return Math.round(a * m.startup);
    const n = Number(a.slice(1) || 0);
    if (a[0] === 'S') return m.startup + n;
    if (a[0] === 'A') return lastActive + n;
    if (a[0] === 'R') return lastActive + Math.round(n * m.recovery);
    return total + n;
  };
  const out: Key[] = [];
  for (const [a, p, ease] of keys) {
    const f = Math.max(0, Math.min(total, at(a)));
    if (out.length && f <= out[out.length - 1].f) continue;
    out.push({ f, p, ease });
  }
  return { length: total, keys: out };
}

/** the v6 finishers / special moves: more keys than windup -> strike -> recovery */
function customMoveClips(): Partial<Record<MoveId, Clip>> {
  const A = ATTACKS;
  return {
    // fists joined over the head, a held beat of anticipation, then smashed down
    hammerFist: timedClip('hammerFist', [
      [0, STANCE],
      [0.5, HAMMER_UP, 'out'],
      ['S-3', merge(HAMMER_UP, { root: [0, 0.05, -0.08], spine: [-22, 0, 0], upperArmL: [-182, 0, -10], upperArmR: [-182, 0, 10] }), 'smooth'],
      ['S', HAMMER_DOWN, 'in'],
      ['A', merge(HAMMER_DOWN, { root: [0, -0.3, 0.22], spine: [36, 0, 0], chest: [18, 0, 0], upperArmL: [-72, 0, -14], upperArmR: [-72, 0, 14] }), 'out'],
      ['R0.4', HAMMER_SETTLE, 'smooth'],
      ['T', STANCE, 'smooth'],
    ]),
    // crouch, explode upward fist first, hang at the top, drop back down, land
    risingUppercut: timedClip('risingUppercut', [
      [0, STANCE],
      [0.55, SHORYU_LOAD, 'out'],
      ['S-1', merge(SHORYU_LOAD, { root: [0, -0.48, 0.04] })],
      ['S', SHORYU_RISE, 'out'],
      ['A', SHORYU_TOP, 'out'],
      ['R0.45', merge(AIR, { root: [0, 0.1, 0.08], hips: [0, 10, 0], upperArmR: [-120, 0, -20], foreArmR: [-50, 0, 0] }), 'in'],
      ['R0.62', merge(CROUCH, { root: [0, -0.34, 0.06] }), 'in'],
      ['T', STANCE, 'smooth'],
    ]),
    // load, hop and spin with the back to the opponent, the rear leg slashes through, land
    tornadoKick: timedClip('tornadoKick', [
      [0, STANCE],
      [0.4, TORNADO_LOAD, 'out'],
      [0.78, TORNADO_AIR, 'smooth'],
      ['S', TORNADO_SLASH, 'linear'],
      ['A', merge(TORNADO_SLASH, { hips: [0, -318, 0], root: [0, 0.28, 0.1] }), 'linear'],
      ['R0.35', TORNADO_LAND, 'in'],
      ['T', A.tornadoKick.end!, 'smooth'],
    ]),
    // knee chambers, the straight leg goes up over the head, held, then the heel chops down
    axeKick: timedClip('axeKick', [
      [0, STANCE],
      [0.35, merge(STANCE, { root: [0, -0.04, -0.04], spine: [-6, -4, 0], thighL: [-110, 0, 8], shinL: [110, 0, 0], footL: [10, 0, 0] }), 'out'],
      [0.75, AXE_UP, 'smooth'],
      ['S-2', merge(AXE_UP, { thighL: [-176, 0, 8], spine: [-18, 0, 0] })],
      ['S', AXE_DOWN, 'in'],
      ['A', merge(AXE_DOWN, { root: [0, -0.14, 0.16], hips: [14, -14, 0], spine: [28, 0, 0], thighL: [-66, 0, 6] }), 'in'],
      ['R0.4', AXE_LAND, 'smooth'],
      ['T', STANCE, 'smooth'],
    ]),
    // hands clap shut on empty air, stumbling half a step, guard back up
    throwWhiff: timedClip('throwWhiff', [
      [0, GRAB_REACH],
      ['S3', GRAB_MISS, 'in'],
      ['S8', GRAB_MISS],
      ['S15', GRAB_STUMBLE, 'smooth'],
      ['T', STANCE, 'smooth'],
    ]),
    // the hook winds the rear shoulder back hard, then whips through
    hook: timedClip('hook', [
      [0, STANCE],
      [0.6, A.hook.windup, 'out'],
      ['S', A.hook.strike, 'in'],
      ['A', A.hook.strike],
      ['R0.35', A.hook.follow!, 'smooth'],
      ['T', STANCE, 'smooth'],
    ]),
  };
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
  const grab = GRAB_HOLD;
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

/**
 * Back throw (thrower): grab, pivot on the lead foot pulling the victim round, heave them
 * over the shoulder, slam them down BEHIND (sim: the victim travels from the front to
 * behind between frames ~14 and 34), then turn back to guard.
 */
function throwingBack(): Clip {
  const pivot = merge(GRAB_HOLD, {
    root: [0, -0.14, 0.02],
    hips: [0, -70, 0],
    spine: [4, -24, 0],
    chest: [0, -20, 0],
    head: [-10, 30, 0],
    upperArmL: [-110, 0, 30],
    foreArmL: [-40, 0, 0],
    upperArmR: [-120, 0, -10],
    foreArmR: [-50, 0, 0],
    thighL: [-50, 0, 10],
    shinL: [60, 0, 0],
    thighR: [20, 0, -10],
    shinR: [40, 0, 0],
  });
  const heave = merge(STANCE, {
    root: [0, -0.06, -0.04],
    hips: [0, -120, 0],
    spine: [-20, -20, 0],
    chest: [-14, -16, 0],
    neck: [-10, 0, 0],
    head: [-20, 20, 0],
    upperArmL: [-176, 0, 20],
    foreArmL: [-30, 0, 0],
    upperArmR: [-176, 0, -20],
    foreArmR: [-30, 0, 0],
    thighL: [-30, 0, 10],
    shinL: [30, 0, 0],
    thighR: [6, 0, -10],
    shinR: [20, 0, 0],
  });
  // facing the slam behind: chest turned to the back, bent over the victim, arms driven down
  const slam = merge(STANCE, {
    root: [0, -0.3, -0.12],
    hips: [0, -196, 0],
    spine: [34, 0, 0],
    chest: [18, 0, 0],
    neck: [4, 0, 0],
    head: [6, 0, 0],
    upperArmL: [-56, 0, 10],
    foreArmL: [-12, 0, 0],
    upperArmR: [-56, 0, -10],
    foreArmR: [-12, 0, 0],
    thighL: [-60, 0, 8],
    shinL: [84, 0, 0],
    thighR: [20, 0, -8],
    shinR: [60, 0, 0],
  });
  const rise = merge(STANCE, { hips: [0, -150, 0], spine: [10, -10, 0], head: [-6, 30, 0] });
  return {
    length: 58,
    keys: [
      { f: 0, p: GRAB_HOLD },
      { f: 8, p: GRAB_HOLD },
      { f: 16, p: pivot, ease: 'smooth' },
      { f: 26, p: heave, ease: 'smooth' },
      { f: 34, p: slam, ease: 'in' },
      { f: 44, p: slam },
      { f: 52, p: rise, ease: 'smooth' },
      { f: 58, p: merge(STANCE, { hips: [0, -32, 0] }), ease: 'smooth' },
    ],
  };
}

/** Back throw (victim): pulled in, flipped head over heels over the thrower, slammed flat on the back. */
function thrownBack(): Clip {
  const held = merge(HIT_HIGH, { root: [0, -0.02, 0] });
  const pulled = merge(HIT_HIGH, {
    root: [0, 0.3, 0],
    hips: [40, -10, 0],
    spine: [10, 0, 0],
    upperArmL: [-60, 0, 70],
    upperArmR: [-50, 0, -70],
    thighL: [-30, 0, 14],
    shinL: [50, 0, 0],
    thighR: [-10, 0, -14],
    shinR: [60, 0, 0],
  });
  const over = merge(pulled, {
    root: [0, 1.0, 0],
    hips: [110, 110, 0],
    spine: [-10, 0, 0],
    head: [-20, 0, 0],
    upperArmL: [-20, 0, 100],
    upperArmR: [-20, 0, -100],
    thighL: [-20, 0, 20],
    shinL: [30, 0, 0],
    thighR: [-6, 0, -20],
    shinR: [40, 0, 0],
  });
  // landed face up with the head away from the thrower: LYING turned round (yaw 180 then
  // tipped back = Euler [90, 170, 0]), so the facing flip at the knockdown doesn't pop
  const slammed = merge(LYING, { root: [0, -0.8, 0.45], hips: [90, 170, 0], upperArmL: [-60, 0, 100], upperArmR: [-70, 0, -100] });
  const lying = merge(LYING, { root: [0, -0.86, 0.5], hips: [90, 170, 0] });
  return {
    length: 58,
    keys: [
      { f: 0, p: held },
      { f: 10, p: held },
      { f: 18, p: pulled, ease: 'smooth' },
      { f: 26, p: over, ease: 'smooth' },
      { f: 34, p: slammed, ease: 'in' },
      { f: 44, p: lying, ease: 'smooth' },
      { f: 58, p: lying },
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
  // slammed down clear of the thrower's feet (the sim slides the victim further at the end)
  const slammed = merge(LYING, { root: [0, -0.86, -0.4] });
  const lying = merge(LYING, { root: [0, -0.86, -0.45] });
  return {
    length: 58,
    keys: [
      { f: 0, p: held },
      { f: 10, p: held },
      { f: 24, p: lifted, ease: 'smooth' },
      { f: 34, p: slammed, ease: 'in' },
      { f: 58, p: lying, ease: 'smooth' },
    ],
  };
}

/** throw escape (both fighters): the grab is slapped away, both skid apart, guard back up */
function throwBreak(): Clip {
  const skid = merge(STANCE, { root: [0, -0.12, -0.08], spine: [4, -4, 0], head: [-4, 8, 0], upperArmL: [-74, 0, 30], foreArmL: [-70, 0, 0] });
  return {
    length: 20,
    keys: [
      { f: 0, p: GRAB_HOLD },
      { f: 3, p: TECH_SLAP, ease: 'out' },
      { f: 7, p: TECH_SLAP },
      { f: 13, p: skid, ease: 'smooth' },
      { f: 20, p: STANCE, ease: 'smooth' },
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
// ranged profile, guard crush
// ---------------------------------------------------------------------------
/**
 * The ranged profile's throw: turn away and cock the arm, a short pull, then the body
 * whips forward and the hand releases the projectile on the move's active frame
 * (sim: MOVES.projectile.startup), follow-through, back to guard.
 * `lob` = the grenade (arm released upward), else a straight throw.
 */
function projectileClip(lob: boolean): Clip {
  const m = MOVES.projectile;
  const S = m.startup;
  const total = moveTotal(m);
  const release = lob ? THROW_RELEASE_LOB : THROW_RELEASE;
  const follow = Math.min(total - 8, S + 9);
  return {
    length: total,
    keys: [
      { f: 0, p: STANCE },
      { f: Math.round(S * 0.5), p: THROW_COCK, ease: 'out' },
      { f: S - 3, p: THROW_PULL, ease: 'smooth' },
      { f: S, p: release, ease: 'in' },
      { f: S + 2, p: release },
      { f: follow, p: THROW_FOLLOW, ease: 'smooth' },
      { f: Math.min(total - 4, follow + 7), p: THROW_FOLLOW },
      { f: total, p: STANCE, ease: 'smooth' },
    ],
  };
}

/** guard crush: the guard bursts open (arms flung up, head back), then a long wobbling stagger */
function guardCrush(): Clip {
  const burst = merge(STANCE, {
    root: [0, -0.04, -0.12],
    hips: [-10, -14, 0],
    spine: [-18, 0, 0],
    chest: [-16, 0, 0],
    neck: [-12, 0, 0],
    head: [-26, 8, 0],
    upperArmL: [-130, 0, 62],
    foreArmL: [-24, 0, 0],
    handL: [-20, 0, 0],
    upperArmR: [-124, 0, -66],
    foreArmR: [-28, 0, 0],
    handR: [-20, 0, 0],
    thighL: [-26, 0, 8],
    shinL: [24, 0, 0],
    thighR: [26, 0, -8],
    shinR: [34, 0, 0],
    footR: [-40, 0, 0],
  });
  const burst2 = merge(burst, { root: [0, -0.06, -0.16], spine: [-22, 0, 0], head: [-30, 4, 0], upperArmL: [-142, 0, 70], upperArmR: [-136, 0, -74] });
  // off balance on wobbly legs, arms dangling: rocking back and forth (reads side-on)
  const reelA = merge(STANCE, {
    root: [0.03, -0.13, -0.14],
    hips: [-8, -26, 6],
    spine: [-12, 0, -8],
    chest: [-10, 4, -4],
    neck: [-8, 0, -6],
    head: [-18, 18, -12],
    upperArmL: [24, 0, 34],
    foreArmL: [-26, 0, 0],
    handL: [16, 0, 0],
    upperArmR: [30, 0, -30],
    foreArmR: [-22, 0, 0],
    handR: [16, 0, 0],
    thighL: [-34, 0, 10],
    shinL: [40, 0, 0],
    footL: [6, 0, 0],
    thighR: [26, 0, -10],
    shinR: [44, 0, 0],
    footR: [-34, 0, 0],
  });
  // lurching forward, knees buckling, head dropping, arms swinging forward
  const reelB = merge(reelA, {
    root: [-0.03, -0.2, 0.02],
    hips: [6, -34, -6],
    spine: [22, 0, 8],
    chest: [14, -4, 4],
    neck: [12, 0, 8],
    head: [22, 26, 14],
    upperArmL: [-34, 0, 22],
    foreArmL: [-40, 0, 0],
    upperArmR: [-26, 0, -26],
    foreArmR: [-44, 0, 0],
    thighL: [-48, 0, 8],
    shinL: [74, 0, 0],
    thighR: [18, 0, -10],
    shinR: [58, 0, 0],
  });
  const reelC = merge(reelA, {
    root: [0.02, -0.15, -0.08],
    spine: [-4, 0, -5],
    chest: [-4, 4, -3],
    head: [-8, 14, -8],
    upperArmL: [8, 0, 28],
    upperArmR: [12, 0, -26],
    thighL: [-36, 0, 9],
    shinL: [50, 0, 0],
  });
  // shaking it off, the guard coming back up
  const recover = merge(STANCE, {
    root: [0, -0.1, -0.04],
    spine: [12, -4, 0],
    chest: [8, -4, 0],
    head: [10, 10, 0],
    upperArmL: [-46, 0, 20],
    foreArmL: [-90, 0, 0],
    upperArmR: [-34, 0, -24],
    foreArmR: [-100, 0, 0],
  });
  // frame = actionFrame scaled to the sim's crush length (see FighterView); frame 0 is held
  // through the hitstop of the crush, so it already is the burst pose
  return {
    length: 48,
    keys: [
      { f: 0, p: burst },
      { f: 5, p: burst2, ease: 'out' },
      { f: 12, p: reelA, ease: 'smooth' },
      { f: 20, p: reelB, ease: 'smooth' },
      { f: 28, p: reelC, ease: 'smooth' },
      { f: 35, p: merge(reelB, { root: [-0.02, -0.17, 0], spine: [14, 0, 6], head: [14, 20, 10] }), ease: 'smooth' },
      { f: 41, p: recover, ease: 'smooth' },
      { f: 48, p: STANCE, ease: 'smooth' },
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
    throwingBack: throwingBack(),
    thrownBack: thrownBack(),
    throwBreak: throwBreak(),
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
  for (const [id, clip] of Object.entries(customMoveClips())) lib['move:' + id] = clip;
  lib['move:projectile'] = projectileClip(false);
  lib['move:projectile:lob'] = projectileClip(true);
  lib.guardCrush = guardCrush();
  return lib;
}

export const CLIPS = buildLibrary();
