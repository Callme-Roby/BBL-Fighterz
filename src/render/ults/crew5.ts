import type { Clip, Key, Pose } from '../poses';
import { kit } from '../ultimatePoses';
import { PK, PK_HITS, PK_SPOTS, type PkBlow, type PkHit, type PkSide, type PkSpot } from '../../sim/ults/peekaboo';

/**
 * Clips of the BBL MAX cinematics of src/sim/ults/crew5.ts, keyed by full clip name:
 * `ult:<id>:a` (attacker), `ult:<id>:v` (victim).
 *
 *  peekaboo – Aroa: PEEK-A-BOO (gloves on, Tyson's peek-a-boo guard, a 25-second barrage from
 *             every side with vanishing / reappearing, one huge uppercut)
 *
 * Both clips are generated from the shared timeline (src/sim/ults/peekaboo.ts): strike pose ON
 * every hit frame for the attacker, reaction pose ON it for the victim. The victim clip ends in
 * LYING, the attacker clip in STANCE.
 */
export function crew5Clips(): Record<string, Clip> {
  const out: Record<string, Clip> = {};
  const add = (id: string, c: Record<string, Clip>) => {
    for (const [role, cl] of Object.entries(c)) out[`ult:${id}:${role}`] = cl;
  };
  add('peekaboo', peekaboo());
  return out;
}

const { P, K, clip, plant, react, crash, mirror, spin, rot, rewrap, J, OPEN_LEGS, DAZED, REEL, TWIST_L, TWIST_L2, TWIST_R, TWIST_R2, CHIN_UP, DOUBLE, SMASHED, HAMMER_UP, HAMMER_DOWN, LANDING, HAND_ON_HIP_L, STANCE, LYING, HIT_MID, HIT_HIGH, ATTACKS } = kit;

const D2R = Math.PI / 180;

/** the left-arm part of a pose mirrored onto the right arm */
function armR(p: Pose): Pose {
  const m = mirror(p);
  const out: Pose = {};
  for (const b of ['upperArmR', 'foreArmR', 'handR'] as const) if (m[b]) out[b] = m[b];
  return out;
}

/** Aroa's body turn at each spot (hips yaw added to every pose): she always faces the victim */
const YAW: Record<PkSide, number> = { front: 0, back: 180, far: -90, near: 90, air: 0 };

/**
 * A pose turned to face the victim from `side` (the hips offset turns with the body). From behind
 * the victim, the pose is mirrored first so the chest still opens toward the camera side.
 */
function orient(p0: Pose, side: PkSide): Pose {
  const yaw = YAW[side];
  if (!yaw) return p0;
  const p = side === 'back' ? mirror(p0) : p0;
  const r = p.root ?? [0, 0, 0];
  const t = yaw * D2R;
  const x = r[0] * Math.cos(t) + r[2] * Math.sin(t);
  const z = -r[0] * Math.sin(t) + r[2] * Math.cos(t);
  return spin({ ...p, root: [Math.round(x * 1000) / 1000, r[1], Math.round(z * 1000) / 1000] }, yaw);
}

/** Key list that only grows forward in time (a key earlier than the last one is dropped). */
class Track {
  keys: Key[] = [];
  add(...ks: (Key | Key[])[]) {
    for (const k of ks.flat()) {
      const last = this.keys[this.keys.length - 1];
      if (last && k.f < last.f) continue;
      this.keys.push(k);
    }
  }
  get last(): number {
    return this.keys.length ? this.keys[this.keys.length - 1].f : -1;
  }
}

// ---------------------------------------------------------------------------
// arm poses (solved by forward kinematics, see the scratch solver)
// ---------------------------------------------------------------------------
/** a glove going on: fist pushed forward, the other hand pulls the cuff */
const GLOVE_L_HOLD: Pose = { upperArmL: [-40, -3, -20], foreArmL: [-21, 0, 0], handL: [0, 0, 0] };
const GLOVE_L_PUSH: Pose = { upperArmL: [-50, 0, -19], foreArmL: [-12, 0, 0], handL: [0, 0, 0] };
const GRAB_R: Pose = { upperArmR: [-68, 61, 40], foreArmR: [-39, 0, 0], handR: [0, 0, 0] };
const PULL_R: Pose = { upperArmR: [-49, 75, 30], foreArmR: [-55, 0, 0], handR: [0, 0, 0] };
/** gloves touching in front of the chest / opened */
const TAP_L: Pose = { upperArmL: [-41, -35, -10], foreArmL: [-58, 0, 0], handL: [0, 0, 0] };
const OPEN_L: Pose = { upperArmL: [-18, -32, 20], foreArmL: [-82, 0, 0], handL: [0, 0, 0] };
const LOOSE_L: Pose = { upperArmL: [-6, 0, 12], foreArmL: [-24, 0, 0], handL: [0, 0, 0] };
const SHRUG_L: Pose = { upperArmL: [0, 12, 10], foreArmL: [-79, 0, 0], handL: [-30, 0, 0] };
/** peek-a-boo: both gloves against the cheeks, elbows tucked */
const PKB_ARMS: Pose = { upperArmL: [-82, -16, -18], foreArmL: [-128, 0, 0], handL: [0, 0, 0], upperArmR: [-70, 3, 60], foreArmR: [-94, 0, 0], handR: [0, 0, 0] };
/** waving one glove ("coucou") */
const WAVE_R: Pose = { upperArmR: [-150, 0, -30], foreArmR: [-40, 0, 0], handR: [0, 0, 0] };
const WAVE_R2: Pose = { upperArmR: [-150, 0, -50], foreArmR: [-20, 0, 0], handR: [0, 0, 0] };

// ---------------------------------------------------------------------------
// Aroa — PEEK-A-BOO
// ---------------------------------------------------------------------------
function peekaboo() {
  // ===== attacker poses (front orientation) =====
  const CROUCH_LEGS: Pose = { thighL: [-44, 0, 8], shinL: [62, 0, 0], footL: [-18, 0, 0], thighR: [-10, 0, -8], shinR: [52, 0, 0], footR: [-36, 0, 0] };
  const DEEP_LEGS: Pose = { thighL: [-56, 0, 8], shinL: [84, 0, 0], footL: [-28, 0, 0], thighR: [-22, 0, -8], shinR: [74, 0, 0], footR: [-40, 0, 0] };
  const TORSO: Pose = { hips: [0, -18, 0], spine: [16, -2, 0], chest: [8, -2, 0], neck: [-8, 2, 0], head: [-6, 4, 0] };
  // the peek-a-boo guard: crouched, chin down, gloves on the cheeks
  const pkb = plant(P(STANCE, TORSO, CROUCH_LEGS, PKB_ARMS));
  const bob = plant(P(pkb, DEEP_LEGS, { spine: [22, -2, 0], neck: [-14, 2, 0] }));
  // weaving (dempsey roll): the head travels side to side under an imaginary rope
  const weave = (s: 1 | -1, deep = false) =>
    plant(P(deep ? bob : pkb, { root: [s * 0.09, 0, 0.02], hips: [0, -18 + s * 10, 0], spine: [deep ? 24 : 18, s * 4, -s * 12], chest: [8, s * 2, -s * 6], neck: [-10, 0, s * 8], head: [-6, s * 4, s * 6] }));
  const weaveL = weave(1);
  const weaveR = weave(-1);
  const slipL = weave(1, true);
  const slipR = weave(-1, true);

  // straights (from the crouch: the legs stay bent)
  const jabWind = plant(P(pkb, { hips: [0, -24, 0], upperArmL: [-74, 0, 10], foreArmL: [-84, 0, 0] }));
  const jab = plant(
    P(pkb, {
      root: [0, 0, 0.06],
      hips: [0, -10, 0],
      spine: [14, 4, 0],
      chest: [6, 8, 0],
      head: [-4, -2, 0],
      upperArmL: [-110, -10, -15],
      foreArmL: [-17, 0, 0],
      handL: [0, 0, 0],
      thighL: [-50, 0, 8],
      shinL: [62, 0, 0],
    }),
  );
  const crossWind = plant(P(pkb, { hips: [0, -36, 0], upperArmR: [-40, 0, -28], foreArmR: [-120, 0, 0] }));
  const cross = plant(
    P(pkb, {
      hips: [0, 6, 0],
      spine: [14, 8, 0],
      chest: [6, 10, 0],
      head: [-4, -16, 0],
      upperArmR: [-106, 1, 0],
      foreArmR: [-22, 0, 0],
      handR: [0, 0, 0],
      thighL: [-52, 0, 8],
      shinL: [62, 0, 0],
      thighR: [-4, 0, -8],
      shinR: [36, 0, 0],
    }),
  );
  // hooks to the head
  const hookLWind = plant(P(pkb, { hips: [0, -4, 0], spine: [16, 8, 6], chest: [6, 6, 0], head: [-4, -10, 0], upperArmL: [-60, 0, 40], foreArmL: [-110, 0, 0] }));
  const hookL = plant(
    P(pkb, {
      root: [0, 0, 0.02],
      hips: [0, -50, 0],
      spine: [16, -10, -6],
      chest: [6, -10, 0],
      neck: [-6, 12, 0],
      head: [-6, 26, 0],
      upperArmL: [-37, 30, 102],
      foreArmL: [-101, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  const hookRWind = plant(P(pkb, { hips: [0, -42, 0], spine: [16, -8, -6], head: [-4, 16, 0], upperArmR: [-56, 0, -40], foreArmR: [-110, 0, 0] }));
  const hookR = plant(
    P(pkb, {
      root: [0, 0, 0.06],
      hips: [0, 32, 0],
      spine: [16, 12, 6],
      chest: [6, 10, 0],
      neck: [-6, -10, 0],
      head: [-8, -24, 0],
      upperArmR: [-28, -10, -99],
      foreArmR: [-109, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  // hooks to the body: dipping low
  const bodyRWind = plant(P(bob, { hips: [0, -50, 0], spine: [26, -8, 8], chest: [10, -6, 0], head: [-6, 20, 0], upperArmR: [-20, 0, -30], foreArmR: [-110, 0, 0] }));
  const bodyR = plant(
    P(bob, {
      root: [0, 0, 0.1],
      hips: [0, 28, 0],
      spine: [26, 12, 10],
      chest: [10, 10, 0],
      neck: [-10, -8, 0],
      head: [-14, -22, 0],
      upperArmR: [-8, -10, -82],
      foreArmR: [-116, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const bodyLWind = plant(P(bob, { hips: [0, 10, 0], spine: [26, 8, -8], chest: [10, 6, 0], head: [-6, -16, 0], upperArmL: [-20, 0, 30], foreArmL: [-110, 0, 0] }));
  const bodyL = plant(
    P(bob, {
      root: [0, 0, 0.1],
      hips: [0, -42, 0],
      spine: [26, -14, -10],
      chest: [10, -10, 0],
      neck: [-10, 8, 0],
      head: [-14, 22, 0],
      upperArmL: [-8, 10, 82],
      foreArmL: [-116, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  // uppercut: dip, then the right fist comes up under the chin
  const upWind = plant(
    P(pkb, {
      hips: [0, -48, 0],
      spine: [28, -10, 6],
      chest: [10, -6, 0],
      head: [-2, 14, 0],
      upperArmR: [-6, 0, -26],
      foreArmR: [-112, 0, 0],
      thighL: [-64, 0, 6],
      shinL: [98, 0, 0],
      thighR: [-10, 0, -6],
      shinR: [90, 0, 0],
    }),
  );
  const upWind2 = plant(P(upWind, { spine: [32, -12, 8], thighL: [-72, 0, 6], shinL: [110, 0, 0], thighR: [-18, 0, -6], shinR: [102, 0, 0] }));
  const uppercut = plant(
    P(pkb, {
      root: [0, 0, 0.1],
      hips: [0, 20, 0],
      spine: [4, 12, 0],
      chest: [-4, 10, 0],
      neck: [-6, -6, 0],
      head: [-14, -18, 0],
      upperArmR: [-22, -5, -23],
      foreArmR: [-85, 0, 0],
      handR: [0, 0, 0],
      thighL: [-36, 0, 6],
      shinL: [36, 0, 0],
      thighR: [16, 0, -6],
      shinR: [8, 0, 0],
      footR: [-36, 0, 0],
    }),
    0.04,
  );
  const upFollow = plant(P(uppercut, { root: [0, 0, 0.1], spine: [-6, 14, 0], chest: [-10, 12, 0], head: [-22, -16, 0], upperArmR: [-165, 0, -8], foreArmR: [-30, 0, 0] }), 0.06);
  // the feint: starts the uppercut, stops, smiles
  const feint = plant(P(upWind, { spine: [20, -10, 4], head: [-10, 20, 8], upperArmR: [-30, 0, -26], foreArmR: [-120, 0, 0] }));
  // overhand right (ground)
  const overWind = plant(P(pkb, { hips: [0, -44, 0], spine: [6, -10, -6], chest: [-4, -6, 0], head: [-8, 14, 0], upperArmR: [-160, 0, -30], foreArmR: [-60, 0, 0] }));
  const over = plant(
    P(bob, { root: [0, 0, 0.08], hips: [0, 24, 0], spine: [30, 12, 8], chest: [10, 8, 0], head: [-12, -18, 0], upperArmR: [-104, 0, -6], foreArmR: [-12, 0, 0], handR: [0, 0, 0] }),
  );
  // from the air: overhead hammer fists, then landing
  const airUp = P(HAMMER_UP, { hips: [14, -10, 0] });
  const airUp2 = P(HAMMER_UP, { hips: [8, -6, 0], spine: [-20, 0, 0], head: [-14, 0, 0] });
  const airDown = P(HAMMER_DOWN, { hips: [22, -6, 0] });
  // pop-up poses when she reappears
  const peek = plant(P(pkb, { spine: [10, 0, 0], head: [-10, 0, 10] }, WAVE_R));
  const peek2 = plant(P(pkb, { spine: [10, 0, 0], head: [-10, 0, -8] }, WAVE_R2));
  // gloves on (body squared to the camera side, then the guard)
  const UP: Pose = { root: [0, 0, 0], hips: [0, -38, 0], spine: [8, 0, 0], chest: [4, 0, 0], neck: [6, 0, 0], head: [10, 6, 0] };
  const gear = (arms: Pose, extra: Pose = {}) => plant(P(STANCE, OPEN_LEGS, UP, arms, extra));
  const relaxed = gear(P(LOOSE_L, armR(LOOSE_L)), { head: [-4, 10, 6] });
  const backStep = plant(P(relaxed, { thighL: [-14, 0, 10], shinL: [24, 0, 0], thighR: [24, 0, -10], shinR: [30, 0, 0], footR: [-20, 0, 0] }));
  const gloveLGrab = gear(P(GLOVE_L_HOLD, GRAB_R));
  const gloveLPull = gear(P(GLOVE_L_PUSH, PULL_R), { head: [16, 4, 4] });
  const gloveRGrab = gear(mirror(P(GLOVE_L_HOLD, GRAB_R)));
  const gloveRPull = gear(mirror(P(GLOVE_L_PUSH, PULL_R)), { head: [16, -4, -4] });
  const tap = gear(P(TAP_L, armR(TAP_L)), { head: [8, 0, 0] });
  const open = gear(P(OPEN_L, armR(OPEN_L)), { head: [4, 0, 6] });
  // victory: right glove up to the sky, left hand on the hip, bouncing
  const victory = plant(P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, { hips: [0, -30, 0], spine: [-2, 0, 0], chest: [-4, 0, 0], neck: [-4, 0, 0], head: [-10, 8, 8], upperArmR: [-172, 0, -10], foreArmR: [-16, 0, 0], handR: [0, 0, 0] }));
  const victory2 = plant(P(victory, { head: [-12, 6, -8], upperArmR: [-165, 0, -24] }), 0.05);

  const BLOWS: Record<PkBlow, { wind: Pose; hit: Pose }> = {
    jab: { wind: jabWind, hit: jab },
    cross: { wind: crossWind, hit: cross },
    hookL: { wind: hookLWind, hit: hookL },
    hookR: { wind: hookRWind, hit: hookR },
    bodyL: { wind: bodyLWind, hit: bodyL },
    bodyR: { wind: bodyRWind, hit: bodyR },
    upper: { wind: upWind, hit: uppercut },
    hammer: { wind: overWind, hit: over },
    finish: { wind: upWind2, hit: uppercut },
  };

  const spotAt = (f: number): PkSpot => {
    let s = PK_SPOTS[0];
    for (const sp of PK_SPOTS) if (f >= sp.from) s = sp;
    return s;
  };

  // ===== attacker clip =====
  const A = new Track();
  A.add(
    K(0, ATTACKS.super.strike),
    K(6, backStep, 'out'),
    K(12, relaxed, 'smooth'),
    // "Attends, attends… je mets mes gants."
    K(20, gloveLGrab, 'smooth'),
    K(25, gloveLPull, 'in'),
    K(28, gloveLGrab, 'out'),
    K(31, gloveLPull, 'in'),
    K(35, gloveRGrab, 'smooth'),
    K(39, gloveRPull, 'in'),
    K(42, gloveRGrab, 'out'),
    K(45, gloveRPull, 'in'),
    K(49, open, 'smooth'),
    K(52, tap, 'in'),
    K(55, open, 'out'),
    K(57, tap, 'in'),
    K(61, open, 'smooth'),
    // drops into the peek-a-boo guard: "Peek-a-boo !"
    K(66, bob, 'in'),
    K(72, pkb, 'out'),
    K(78, bob, 'smooth'),
    K(84, pkb, 'smooth'),
    // "Peek-a-boo !": peeking out behind the gloves
    K(88, peek, 'smooth'),
    K(93, peek2, 'smooth'),
    // dempsey roll forward; slips the two swings
    K(97, weaveR, 'smooth'),
    K(PK.swing1 - 3, weaveL, 'smooth'),
    K(PK.swing1, slipL, 'out'),
    K(PK.swing1 + 6, weaveR, 'smooth'),
    K(PK.swing2 - 4, weaveL, 'smooth'),
    K(PK.swing2, slipR, 'out'),
    K(PK.swing2 + 7, weaveL, 'smooth'),
    K(134, weaveR, 'smooth'),
    K(141, weaveL, 'smooth'),
    K(146, pkb, 'smooth'),
  );

  let flip = 1;
  const guardFor = (side: PkSide) => orient(flip > 0 ? weaveL : weaveR, side);
  const hits = PK_HITS.slice(0, -1);
  hits.forEach((h, i) => {
    const sp = spotAt(h.f);
    const side = sp.side;
    const prev = i > 0 ? hits[i - 1] : null;
    const next = hits[i + 1];
    // a spot starts: she pops up (smoke from the director)
    if (prev && spotAt(prev.f) !== sp) {
      const ps = spotAt(prev.f);
      // last guard before vanishing, then the new spot (the turn happens while she's invisible);
      // the pop-up keys stop before the first windup
      const room = (f: number) => f < h.f - 4;
      A.add(K(ps.to - 1, guardFor(ps.side), 'smooth'));
      if (side === 'air') A.add(K(sp.from, airUp), ...(room(sp.from + 8) ? [K(sp.from + 8, airUp2, 'smooth')] : []));
      else if (sp.from > ps.to) {
        A.add(K(sp.from, orient(peek, side)));
        if (room(sp.from + 5)) A.add(K(sp.from + 5, orient(peek2, side), 'smooth'));
        if (room(sp.from + 9)) A.add(K(sp.from + 9, orient(pkb, side), 'smooth'));
      } else A.add(K(sp.from, orient(LANDING, side), 'in'), ...(room(sp.from + 4) ? [K(sp.from + 4, orient(pkb, side), 'out')] : []));
    }
    // the uppercut feint (no blow)
    if (prev && prev.f < PK.feint && h.f > PK.feint) A.add(K(PK.feint - 6, upWind, 'smooth'), K(PK.feint, feint, 'out'), K(PK.feint + 5, pkb, 'smooth'));
    const air = side === 'air';
    const b = air ? { wind: airUp, hit: airDown } : BLOWS[h.blow];
    const gapNext = next ? next.f - h.f : 99;
    const pre = h.flurry ? 1 : gapNext <= 6 || (prev && h.f - prev.f <= 6) ? 2 : 3;
    const hold = 1;
    A.add(K(h.f - pre, orient(b.wind, side), 'out'), K(h.f, orient(b.hit, side), 'in'), K(h.f + hold, orient(b.hit, side)));
    // room before the next blow: back into the weaving guard
    if (!h.flurry && gapNext >= pre + hold + 4 && (!next || spotAt(next.f) === sp)) {
      flip = -flip;
      A.add(K(h.f + hold + 2, air ? P(airUp2, {}) : guardFor(side), 'smooth'));
    }
    // landing after the last blow from the air
    if (air && (!next || spotAt(next.f) !== sp)) A.add(K(sp.to, LANDING, 'in'), K(sp.to + 4, pkb, 'out'));
  });
  // the finish: bobbing, the dazed victim, the long windup, the uppercut, victory
  const F = PK.finish;
  A.add(
    K(766, pkb, 'smooth'),
    K(772, weaveL, 'smooth'),
    K(778, weaveR, 'smooth'),
    K(786, pkb, 'smooth'),
    K(794, bob, 'smooth'),
    K(800, pkb, 'smooth'),
    K(812, upWind, 'smooth'),
    K(824, upWind2, 'smooth'),
    K(F - 2, P(upWind2, { thighL: [-76, 0, 6], shinL: [116, 0, 0], thighR: [-20, 0, -6], shinR: [108, 0, 0] }), 'smooth'),
    K(F, uppercut, 'in'),
    K(F + 6, upFollow, 'out'),
    K(F + 22, upFollow),
    K(F + 34, victory, 'smooth'),
    K(F + 44, victory2, 'smooth'),
    K(F + 54, victory, 'smooth'),
    K(F + 64, victory2, 'smooth'),
    K(F + 74, victory, 'smooth'),
    K(F + 86, victory2, 'smooth'),
    K(F + 100, victory, 'smooth'),
    K(PK.length, STANCE, 'smooth'),
  );
  const a = clip(...A.keys);

  // ===== victim poses (local +Z = toward the attacker's start) =====
  const wary = plant(P(STANCE, { hips: [0, -26, 0], head: [-2, 14, 0] }));
  const puzzled = plant(P(STANCE, OPEN_LEGS, { hips: [0, -30, 0], spine: [2, 0, 0], head: [-4, 10, 14], upperArmL: [-20, 0, 14], foreArmL: [-70, 0, 0], upperArmR: [-20, 0, -14], foreArmR: [-70, 0, 0] }));
  const puzzled2 = P(puzzled, { head: [-6, 6, -10] });
  const protest = plant(P(STANCE, OPEN_LEGS, SHRUG_L, armR(SHRUG_L), { root: [0, 0, 0.04], hips: [0, -24, 0], spine: [10, 0, 0], chest: [-4, 0, 0], neck: [-6, 0, 0], head: [-8, 6, 8] }));
  const protest2 = P(protest, { upperArmL: [-14, 5, 16], upperArmR: [-14, -5, -16], head: [-12, 6, -8], spine: [12, 0, 0] });
  const scared = plant(
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
  // its swings
  const swingWind = plant(P(ATTACKS.cross.windup, { head: [0, 10, 0] }));
  const swing = plant(P(ATTACKS.cross.strike, { root: [0, 0, 0.1], spine: [16, 10, 0], head: [-6, -6, 0] }));
  const hookWind = plant(P(ATTACKS.hook.windup));
  const hookSwing = plant(P(ATTACKS.hook.strike, { root: [0, 0, 0.06], spine: [14, 20, 0] }));
  // looking for her (head left / right, hands up)
  const look = (s: 1 | -1, back = false) =>
    plant(P(scared, { hips: [0, -20 + s * (back ? 40 : 14), 0], spine: [0, s * (back ? 24 : 10), 0], chest: [0, s * (back ? 20 : 8), 0], neck: [0, s * 26, 0], head: [4, s * 40, 0] }));
  // blows from the front
  const snap = plant(P(HIT_HIGH, { hips: [-8, -34, 0], neck: [-24, 8, 0], head: [-30, 8, 0] }));
  const snap2 = plant(P(HIT_HIGH, { root: [0, 0, -0.1], hips: [-10, -30, 0], neck: [-26, -6, 0], head: [-34, -6, 4] }));
  const between = plant(P(HIT_HIGH, { root: [0, 0, -0.04], hips: [-2, -30, 0], head: [-6, 4, 0], upperArmL: [-40, 0, 30], foreArmL: [-90, 0, 0], upperArmR: [-40, 0, -30], foreArmR: [-90, 0, 0] }));
  const between2 = plant(P(between, { root: [0.03, 0, -0.04], spine: [0, 0, 6], head: [-4, -10, 8] }));
  const doubled = plant(DOUBLE);
  const doubled2 = plant(P(DOUBLE, { spine: [36, 10, 8], head: [16, -12, 0] }));
  const flurryA = plant(P(DAZED, { head: [-10, 24, -10], spine: [0, 6, -6] }));
  const flurryB = plant(P(DAZED, { head: [-10, -24, 10], spine: [0, -6, 6] }));
  // blows in the back: arched forward, arms flung back
  const backHit = plant(
    P(STANCE, {
      root: [0, 0, 0.1],
      hips: [-12, -20, 0],
      spine: [-16, 0, 0],
      chest: [-10, 0, 0],
      neck: [-14, 0, 0],
      head: [-20, 0, 0],
      upperArmL: [24, 0, 30],
      foreArmL: [-20, 0, 0],
      upperArmR: [24, 0, -30],
      foreArmR: [-20, 0, 0],
    }),
  );
  const backHit2 = plant(P(backHit, { spine: [-20, 8, 6], head: [-24, 10, 0], root: [0.02, 0, 0.12] }));
  const backHead = plant(P(backHit, { spine: [10, 0, 0], neck: [24, 0, 0], head: [28, 0, 0] }));
  // blows from the side (far side = its left): pushed toward the other side
  const sideHit = (s: 1 | -1, body: boolean, alt: boolean): Pose => {
    const base = body ? DOUBLE : s > 0 ? (alt ? TWIST_R2 : TWIST_R) : alt ? TWIST_L2 : TWIST_L;
    return plant(P(base, { root: [-s * 0.08, 0, 0], spine: [body ? 34 : -4, 0, s * 12], chest: [body ? 20 : -6, 0, s * 6] }));
  };
  // from above: the knees buckle
  const squashed = plant(P(SMASHED, { thighL: [-30, 0, 10], shinL: [60, 0, 0], thighR: [-24, 0, -10], shinR: [66, 0, 0] }));
  const wobble = plant(P(DAZED, { head: [16, -20, 14], spine: [6, 0, 10] }));
  const wobble2 = plant(P(REEL, { head: [14, 22, -12], spine: [6, 0, -10] }));

  /** where the victim looks / how it stands between two blows */
  const idleFor = (side: PkSide, n: number): Pose => {
    switch (side) {
      case 'back':
        return n % 2 ? look(1) : look(-1);
      case 'far':
        return plant(P(between, { head: [-6, 30, 4], neck: [0, 16, 0] }));
      case 'near':
        return plant(P(between, { head: [-6, -30, -4], neck: [0, -16, 0] }));
      case 'air':
        return plant(P(between, { neck: [-20, 0, 0], head: [-24, 0, 0] }));
      default:
        return n % 2 ? between : between2;
    }
  };
  const reaction = (h: PkHit, side: PkSide, n: number): Pose => {
    const alt = n % 2 === 1;
    const body = h.blow === 'bodyL' || h.blow === 'bodyR';
    switch (side) {
      case 'back':
        return body ? (alt ? backHit2 : backHit) : backHead;
      case 'far':
        return sideHit(1, body, alt);
      case 'near':
        return sideHit(-1, body, alt);
      case 'air':
        return squashed;
    }
    if (h.flurry) return alt ? flurryB : flurryA;
    switch (h.blow) {
      case 'jab':
        return alt ? snap2 : snap;
      case 'cross':
      case 'hookR':
        return plant(alt ? TWIST_L2 : TWIST_L);
      case 'hookL':
        return plant(alt ? TWIST_R2 : TWIST_R);
      case 'bodyL':
      case 'bodyR':
        return alt ? doubled2 : doubled;
      case 'upper':
        return plant(CHIN_UP);
      default:
        return snap;
    }
  };

  // ===== victim clip =====
  const Vt = new Track();
  Vt.add(
    K(0, HIT_MID),
    K(8, REEL, 'out'),
    K(16, wary, 'smooth'),
    K(26, puzzled, 'smooth'),
    K(40, puzzled2, 'smooth'),
    K(52, puzzled, 'smooth'),
    // "T'es sérieuse, là ?"
    K(60, protest, 'out'),
    K(66, protest2, 'smooth'),
    K(74, protest, 'smooth'),
    K(84, scared, 'smooth'),
    K(92, wary, 'smooth'),
    // two swings in the air
    K(PK.swing1 - 5, swingWind, 'out'),
    K(PK.swing1, swing, 'in'),
    K(PK.swing1 + 6, wary, 'smooth'),
    K(PK.swing2 - 5, hookWind, 'out'),
    K(PK.swing2, hookSwing, 'in'),
    // "Mais arrête de bouger !"
    K(PK.swing2 + 6, protest, 'smooth'),
    K(132, protest2, 'smooth'),
    K(140, scared, 'smooth'),
    K(148, wary, 'smooth'),
  );
  hits.forEach((h, i) => {
    const sp = spotAt(h.f);
    const side = sp.side;
    const prev = i > 0 ? hits[i - 1] : null;
    if (prev && spotAt(prev.f) !== sp) {
      const ps = spotAt(prev.f);
      // she vanished: where is she?
      if (sp.from > ps.to) {
        Vt.add(K(ps.to + 1, idleFor('front', i)), K(ps.to + 3, look(1), 'smooth'));
        if (sp.from - ps.to >= 10) Vt.add(K(ps.to + 8, look(-1), 'smooth'));
        Vt.add(K(sp.from + 2, look(side === 'back' ? 1 : -1, side === 'back'), 'smooth'));
      }
    }
    if (prev && prev.f < PK.feint && h.f > PK.feint) Vt.add(K(PK.feint - 1, between), K(PK.feint + 1, scared, 'out'), K(PK.feint + 6, wary, 'smooth'));
    const before = idleFor(side, i);
    Vt.add(react(h.f, before, reaction(h, side, i)));
    const next = hits[i + 1];
    if (next && next.f - h.f >= 6) Vt.add(K(h.f + Math.min(4, next.f - h.f - 2), before, 'smooth'));
  });
  Vt.add(
    // dazed, swaying
    K(768, wobble, 'smooth'),
    K(780, wobble2, 'smooth'),
    K(792, wobble, 'smooth'),
    K(804, wobble2, 'smooth'),
    K(816, wobble, 'smooth'),
    K(828, wobble2, 'smooth'),
    react(F, wobble2, CHIN_UP),
    // flies away, flipping over backwards
    K(F + 8, rot(J.a, 0), 'smooth'),
    K(F + 24, rot(J.b, -200)),
    rewrap(F + 40, J.c, 0, undefined, -360),
    K(F + 52, J.c, 'smooth'),
    crash(PK.fall),
    K(PK.length, LYING),
  );
  const v = clip(...Vt.keys);
  return { a, v };
}
