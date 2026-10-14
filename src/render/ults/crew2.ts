import type { BoneName } from '../characterModel';
import type { Clip, Euler3, Key, Pose } from '../poses';
import { kit } from '../ultimatePoses';

/**
 * Clips of the BBL MAX cinematics of src/sim/ults/crew2.ts, keyed by full clip name:
 * `ult:<id>:a` (attacker), `ult:<id>:v` (victim), `ult:<id>:<actorId>` (extra actors).
 *
 * Same frame base as the scripts: keys ON the hit frames (strike pose for the
 * attacker / actor, reaction pose for the victim), victim clips end exactly in
 * LYING, attacker clips end in STANCE.
 */
export function crew2Clips(): Record<string, Clip> {
  const out: Record<string, Clip> = {};
  const add = (id: string, c: Record<string, Clip>) => {
    for (const [role, cl] of Object.entries(c)) out[`ult:${id}:${role}`] = cl;
  };
  add('mignon', mignon());
  add('buff', buff());
  add('rap', rap());
  add('arsenal', arsenal());
  add('spider', spider());
  return out;
}

const {
  P,
  K,
  clip,
  rot,
  rewrap,
  shift,
  mirror,
  plant,
  strike,
  react,
  crash,
  J,
  OPEN_LEGS,
  FLEX,
  CROSSED,
  LANDING,
  DAZED,
  REEL,
  TWIST_L,
  TWIST_L2,
  TWIST_R2,
  CHIN_UP,
  DOUBLE,
  SIT,
  FLY_BACK,
  FLY_BACK2,
  LYING_BOUNCE,
  SMASHED,
  KNEEL,
  HAND_ON_HIP_L,
  HAND_ON_HIP_R,
  STANCE,
  CROUCH,
  AIR,
  LYING,
  HIT_HIGH,
  HIT_MID,
  ATTACKS,
} = kit;

/** adds degrees to one bone */
function add(p: Pose, bone: BoneName, d: Euler3): Pose {
  const e = p[bone] ?? [0, 0, 0];
  return { ...p, [bone]: [e[0] + d[0], e[1] + d[1], e[2] + d[2]] };
}

// ---------------------------------------------------------------------------
// shared poses
// ---------------------------------------------------------------------------
/** right hand held in front of the chin, fist thumb-side (+Z) up toward the mouth (mic, grenade pin) */
const HAND_AT_MOUTH_R: Pose = { upperArmR: [-65, 30, 40], foreArmR: [-90, 0, 0], handR: [20, 0, 0] };
const HAND_AT_MOUTH_L: Pose = { upperArmL: [-65, -30, -40], foreArmL: [-90, 0, 0], handL: [20, 0, 0] };

/** victim on guard, a bit worried */
const WARY = plant(P(STANCE, { hips: [0, -26, 0], head: [-2, 14, 0] }));
/** victim scared: leaning back, open hands up in front of the chest */
const SCARED = plant(
  P(STANCE, {
    root: [0, 0, -0.06],
    hips: [-4, -20, 0],
    spine: [-10, 0, 0],
    chest: [-8, 0, 0],
    neck: [-4, 0, 0],
    head: [-6, 6, 0],
    upperArmL: [-55, 0, 24],
    foreArmL: [-110, 0, 0],
    handL: [-40, 0, 0],
    upperArmR: [-55, 0, -24],
    foreArmR: [-110, 0, 0],
    handR: [-40, 0, 0],
    thighL: [-20, 0, 8],
    shinL: [30, 0, 0],
    thighR: [12, 0, -8],
    shinR: [24, 0, 0],
  }),
);
const SCARED2 = P(SCARED, { root: [0.012, SCARED.root![1] - 0.01, -0.06], head: [-4, 0, 4], upperArmL: [-58, 0, 22], upperArmR: [-52, 0, -26] });
/** trembling between two poses every `step` frames over [f0, f1] */
function tremble(f0: number, f1: number, a: Pose, b: Pose, step = 4): Key[] {
  const keys: Key[] = [];
  for (let f = f0, i = 0; f <= f1; f += step, i++) keys.push(K(f, i % 2 ? b : a, 'smooth'));
  return keys;
}

// ---------------------------------------------------------------------------
// Alex — VIENS LÀ MON MIGNON
// ---------------------------------------------------------------------------
function mignon() {
  // big grin, head tilted, "come here" with the left hand
  const grin = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -36, 0],
      spine: [-2, -2, 0],
      chest: [-4, 0, 0],
      neck: [0, -4, 6],
      head: [-6, -6, 12],
      upperArmR: [8, 0, -12],
      foreArmR: [-24, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-80, 0, 10],
      foreArmL: [-20, 0, 0],
      handL: [-30, 0, 0],
    }),
  );
  const beckon = P(grin, { foreArmL: [-85, 0, 0], handL: [-60, 0, 0], head: [-6, -4, 8] });
  // knuckles: fingers laced, arms pushed forward / pulled back to the chest; then the neck
  const crackPush = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -20, 0],
      spine: [4, 10, 0],
      chest: [2, 10, 0],
      neck: [0, 0, 0],
      head: [-4, 0, 0],
      upperArmL: [-85, 0, -20],
      foreArmL: [-8, 0, 0],
      handL: [-50, 0, 0],
      upperArmR: [-85, 0, 20],
      foreArmR: [-8, 0, 0],
      handR: [-50, 0, 0],
    }),
  );
  const crackPull = P(crackPush, { upperArmL: [-62, 0, -10], foreArmL: [-96, 0, 0], handL: [10, 0, 0], upperArmR: [-62, 0, 10], foreArmR: [-96, 0, 0], handR: [10, 0, 0] });
  const neckL = P(crackPull, { neck: [0, 0, 16], head: [-4, 0, 22] });
  const neckR = P(crackPull, { neck: [0, 0, -16], head: [-4, 0, -22] });
  // fixing his curls, the other hand on the hip
  const hair = plant(
    P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, {
      hips: [0, -40, 0],
      spine: [-4, 0, 6],
      chest: [-4, 0, 0],
      head: [-12, 10, 12],
      upperArmR: [-150, 0, -40],
      foreArmR: [-110, 0, 0],
      handR: [20, 0, 0],
    }),
  );
  const hair2 = P(hair, { head: [-16, 16, 4], upperArmR: [-150, 0, -30], foreArmR: [-120, 0, 0], hips: [0, -46, 0] });
  // dusting off the hands
  const dust = plant(P(STANCE, OPEN_LEGS, { hips: [0, -40, 0], head: [10, 10, 0], upperArmL: [-40, 0, 6], foreArmL: [-70, 0, 0], upperArmR: [-40, 0, -6], foreArmR: [-70, 0, 0] }));
  const dust2 = P(dust, { upperArmL: [-46, 0, 2], foreArmL: [-60, 0, 0], upperArmR: [-34, 0, -10], foreArmR: [-80, 0, 0] });
  const A = ATTACKS;
  const a = clip(
    K(0, A.super.strike),
    K(6, grin, 'out'),
    K(12, beckon, 'smooth'),
    K(18, grin, 'smooth'),
    K(24, beckon, 'smooth'),
    K(30, grin, 'smooth'),
    K(38, P(grin, { head: [-8, -2, 16] }), 'smooth'),
    K(46, crackPull, 'smooth'),
    K(51, crackPull),
    K(54, crackPush, 'in'),
    K(57, crackPull, 'out'),
    K(59, neckL, 'in'),
    K(62, crackPull, 'smooth'),
    K(64, neckR, 'in'),
    K(70, STANCE, 'smooth'),
    // --- in the dark ---
    strike(84, A.jab.windup, A.jab.strike, 5, 2),
    strike(98, A.cross.windup, A.cross.strike, 5, 2),
    strike(112, A.uppercut.windup, A.uppercut.strike, 5, 2),
    strike(126, A.frontKick.windup, A.frontKick.strike, 5, 2),
    strike(140, A.powerPunch.windup, A.powerPunch.strike, 6, 2),
    strike(156, A.elbow.windup, A.elbow.strike, 5, 2),
    strike(178, A.roundhouse.windup, A.roundhouse.strike, 6, 3),
    K(186, STANCE, 'smooth'),
    // --- picture back: hair, "Suivant.", hands dusted off ---
    K(192, hair, 'smooth'),
    K(200, hair2, 'smooth'),
    K(208, hair, 'smooth'),
    K(216, hair2, 'smooth'),
    K(226, hair, 'smooth'),
    K(236, hair2, 'smooth'),
    K(244, dust, 'smooth'),
    K(248, dust2, 'in'),
    K(251, dust, 'out'),
    K(254, dust2, 'in'),
    K(257, dust, 'out'),
    K(260, dust2, 'in'),
    K(266, dust, 'out'),
    K(284, STANCE, 'smooth'),
    K(296, STANCE),
  );
  const backOff = P(SCARED, { root: [0, SCARED.root![1], -0.12], spine: [-14, 0, 0], head: [-10, 10, 0] });
  // K.O.: limbs everywhere, one leg sticking up and twitching
  const ko = P(LYING, {
    head: [12, -40, 0],
    neck: [14, 0, 0],
    upperArmL: [-10, 0, 100],
    foreArmL: [-20, 0, 0],
    upperArmR: [-40, 0, -85],
    foreArmR: [-70, 0, 0],
    thighL: [-78, 0, 14],
    shinL: [36, 0, 0],
    footL: [24, 0, 0],
    thighR: [-12, 0, -14],
    shinR: [20, 0, 0],
    footR: [40, 0, 0],
  });
  const koT = P(ko, { thighL: [-72, 0, 16], shinL: [52, 0, 0], footL: [46, 0, 0] });
  const v = clip(
    K(0, HIT_MID),
    K(6, WARY, 'smooth'),
    K(30, WARY),
    K(38, SCARED, 'out'),
    tremble(42, 50, SCARED2, SCARED),
    K(54, P(SCARED, { head: [-12, 6, 0] }), 'out'),
    K(58, SCARED2, 'smooth'),
    K(64, backOff, 'smooth'),
    K(72, P(backOff, { head: [-12, 14, 6] }), 'smooth'),
    // --- in the dark ---
    react(84, P(backOff, { head: [-12, 14, 6] }), TWIST_L),
    K(90, REEL, 'smooth'),
    react(98, REEL, DOUBLE),
    K(104, REEL, 'smooth'),
    react(112, REEL, CHIN_UP),
    K(118, DAZED, 'smooth'),
    react(126, DAZED, DOUBLE),
    K(132, REEL, 'smooth'),
    react(140, REEL, TWIST_R2),
    K(146, DAZED, 'smooth'),
    react(156, DAZED, TWIST_L2),
    K(164, DAZED, 'smooth'),
    react(178, DAZED, FLY_BACK),
    K(184, FLY_BACK2, 'smooth'),
    K(188, LYING, 'in'),
    K(192, LYING_BOUNCE, 'out'),
    K(197, ko, 'smooth'),
    // --- picture back: twitching ---
    K(222, ko),
    K(225, koT, 'out'),
    K(228, ko, 'in'),
    K(231, koT, 'out'),
    K(234, ko, 'in'),
    K(256, ko),
    K(259, koT, 'out'),
    K(262, ko, 'in'),
    K(266, koT, 'out'),
    K(270, ko, 'in'),
    K(286, LYING, 'smooth'),
    K(296, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Isis — MUSCLES XXL
// ---------------------------------------------------------------------------
function buff() {
  // "most muscular": hunched, fists together in front of the belly, every muscle tensed
  const effort = plant(
    P(STANCE, {
      hips: [0, -25, 0],
      spine: [20, 0, 0],
      chest: [14, 0, 0],
      neck: [-12, 0, 0],
      head: [-16, -10, 0],
      upperArmL: [-25, -60, 40],
      foreArmL: [-100, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-25, 60, -40],
      foreArmR: [-100, 0, 0],
      handR: [0, 0, 0],
      thighL: [-40, 0, 14],
      shinL: [60, 0, 0],
      footL: [-20, 0, 0],
      thighR: [-10, 0, -14],
      shinR: [50, 0, 0],
      footR: [-30, 0, 0],
    }),
  );
  const effort2 = shift(P(effort, { head: [-20, -6, 4], chest: [17, 0, 2], upperArmL: [-27, -60, 42], upperArmR: [-23, 60, -38] }), 0.012, -0.012, 0);
  // power burst: roaring, arms flung down and out
  const roar = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -30, 0],
      spine: [-10, 0, 0],
      chest: [-12, 0, 0],
      neck: [-10, 0, 0],
      head: [-24, 6, 0],
      upperArmL: [-20, 0, 60],
      foreArmL: [-40, 0, 0],
      upperArmR: [-20, 0, -60],
      foreArmR: [-40, 0, 0],
    }),
  );
  const kiss = P(FLEX, { neck: [0, -24, 0], head: [8, -44, 0] });
  const bringIt = plant(P(STANCE, OPEN_LEGS, { hips: [0, -30, 0], spine: [8, 0, 0], head: [-6, 10, 0], upperArmL: [-60, 0, 30], foreArmL: [-120, 0, 0], upperArmR: [-50, 0, -30], foreArmR: [-120, 0, 0], thighL: [-30, 0, 14], shinL: [40, 0, 0] }));
  // big hooks
  // left hook to the body: left shoulder driven forward, elbow out, fist into the stomach
  const hookBodyWind = plant(P(STANCE, { hips: [0, 10, 0], spine: [6, 8, 0], chest: [4, 6, 0], head: [-8, -10, 0], upperArmL: [-20, -15, 70], foreArmL: [-120, 0, 0], handL: [0, 0, 0] }));
  const hookBody = plant(
    P(STANCE, {
      root: [0, -0.06, 0.08],
      hips: [0, -20, 0],
      spine: [12, -10, 0],
      chest: [6, -10, 0],
      head: [-12, 20, 0],
      upperArmL: [-10, -15, 60],
      foreArmL: [-100, 0, 0],
      handL: [0, 0, 0],
      thighL: [-50, 0, 6],
      shinL: [60, 0, 0],
      thighR: [14, 0, -6],
      shinR: [40, 0, 0],
    }),
  );
  const hookRWind = plant(P(STANCE, { hips: [0, -40, 0], spine: [0, -12, 0], chest: [0, -8, 0], head: [-6, 30, 0], upperArmR: [-30, 30, -80], foreArmR: [-110, 0, 0], handR: [0, 0, 0] }));
  // right hook: chest turned into the blow, elbow out at shoulder height, fist across to the jaw
  const hookR = plant(
    P(STANCE, {
      root: [0, 0, 0.1],
      hips: [0, 20, 0],
      spine: [6, 10, 0],
      chest: [6, 10, 0],
      head: [-6, -24, 0],
      upperArmR: [-40, 30, -90],
      foreArmR: [-90, 0, 0],
      handR: [0, 0, 0],
      thighL: [-40, 0, 6],
      shinL: [46, 0, 0],
    }),
  );
  // double hammer fist
  const hamUp = plant(
    P(STANCE, {
      root: [0, 0, -0.04],
      hips: [0, -10, 0],
      spine: [-16, 0, 0],
      chest: [-10, 0, 0],
      head: [-10, 0, 0],
      upperArmL: [-175, 0, -6],
      foreArmL: [-30, 0, 0],
      upperArmR: [-175, 0, 6],
      foreArmR: [-30, 0, 0],
      thighL: [-30, 0, 8],
      shinL: [40, 0, 0],
      thighR: [10, 0, -8],
      shinR: [30, 0, 0],
    }),
    0.04,
  );
  const hamDown = plant(
    P(STANCE, {
      root: [0, 0, 0.04],
      hips: [0, -6, 0],
      spine: [12, 0, 0],
      chest: [6, 0, 0],
      head: [4, 0, 0],
      upperArmL: [-142, 0, -10],
      foreArmL: [-14, 0, 0],
      upperArmR: [-142, 0, 10],
      foreArmR: [-14, 0, 0],
      thighL: [-50, 0, 6],
      shinL: [56, 0, 0],
      thighR: [24, 0, -6],
      shinR: [16, 0, 0],
    }),
  );
  // grab, lift, overhead press (narrow grip under the victim's back), reps
  const grab = plant(
    P(CROUCH, {
      hips: [10, -10, 0],
      spine: [30, 0, 0],
      chest: [10, 0, 0],
      head: [-10, 0, 0],
      upperArmL: [-70, 0, -10],
      foreArmL: [-20, 0, 0],
      upperArmR: [-70, 0, 10],
      foreArmR: [-20, 0, 0],
    }),
  );
  const liftChest = plant(
    P(STANCE, OPEN_LEGS, { hips: [0, -10, 0], spine: [-6, 0, 0], chest: [-6, 0, 0], head: [-14, 0, 0], upperArmL: [-120, 0, 20], foreArmL: [-60, 0, 0], upperArmR: [-120, 0, -20], foreArmR: [-60, 0, 0] }),
  );
  const pressTop = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -20, 0],
      spine: [-8, 0, 0],
      chest: [-8, 0, 0],
      neck: [-10, 0, 0],
      head: [-20, 4, 0],
      upperArmL: [-172, 0, 8],
      foreArmL: [-8, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-172, 0, -8],
      foreArmR: [-8, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const pressLow = plant(
    P(pressTop, {
      spine: [-4, 0, 0],
      head: [-14, 4, 0],
      upperArmL: [-140, 0, 16],
      foreArmL: [-60, 0, 0],
      upperArmR: [-140, 0, -16],
      foreArmR: [-60, 0, 0],
      thighL: [-16, 0, 12],
      shinL: [30, 0, 0],
      thighR: [-16, 0, -12],
      shinR: [30, 0, 0],
    }),
  );
  const throwWind = P(pressTop, { spine: [-14, 0, 0], chest: [-12, 0, 0], head: [-24, 0, 0], upperArmL: [-185, 0, 8], upperArmR: [-185, 0, -8] });
  const slam = plant(
    P(CROUCH, {
      root: [0, 0, 0.12],
      hips: [16, -10, 0],
      spine: [36, 0, 0],
      chest: [16, 0, 0],
      head: [10, 0, 0],
      upperArmL: [-60, 0, -10],
      foreArmL: [-10, 0, 0],
      upperArmR: [-60, 0, 10],
      foreArmR: [-10, 0, 0],
      thighL: [-80, 0, 10],
      shinL: [100, 0, 0],
      thighR: [-10, 0, -10],
      shinR: [100, 0, 0],
    }),
  );
  // giant punch
  const punchWind = plant(
    P(STANCE, {
      root: [0, 0, -0.1],
      hips: [0, -75, 0],
      spine: [-8, -16, 0],
      chest: [-10, -12, 0],
      neck: [0, 20, 0],
      head: [-12, 40, 0],
      upperArmR: [48, 0, -22],
      foreArmR: [-70, 0, 0],
      upperArmL: [-20, 0, 75],
      foreArmL: [-30, 0, 0],
      thighL: [-30, 0, 6],
      shinL: [40, 0, 0],
      thighR: [16, 0, -6],
      shinR: [30, 0, 0],
    }),
  );
  const punchWind2 = P(punchWind, { upperArmR: [62, 0, -26], foreArmR: [-60, 0, 0], spine: [-10, -20, 0], head: [-14, 44, 0] });
  const giant = plant(P(ATTACKS.powerPunch.strike, { root: [0, 0, 0.22], upperArmR: [-140, 0, -30], foreArmR: [-2, 0, 0], head: [-10, -30, 0] }));
  const follow = plant(P(giant, { root: [0, 0, 0.24], hips: [0, 50, 0], spine: [20, 26, 0], upperArmR: [-70, 0, 30], foreArmR: [-40, 0, 0] }));
  const crab = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -30, 0],
      spine: [16, 0, 0],
      chest: [12, 0, 0],
      neck: [-10, 0, 0],
      head: [-14, 10, 0],
      upperArmL: [-25, -60, 40],
      foreArmL: [-100, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-25, 60, -40],
      foreArmR: [-100, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const crab2 = P(crab, { head: [-18, 16, 6], chest: [14, 0, 0] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(6, effort, 'out'),
    tremble(9, 39, effort2, effort, 3),
    K(44, roar, 'out'),
    K(48, roar),
    K(53, FLEX, 'out'),
    K(62, FLEX),
    K(68, kiss, 'smooth'),
    K(76, kiss),
    K(82, FLEX, 'smooth'),
    K(92, bringIt, 'smooth'),
    strike(104, hookBodyWind, hookBody, 6, 2),
    strike(114, hookRWind, hookR, 5, 2),
    K(122, hamUp, 'smooth'),
    K(125, P(hamUp, { spine: [-22, 0, 0], upperArmL: [-185, 0, -6], upperArmR: [-185, 0, 6] }), 'smooth'),
    K(128, hamDown, 'in'),
    K(130, hamDown),
    K(134, grab, 'smooth'),
    K(140, liftChest, 'smooth'),
    K(146, pressTop, 'out'),
    K(155, pressLow, 'smooth'),
    K(166, pressTop, 'smooth'),
    K(172, P(pressTop, { head: [-24, 4, 0] })),
    K(177, throwWind, 'smooth'),
    K(182, slam, 'in'),
    K(186, slam),
    K(192, punchWind, 'smooth'),
    K(197, punchWind2, 'smooth'),
    K(200, giant, 'in'),
    K(204, giant),
    K(214, follow, 'smooth'),
    K(224, STANCE, 'smooth'),
    K(232, crab, 'out'),
    K(238, crab2, 'smooth'),
    K(244, crab, 'smooth'),
    K(250, crab2, 'smooth'),
    K(258, FLEX, 'smooth'),
    K(268, kiss, 'smooth'),
    K(280, FLEX, 'smooth'),
    K(300, STANCE, 'smooth'),
  );
  const puzzled = plant(P(STANCE, { hips: [0, -20, 0], spine: [-6, 0, 0], head: [-10, 0, 18], neck: [0, 0, 8], upperArmL: [-20, 0, 20], foreArmL: [-60, 0, 0], upperArmR: [-20, 0, -20], foreArmR: [-60, 0, 0] }));
  const puzzled2 = P(puzzled, { head: [-10, 6, -14], neck: [0, 0, -6] });
  // folded around the body hook, but pushed back (no head-to-head with Isis)
  const gut = plant(P(DOUBLE, { root: [0, 0, -0.24], hips: [6, -20, 0], spine: [20, 0, 0], chest: [10, 0, 0], neck: [-4, 0, 0], head: [-8, 0, 0] }));
  // knees buckling under the double hammer fist, head driven down
  const hammered = plant(
    P(HIT_MID, {
      root: [0, 0, -0.04],
      hips: [4, -20, 0],
      spine: [16, 0, 0],
      chest: [8, 0, 0],
      neck: [24, 0, 0],
      head: [30, 0, 0],
      thighL: [-40, 0, 10],
      shinL: [80, 0, 0],
      thighR: [-30, 0, -10],
      shinR: [90, 0, 0],
      upperArmL: [-10, 0, 30],
      foreArmL: [-20, 0, 0],
      upperArmR: [-10, 0, -30],
      foreArmR: [-20, 0, 0],
    }),
  );
  // held overhead on its back (hips = centre of the body), limbs dangling, head hanging
  const pressed: Pose = {
    root: [0, -0.86, 0],
    hips: [-90, 0, 0],
    spine: [0, 0, 0],
    chest: [0, 0, 0],
    neck: [-26, 0, 0],
    head: [-20, 0, 0],
    upperArmL: [70, 0, 30],
    foreArmL: [-20, 0, 0],
    handL: [0, 0, 0],
    upperArmR: [70, 0, -30],
    foreArmR: [-20, 0, 0],
    handR: [0, 0, 0],
    thighL: [0, 0, 8],
    shinL: [80, 0, 0],
    footL: [10, 0, 0],
    thighR: [-10, 0, -8],
    shinR: [85, 0, 0],
    footR: [10, 0, 0],
  };
  const pressed2 = P(pressed, { upperArmL: [40, 0, 50], upperArmR: [90, 0, -20], thighL: [-20, 0, 8], shinL: [60, 0, 0], thighR: [6, 0, -8], shinR: [100, 0, 0], head: [-14, 20, 0] });
  const lifted = P(J.a, { root: [0, -0.3, 0], hips: [-50, -10, 0], thighL: [-40, 0, 10], shinL: [60, 0, 0], thighR: [-30, 0, -10], shinR: [70, 0, 0] });
  const slammed = P(LYING, {
    thighL: [-70, 0, 12],
    shinL: [110, 0, 0],
    footL: [0, 0, 0],
    thighR: [-64, 0, -12],
    shinR: [100, 0, 0],
    footR: [0, 0, 0],
    upperArmL: [-40, 0, 60],
    upperArmR: [-40, 0, -60],
    head: [20, -10, 0],
  });
  // bounces back up off the floor like a rag doll, right into the giant punch
  const bounced = P(J.a, { root: [0, -0.04, 0], hips: [-16, -20, 0], spine: [12, 0, 0], neck: [12, 0, 0], head: [22, 0, 0], upperArmL: [-30, 0, 60], upperArmR: [-30, 0, -60] });
  const v = clip(
    K(0, HIT_MID),
    K(6, WARY, 'smooth'),
    K(36, WARY),
    K(46, puzzled, 'out'),
    K(60, puzzled2, 'smooth'),
    K(74, puzzled, 'smooth'),
    K(84, SCARED, 'out'),
    tremble(88, 100, SCARED2, SCARED),
    react(104, SCARED, gut),
    K(110, REEL, 'smooth'),
    react(114, REEL, TWIST_L2),
    K(120, DAZED, 'smooth'),
    react(128, DAZED, hammered),
    K(133, hammered),
    K(139, lifted, 'smooth'),
    K(146, pressed, 'smooth'),
    K(155, pressed2, 'smooth'),
    K(166, pressed, 'smooth'),
    K(176, pressed2, 'smooth'),
    K(182, slammed, 'in'),
    K(186, P(slammed, { head: [10, -20, 0] })),
    K(192, bounced, 'out'),
    K(199, P(bounced, { head: [26, 10, 6] })),
    K(200, P(CHIN_UP, { root: [0, -0.04, -0.12], hips: [-20, -20, 0] }), 'out'),
    K(206, FLY_BACK, 'smooth'),
    K(216, FLY_BACK2, 'smooth'),
    crash(226),
    K(300, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Zia — RAP CONTENDERS
// ---------------------------------------------------------------------------
function rap() {
  // mic at the mouth (right hand), left hand free for the gestures, nodding on the beat
  const rapBase = plant(
    P(STANCE, OPEN_LEGS, HAND_AT_MOUTH_R, {
      hips: [0, -35, 0],
      spine: [6, 0, 0],
      chest: [2, 0, 0],
      neck: [0, 0, 0],
      head: [-4, 0, 0],
      upperArmL: [-50, 0, 30],
      foreArmL: [-60, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  /** the same pose one half-beat later: knees and head down */
  const bob = (p: Pose): Pose =>
    plant(add(add(add(add(add(add(add(p, 'spine', [5, 0, 0]), 'neck', [5, 0, 0]), 'head', [8, 0, 0]), 'thighL', [-8, 0, 0]), 'shinL', [16, 0, 0]), 'thighR', [-8, 0, 0]), 'shinR', [16, 0, 0]));
  /** nods on the beat over [f0, f1): pose / bob(pose) every 10 frames, cycling through the gestures */
  const groove = (f0: number, f1: number, poses: Pose[]): Key[] => {
    const keys: Key[] = [];
    for (let f = f0, i = 0; f < f1; f += 10, i++) {
      const p = poses[Math.floor(i / 2) % poses.length];
      keys.push(K(f, i % 2 ? bob(p) : p, 'smooth'));
    }
    return keys;
  };
  const chopUp = P(rapBase, { upperArmL: [-85, 0, 34], foreArmL: [-80, 0, 0], handL: [-20, 0, 0] });
  const chopDown = P(rapBase, { upperArmL: [-45, 0, 34], foreArmL: [-50, 0, 0], handL: [-30, 0, 0] });
  const sway = P(rapBase, { spine: [6, 0, 8], head: [-4, 6, 8], upperArmL: [-30, 0, 60], foreArmL: [-50, 0, 0] });
  // pointing at the opponent (chest turned -35°: +35° on the arm), leaning in for the punchline
  const point = P(rapBase, { upperArmL: [-88, 0, 35], foreArmL: [-6, 0, 0], handL: [0, 0, 0], head: [-6, 22, 0] });
  const pointLean = plant(shift(P(point, { spine: [16, 10, 0], chest: [8, 6, 0], neck: [-4, 6, 0], head: [-10, 16, 0] }), 0, 0, 0.08));
  // "mode avion": the free arm as a wing, banking
  const planeA = P(rapBase, { upperArmL: [0, 0, 88], foreArmL: [0, 0, 0], handL: [0, 0, 0], spine: [6, 0, 12], head: [-4, 10, 10] });
  const planeB = P(planeA, { spine: [6, 0, -6], head: [-4, 10, -6] });
  // listening to the "comeback": mic lowered, hand cupped behind the ear
  const listen = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -30, 0],
      spine: [-4, 0, 6],
      chest: [-2, 0, 0],
      head: [-6, 16, 12],
      upperArmR: [-20, 0, -10],
      foreArmR: [-110, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-30, 0, 60],
      foreArmL: [-140, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  const listen2 = P(listen, { head: [-2, 24, 18], spine: [0, 0, 10] });
  const laugh = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 0],
      spine: [-14, 0, 0],
      chest: [-10, 0, 0],
      neck: [-10, 0, 0],
      head: [-24, 14, 0],
      upperArmR: [10, 0, -14],
      foreArmR: [-60, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-88, 0, 40],
      foreArmL: [-6, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  const laugh2 = plant(P(laugh, { spine: [24, 0, 0], chest: [10, 0, 0], neck: [10, 0, 0], head: [6, 20, 0], upperArmL: [-60, 0, 40], foreArmL: [-30, 0, 0] }));
  // "rentre chez toi": thumb over the shoulder
  const thumbBack = P(rapBase, { upperArmL: [-40, 0, 40], foreArmL: [-130, 0, 0], handL: [0, 0, 0], head: [-8, 24, 0] });
  const drop = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -50, 0],
      spine: [-4, 0, 0],
      chest: [-6, -10, 0],
      neck: [0, 10, 0],
      head: [-16, 30, 6],
      upperArmR: [-80, 0, -50],
      foreArmR: [-6, 0, 0],
      handR: [-10, 0, 0],
      upperArmL: [-20, 0, 12],
      foreArmL: [-100, 0, 0],
    }),
  );
  const drop2 = P(drop, { handR: [70, 0, 0], head: [-18, 34, 8] });
  const smug = plant(P(CROSSED, { hips: [0, -70, 0], head: [-18, 30, 0] }));
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(8, rapBase, 'out'),
    // punchline 1
    groove(16, 110, [sway, chopUp, chopDown, chopUp]),
    K(112, point, 'smooth'),
    K(118, pointLean, 'in'),
    K(124, pointLean),
    // punchline 2
    groove(130, 170, [rapBase, chopDown]),
    groove(170, 210, [planeA, planeB]),
    K(214, point, 'smooth'),
    K(226, pointLean, 'in'),
    K(232, pointLean),
    // the "comeback"
    K(240, listen, 'smooth'),
    K(250, listen2, 'smooth'),
    K(258, listen, 'smooth'),
    K(266, laugh, 'out'),
    K(272, laugh2, 'in'),
    K(276, laugh, 'smooth'),
    // final punchline + mic drop
    K(284, rapBase, 'smooth'),
    groove(292, 332, [thumbBack, chopDown]),
    groove(332, 372, [point, chopUp]),
    K(378, drop, 'smooth'),
    K(383, drop),
    K(386, drop2, 'in'),
    K(390, drop2),
    K(402, drop2),
    K(410, smug, 'smooth'),
    K(420, STANCE, 'smooth'),
  );
  // victim: arms crossed and confident… less and less
  const cocky = plant(P(CROSSED, { hips: [0, -30, 0], head: [-14, 6, 10] }));
  const cocky2 = P(cocky, { head: [-12, 10, -6] });
  const handOnHeart: Pose = { upperArmR: [-45, 75, 10], foreArmR: [-90, 0, 0], handR: [0, 0, 0] };
  const shook = plant(
    P(HIT_HIGH, handOnHeart, {
      root: [0, 0, -0.1],
      hips: [-8, -26, 0],
      spine: [-14, 0, 0],
      chest: [-10, 0, 0],
      neck: [-14, 0, 0],
      head: [-20, 10, 0],
      upperArmL: [-30, 0, 45],
      foreArmL: [-60, 0, 0],
    }),
  );
  const uneasy = plant(P(STANCE, { hips: [0, -26, 0], spine: [8, 0, 0], head: [8, 10, 0], upperArmL: [-30, 0, 14], foreArmL: [-70, 0, 0], upperArmR: [-30, 0, -14], foreArmR: [-70, 0, 0] }));
  const uneasy2 = P(uneasy, { head: [4, -6, 6], upperArmL: [-36, 0, 10], foreArmL: [-80, 0, 0] });
  // both hands on the head, staggering back
  const shook2 = plant(
    P(STANCE, {
      root: [0, 0, -0.12],
      hips: [-6, -24, 0],
      spine: [-12, 0, 0],
      chest: [-10, 0, 0],
      neck: [-10, 0, 0],
      head: [-14, 0, 0],
      upperArmL: [-150, 0, 40],
      foreArmL: [-110, 0, 0],
      upperArmR: [-150, 0, -40],
      foreArmR: [-110, 0, 0],
      thighL: [-28, 0, 8],
      shinL: [40, 0, 0],
      thighR: [16, 0, -8],
      shinR: [30, 0, 0],
    }),
  );
  // the comeback: leaning in, pointing… then lost, scratching the head
  const comeback = plant(P(STANCE, { hips: [0, -20, 0], spine: [12, 0, 0], head: [-6, 0, 0], upperArmR: [-80, 0, -6], foreArmR: [-20, 0, 0], handR: [0, 0, 0], upperArmL: [-20, 0, 20], foreArmL: [-60, 0, 0] }));
  const comeback2 = P(comeback, { upperArmR: [-120, 0, -10], foreArmR: [-40, 0, 0], head: [-10, 6, 6] });
  const scratch = plant(P(STANCE, { hips: [0, -24, 0], spine: [4, 0, 0], head: [6, -10, -12], upperArmR: [-150, 0, -40], foreArmR: [-120, 0, 0], handR: [20, 0, 0], upperArmL: [-10, 0, 14], foreArmL: [-40, 0, 0] }));
  const scratch2 = P(scratch, { head: [8, -14, -6], foreArmR: [-110, 0, 0] });
  // shrinking, hands over the face
  const shrink = plant(
    P(STANCE, {
      root: [0, 0, -0.04],
      hips: [6, -20, 0],
      spine: [26, 0, 0],
      chest: [14, 0, 0],
      neck: [16, 0, 0],
      head: [20, 0, 0],
      upperArmL: [-110, 0, -14],
      foreArmL: [-120, 0, 0],
      upperArmR: [-110, 0, 14],
      foreArmR: [-120, 0, 0],
      thighL: [-34, 0, 8],
      shinL: [56, 0, 0],
      thighR: [-6, 0, -8],
      shinR: [46, 0, 0],
    }),
  );
  const shrink2 = P(shrink, { root: [0.012, shrink.root![1] - 0.01, -0.04], head: [24, 6, 4] });
  const v = clip(
    K(0, HIT_MID),
    K(8, WARY, 'smooth'),
    K(20, cocky, 'smooth'),
    K(50, cocky2, 'smooth'),
    K(80, cocky, 'smooth'),
    K(104, cocky2, 'smooth'),
    react(118, cocky2, shook),
    K(124, shook),
    K(134, uneasy, 'smooth'),
    K(154, uneasy2, 'smooth'),
    K(174, uneasy, 'smooth'),
    K(196, uneasy2, 'smooth'),
    K(214, uneasy, 'smooth'),
    react(226, uneasy, shook2),
    K(232, shook2),
    K(238, comeback, 'smooth'),
    K(246, comeback2, 'smooth'),
    K(254, comeback, 'smooth'),
    K(260, scratch, 'smooth'),
    K(266, scratch2, 'smooth'),
    react(272, scratch2, shrink),
    tremble(278, 384, shrink2, shrink, 6),
    react(390, shrink, SMASHED),
    K(396, KNEEL, 'smooth'),
    K(402, P(SIT, { root: [0, -0.5, -0.12], hips: [-10, -20, 0], spine: [20, 0, 0], head: [10, 0, 0], thighL: [-70, 0, 15], shinL: [120, 0, 0], thighR: [-60, 0, -10], shinR: [130, 0, 0] }), 'smooth'),
    K(405, P(SIT, { head: [-10, 0, 0] }), 'smooth'),
    crash(408),
    K(420, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Clément — ARSENAL BARBU
// ---------------------------------------------------------------------------
function arsenal() {
  const beard = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 0],
      spine: [-4, 0, 0],
      head: [-12, 14, 0],
      upperArmR: [-40, 0, 18],
      foreArmR: [-125, 0, 0],
      handR: [-20, 0, 0],
      upperArmL: [8, 0, 18],
      foreArmL: [-20, 0, 0],
    }),
  );
  const beard2 = P(beard, { head: [-16, 22, 4], foreArmR: [-118, 0, 0] });
  const reachBack = plant(P(STANCE, OPEN_LEGS, { hips: [0, -40, 0], spine: [4, -10, 0], head: [-6, 14, 0], upperArmR: [40, 0, -20], foreArmR: [-70, 0, 0], handR: [0, 0, 0], upperArmL: [8, 0, 18], foreArmL: [-20, 0, 0] }));
  // gun up by the shoulder (barrel up), left hand racking it
  const cock = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -30, 0],
      spine: [0, 0, 0],
      head: [-6, -6, 0],
      upperArmR: [-30, 0, -10],
      foreArmR: [-120, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-60, 0, -10],
      foreArmL: [-100, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  // one-handed aim, chest square to the target, fist on the hip
  const legs: Pose = { thighL: [-34, 0, 10], shinL: [40, 0, 0], footL: [-6, 0, 0], thighR: [16, 0, -10], shinR: [24, 0, 0], footR: [-30, 0, 0] };
  const aim = plant(P(STANCE, legs, HAND_ON_HIP_L, { hips: [0, -20, 0], spine: [0, 10, 0], chest: [0, 10, 0], neck: [0, 0, 0], head: [-6, 0, -4], upperArmR: [-90, 0, 0], foreArmR: [-2, 0, 0], handR: [0, 0, 0] }));
  const kick = (p: Pose, side: number): Pose => {
    const ua = p.upperArmR!;
    return shift(P(p, { upperArmR: [ua[0] - 9, ua[1], ua[2] + side * 4], foreArmR: [-10, 0, 0], head: [-8, 0, -4] }), 0, 0, -0.015);
  };
  const aimLow = plant(P(aim, { spine: [10, 10, 0], head: [6, 0, -4], upperArmR: [-58, 0, 0] }));
  // blowing on the smoking barrel
  const blow = P(cock, { upperArmR: [-10, 45, 5], foreArmR: [-145, 0, 0], handR: [0, 0, 0], neck: [0, 0, 0], head: [-6, -10, 0], upperArmL: [8, 0, 18], foreArmL: [-20, 0, 0] });
  const tossBack = plant(P(STANCE, OPEN_LEGS, { hips: [0, -30, 0], spine: [-6, 0, 0], head: [-8, 10, 0], upperArmR: [-170, 0, -20], foreArmR: [-40, 0, 0], upperArmL: [8, 0, 18], foreArmL: [-20, 0, 0] }));
  // grenades: one in each fist, pins pulled with the teeth, two overhand throws
  const nades = plant(P(STANCE, OPEN_LEGS, { hips: [0, -30, 0], head: [-8, 6, 0], upperArmL: [-50, 0, 20], foreArmL: [-80, 0, 0], upperArmR: [-50, 0, -20], foreArmR: [-80, 0, 0] }));
  const pinR = P(nades, HAND_AT_MOUTH_R, { head: [-2, 0, 0] });
  const pinR2 = P(pinR, { head: [-6, 26, 6], neck: [0, 10, 0], upperArmR: [-50, 0, -30], foreArmR: [-100, 0, 0], handR: [0, 0, 0] });
  const pinL = P(nades, HAND_AT_MOUTH_L, { head: [-2, 0, 0] });
  const pinL2 = P(pinL, { head: [-6, -26, -6], neck: [0, -10, 0], upperArmL: [-50, 0, 30], foreArmL: [-100, 0, 0], handL: [0, 0, 0] });
  const throwRWind = plant(P(STANCE, legs, { hips: [0, -60, 0], spine: [-10, -10, 0], head: [-10, 40, 0], upperArmR: [-150, 0, -40], foreArmR: [-100, 0, 0], upperArmL: [-50, 0, 20], foreArmL: [-80, 0, 0] }));
  const throwR = plant(P(STANCE, legs, { root: [0, 0, 0.08], hips: [0, 10, 0], spine: [16, 10, 0], head: [-14, -10, 0], upperArmR: [-120, 0, -10], foreArmR: [-10, 0, 0], upperArmL: [-50, 0, 20], foreArmL: [-80, 0, 0] }));
  const throwLWind = plant(P(throwR, { hips: [0, 20, 0], spine: [-10, 14, 0], head: [-10, -30, 0], upperArmL: [-150, 0, 40], foreArmL: [-100, 0, 0], upperArmR: [-40, 0, -20], foreArmR: [-30, 0, 0] }));
  const throwL = plant(P(throwR, { hips: [0, -50, 0], spine: [16, -10, 0], head: [-14, 20, 0], upperArmL: [-120, 0, 10], foreArmL: [-10, 0, 0], upperArmR: [-20, 0, -20], foreArmR: [-30, 0, 0] }));
  const watch = plant(P(CROSSED, { hips: [0, -30, 0], head: [-22, 14, 0] }));
  const watch2 = P(watch, { head: [-10, 18, 4] });
  // bazooka on the right shoulder (prop offset in the script), left hand under the tube, head on the sight
  const baz = plant(
    P(STANCE, legs, {
      hips: [0, -20, 0],
      spine: [0, 10, 0],
      chest: [0, 10, 0],
      neck: [0, 0, -8],
      head: [-2, 0, -14],
      upperArmR: [-80, 0, 0],
      foreArmR: [-10, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-80, 0, -38],
      foreArmL: [-14, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  const bazLift = plant(P(baz, { spine: [-6, 6, 0], upperArmR: [-60, 0, -20], foreArmR: [-70, 0, 0], upperArmL: [-40, 0, -10], foreArmL: [-60, 0, 0], head: [-10, 10, 0], neck: [0, 0, 0] }));
  const fire = plant(P(baz, { root: [0, 0, -0.1], spine: [-10, 10, 0], chest: [-6, 10, 0], head: [-12, 0, -10], upperArmR: [-86, 0, 0], foreArmR: [-16, 0, 0], upperArmL: [-86, 0, -38] }));
  // still on the shoulder, muzzle a bit up, fist on the hip, looking at the camera
  const rest = plant(P(baz, HAND_ON_HIP_L, { neck: [0, -10, 0], head: [-12, -24, 0], upperArmR: [-84, 0, 0], foreArmR: [-18, 0, 0] }));
  const rest2 = P(rest, { head: [-8, -30, 6] });
  const tossBaz = plant(P(STANCE, OPEN_LEGS, { hips: [0, -30, 0], spine: [-8, 0, 0], head: [-10, 10, 0], upperArmR: [-165, 0, -30], foreArmR: [-20, 0, 0], upperArmL: [8, 0, 18], foreArmL: [-20, 0, 0] }));
  const shots = (fs: number[], base: Pose): Key[] =>
    fs.flatMap((f, i) => [K(f, kick(base, i % 2 ? -1 : 1), 'in'), K(f + 2, base, 'out')]);
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(6, beard, 'out'),
    K(14, beard2, 'smooth'),
    K(22, beard, 'smooth'),
    K(30, reachBack, 'smooth'),
    K(36, cock, 'out'),
    K(39, P(cock, { upperArmL: [-50, 0, -16], foreArmL: [-110, 0, 0] }), 'in'),
    K(42, aim, 'smooth'),
    shots([46, 50, 54, 58, 62], aim),
    K(68, aimLow, 'smooth'),
    shots([72, 76, 80, 84, 88, 92], aimLow),
    K(98, blow, 'smooth'),
    K(102, P(blow, { head: [-2, -14, 0] })),
    K(106, tossBack, 'out'),
    K(110, nades, 'smooth'),
    K(114, pinR, 'smooth'),
    K(116, pinR2, 'out'),
    K(121, pinL, 'smooth'),
    K(124, pinL2, 'out'),
    K(127, throwRWind, 'smooth'),
    K(130, throwR, 'in'),
    K(133, throwLWind, 'smooth'),
    K(136, throwL, 'in'),
    K(144, watch, 'smooth'),
    K(150, P(watch, { head: [-16, 14, 0] })),
    K(158, watch2, 'smooth'),
    K(170, watch, 'smooth'),
    K(180, watch2, 'smooth'),
    K(186, reachBack, 'smooth'),
    K(192, bazLift, 'smooth'),
    K(200, baz, 'smooth'),
    K(210, P(baz, { head: [0, 0, -16] }), 'smooth'),
    K(214, fire, 'in'),
    K(218, fire),
    K(226, P(baz, { head: [-8, 0, -8], neck: [0, 0, -4] }), 'smooth'),
    K(232, baz, 'smooth'),
    K(240, rest, 'smooth'),
    K(256, rest2, 'smooth'),
    K(272, rest, 'smooth'),
    K(288, rest2, 'smooth'),
    K(298, rest, 'smooth'),
    K(305, tossBaz, 'smooth'),
    K(312, beard, 'smooth'),
    K(320, beard2, 'smooth'),
    K(330, STANCE, 'smooth'),
  );
  // hands up!
  const surrender = plant(
    P(STANCE, {
      hips: [0, -20, 0],
      spine: [-6, 0, 0],
      chest: [-4, 0, 0],
      head: [-8, 6, 0],
      upperArmL: [0, 0, 92],
      foreArmL: [0, 0, 85],
      handL: [0, 0, 0],
      upperArmR: [0, 0, -92],
      foreArmR: [0, 0, -85],
      handR: [0, 0, 0],
    }),
  );
  const jitA = plant(P(surrender, { root: [0, 0, -0.04], spine: [-14, 10, 6], chest: [-10, 8, 0], head: [-16, -10, 8], upperArmL: [-10, 0, 110], upperArmR: [10, 0, -70] }));
  const jitB = plant(P(surrender, { root: [0, 0, -0.04], spine: [-12, -10, -6], chest: [-8, -8, 0], head: [-12, 12, -8], upperArmL: [10, 0, 70], upperArmR: [-10, 0, -110] }));
  // dancing under the bullets: knee up, arms flailing
  const danceA = P(STANCE, {
    root: [0, -0.04, 0],
    hips: [0, -20, 0],
    spine: [-6, 0, 6],
    head: [-10, 0, -6],
    thighL: [-80, 0, 10],
    shinL: [100, 0, 0],
    footL: [20, 0, 0],
    thighR: [4, 0, -6],
    shinR: [10, 0, 0],
    footR: [20, 0, 0],
    upperArmL: [-20, 0, 120],
    foreArmL: [-40, 0, 0],
    upperArmR: [-30, 0, -80],
    foreArmR: [-60, 0, 0],
  });
  const danceB = P(mirror(danceA), { hips: [0, -20, 0] });
  const pant = plant(
    P(STANCE, {
      hips: [20, -20, 0],
      spine: [30, 0, 0],
      chest: [10, 0, 0],
      head: [-30, 0, 0],
      upperArmL: [-40, 0, 10],
      foreArmL: [-20, 0, 0],
      upperArmR: [-40, 0, -10],
      foreArmR: [-20, 0, 0],
      thighL: [-50, 0, 10],
      shinL: [60, 0, 0],
      thighR: [-20, 0, -10],
      shinR: [50, 0, 0],
    }),
  );
  const pant2 = shift(P(pant, { spine: [34, 0, 0], head: [-26, 0, 0] }), 0, -0.01, 0);
  const lookUp = plant(P(SCARED, { root: [0, 0, -0.04], spine: [-12, 0, 0], neck: [-22, 0, 0], head: [-30, 0, 0] }));
  const blown = P(J.a, { head: [-40, 0, 0], neck: [-24, 0, 0], upperArmL: [-80, 0, 110], upperArmR: [-60, 0, -110] });
  const blown2 = P(J.b, { upperArmL: [-40, 0, 140], upperArmR: [-40, 0, -140], thighL: [-60, 0, 30], thighR: [-40, 0, -30] });
  // charred, standing, arms dangling, smoke rising
  const charred = plant(P(DAZED, { spine: [16, 0, 0], neck: [10, 0, 0], head: [14, 0, 0], upperArmL: [-4, 0, 18], foreArmL: [-10, 0, 0], upperArmR: [-4, 0, -18], foreArmR: [-10, 0, 0] }));
  const cough = plant(P(charred, { spine: [30, 0, 0], chest: [16, 0, 0], head: [20, 0, 0], upperArmR: [-70, 40, -10], foreArmR: [-110, 0, 0] }));
  const v = clip(
    K(0, HIT_MID),
    K(8, WARY, 'smooth'),
    K(32, WARY),
    K(38, surrender, 'out'),
    K(42, P(surrender, { head: [-4, 0, 6] }), 'smooth'),
    react(46, surrender, jitA),
    K(50, jitB, 'out'),
    K(54, jitA, 'out'),
    K(58, jitB, 'out'),
    K(62, jitA, 'out'),
    K(68, SCARED, 'smooth'),
    K(72, danceA, 'out'),
    K(76, danceB, 'out'),
    K(80, danceA, 'out'),
    K(84, danceB, 'out'),
    K(88, danceA, 'out'),
    K(92, danceB, 'out'),
    K(100, pant, 'smooth'),
    K(108, pant2, 'smooth'),
    K(116, pant, 'smooth'),
    K(124, pant2, 'smooth'),
    K(134, lookUp, 'smooth'),
    K(142, P(lookUp, { head: [-24, 10, 0] }), 'smooth'),
    react(150, P(lookUp, { head: [-24, 10, 0] }), blown),
    K(155, J.b, 'smooth'),
    react(158, J.b, blown2),
    K(166, P(blown2, { hips: [-50, -20, 0] }), 'smooth'),
    K(172, P(J.a, { root: [0, -0.1, 0] }), 'smooth'),
    K(178, charred, 'in'),
    K(184, cough, 'out'),
    K(188, charred, 'smooth'),
    K(192, cough, 'out'),
    K(198, charred, 'smooth'),
    K(204, SCARED, 'out'),
    tremble(208, 224, SCARED2, SCARED),
    react(226, SCARED, FLY_BACK),
    K(238, FLY_BACK2, 'smooth'),
    crash(250),
    K(330, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Enola — SPIDER-POTE (+ actor 'pote')
// ---------------------------------------------------------------------------
function spider() {
  // calling with both hands around the mouth, looking up
  const call = plant(P(STANCE, OPEN_LEGS, HAND_AT_MOUTH_R, HAND_AT_MOUTH_L, { hips: [0, -30, 0], spine: [-8, 0, 0], chest: [-10, 0, 0], neck: [-14, 0, 0], head: [-22, 8, 0] }));
  const call2 = P(call, { head: [-26, -8, 0], spine: [-10, 0, 4] });
  const pointSky = plant(P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, { hips: [0, -30, 0], spine: [-6, 0, 0], neck: [-14, 0, 0], head: [-20, 20, 0], upperArmR: [-160, 0, -16], foreArmR: [-6, 0, 0], handR: [0, 0, 0] }));
  // "ta-da": presenting her buddy
  const present = plant(P(STANCE, OPEN_LEGS, HAND_ON_HIP_R, { hips: [0, -40, 0], spine: [-4, 0, 0], head: [-8, 14, 0], upperArmL: [-70, 0, 60], foreArmL: [-10, 0, 0], handL: [0, 0, -30] }));
  const present2 = P(present, { head: [-6, 20, 8], upperArmL: [-74, 0, 64] });
  const guard = STANCE;
  // rising front kick (both of them, from each side): launches the victim straight up
  const launchWind = plant(P(STANCE, { hips: [0, -10, 0], spine: [10, 0, 0], thighL: [-90, 0, 6], shinL: [110, 0, 0], upperArmL: [-40, 0, 40], foreArmL: [-60, 0, 0], upperArmR: [-40, 0, -40], foreArmR: [-60, 0, 0] }));
  const launch = plant(
    P(STANCE, {
      root: [0, 0, 0.04],
      hips: [-10, -10, 0],
      spine: [-20, 0, 0],
      chest: [-10, 0, 0],
      head: [-10, 0, 0],
      upperArmL: [-30, 0, 50],
      foreArmL: [-40, 0, 0],
      upperArmR: [-20, 0, -50],
      foreArmR: [-40, 0, 0],
      thighL: [-125, 0, 4],
      shinL: [4, 0, 0],
      footL: [-20, 0, 0],
      thighR: [10, 0, -6],
      shinR: [6, 0, 0],
      footR: [-10, 0, 0],
    }),
    0.06,
  );
  const run = plant(P(STANCE, { hips: [0, -10, 0], spine: [24, 0, 0], head: [-14, 0, 0], upperArmL: [30, 0, 10], foreArmL: [-90, 0, 0], upperArmR: [-60, 0, -10], foreArmR: [-90, 0, 0], thighL: [-70, 0, 6], shinL: [80, 0, 0], thighR: [30, 0, -6], shinR: [60, 0, 0] }));
  const walkA = plant(P(STANCE, OPEN_LEGS, { hips: [0, -20, 0], head: [-14, 0, 0], thighL: [-30, 0, 6], shinL: [20, 0, 0], thighR: [16, 0, -6], shinR: [30, 0, 0] }));
  const walkB = plant(P(STANCE, OPEN_LEGS, { hips: [0, -20, 0], head: [-14, 0, 0], thighL: [8, 0, 6], shinL: [30, 0, 0], thighR: [-26, 0, -6], shinR: [20, 0, 0] }));
  // high five: right arm up and forward, palm open
  const high5 = plant(P(STANCE, OPEN_LEGS, { hips: [0, -10, 0], spine: [10, 4, 0], head: [-20, 0, 0], upperArmR: [-135, 0, 4], foreArmR: [-6, 0, 0], handR: [-40, 0, 0], upperArmL: [-20, 0, 30], foreArmL: [-50, 0, 0] }));
  const high5Wind = P(high5, { upperArmR: [-130, 0, -30], foreArmR: [-70, 0, 0], handR: [0, 0, 0] });
  const lookUp = plant(P(SCARED, { root: [0, 0, -0.02], spine: [-16, 0, 0], neck: [-24, 0, 0], head: [-34, 0, 0] }));
  const hop = P(AIR, { root: [0, 0, 0], spine: [-10, 0, 0], head: [-26, 0, 0], upperArmL: [-60, 0, 60], foreArmL: [-60, 0, 0], upperArmR: [-60, 0, -60], foreArmR: [-60, 0, 0], thighL: [-50, 0, 10], shinL: [70, 0, 0], thighR: [-30, 0, -10], shinR: [80, 0, 0] });
  const wince = plant(P(STANCE, OPEN_LEGS, { hips: [0, -40, 0], spine: [4, 0, 0], neck: [6, -10, 0], head: [10, -26, 0], upperArmL: [-50, 0, 20], foreArmL: [-120, 0, 0], upperArmR: [-50, 0, -20], foreArmR: [-120, 0, 0] }));
  const wave = plant(P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, { hips: [0, -30, 0], spine: [-6, 0, 0], head: [-18, 16, 0], upperArmR: [-10, 0, -150], foreArmR: [0, 0, -20], handR: [0, 0, 0] }));
  const wave2 = P(wave, { foreArmR: [0, 0, 24], head: [-18, 12, 4] });
  const A = ATTACKS;
  const a = clip(
    K(0, A.super.strike),
    K(6, call, 'out'),
    K(20, call2, 'smooth'),
    K(30, call, 'smooth'),
    K(38, pointSky, 'smooth'),
    K(50, P(pointSky, { head: [-14, 30, 0] }), 'smooth'),
    K(58, present, 'smooth'),
    K(70, present2, 'smooth'),
    K(82, present, 'smooth'),
    K(96, present2, 'smooth'),
    K(106, present, 'smooth'),
    K(116, guard, 'smooth'),
    strike(124, A.cross.windup, A.cross.strike, 5, 2),
    K(132, guard, 'smooth'),
    strike(140, A.frontKick.windup, A.frontKick.strike, 5, 2),
    K(148, guard, 'smooth'),
    strike(160, A.roundhouse.windup, A.roundhouse.strike, 6, 2),
    K(168, guard, 'smooth'),
    K(174, P(CROUCH, { head: [-14, 10, 0] }), 'smooth'),
    K(184, P(CROUCH, { head: [-14, 10, 0] })),
    K(190, run, 'out'),
    K(196, launchWind, 'smooth'),
    K(202, launch, 'in'),
    K(206, launch),
    K(210, walkA, 'smooth'),
    K(214, walkB, 'smooth'),
    K(218, high5Wind, 'smooth'),
    K(222, high5, 'in'),
    K(225, high5),
    K(228, lookUp, 'out'),
    K(233, hop, 'out'),
    K(240, LANDING, 'in'),
    K(246, STANCE, 'smooth'),
    K(252, wince, 'in'),
    K(260, wince),
    K(266, wave, 'smooth'),
    K(272, wave2, 'smooth'),
    K(278, wave, 'smooth'),
    K(284, wave2, 'smooth'),
    K(290, wave, 'smooth'),
    K(304, STANCE, 'smooth'),
    K(324, STANCE),
  );

  // --- victim ---
  const lookSky = plant(P(WARY, { spine: [-8, 0, 0], neck: [-16, 0, 0], head: [-24, 0, 0] }));
  // looking over its shoulder at the hero who just landed behind
  const lookBack = plant(P(STANCE, { hips: [0, -20, 0], spine: [-4, 30, 0], chest: [-4, 30, 0], neck: [0, 36, 0], head: [-6, 46, 0], upperArmL: [-30, 0, 30], foreArmL: [-80, 0, 0], upperArmR: [-30, 0, -30], foreArmR: [-80, 0, 0] }));
  const lookBack2 = P(lookBack, { head: [-2, 50, 10] });
  // hit in the back: hips pushed toward Enola, chest and head snapping back
  const backHit = P(HIT_HIGH, { root: [0, -0.05, 0.12], hips: [10, -20, 0], spine: [-20, 0, 0], chest: [-14, 0, 0], neck: [-16, 0, 0], head: [-24, 0, 0], upperArmL: [-20, 0, 50], upperArmR: [-20, 0, -50] });
  const backHit2 = P(backHit, { root: [0, -0.07, 0.16], hips: [20, -20, 0], spine: [-26, 0, 0] });
  // webbed: arms glued to the body, stiff as a board, dragged backward on the heels
  const webbed = plant(
    P(STANCE, {
      root: [0, 0, -0.08],
      hips: [-14, -10, 0],
      spine: [-6, 0, 0],
      chest: [0, 0, 0],
      neck: [10, 0, 0],
      head: [10, 0, 0],
      upperArmL: [6, 0, 8],
      foreArmL: [-6, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [6, 0, -8],
      foreArmR: [-6, 0, 0],
      handR: [0, 0, 0],
      thighL: [6, 0, 4],
      shinL: [4, 0, 0],
      footL: [30, 0, 0],
      thighR: [6, 0, -4],
      shinR: [4, 0, 0],
      footR: [30, 0, 0],
    }),
  );
  const webbed2 = P(webbed, { head: [16, 10, 6], neck: [14, 0, 0], hips: [-18, -10, 0] });
  const popped = P(J.a, { head: [-40, 0, 0], neck: [-24, 0, 0], upperArmL: [6, 0, 10], upperArmR: [6, 0, -10] });
  const pitch = (p: Pose, x: number): Pose => ({ ...p, hips: [x, -15, 0] });
  const v = clip(
    K(0, HIT_MID),
    K(8, WARY, 'smooth'),
    K(30, WARY),
    K(38, lookSky, 'smooth'),
    K(50, P(lookSky, { head: [-30, 10, 0] }), 'smooth'),
    K(56, P(SCARED, { root: [0, SCARED.root![1] + 0.02, -0.06] }), 'out'),
    K(64, lookBack, 'smooth'),
    K(76, lookBack2, 'smooth'),
    K(86, lookBack, 'smooth'),
    K(98, lookBack2, 'smooth'),
    K(110, lookBack, 'smooth'),
    K(118, WARY, 'smooth'),
    react(124, WARY, TWIST_L),
    K(128, REEL, 'smooth'),
    react(132, REEL, backHit),
    K(136, REEL, 'smooth'),
    react(140, REEL, DOUBLE),
    K(144, REEL, 'smooth'),
    react(148, REEL, backHit2),
    K(154, DAZED, 'smooth'),
    react(160, DAZED, TWIST_L2),
    K(168, DAZED, 'smooth'),
    react(174, DAZED, webbed),
    K(180, webbed2, 'smooth'),
    K(186, webbed, 'smooth'),
    K(194, webbed2, 'smooth'),
    K(201, webbed),
    K(202, popped, 'out'),
    K(210, pitch(J.b, -80), 'smooth'),
    K(220, pitch(J.c, -200), 'smooth'),
    K(232, pitch(J.c, -300), 'linear'),
    K(244, pitch(J.c, -400), 'linear'),
    rewrap(252, LYING, 0, 'in', -360),
    K(256, LYING_BOUNCE, 'out'),
    K(262, LYING, 'in'),
    K(324, LYING),
  );

  // --- Spider-Pote (actor, faces back toward Enola: his +Z points at the victim's back) ---
  const swing = P(AIR, {
    root: [0, 0, 0],
    hips: [-10, 0, 0],
    spine: [-6, 0, 0],
    head: [-10, 0, 0],
    upperArmR: [-172, 0, -8],
    foreArmR: [-8, 0, 0],
    handR: [0, 0, 0],
    upperArmL: [-40, 0, 60],
    foreArmL: [-40, 0, 0],
    thighL: [-60, 0, 8],
    shinL: [80, 0, 0],
    thighR: [-30, 0, -8],
    shinR: [70, 0, 0],
  });
  const swing2 = P(swing, { spine: [-14, 0, 0], thighL: [-80, 0, 6], shinL: [20, 0, 0], thighR: [-70, 0, -6], shinR: [30, 0, 0], upperArmL: [-20, 0, 80] });
  const tuck = P(AIR, {
    root: [0, 0, 0],
    hips: [0, 0, 0],
    spine: [20, 0, 0],
    thighL: [-110, 0, 10],
    shinL: [120, 0, 0],
    thighR: [-110, 0, -10],
    shinR: [120, 0, 0],
    upperArmL: [-60, 0, 20],
    foreArmL: [-60, 0, 0],
    upperArmR: [-60, 0, -20],
    foreArmR: [-60, 0, 0],
  });
  // superhero landing: one knee down, fist on the floor, other arm back
  const heroLand = plant(
    P(CROUCH, {
      root: [0, 0, 0],
      hips: [20, -10, 0],
      spine: [30, 0, 0],
      chest: [10, 0, 0],
      neck: [-20, 0, 0],
      head: [-26, 0, 0],
      upperArmR: [-40, 0, -6],
      foreArmR: [0, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [30, 0, 50],
      foreArmL: [-10, 0, 0],
      thighL: [-100, 0, 10],
      shinL: [130, 0, 0],
      footL: [-30, 0, 0],
      thighR: [10, 0, -10],
      shinR: [120, 0, 0],
      footR: [20, 0, 0],
    }),
  );
  const proud = plant(P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, HAND_ON_HIP_R, { hips: [0, -20, 0], spine: [-6, 0, 0], chest: [-8, 0, 0], head: [-10, -14, 0] }));
  const proud2 = P(proud, { head: [-6, -8, 10] });
  // pointing at his own chest with the thumb ("le Spider-Pote !")
  const me = P(proud, { upperArmR: [-40, 60, 0], foreArmR: [-110, 0, 0], handR: [0, 0, 0], head: [-14, -10, 0] });
  // web shot: arm out, wrist flicked up
  const webAim = plant(P(STANCE, { hips: [0, -20, 0], spine: [0, 10, 0], chest: [0, 10, 0], head: [-6, 0, 0], upperArmR: [-90, 0, 0], foreArmR: [0, 0, 0], handR: [-60, 0, 0], upperArmL: [-40, 0, 30], foreArmL: [-80, 0, 0] }));
  const webWind = P(webAim, { upperArmR: [-70, 0, -20], foreArmR: [-60, 0, 0], handR: [0, 0, 0] });
  // pulling the web line, leaning back, legs braced
  const pull = plant(
    P(STANCE, {
      root: [0, 0, -0.1],
      hips: [-6, -10, 0],
      spine: [-20, 0, 0],
      chest: [-10, 0, 0],
      head: [0, 0, 0],
      upperArmR: [-60, 0, -6],
      foreArmR: [-30, 0, 0],
      upperArmL: [-60, 0, 6],
      foreArmL: [-50, 0, 0],
      thighL: [-40, 0, 8],
      shinL: [20, 0, 0],
      thighR: [20, 0, -8],
      shinR: [40, 0, 0],
      footR: [-20, 0, 0],
    }),
  );
  const pull2 = plant(P(pull, { root: [0, 0, -0.14], spine: [-28, 0, 0], upperArmR: [-40, 0, -6], foreArmR: [-70, 0, 0], upperArmL: [-40, 0, 6], foreArmL: [-80, 0, 0] }));
  const pLaunchWind = mirror(launchWind);
  const pLaunch = mirror(launch);
  const swingAway = P(swing, { head: [-20, 0, 0] });
  const p = clip(
    K(0, swing),
    K(26, swing),
    K(34, P(swing, { spine: [-10, 0, 0] }), 'smooth'),
    K(42, swing2, 'smooth'),
    K(46, rot(tuck, 120), 'out'),
    K(51, rot(tuck, 290), 'linear'),
    rewrap(54, heroLand, 0, 'out', 360),
    K(64, heroLand),
    K(74, proud, 'smooth'),
    K(86, proud2, 'smooth'),
    K(96, proud, 'smooth'),
    K(102, me, 'smooth'),
    K(110, me),
    K(118, STANCE, 'smooth'),
    strike(132, A.cross.windup, A.cross.strike, 5, 2),
    K(140, STANCE, 'smooth'),
    strike(148, A.frontKick.windup, A.frontKick.strike, 5, 2),
    K(156, STANCE, 'smooth'),
    K(164, webWind, 'smooth'),
    K(168, webAim, 'in'),
    K(171, webAim),
    K(174, pull, 'in'),
    K(180, pull2, 'smooth'),
    K(186, pull, 'smooth'),
    K(192, STANCE, 'smooth'),
    K(197, pLaunchWind, 'smooth'),
    K(202, pLaunch, 'in'),
    K(206, pLaunch),
    K(210, walkB, 'smooth'),
    K(214, walkA, 'smooth'),
    K(218, high5Wind, 'smooth'),
    K(222, high5, 'in'),
    K(225, high5),
    K(228, lookUp, 'out'),
    K(233, hop, 'out'),
    K(240, LANDING, 'in'),
    K(246, STANCE, 'smooth'),
    K(252, wince, 'in'),
    K(256, proud, 'smooth'),
    // turns around (the script flips his facing at 238), shoots a web line up and swings away
    rewrap(262, P(webWind, { upperArmR: [-150, 0, -10] }), 180, 'smooth'),
    K(266, swing, 'out'),
    K(274, swing2, 'smooth'),
    K(282, swingAway, 'smooth'),
    K(292, swing2, 'smooth'),
    K(324, swing2),
  );
  return { a, v, pote: p };
}

