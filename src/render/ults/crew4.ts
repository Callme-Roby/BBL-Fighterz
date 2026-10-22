import type { Clip, Pose } from '../poses';
import { kit } from '../ultimatePoses';

/**
 * Clips of the BBL MAX cinematics of src/sim/ults/crew4.ts, keyed by full clip name:
 * `ult:<id>:a` (attacker), `ult:<id>:v` (victim).
 *
 *  m6 – Matteo: LE M6 (penalty over the bar, bouncy ball, carried into the net with the goalkeeper)
 *
 * Same frame base as the script: keys ON the hit frames. Both clips end exactly in LYING
 * (the script sets `attackerDown`: Matteo ends on the floor too).
 */
export function crew4Clips(): Record<string, Clip> {
  const out: Record<string, Clip> = {};
  const add = (id: string, c: Record<string, Clip>) => {
    for (const [role, cl] of Object.entries(c)) out[`ult:${id}:${role}`] = cl;
  };
  add('m6', m6());
  return out;
}

const { P, K, clip, plant, react, crash, mirror, OPEN_LEGS, CROSSED, DAZED, HIT_MID, CHIN_UP, FLY_BACK, FLY_BACK2, LYING_BOUNCE, HAND_ON_HIP_L, HAND_ON_HIP_R, STANCE, LYING, ATTACKS } = kit;

/** the left-arm part of a pose mirrored onto the right arm */
function armR(p: Pose): Pose {
  const m = mirror(p);
  const out: Pose = {};
  for (const b of ['upperArmR', 'foreArmR', 'handR'] as const) if (m[b]) out[b] = m[b];
  return out;
}

// ---------------------------------------------------------------------------
// arm poses
// ---------------------------------------------------------------------------
/** right arm stretched toward the opponent, index pointing */
const POINT_R: Pose = { upperArmR: [-88, 8, -6], foreArmR: [-8, 0, 0], handR: [0, 0, 0] };
/** right hand up beside the head (finger snap) */
const SNAP_R: Pose = { upperArmR: [-140, 30, -30], foreArmR: [-70, 0, 0], handR: [-20, 0, 0] };
/** right hand holding the ball up in front of the chest */
const BALL_UP_R: Pose = { upperArmR: [-8, 0, -22], foreArmR: [-62, 0, 0], handR: [-10, 0, 0] };
/** the ball against the lips */
const KISS_R: Pose = { upperArmR: [-60, 46, -6], foreArmR: [-128, 0, 0], handR: [-20, 0, 0] };
/** relaxed arms */
const LOOSE_L: Pose = { upperArmL: [-6, 0, 12], foreArmL: [-24, 0, 0], handL: [0, 0, 0] };
const LOOSE_R: Pose = { upperArmR: [-6, 0, -12], foreArmR: [-24, 0, 0], handR: [0, 0, 0] };
/** both hands on the head (despair) */
const HEAD_L: Pose = { upperArmL: [-150, 0, 40], foreArmL: [-110, 0, 0], handL: [0, 0, 0] };
/** left hand on the belly (laughing) */
const BELLY_L: Pose = { upperArmL: [-20, -30, 10], foreArmL: [-100, 0, 0], handL: [0, 0, 0] };
/** goalkeeper: arms open, gloves wide and low */
const KEEPER_L: Pose = { upperArmL: [-36, 0, 52], foreArmL: [-36, 0, 0], handL: [0, 0, 0] };
/** gloves up in front of the face (looking at them) */
const GLOVES_UP_L: Pose = { upperArmL: [-40, -30, 26], foreArmL: [-84, 0, 0], handL: [-10, 0, 0] };
/** arms up, gloves clapping above the head */
const CLAP_UP_L: Pose = { upperArmL: [-168, 0, 14], foreArmL: [-20, 0, 0], handL: [0, 0, 0] };
const CLAP_OPEN_L: Pose = { upperArmL: [-150, 0, 42], foreArmL: [-24, 0, 0], handL: [0, 0, 0] };

// ---------------------------------------------------------------------------
// Matteo — LE M6
// ---------------------------------------------------------------------------
function m6() {
  // relaxed, squared to the opponent (a bit turned toward the camera side)
  const UP: Pose = { root: [0, 0, 0], hips: [0, -16, 0], spine: [2, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [-2, 6, 0] };
  const stand = (arms: Pose, extra: Pose = {}, lift = 0) => plant(P(STANCE, OPEN_LEGS, UP, arms, extra), lift);

  // "Stop ! On règle ça aux tirs au but."
  const stop = stand(P(LOOSE_L, POINT_R), { spine: [4, 0, 0], head: [-4, 10, 0] });
  const stop2 = stand(P(LOOSE_L, POINT_R), { spine: [6, 0, 0], head: [2, 8, 0], upperArmR: [-80, 8, -6] });
  const snapUp = stand(P(LOOSE_L, SNAP_R), { head: [-6, 0, 6] });
  const snap = stand(P(LOOSE_L, SNAP_R), { head: [-4, 0, -4], foreArmR: [-50, 0, 0], handR: [10, 0, 0] });
  const smug = CROSSED;
  const smug2 = P(CROSSED, { head: [-12, 30, -6] });
  // the ball
  const ballUp = stand(P(LOOSE_L, BALL_UP_R), { head: [6, -6, 0] });
  const kiss = stand(P(LOOSE_L, KISS_R), { spine: [6, 0, 0], neck: [10, 0, 0], head: [10, -18, 0] });
  // walking to the spot, ball in the hand
  const stepA = (arms: Pose) =>
    plant(P(STANCE, UP, arms, { thighL: [-30, 0, 6], shinL: [22, 0, 0], footL: [0, 0, 0], thighR: [14, 0, -6], shinR: [26, 0, 0], footR: [-10, 0, 0] }));
  const stepB = (arms: Pose) =>
    plant(P(STANCE, UP, arms, { thighL: [12, 0, 6], shinL: [26, 0, 0], footL: [-10, 0, 0], thighR: [-30, 0, -6], shinR: [22, 0, 0], footR: [0, 0, 0] }));
  const carry = P(LOOSE_L, BALL_UP_R, { upperArmR: [-26, 20, -10], foreArmR: [-80, 0, 0] });
  // crouching, placing the ball on the spot (right hand reaching down / forward)
  const crouchBase: Pose = {
    hips: [24, -10, 0],
    spine: [26, 0, 0],
    chest: [10, 0, 0],
    neck: [-10, 0, 0],
    head: [-6, 0, 0],
    thighL: [-100, 0, 10],
    shinL: [120, 0, 0],
    footL: [-20, 0, 0],
    thighR: [-10, 0, -8],
    shinR: [120, 0, 0],
    footR: [-50, 0, 0],
  };
  const crouch = (arm: Pose) => plant(P(STANCE, crouchBase, LOOSE_L, { upperArmL: [-40, 0, 20], foreArmL: [-60, 0, 0] }, arm));
  const place = crouch({ upperArmR: [-62, 0, -6], foreArmR: [-14, 0, 0], handR: [-20, 0, 0] });
  const adjust1 = crouch({ upperArmR: [-58, 10, -6], foreArmR: [-20, 0, 0], handR: [-30, 0, 0] });
  const adjust2 = crouch({ upperArmR: [-66, -10, -6], foreArmR: [-8, 0, 0], handR: [-30, 0, 0] });
  const lookUp = P(adjust1, { neck: [-20, 0, 0], head: [-20, 0, 0] });
  // stepping back (looking at the goalkeeper)
  const back = (a: boolean) =>
    plant(
      P(STANCE, UP, LOOSE_L, LOOSE_R, a ? { thighL: [10, 0, 6], shinL: [30, 0, 0], thighR: [-20, 0, -6], shinR: [16, 0, 0] } : { thighL: [-20, 0, 6], shinL: [16, 0, 0], thighR: [10, 0, -6], shinR: [30, 0, 0] }),
    );
  // hands on the hips, deep breath
  const hips = stand(P(HAND_ON_HIP_L, HAND_ON_HIP_R), { spine: [-4, 0, 0], chest: [-6, 0, 0], head: [-6, 0, 0] });
  const breath = stand(P(HAND_ON_HIP_L, HAND_ON_HIP_R), { spine: [-8, 0, 0], chest: [-12, 0, 0], head: [-12, 0, 0] }, 0.02);
  // run-up: leaning forward, arms pumping
  const RUN: Pose = { hips: [10, -10, 0], spine: [12, 0, 0], chest: [4, 0, 0], neck: [-10, 0, 0], head: [-10, 0, 0] };
  const runA = plant(
    P(STANCE, RUN, {
      upperArmL: [40, 0, 10],
      foreArmL: [-80, 0, 0],
      upperArmR: [-60, 0, -10],
      foreArmR: [-90, 0, 0],
      thighL: [-60, 0, 6],
      shinL: [60, 0, 0],
      footL: [-10, 0, 0],
      thighR: [30, 0, -6],
      shinR: [70, 0, 0],
      footR: [-20, 0, 0],
    }),
    0.04,
  );
  const runB = plant(
    P(STANCE, RUN, {
      upperArmR: [40, 0, -10],
      foreArmR: [-80, 0, 0],
      upperArmL: [-60, 0, 10],
      foreArmL: [-90, 0, 0],
      thighR: [-60, 0, -6],
      shinR: [60, 0, 0],
      footR: [-10, 0, 0],
      thighL: [30, 0, 6],
      shinL: [70, 0, 0],
      footL: [-20, 0, 0],
    }),
    0.04,
  );
  // the shot: left foot planted, right leg swung back, then through the ball
  const kickWind = plant(
    P(STANCE, {
      hips: [6, -20, 0],
      spine: [6, 0, -6],
      chest: [2, 0, 0],
      head: [10, 0, 0],
      upperArmL: [-60, 0, 50],
      foreArmL: [-20, 0, 0],
      upperArmR: [-20, 0, -40],
      foreArmR: [-30, 0, 0],
      thighL: [-14, 0, 4],
      shinL: [24, 0, 0],
      footL: [-10, 0, 0],
      thighR: [50, 0, -6],
      shinR: [100, 0, 0],
      footR: [40, 0, 0],
    }),
  );
  const kick = plant(
    P(STANCE, {
      root: [0, 0, 0.05],
      hips: [-14, -6, 0],
      spine: [-6, 0, 4],
      chest: [-6, 0, 0],
      head: [16, 0, 0],
      upperArmL: [-90, 0, 40],
      foreArmL: [-20, 0, 0],
      upperArmR: [-10, 0, -50],
      foreArmR: [-30, 0, 0],
      thighL: [6, 0, 4],
      shinL: [20, 0, 0],
      footL: [-10, 0, 0],
      thighR: [-60, 0, -4],
      shinR: [10, 0, 0],
      footR: [30, 0, 0],
    }),
  );
  const follow = plant(P(kick, { hips: [-22, -4, 0], thighR: [-100, 0, -4], shinR: [0, 0, 0], head: [-14, 0, 0], spine: [-10, 0, 0] }), 0.05);
  // watching the ball fly away: hands on the head, then following it around
  const despair = stand(P(HEAD_L, armR(HEAD_L)), { spine: [-8, 0, 0], chest: [-6, 0, 0], neck: [-10, 0, 0], head: [-24, 0, 0] });
  const despair2 = stand(P(HEAD_L, armR(HEAD_L)), { spine: [-6, 0, 0], neck: [-6, 20, 0], head: [-14, 30, 0] });
  const follow2 = stand(P(LOOSE_L, LOOSE_R), { neck: [-10, 30, 0], head: [-16, 40, 0] });
  const follow3 = stand(P(LOOSE_L, LOOSE_R), { neck: [0, -10, 0], head: [6, -20, 0] });
  // laughing at the goalkeeper (pointing, hand on the belly, leaning back)
  const laugh = stand(P(BELLY_L, POINT_R), { spine: [-10, 0, 0], chest: [-8, 0, 0], neck: [-10, 0, 0], head: [-20, 8, 0] });
  const laugh2 = stand(P(BELLY_L, POINT_R), { spine: [4, 0, 0], chest: [2, 0, 0], neck: [0, 0, 0], head: [-6, 8, 0], upperArmR: [-80, 8, -6] }, 0.01);
  // the ball in the back: arched, arms flung back
  const hitBack = plant(
    P(STANCE, OPEN_LEGS, UP, {
      root: [0, 0, 0.12],
      hips: [12, -10, 0],
      spine: [-24, 0, 0],
      chest: [-14, 0, 0],
      neck: [-16, 0, 0],
      head: [-26, 0, 0],
      upperArmL: [40, 0, 40],
      foreArmL: [-20, 0, 0],
      upperArmR: [40, 0, -40],
      foreArmR: [-20, 0, 0],
    }),
  );
  // superman: horizontal, belly down, arms ahead
  const superman: Pose = {
    root: [0, -0.1, 0],
    hips: [84, 0, 0],
    spine: [-8, 0, 0],
    chest: [-6, 0, 0],
    neck: [-30, 0, 0],
    head: [-30, 0, 0],
    upperArmL: [-170, 0, 12],
    foreArmL: [-10, 0, 0],
    handL: [0, 0, 0],
    upperArmR: [-170, 0, -12],
    foreArmR: [-10, 0, 0],
    handR: [0, 0, 0],
    thighL: [-4, 0, 6],
    shinL: [20, 0, 0],
    footL: [30, 0, 0],
    thighR: [-4, 0, -6],
    shinR: [30, 0, 0],
    footR: [30, 0, 0],
  };
  const superman2 = P(superman, { thighL: [6, 0, 8], shinL: [40, 0, 0], thighR: [-10, 0, -8], shinR: [20, 0, 0], head: [-36, 0, 0] });
  // crashing into the goalkeeper / the net: squashed, arms folded
  const squash = P(superman, { spine: [10, 0, 0], neck: [-10, 0, 0], head: [-6, 0, 0], upperArmL: [-120, 0, 50], foreArmL: [-60, 0, 0], upperArmR: [-120, 0, -50], foreArmR: [-60, 0, 0] });
  // sprung back out of the net: upright for an instant, falling backward
  const sprung = P(STANCE, {
    root: [0, -0.05, -0.1],
    hips: [-20, -10, 0],
    spine: [-10, 0, 0],
    chest: [-8, 0, 0],
    neck: [-10, 0, 0],
    head: [-16, 0, 0],
    upperArmL: [-100, 0, 60],
    foreArmL: [-30, 0, 0],
    upperArmR: [-100, 0, -60],
    foreArmR: [-30, 0, 0],
    thighL: [-40, 0, 10],
    shinL: [50, 0, 0],
    thighR: [-20, 0, -10],
    shinR: [40, 0, 0],
  });
  const falling = P(FLY_BACK, { head: [10, 0, 0] });
  // "…Il compte, hein ?": lying, index finger raised
  const finger = P(LYING, { upperArmR: [-150, 10, -10], foreArmR: [-20, 0, 0], head: [0, -20, 0] });

  const a = clip(
    K(0, ATTACKS.super.strike),
    K(8, stop, 'out'),
    K(16, stop2, 'smooth'),
    K(22, stop, 'smooth'),
    K(27, snapUp, 'smooth'),
    K(31, snap, 'in'),
    K(36, snap),
    K(44, smug, 'smooth'),
    K(56, smug2, 'smooth'),
    K(66, smug, 'smooth'),
    // the ball appears in his hand: a kiss
    K(72, ballUp, 'smooth'),
    K(77, ballUp),
    K(80, kiss, 'in'),
    K(84, kiss),
    // walks to the spot
    K(88, stepA(carry), 'smooth'),
    K(92, stepB(carry), 'smooth'),
    K(96, stepA(carry), 'smooth'),
    K(100, stepB(carry), 'smooth'),
    // crouches and places it (the ball becomes a scene object at 104)
    K(104, place, 'smooth'),
    K(108, place),
    K(112, adjust1, 'smooth'),
    K(116, adjust2, 'smooth'),
    K(120, adjust1, 'smooth'),
    K(122, lookUp, 'smooth'),
    // steps back, eyes on the goalkeeper
    K(127, back(true), 'smooth'),
    K(133, back(false), 'smooth'),
    K(139, back(true), 'smooth'),
    K(145, back(false), 'smooth'),
    K(149, hips, 'smooth'),
    K(153, breath, 'smooth'),
    K(157, hips, 'smooth'),
    // run-up
    K(161, runA, 'smooth'),
    K(165, runB, 'smooth'),
    K(168, kickWind, 'smooth'),
    K(172, kick, 'in'),
    K(176, follow, 'out'),
    K(182, follow),
    // over the bar…
    K(188, despair, 'smooth'),
    K(196, despair2, 'smooth'),
    K(204, despair, 'smooth'),
    K(212, follow2, 'smooth'),
    K(226, follow3, 'smooth'),
    K(240, follow2, 'smooth'),
    K(246, follow3, 'smooth'),
    K(248, follow3),
    // the goalkeeper takes it on the head: laughing
    K(251, laugh, 'out'),
    K(255, laugh2, 'smooth'),
    K(259, laugh, 'smooth'),
    K(263, laugh2, 'smooth'),
    K(267, laugh, 'smooth'),
    K(271, laugh2, 'smooth'),
    K(275, laugh),
    // …in the back
    K(276, hitBack, 'out'),
    K(280, superman, 'smooth'),
    K(286, superman2, 'smooth'),
    K(288, squash, 'in'),
    K(294, superman2, 'smooth'),
    K(298, squash, 'in'),
    // sprung out of the net, on his back
    K(302, sprung, 'out'),
    K(306, falling, 'smooth'),
    K(310, LYING, 'in'),
    K(313, LYING_BOUNCE, 'out'),
    K(317, LYING, 'in'),
    K(324, finger, 'smooth'),
    K(338, finger),
    K(348, LYING, 'smooth'),
    K(384, LYING),
  );

  // --- victim: the original fighter, then the goalkeeper (swap at 34) ---
  const UPV: Pose = { hips: [0, -20, 0], spine: [2, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [-2, 6, 0] };
  const standV = (arms: Pose, extra: Pose = {}, lift = 0) => plant(P(STANCE, OPEN_LEGS, UPV, arms, extra), lift);
  const stagger = plant(P(HIT_MID, { root: [0, 0, -0.06], hips: [-6, -26, 0], spine: [-8, 0, 0], head: [-6, 0, 0], thighL: [-26, 0, 8], shinL: [40, 0, 0], thighR: [24, 0, -8], shinR: [24, 0, 0] }));
  const puzzled = standV(P(LOOSE_L, LOOSE_R), { head: [-4, 10, 14] });
  // poof: looking down at the jersey / the gloves
  const lookSelf = standV(
    { upperArmL: [-50, -30, 20], foreArmL: [-50, 0, 0], handL: [-30, 0, 0], upperArmR: [-50, 30, -20], foreArmR: [-50, 0, 0], handR: [-30, 0, 0] },
    { spine: [10, 0, 0], chest: [6, 0, 0], neck: [8, 0, 0], head: [14, 0, 0] },
  );
  const gloves = standV(P(GLOVES_UP_L, armR(GLOVES_UP_L)), { head: [6, 0, 0] });
  const gloves2 = standV(P(GLOVES_UP_L, armR(GLOVES_UP_L), { upperArmL: [-48, -24, 30], upperArmR: [-36, 36, -22] }), { head: [10, 10, 6] });
  const shrugV = standV({ upperArmL: [0, 12, 10], foreArmL: [-79, 0, 0], handL: [-30, 0, 0], upperArmR: [0, -12, -10], foreArmR: [-79, 0, 0], handR: [-30, 0, 0] }, { head: [-8, 6, 10] });
  // goalkeeper stance: knees bent, arms open, on the toes, swaying
  const KEEP: Pose = {
    hips: [14, -10, 0],
    spine: [16, 0, 0],
    chest: [4, 0, 0],
    neck: [-10, 0, 0],
    head: [-12, 0, 0],
    thighL: [-44, 0, 14],
    shinL: [66, 0, 0],
    footL: [-20, 0, 0],
    thighR: [-44, 0, -14],
    shinR: [66, 0, 0],
    footR: [-20, 0, 0],
  };
  const keeper = (extra: Pose = {}, lift = 0) => plant(P(STANCE, KEEP, KEEPER_L, armR(KEEPER_L), extra), lift);
  const keepL = keeper({ root: [0.12, 0, 0], spine: [16, 0, -6] });
  const keepR = keeper({ root: [-0.12, 0, 0], spine: [16, 0, 6] });
  const keepHop = keeper({}, 0.06);
  // taunt: gloves clapping above the head
  const clapUp = standV(P(CLAP_UP_L, armR(CLAP_UP_L)), { head: [-10, 0, 0] }, 0.04);
  const clapOpen = standV(P(CLAP_OPEN_L, armR(CLAP_OPEN_L)), { head: [-6, 0, 0] });
  // the dive: the wrong way, onto its left side (toward the camera)
  const dive: Pose = P(STANCE, {
    root: [0.55, -0.45, 0],
    hips: [0, -10, 62],
    spine: [0, 0, 10],
    chest: [0, 0, 6],
    neck: [0, 0, -10],
    head: [-6, 0, -16],
    upperArmL: [-10, 0, 160],
    foreArmL: [-10, 0, 0],
    upperArmR: [-20, 0, 150],
    foreArmR: [-10, 0, 0],
    thighL: [-10, 0, 20],
    shinL: [20, 0, 0],
    thighR: [-10, 0, 30],
    shinR: [30, 0, 0],
  });
  const ground: Pose = P(dive, { root: [0.8, -0.78, 0], hips: [0, -10, 86], spine: [0, 0, 0], head: [-6, 0, -20] });
  const ground2: Pose = P(ground, { head: [10, 0, -30], upperArmR: [-40, 0, 90], foreArmR: [-60, 0, 0] });
  const kneelUp = plant(P(STANCE, KEEP, { root: [0.4, 0, 0], hips: [20, -10, 20], spine: [20, 0, -10], thighL: [-90, 0, 14], shinL: [120, 0, 0], thighR: [-20, 0, -14], shinR: [110, 0, 0], footR: [-40, 0, 0] }, KEEPER_L, armR(KEEPER_L)));
  // watching the ball flying around, then standing up straight looking up (where is it?)
  const watchL = standV(P(KEEPER_L, armR(KEEPER_L)), { neck: [-14, 30, 0], head: [-20, 36, 0] });
  const watchR = standV(P(KEEPER_L, armR(KEEPER_L)), { neck: [-6, -24, 0], head: [-6, -30, 0] });
  const watchUp = standV(P(LOOSE_L, LOOSE_R), { neck: [-20, 0, 0], head: [-26, 0, 0] });
  // BONK on the head
  const bonked = plant(P(CHIN_UP, { head: [20, 10, 14], neck: [16, 0, 0], spine: [10, 0, 6] }));
  const wobble = (s: number) => plant(P(DAZED, { head: [16, -20 * s, 14 * s], spine: [6, 0, 10 * s] }));
  const v = clip(
    K(0, HIT_MID),
    K(6, stagger, 'out'),
    K(16, puzzled, 'smooth'),
    K(26, P(puzzled, { head: [-6, 6, -10] }), 'smooth'),
    K(33, puzzled, 'smooth'),
    // poof: goalkeeper
    K(36, lookSelf, 'out'),
    K(42, P(lookSelf, { head: [16, 14, 8] }), 'smooth'),
    K(48, gloves, 'smooth'),
    K(56, gloves2, 'smooth'),
    K(62, gloves, 'smooth'),
    K(70, shrugV, 'smooth'),
    K(78, P(shrugV, { head: [-8, -6, -10] }), 'smooth'),
    // resigned: in goal
    K(88, keeper(), 'smooth'),
    K(96, keepL, 'smooth'),
    K(104, keepR, 'smooth'),
    K(112, keepL, 'smooth'),
    K(120, keepR, 'smooth'),
    // taunt
    K(128, clapUp, 'smooth'),
    K(131, clapOpen, 'smooth'),
    K(134, clapUp, 'in'),
    K(137, clapOpen, 'smooth'),
    K(140, clapUp, 'in'),
    K(144, clapOpen, 'smooth'),
    K(150, clapUp, 'in'),
    K(154, clapUp, 'in'),
    // ready
    K(158, keeper(), 'smooth'),
    K(162, keepHop, 'smooth'),
    K(165, keeper(), 'smooth'),
    K(168, keepHop, 'smooth'),
    K(171, keeper(), 'smooth'),
    // dives (the wrong way)
    K(176, dive, 'out'),
    K(182, ground, 'in'),
    K(190, ground2, 'smooth'),
    K(198, ground, 'smooth'),
    K(204, kneelUp, 'smooth'),
    K(212, keeper(), 'smooth'),
    K(220, watchL, 'smooth'),
    K(228, watchR, 'smooth'),
    K(236, watchL, 'smooth'),
    K(244, watchUp, 'smooth'),
    // BONK
    react(248, watchUp, bonked),
    K(254, wobble(1), 'smooth'),
    K(262, wobble(-1), 'smooth'),
    K(270, wobble(1), 'smooth'),
    K(278, wobble(-1), 'smooth'),
    K(287, wobble(1), 'smooth'),
    // Matteo flying in: carried into the net
    react(288, wobble(1), FLY_BACK),
    K(294, FLY_BACK, 'smooth'),
    K(298, FLY_BACK2, 'in'),
    K(302, P(FLY_BACK2, { head: [30, 0, 0] }), 'smooth'),
    ...crash(306),
    K(384, LYING),
  );
  return { a, v };
}
