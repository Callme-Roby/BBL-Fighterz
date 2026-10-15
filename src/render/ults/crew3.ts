import type { Clip, Euler3, Pose } from '../poses';
import { kit } from '../ultimatePoses';

/**
 * Clips of the BBL MAX cinematics of src/sim/ults/crew3.ts, keyed by full clip name:
 * `ult:<id>:a` (attacker), `ult:<id>:v` (victim), `ult:<id>:<actorId>` (extra actors).
 *
 *  pacifist – Rayan:  PACIFISTE… OU PAS (the victim turns into Dylan, gloves on, English boxing)
 *  meta     – Billel: LA MÉTA (League of Legends monologue in a tunnel, K.O. by information overload)
 *
 * Same frame base as the scripts: keys ON the hit frames (strike pose for the attacker,
 * reaction pose for the victim), victim clips end exactly in LYING, attacker clips end in STANCE.
 */
export function crew3Clips(): Record<string, Clip> {
  const out: Record<string, Clip> = {};
  const add = (id: string, c: Record<string, Clip>) => {
    for (const [role, cl] of Object.entries(c)) out[`ult:${id}:${role}`] = cl;
  };
  add('pacifist', pacifist());
  add('meta', meta());
  return out;
}

const { P, K, clip, rewrap, mirror, plant, strike, react, crash, J, OPEN_LEGS, DAZED, TWIST_L, TWIST_L2, TWIST_R2, CHIN_UP, DOUBLE, SIT, SMASHED, KNEEL, LYING_BOUNCE, STANCE, LYING, HIT_HIGH, HIT_MID, ATTACKS } = kit;

/** the left-arm part of a pose mirrored onto the right arm */
function armR(p: Pose): Pose {
  const m = mirror(p);
  const out: Pose = {};
  for (const b of ['upperArmR', 'foreArmR', 'handR'] as const) if (m[b]) out[b] = m[b];
  return out;
}

// ---------------------------------------------------------------------------
// arm poses (solved by forward kinematics on an upright torso, see the scratch solver)
// ---------------------------------------------------------------------------
/** hands up, palms out ("whoa, calm down") */
const WHOA: Pose = { upperArmL: [-62, 0, 34], foreArmL: [-104, 0, 0], handL: [-40, 0, 0], upperArmR: [-62, 0, -34], foreArmR: [-104, 0, 0], handR: [-40, 0, 0] };
/** palms down, patting the air ("calme-toi") */
const PAT: Pose = { upperArmL: [-40, -10, 26], foreArmL: [-60, 0, 0], handL: [30, 0, 0], upperArmR: [-40, 10, -26], foreArmR: [-60, 0, 0], handR: [30, 0, 0] };
const PAT2: Pose = { upperArmL: [-34, -10, 26], foreArmL: [-40, 0, 0], handL: [40, 0, 0], upperArmR: [-34, 10, -26], foreArmR: [-40, 0, 0], handR: [40, 0, 0] };
/** left fist pushed forward in front of the chest (a glove going on), right hand on its cuff */
const GLOVE_L_HOLD: Pose = { upperArmL: [-40, -3, -20], foreArmL: [-21, 0, 0], handL: [0, 0, 0] };
const GLOVE_L_PUSH: Pose = { upperArmL: [-50, 0, -19], foreArmL: [-12, 0, 0], handL: [0, 0, 0] };
const GRAB_R: Pose = { upperArmR: [-68, 61, 40], foreArmR: [-39, 0, 0], handR: [0, 0, 0] };
const PULL_R: Pose = { upperArmR: [-49, 75, 30], foreArmR: [-55, 0, 0], handR: [0, 0, 0] };
/** gloves touching in front of the chest / opened */
const TAP_L: Pose = { upperArmL: [-41, -35, -10], foreArmL: [-58, 0, 0], handL: [0, 0, 0] };
const OPEN_L: Pose = { upperArmL: [-18, -32, 20], foreArmL: [-82, 0, 0], handL: [0, 0, 0] };
/** hands on the sides of the head (headgear going on), pulled down */
const CAP_L: Pose = { upperArmL: [-133, -31, 10], foreArmL: [-95, 0, 0], handL: [0, 0, 0] };
const CAP_DOWN_L: Pose = { upperArmL: [-112, -44, 23], foreArmL: [-127, 0, 0], handL: [0, 0, 0] };
/** fists under the chin (chin strap) */
const STRAP_L: Pose = { upperArmL: [-56, -48, -21], foreArmL: [-123, 0, 0], handL: [0, 0, 0] };
// Billel's talking hands (kept in front of the chest, readable from the 'face' camera)
const BALL_L: Pose = { upperArmL: [-6, -32, 24], foreArmL: [-95, 0, 0], handL: [-10, 0, 0] };
const BALL_WIDE_L: Pose = { upperArmL: [0, 1, 32], foreArmL: [-112, 0, 0], handL: [-20, 0, 0] };
const MAP_UP_L: Pose = { upperArmL: [-45, -4, 20], foreArmL: [-114, 0, 0], handL: [-10, 0, 0] };
const MAP_DOWN_L: Pose = { upperArmL: [-17, -23, 0], foreArmL: [-64, 0, 0], handL: [0, 0, 0] };
const PALM_L: Pose = { upperArmL: [-24, -43, 8], foreArmL: [-88, 0, 0], handL: [-20, 0, 0] };
const COUNT_R: Pose = { upperArmR: [-36, 40, 10], foreArmR: [-83, 0, 0], handR: [0, 0, 0] };
const COUNT_R2: Pose = { upperArmR: [-47, 56, 11], foreArmR: [-87, 0, 0], handR: [0, 0, 0] };
const SPREAD_L: Pose = { upperArmL: [-28, 45, 45], foreArmL: [-108, 0, 0], handL: [-20, 0, 0] };
const CHOP_UP_L: Pose = { upperArmL: [-51, -29, 0], foreArmL: [-104, 0, 0], handL: [0, 0, 0] };
const CHOP_DN_L: Pose = { upperArmL: [-30, -17, -10], foreArmL: [-54, 0, 0], handL: [10, 0, 0] };
const WAVE_OUT_L: Pose = { upperArmL: [-11, 2, 39], foreArmL: [-113, 0, 0], handL: [-20, 0, 0] };
const WAVE_IN_L: Pose = { upperArmL: [-50, -60, -1], foreArmL: [-87, 0, 0], handL: [-20, 0, 0] };
const TEMPLE_R: Pose = { upperArmR: [-102, 47, -20], foreArmR: [-123, 0, 0], handR: [0, 0, 0] };
const INDEX_UP_R: Pose = { upperArmR: [-75, 13, -4], foreArmR: [-117, 0, 0], handR: [-10, 0, 0] };
const SHRUG_L: Pose = { upperArmL: [0, 12, 10], foreArmL: [-79, 0, 0], handL: [-30, 0, 0] };
const POINT_R: Pose = { upperArmR: [-100, 46, 19], foreArmR: [-9, 0, 0], handR: [0, 0, 0] };
/** palms / fists joined in front of the chest (namaste) */
const PRAY_L: Pose = { upperArmL: [-33, -47, -10], foreArmL: [-85, 0, 0], handL: [0, 0, 0] };
/** right hand flat over the eyes (scanning the horizon) */
const SHADE_EYES_R: Pose = { upperArmR: [-100, 29, 10], foreArmR: [-99, 0, 0], handR: [0, 0, 0] };

// ---------------------------------------------------------------------------
// Rayan — PACIFISTE… OU PAS
// ---------------------------------------------------------------------------
function pacifist() {
  // --- "Wesh, calme-toi… moi je suis pacifiste." ---
  const calm = plant(
    P(STANCE, OPEN_LEGS, WHOA, {
      root: [0, 0, -0.04],
      hips: [-4, -26, 0],
      spine: [-6, 0, 0],
      chest: [-4, 0, 0],
      neck: [0, 0, 0],
      head: [-4, 8, 0],
    }),
  );
  const backStep = plant(P(calm, { thighL: [-14, 0, 10], shinL: [24, 0, 0], thighR: [24, 0, -10], shinR: [30, 0, 0], footR: [-20, 0, 0] }));
  const pat = plant(P(calm, PAT, { spine: [4, 0, 0], head: [2, 8, 4] }));
  const pat2 = plant(P(calm, PAT2, { spine: [6, 0, 0], head: [4, 8, -2] }));
  // namaste, serene little bow
  const peace = plant(
    P(STANCE, OPEN_LEGS, PRAY_L, armR(PRAY_L), {
      root: [0, 0, 0],
      hips: [0, -26, 0],
      spine: [4, 0, 0],
      chest: [0, 0, 0],
      neck: [4, 0, 0],
      head: [-2, 8, 8],
    }),
  );
  const peace2 = P(peace, { spine: [10, 0, 0], neck: [8, 0, 0], head: [4, 8, -6] });
  // --- the opponent turns into Dylan: Rayan freezes and stares ---
  const jolt = plant(P(calm, { root: [0, 0, -0.06], spine: [-12, 0, 0], chest: [-8, 0, 0], neck: [-6, 0, 0], head: [-10, 6, 0], upperArmL: [-80, 0, 40], upperArmR: [-80, 0, -40] }));
  const stare = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 0],
      spine: [4, -4, 0],
      chest: [2, -2, 0],
      neck: [0, -2, 0],
      head: [-4, 0, 0],
      upperArmL: [-14, 0, 12],
      foreArmL: [-40, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-14, 0, -12],
      foreArmR: [-40, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const stareNarrow = P(stare, { neck: [2, -2, 0], head: [0, 4, -6], spine: [6, -4, 0] });
  // slow nod ("Là c'est pas pareil")
  const nod = P(stare, { neck: [8, -2, 0], head: [12, 0, 0] });
  // --- back turned, gearing up (hips turned -125°: back to the opponent, chest toward the camera) ---
  const TURN: Pose = { hips: [0, -125, 0], spine: [6, 0, 0], chest: [4, 0, 0], neck: [10, 0, 0], head: [16, 0, 0] };
  const turned = (arms: Pose, extra: Pose = {}) => plant(P(STANCE, OPEN_LEGS, TURN, arms, extra));
  const halfTurn = plant(P(stare, { hips: [0, -80, 0], spine: [4, 0, 0], head: [4, 30, 0] }, GLOVE_L_HOLD));
  const gloveLGrab = turned(P(GLOVE_L_HOLD, GRAB_R));
  const gloveLPull = turned(P(GLOVE_L_PUSH, PULL_R), { head: [20, 4, 4] });
  const gloveRGrab = turned(P(mirror(P(GLOVE_L_HOLD, GRAB_R))));
  const gloveRPull = turned(P(mirror(P(GLOVE_L_PUSH, PULL_R))), { head: [20, -4, -4] });
  const tap = turned(P(TAP_L, armR(TAP_L)), { head: [14, 0, 0] });
  const open = turned(P(OPEN_L, armR(OPEN_L)), { head: [12, 0, 0] });
  const cap = turned(P(CAP_L, armR(CAP_L)), { spine: [-2, 0, 0], neck: [0, 0, 0], head: [-6, 0, 0] });
  const capDown = turned(P(CAP_DOWN_L, armR(CAP_DOWN_L)), { neck: [6, 0, 0], head: [8, 0, 0] });
  const capDown2 = turned(P(CAP_DOWN_L, armR(CAP_DOWN_L)), { neck: [6, 0, 0], head: [6, 8, 6] });
  const strap = turned(P(STRAP_L, armR(STRAP_L)), { neck: [-10, 0, 0], head: [-14, 0, 0] });
  const strap2 = turned(P(STRAP_L, armR(STRAP_L)), { neck: [-12, 0, 0], head: [-18, 0, 0] });
  // ready, back still turned: gloves up, neck roll, glance over the shoulder at Dylan
  const readyArms: Pose = { upperArmL: [-58, 0, 14], foreArmL: [-118, 0, 0], handL: [10, 0, 0], upperArmR: [-58, 0, -14], foreArmR: [-118, 0, 0], handR: [10, 0, 0] };
  const ready = turned(readyArms, { neck: [0, 0, 14], head: [-6, 0, 14] });
  const ready2 = turned(readyArms, { neck: [0, 0, -14], head: [-6, 0, -14] });
  const glance = turned(readyArms, { spine: [6, 14, 0], chest: [4, 16, 0], neck: [0, 30, 0], head: [6, 34, 0] });
  // spinning back to the opponent (hips continue the turn: -125 → -390, rewrapped to -30)
  const spinMid = plant(P(STANCE, readyArms, { hips: [0, -260, 0], spine: [8, 0, 0], head: [0, 0, 0] }), 0.05);

  // --- classic English boxing guard (orthodox, gloves high, chin tucked) ---
  const guard = plant(
    P(STANCE, {
      hips: [0, -30, 0],
      spine: [12, -4, 0],
      chest: [6, -4, 0],
      neck: [4, 4, 0],
      head: [2, 8, 0],
      upperArmL: [-62, 0, 12],
      foreArmL: [-120, 0, 0],
      handL: [10, 0, 0],
      upperArmR: [-46, 0, -16],
      foreArmR: [-136, 0, 0],
      handR: [10, 0, 0],
      thighL: [-32, 0, 6],
      shinL: [44, 0, 0],
      footL: [-12, 0, 0],
      thighR: [14, 0, -6],
      shinR: [26, 0, 0],
      footR: [-34, 0, 0],
    }),
  );
  const guardDn = plant(P(guard, { thighL: [-38, 0, 6], shinL: [56, 0, 0], thighR: [8, 0, -6], shinR: [36, 0, 0], spine: [14, -4, 0] }));
  const shuffle = plant(P(guard, { thighL: [-40, 0, 6], shinL: [40, 0, 0], thighR: [20, 0, -6], shinR: [20, 0, 0] }), 0.04);
  // jab (left straight)
  const jabWind = plant(P(guard, { hips: [0, -24, 0], upperArmL: [-74, 0, 10], foreArmL: [-84, 0, 0] }));
  const jab = plant(
    P(guard, {
      root: [0, 0, 0.06],
      hips: [0, -14, 0],
      spine: [10, 4, 0],
      chest: [6, 8, 0],
      head: [2, -2, 0],
      upperArmL: [-98, -10, -15],
      foreArmL: [-17, 0, 0],
      handL: [0, 0, 0],
      thighL: [-40, 0, 6],
      shinL: [44, 0, 0],
    }),
  );
  // cross (right straight): the right shoulder comes through
  const crossWind = plant(P(guard, { hips: [0, -40, 0], upperArmR: [-40, 0, -28], foreArmR: [-120, 0, 0] }));
  const cross = plant(
    P(guard, {
      root: [0, 0, 0],
      hips: [0, 2, 0],
      spine: [10, 8, 0],
      chest: [6, 10, 0],
      head: [0, -16, 0],
      upperArmR: [-90, 1, 0],
      foreArmR: [-26, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-54, 0, 18],
      foreArmL: [-126, 0, 0],
      thighL: [-44, 0, 6],
      shinL: [46, 0, 0],
      thighR: [16, 0, -6],
      shinR: [14, 0, 0],
      footR: [-30, 0, 0],
    }),
  );
  // left hook to the head: the torso turns right, the bent left arm sweeps across
  const hookLWind = plant(P(guard, { hips: [0, -10, 0], spine: [12, 6, 0], chest: [6, 6, 0], head: [2, -10, 0], upperArmL: [-60, 0, 40], foreArmL: [-110, 0, 0] }));
  const hookL = plant(
    P(guard, {
      root: [0, 0, 0.02],
      hips: [0, -50, 0],
      spine: [12, -10, -6],
      chest: [6, -10, 0],
      neck: [0, 12, 0],
      head: [-2, 26, 0],
      upperArmL: [-37, 30, 102],
      foreArmL: [-101, 0, 0],
      handL: [0, 0, 0],
      thighL: [-36, 0, 6],
      shinL: [40, 0, 0],
      footL: [-4, 0, 0],
      thighR: [12, 0, -6],
      shinR: [30, 0, 0],
      footR: [-40, 0, 0],
    }),
  );
  // right to the body: knees bent, dipping to the right, the right shoulder turns in
  const bodyWind = plant(
    P(guard, {
      hips: [0, -50, 0],
      spine: [22, -8, 8],
      chest: [10, -6, 0],
      head: [4, 20, 0],
      thighL: [-50, 0, 6],
      shinL: [76, 0, 0],
      thighR: [-4, 0, -6],
      shinR: [60, 0, 0],
      upperArmR: [-20, 0, -30],
      foreArmR: [-110, 0, 0],
    }),
  );
  const bodyR = plant(
    P(guard, {
      root: [0, 0, 0.1],
      hips: [0, 30, 0],
      spine: [24, 12, 10],
      chest: [10, 10, 0],
      neck: [-4, -8, 0],
      head: [-12, -22, 0],
      upperArmR: [-8, -10, -82],
      foreArmR: [-116, 0, 0],
      handR: [0, 0, 0],
      thighL: [-56, 0, 6],
      shinL: [80, 0, 0],
      thighR: [2, 0, -6],
      shinR: [64, 0, 0],
      footR: [-30, 0, 0],
    }),
  );
  // right hook to the head (doubling up): torso turns left
  const hookRWind = plant(P(guard, { hips: [0, -50, 0], spine: [14, -8, 0], head: [2, 16, 0], upperArmR: [-56, 0, -40], foreArmR: [-110, 0, 0] }));
  const hookR = plant(
    P(guard, {
      root: [0, 0, 0.08],
      hips: [0, 36, 0],
      spine: [12, 12, 6],
      chest: [6, 10, 0],
      neck: [0, -10, 0],
      head: [-6, -24, 0],
      upperArmR: [-28, -10, -99],
      foreArmR: [-109, 0, 0],
      handR: [0, 0, 0],
      thighL: [-42, 0, 6],
      shinL: [44, 0, 0],
      thighR: [16, 0, -6],
      shinR: [16, 0, 0],
      footR: [-34, 0, 0],
    }),
  );
  // short flurry: quick straight punches L / R / L
  const flL = plant(P(jab, { root: [0, 0, 0.05], upperArmL: [-90, -3, -15], foreArmL: [-20, 0, 0] }));
  const flR = plant(P(cross, { root: [0, 0, 0.02], hips: [0, 4, 0], upperArmR: [-82, -9, 0], foreArmR: [-33, 0, 0] }));
  // uppercut: dip, then the right fist comes up under the chin and keeps going
  const upWind = plant(
    P(guard, {
      root: [0, 0, 0],
      hips: [0, -48, 0],
      spine: [26, -10, 6],
      chest: [10, -6, 0],
      head: [6, 14, 0],
      upperArmR: [-6, 0, -26],
      foreArmR: [-112, 0, 0],
      thighL: [-64, 0, 6],
      shinL: [98, 0, 0],
      thighR: [-10, 0, -6],
      shinR: [90, 0, 0],
    }),
  );
  const upWind2 = plant(P(upWind, { spine: [30, -12, 8], thighL: [-70, 0, 6], shinL: [108, 0, 0], thighR: [-16, 0, -6], shinR: [100, 0, 0] }));
  const uppercut = plant(
    P(guard, {
      root: [0, 0, 0.12],
      hips: [0, 20, 0],
      spine: [4, 12, 0],
      chest: [-4, 10, 0],
      neck: [-6, -6, 0],
      head: [-14, -18, 0],
      upperArmR: [-22, -5, -23],
      foreArmR: [-85, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-40, 0, 26],
      foreArmL: [-118, 0, 0],
      thighL: [-36, 0, 6],
      shinL: [36, 0, 0],
      thighR: [16, 0, -6],
      shinR: [8, 0, 0],
      footR: [-36, 0, 0],
    }),
    0.04,
  );
  const upFollow = plant(P(uppercut, { root: [0, 0, 0.1], spine: [-6, 14, 0], chest: [-10, 12, 0], head: [-22, -16, 0], upperArmR: [-165, 0, -8], foreArmR: [-30, 0, 0] }), 0.08);
  // "Désolé…": gloves together, little bow; "…c'est un vieux contentieux.": shrug
  const sorry = plant(P(STANCE, OPEN_LEGS, PRAY_L, armR(PRAY_L), { hips: [0, -44, 0], spine: [8, -6, 0], chest: [2, -6, 0], neck: [0, -4, 0], head: [-4, -6, 10] }));
  const sorry2 = P(sorry, { spine: [12, -6, 0], head: [0, -4, -6] });
  const shrug = plant(P(STANCE, OPEN_LEGS, SHRUG_L, armR(SHRUG_L), { hips: [0, -44, 0], spine: [-4, -6, 0], chest: [-6, -6, 0], neck: [0, -4, 0], head: [-6, -6, 10] }));

  const a = clip(
    K(0, ATTACKS.super.strike),
    K(6, backStep, 'out'),
    K(12, calm, 'smooth'),
    K(18, pat, 'smooth'),
    K(24, pat2, 'smooth'),
    K(30, pat, 'smooth'),
    K(36, pat2, 'smooth'),
    K(46, peace, 'smooth'),
    K(58, peace2, 'smooth'),
    K(68, peace, 'smooth'),
    // poof: Dylan
    K(72, jolt, 'out'),
    K(80, jolt),
    K(90, stare, 'smooth'),
    K(94, stareNarrow, 'smooth'),
    K(104, stareNarrow),
    K(110, nod, 'smooth'),
    K(116, stareNarrow, 'smooth'),
    K(122, stareNarrow),
    // turns his back
    K(128, halfTurn, 'smooth'),
    K(134, gloveLGrab, 'smooth'),
    K(137, gloveLPull, 'in'),
    K(140, gloveLGrab, 'smooth'),
    K(143, gloveRGrab, 'smooth'),
    K(146, gloveRPull, 'in'),
    K(149, gloveRGrab, 'smooth'),
    K(152, tap, 'in'),
    K(154, open, 'out'),
    K(156, tap, 'in'),
    K(159, cap, 'smooth'),
    K(162, capDown, 'in'),
    K(165, capDown2, 'smooth'),
    K(168, strap, 'smooth'),
    K(171, strap2, 'smooth'),
    K(174, strap, 'smooth'),
    // ready, still turned: neck roll, glance over the shoulder
    K(180, ready, 'smooth'),
    K(186, ready2, 'smooth'),
    K(192, glance, 'smooth'),
    K(199, glance),
    // DING DING: spins back into guard
    K(203, spinMid, 'in'),
    rewrap(207, guard, -360, 'out'),
    K(209, shuffle, 'smooth'),
    // jab, jab
    strike(214, jabWind, jab, 3, 1),
    K(217, guardDn, 'smooth'),
    strike(220, jabWind, jab, 2, 1),
    // cross
    strike(227, crossWind, cross, 4, 1),
    // left hook
    strike(235, hookLWind, hookL, 4, 1),
    // right to the body
    strike(243, bodyWind, bodyR, 4, 1),
    // right hook to the head
    strike(251, hookRWind, hookR, 4, 1),
    // flurry
    K(254, guard, 'smooth'),
    K(257, flL, 'in'),
    K(260, guard, 'smooth'),
    K(263, flR, 'in'),
    K(266, guard, 'smooth'),
    K(269, flL, 'in'),
    // uppercut
    K(273, upWind, 'smooth'),
    K(278, upWind2, 'smooth'),
    K(282, uppercut, 'in'),
    K(287, upFollow, 'out'),
    K(298, upFollow),
    // "Désolé… c'est un vieux contentieux."
    K(306, sorry, 'smooth'),
    K(314, sorry2, 'smooth'),
    K(322, sorry, 'smooth'),
    K(330, shrug, 'smooth'),
    K(338, shrug),
    K(356, STANCE, 'smooth'),
  );

  // --- victim: the original fighter, then Dylan (swap at 70) ---
  const wary = plant(P(STANCE, { hips: [0, -26, 0], head: [-2, 14, 0] }));
  const puzzled = plant(P(STANCE, OPEN_LEGS, { hips: [0, -30, 0], spine: [2, 0, 0], head: [-4, 10, 14], upperArmL: [-20, 0, 14], foreArmL: [-70, 0, 0], upperArmR: [-20, 0, -14], foreArmR: [-70, 0, 0] }));
  const puzzled2 = P(puzzled, { head: [-6, 6, -10] });
  // poof: looks down at its new body, hands open
  const lookSelf = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -26, 0],
      spine: [10, 0, 0],
      chest: [6, 0, 0],
      neck: [8, 0, 0],
      head: [12, 0, 0],
      upperArmL: [-50, -30, 20],
      foreArmL: [-50, 0, 0],
      handL: [-30, 0, 0],
      upperArmR: [-50, 30, -20],
      foreArmR: [-50, 0, 0],
      handR: [-30, 0, 0],
    }),
  );
  const lookSelf2 = P(lookSelf, { head: [14, 14, 8], upperArmL: [-60, -30, 20], upperArmR: [-40, 30, -20] });
  const whoMe = plant(P(STANCE, OPEN_LEGS, SHRUG_L, armR(SHRUG_L), { hips: [0, -28, 0], spine: [-2, 0, 0], neck: [-4, 0, 0], head: [-8, 8, 14] }));
  const scratch = plant(P(STANCE, OPEN_LEGS, { hips: [0, -24, 0], spine: [4, 0, 0], head: [2, 4, -12], upperArmR: [-150, 0, -40], foreArmR: [-120, 0, 0], handR: [20, 0, 0], upperArmL: [-10, 0, 14], foreArmL: [-40, 0, 0] }));
  const scratch2 = P(scratch, { head: [4, 0, -6], foreArmR: [-110, 0, 0] });
  // "Hein ?! Mais j'ai rien fait !": palms up, shoulders up, leaning in
  const protest = plant(
    P(STANCE, OPEN_LEGS, SHRUG_L, armR(SHRUG_L), {
      root: [0, 0, 0.04],
      hips: [0, -24, 0],
      spine: [10, 0, 0],
      chest: [-4, 0, 0],
      neck: [-6, 0, 0],
      head: [-8, 6, 8],
    }),
  );
  const protest2 = P(protest, { upperArmL: [-14, 5, 16], upperArmR: [-14, -5, -16], head: [-12, 6, -8], spine: [12, 0, 0] });
  // the bell: awkward guard, trembling
  const scaredGuard = plant(
    P(STANCE, {
      root: [0, 0, -0.06],
      hips: [-4, -20, 0],
      spine: [-6, 0, 0],
      chest: [-4, 0, 0],
      head: [6, 6, 0],
      upperArmL: [-68, 0, 10],
      foreArmL: [-140, 0, 0],
      upperArmR: [-70, 0, -10],
      foreArmR: [-140, 0, 0],
      thighL: [-20, 0, 8],
      shinL: [30, 0, 0],
      thighR: [12, 0, -8],
      shinR: [24, 0, 0],
    }),
  );
  const scaredGuard2 = P(scaredGuard, { root: [0.012, scaredGuard.root![1] - 0.01, -0.06], head: [8, 0, 4] });
  // blows
  const snap = plant(P(HIT_HIGH, { hips: [-8, -34, 0], neck: [-24, 8, 0], head: [-30, 8, 0] }));
  const snap2 = plant(P(HIT_HIGH, { root: [0, 0, -0.1], hips: [-10, -30, 0], neck: [-26, -6, 0], head: [-34, -6, 4] }));
  const between = plant(P(HIT_HIGH, { root: [0, 0, -0.04], hips: [-2, -30, 0], head: [-6, 4, 0], upperArmL: [-40, 0, 30], foreArmL: [-90, 0, 0], upperArmR: [-40, 0, -30], foreArmR: [-90, 0, 0] }));
  const twistL = plant(TWIST_L);
  const twistR2 = plant(TWIST_R2);
  const doubled = plant(DOUBLE);
  const twistL2 = plant(TWIST_L2);
  const wobble = plant(P(DAZED, { head: [16, -20, 14], spine: [6, 0, 10] }));
  const flurryA = plant(P(DAZED, { head: [-10, 24, -10], spine: [0, 6, -6] }));
  const flurryB = plant(P(DAZED, { head: [-10, -24, 10], spine: [0, -6, 6] }));
  const v = clip(
    K(0, HIT_MID),
    K(8, wary, 'smooth'),
    K(20, puzzled, 'smooth'),
    K(36, puzzled2, 'smooth'),
    K(52, puzzled, 'smooth'),
    K(68, puzzled2, 'smooth'),
    // poof: it's Dylan now
    K(72, lookSelf, 'out'),
    K(78, lookSelf2, 'smooth'),
    K(84, whoMe, 'smooth'),
    K(92, P(whoMe, { head: [-6, 4, -10] }), 'smooth'),
    K(100, puzzled, 'smooth'),
    K(112, scratch, 'smooth'),
    K(120, scratch2, 'smooth'),
    K(128, scratch, 'smooth'),
    K(136, scratch2, 'smooth'),
    K(146, puzzled, 'smooth'),
    K(160, puzzled2, 'smooth'),
    // protests
    K(180, protest, 'out'),
    K(186, protest2, 'smooth'),
    K(192, protest, 'smooth'),
    K(197, protest2, 'smooth'),
    // DING DING
    K(200, scaredGuard, 'out'),
    K(204, scaredGuard2, 'smooth'),
    K(208, scaredGuard, 'smooth'),
    K(211, scaredGuard2, 'smooth'),
    K(213, scaredGuard),
    // jab, jab, cross, left hook, body, right hook
    react(214, scaredGuard, snap),
    K(218, between, 'smooth'),
    react(220, between, snap2),
    K(224, between, 'smooth'),
    react(227, between, twistL),
    K(232, between, 'smooth'),
    react(235, between, twistR2),
    K(240, between, 'smooth'),
    react(243, between, doubled),
    K(248, P(doubled, { head: [10, 10, 0] }), 'smooth'),
    react(251, P(doubled, { head: [10, 10, 0] }), twistL2),
    K(255, wobble, 'smooth'),
    // flurry
    react(257, wobble, flurryA),
    react(263, flurryA, flurryB),
    react(269, flurryB, flurryA),
    K(276, wobble, 'smooth'),
    // uppercut: launched
    react(282, wobble, CHIN_UP),
    K(288, J.a, 'smooth'),
    K(296, J.b, 'smooth'),
    K(302, J.c, 'smooth'),
    crash(306),
    K(356, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Billel — LA MÉTA
// ---------------------------------------------------------------------------
function meta() {
  // body squared to the 'face' camera (it sits ~17° toward the camera side), relaxed legs
  const TALK: Pose = { root: [0, 0, 0], hips: [0, -16, 0], spine: [2, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [-2, 0, 0] };
  const talk = (arms: Pose, head: Euler3 = [-2, 0, 0], extra: Pose = {}) => plant(P(STANCE, OPEN_LEGS, TALK, arms, { head }, extra));
  const relaxedR: Pose = { upperArmR: [-10, 0, -12], foreArmR: [-40, 0, 0], handR: [0, 0, 0] };
  const relaxedL: Pose = { upperArmL: [-10, 0, 12], foreArmL: [-40, 0, 0], handL: [0, 0, 0] };
  // "attends, attends": steps back, index raised
  const waitUp = plant(P(STANCE, OPEN_LEGS, TALK, INDEX_UP_R, relaxedL, { root: [0, 0, -0.03], hips: [-4, -22, 0], spine: [-4, 0, 0], head: [-6, 6, 4], thighR: [22, 0, -10], shinR: [28, 0, 0] }));
  const ball = talk(P(BALL_L, armR(BALL_L)), [-2, 4, 4]);
  const ball2 = talk(P(BALL_WIDE_L, armR(BALL_L)), [0, -4, -4]);
  const ballWide = talk(P(BALL_WIDE_L, armR(BALL_WIDE_L)), [-6, 0, 0], { spine: [-2, 0, 0] });
  // drawing the map: the lanes, from top-left to bottom-right and back
  const mapA = talk(P(MAP_UP_L, armR(MAP_DOWN_L)), [2, 8, 4], { spine: [4, 0, 4] });
  const mapB = talk(P(MAP_DOWN_L, armR(MAP_UP_L)), [2, -8, -4], { spine: [4, 0, -4] });
  // counting on the fingers (right fist tapping the left palm)
  const count1 = talk(P(PALM_L, COUNT_R), [6, 4, 0], { spine: [4, 0, 0] });
  const count2 = talk(P(PALM_L, COUNT_R2), [8, 2, 0], { spine: [6, 0, 0] });
  const temple = talk(P(TEMPLE_R, BALL_L), [-4, -6, -8]);
  const point = talk(P(POINT_R, relaxedL), [-6, 0, 0], { spine: [6, 0, 0] });
  const indexUp = talk(P(INDEX_UP_R, PALM_L), [-8, 4, 6]);
  const spread = talk(P(SPREAD_L, armR(SPREAD_L)), [-10, 0, 0], { spine: [-6, 0, 0] });
  // both hands chopping on the keyword
  const chopUp = talk(P(CHOP_UP_L, armR(CHOP_UP_L)), [-6, 0, 0], { spine: [-2, 0, 0] });
  const chop = talk(P(CHOP_DN_L, armR(CHOP_DN_L)), [8, 0, 0], { spine: [8, 0, 0] });
  const shrugT = talk(P(SHRUG_L, armR(SHRUG_L)), [-8, 6, 10], { spine: [-2, 0, 0] });
  // "wave management": both hands sweeping side to side, palms forward
  const waveA = talk(P(WAVE_OUT_L, armR(WAVE_IN_L)), [0, 10, 4], { spine: [2, 8, 0] });
  const waveB = talk(P(WAVE_IN_L, armR(WAVE_OUT_L)), [0, -10, -4], { spine: [2, -8, 0] });
  // satisfied nod
  const nod = talk(P(relaxedL, relaxedR), [10, 0, 0], { spine: [4, 0, 0] });
  // stops, looks around: left, right, shading his eyes, shrug
  const freeze = talk(P(BALL_L, armR(BALL_L)), [-4, 0, 0]);
  const lookL = talk(P(relaxedL, relaxedR), [-2, 55, 0], { spine: [0, 14, 0], neck: [0, 20, 0] });
  const lookR = talk(P(relaxedL, SHADE_EYES_R), [-6, -50, 0], { spine: [0, -14, 0], neck: [0, -20, 0] });
  const where = talk(P(SHRUG_L, armR(SHRUG_L)), [-10, 0, 12], { spine: [-4, 0, 0] });

  const a = clip(
    K(0, ATTACKS.super.strike),
    K(8, waitUp, 'out'),
    K(16, P(waitUp, { head: [-4, -4, -4] }), 'smooth'),
    // L1: "Alors en fait, sur ce patch, la bot c'est full enchanteurs…"
    K(22, ball, 'smooth'),
    K(30, ball2, 'smooth'),
    K(38, temple, 'smooth'),
    K(46, ball, 'smooth'),
    K(54, ballWide, 'smooth'),
    K(60, spread, 'in'),
    K(68, spread),
    K(74, mapA, 'smooth'),
    K(82, mapB, 'smooth'),
    K(90, mapA, 'smooth'),
    K(96, chopUp, 'smooth'),
    K(100, chop, 'in'),
    K(106, ball, 'smooth'),
    K(114, count1, 'smooth'),
    // L2: "…du coup ton jungler doit invade niveau un…"
    K(122, ball2, 'smooth'),
    K(132, point, 'smooth'),
    K(140, point),
    K(148, indexUp, 'in'),
    K(156, count1, 'smooth'),
    K(160, count2, 'in'),
    K(164, count1, 'out'),
    K(168, count2, 'in'),
    K(172, count1, 'out'),
    K(178, ballWide, 'in'),
    K(186, mapA, 'smooth'),
    K(194, mapB, 'smooth'),
    K(200, chopUp, 'smooth'),
    K(206, chop, 'in'),
    K(214, temple, 'smooth'),
    K(222, ball, 'smooth'),
    // L3: "…et sans wave management, freeze, slow push, crash…"
    K(230, ball2, 'smooth'),
    K(238, waveA, 'smooth'),
    K(244, waveB, 'smooth'),
    K(252, waveA, 'smooth'),
    K(258, waveB, 'smooth'),
    K(264, waveA, 'smooth'),
    K(270, count1, 'smooth'),
    K(276, count2, 'in'),
    K(280, count1, 'out'),
    K(284, count2, 'in'),
    K(288, count1, 'out'),
    K(292, count2, 'in'),
    K(296, chopUp, 'smooth'),
    K(300, chop, 'in'),
    K(306, shrugT, 'smooth'),
    K(314, point, 'smooth'),
    // "…Jungle gap." satisfied nod
    K(320, nod, 'smooth'),
    K(326, freeze, 'smooth'),
    // he stops, the tunnel is gone: where is everybody?
    K(330, freeze),
    K(334, P(freeze, { head: [-8, 0, 0] }), 'out'),
    K(340, lookL, 'smooth'),
    K(347, lookR, 'smooth'),
    K(354, where, 'smooth'),
    K(366, where),
    K(380, STANCE, 'smooth'),
  );

  // --- victim: staggered back by the dash strike, then information overload ---
  const stagger = plant(
    P(HIT_MID, {
      root: [0, 0, -0.06],
      hips: [-6, -26, 0],
      spine: [-8, 0, 0],
      head: [-6, 0, 0],
      upperArmL: [-40, 0, 50],
      foreArmL: [-40, 0, 0],
      upperArmR: [-30, 0, -60],
      foreArmR: [-40, 0, 0],
      thighL: [-26, 0, 8],
      shinL: [40, 0, 0],
      thighR: [24, 0, -8],
      shinR: [24, 0, 0],
    }),
  );
  const wary = plant(P(STANCE, { hips: [0, -26, 0], head: [-2, 14, 0] }));
  // listening, puzzled: hand on the chin
  const chinHand: Pose = { upperArmR: [-40, 50, 0], foreArmR: [-130, 0, 0], handR: [0, 0, 0], upperArmL: [-20, -40, 0], foreArmL: [-90, 0, 0], handL: [0, 0, 0] };
  const listen = plant(P(STANCE, OPEN_LEGS, chinHand, { hips: [0, -28, 0], spine: [4, 0, 0], head: [2, 8, 12] }));
  const listen2 = P(listen, { head: [4, 4, -8] });
  const flinch = plant(P(listen, { root: [0, 0, -0.04], spine: [-8, 0, 0], neck: [-10, 0, 0], head: [-14, 6, 0] }));
  // hand on the forehead
  const forehead: Pose = { upperArmR: [-110, 30, -10], foreArmR: [-120, 0, 0], handR: [10, 0, 0] };
  const overwhelmed = plant(P(STANCE, OPEN_LEGS, forehead, { hips: [0, -26, 0], spine: [-4, 0, 0], head: [-8, 6, 8], upperArmL: [-10, 0, 14], foreArmL: [-30, 0, 0] }));
  const overwhelmed2 = P(overwhelmed, { head: [-4, 0, -8], spine: [-2, 0, 4] });
  // head lolling (face up: seen in the 'vface' cutaway)
  const dizzy1 = plant(P(DAZED, { neck: [0, 0, 0], head: [-8, -20, 14], spine: [4, 0, 10] }));
  const dizzy2 = plant(P(DAZED, { neck: [0, 0, 0], head: [-8, 20, -14], spine: [4, 0, -10] }));
  const jolt = plant(P(DAZED, { root: [0, 0, -0.05], spine: [-6, 0, 0], neck: [-14, 0, 0], head: [-18, 0, 0] }));
  // both hands on the head (headache)
  const headache: Pose = { upperArmL: [-150, 0, 40], foreArmL: [-110, 0, 0], upperArmR: [-150, 0, -40], foreArmR: [-110, 0, 0] };
  const ache1 = plant(P(DAZED, headache, { spine: [10, 0, 8], head: [14, -10, 8] }));
  const ache2 = plant(P(DAZED, headache, { spine: [10, 0, -8], head: [14, 10, -8] }));
  // knees buckling, then sitting on the floor
  const buckle = plant(SMASHED);
  const kneel = plant(KNEEL);
  const sit = P(SIT, { hips: [-30, -20, 0], spine: [26, 0, 0], neck: [10, 0, 0], head: [14, 0, 0], upperArmL: [10, 0, 16], foreArmL: [-20, 0, 0], upperArmR: [10, 0, -16], foreArmR: [-20, 0, 0] });
  const sit2 = P(sit, { spine: [28, 0, 8], head: [16, -14, 12] });
  const sit3 = P(sit, { spine: [28, 0, -8], head: [16, 14, -12] });
  const sitJolt = P(sit, { spine: [10, 0, 0], neck: [-6, 0, 0], head: [-14, 0, 0], upperArmL: [-30, 0, 40], upperArmR: [-30, 0, -40] });
  const sitLimp = P(sit, { spine: [34, 0, 0], neck: [20, 0, 0], head: [30, 0, 10], upperArmL: [14, 0, 10], foreArmL: [-6, 0, 0], upperArmR: [14, 0, -10], foreArmR: [-6, 0, 0] });
  const keel = P(SIT, { root: [0, -0.7, -0.3], hips: [-64, -20, 0], spine: [6, 0, 0], neck: [-6, 0, 0], head: [-16, 0, 0], upperArmL: [-40, 0, 50], upperArmR: [-40, 0, -50] });
  const v = clip(
    K(0, HIT_MID),
    K(6, stagger, 'out'),
    K(14, P(stagger, { head: [-2, 6, 0] }), 'smooth'),
    K(20, wary, 'smooth'),
    K(30, listen, 'smooth'),
    K(44, listen2, 'smooth'),
    K(54, listen, 'smooth'),
    react(60, listen, flinch),
    K(66, overwhelmed, 'smooth'),
    K(78, overwhelmed2, 'smooth'),
    K(90, overwhelmed, 'smooth'),
    K(99, overwhelmed2, 'smooth'),
    // dizzy
    react(100, overwhelmed2, jolt),
    K(106, dizzy1, 'smooth'),
    K(116, dizzy2, 'smooth'),
    K(126, dizzy1, 'smooth'),
    K(136, dizzy2, 'smooth'),
    K(146, dizzy1, 'smooth'),
    react(148, dizzy1, jolt),
    K(154, ache1, 'smooth'),
    K(162, ache2, 'smooth'),
    K(170, ache1, 'smooth'),
    K(178, ache2, 'smooth'),
    K(185, ache1, 'smooth'),
    // knees give way, sits down
    react(186, ache1, buckle),
    K(192, kneel, 'smooth'),
    K(199, P(kneel, { head: [36, 10, 8] }), 'smooth'),
    K(205, kneel, 'smooth'),
    react(206, kneel, P(kneel, { spine: [10, 0, 0], head: [-10, 0, 0] })),
    K(214, sit, 'smooth'),
    K(226, sit2, 'smooth'),
    K(238, sit3, 'smooth'),
    K(250, sit2, 'smooth'),
    react(252, sit2, sitJolt),
    K(258, sit, 'smooth'),
    K(268, sit3, 'smooth'),
    K(279, sitLimp, 'smooth'),
    react(280, sitLimp, sitJolt),
    K(286, sitLimp, 'smooth'),
    K(294, P(sitLimp, { head: [32, -10, -10] }), 'smooth'),
    K(299, sitLimp, 'smooth'),
    // the last keyword: collapses backward
    react(300, sitLimp, keel),
    crash(306),
    K(340, LYING),
    K(344, LYING_BOUNCE, 'out'),
    K(350, LYING, 'in'),
    K(380, LYING),
  );
  return { a, v };
}

