import {
  AIR,
  ATTACKS,
  CLIPS,
  CLIP_JUGGLE_POSES,
  CROUCH,
  HIT_HIGH,
  HIT_LOW,
  HIT_MID,
  LYING,
  STANCE,
  merge,
  superCombo,
  superVictim,
  type Clip,
  type Euler3,
  type Key,
  type Pose,
} from './poses';

/**
 * Animations of the BBL MAX cinematic combos (one pair per script of
 * `src/sim/ultimates.ts`): `ult:<id>:a` for the attacker, `ult:<id>:v` for the
 * victim. Keys must line up with the script's hit frames (strike pose ON the hit
 * frame, reaction pose ON the hit frame for the victim).
 *
 * Building blocks (STANCE, CROUCH, AIR, LYING, HIT_HIGH, HIT_MID, ATTACKS,
 * merge…) are exported by `./poses`.
 *
 * In the cinematic the victim always faces the attacker: for the victim, local +Z
 * points at the attacker, so being knocked back = leaning toward local −Z
 * (hips X < 0). Victim clips end in LYING (the sim then switches to `knockdown`),
 * attacker clips end close to STANCE or in a taunt that blends back to idle.
 */

export function registerUltimate(id: string, attacker: Clip, victim: Clip) {
  CLIPS[`ult:${id}:a`] = attacker;
  CLIPS[`ult:${id}:v`] = victim;
}

/** Clip names for a fighter in a cinematic (falls back to the generic rush). */
export function ultimateClip(id: string, role: 'a' | 'v'): string {
  const name = `ult:${id}:${role}`;
  return CLIPS[name] ? name : `ult:rush:${role}`;
}

registerUltimate('rush', superCombo(), superVictim());

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const P = merge;
type Ease = Key['ease'];
const K = (f: number, p: Pose, ease?: Ease): Key => (ease ? { f, p, ease } : { f, p });
const clip = (...keys: (Key | Key[])[]): Clip => {
  const flat = keys.flat();
  return { length: flat[flat.length - 1].f, keys: flat };
};
const D2R = Math.PI / 180;

/** adds `dx`/`dy` degrees to the hips pitch / yaw (full spins and flips: Euler keys interpolate linearly) */
function rot(p: Pose, dx: number, dy = 0): Pose {
  const h = p.hips ?? [0, 0, 0];
  return { ...p, hips: [h[0] + dx, h[1] + dy, h[2]] };
}
const spin = (p: Pose, deg: number): Pose => rot(p, 0, deg);

/**
 * Two keys on the same frame: the pose, then the same pose with the extra hips
 * rotation removed (invisible when it is a multiple of 360). Used after spins and
 * flips so the following keys can be written with normal angles.
 */
function rewrap(f: number, p: Pose, dy: number, ease?: Ease, dx = 0): Key[] {
  return [K(f, rot(p, dx, dy), ease), K(f, p)];
}

/** offsets the hips (metres, character space: x = left, y = up, z = forward) */
function shift(p: Pose, dx: number, dy: number, dz: number): Pose {
  const r = p.root ?? [0, 0, 0];
  return { ...p, root: [r[0] + dx, r[1] + dy, r[2] + dz] };
}

const SWAP: Record<string, string> = {
  shoulderL: 'shoulderR',
  upperArmL: 'upperArmR',
  foreArmL: 'foreArmR',
  handL: 'handR',
  thighL: 'thighR',
  shinL: 'shinR',
  footL: 'footR',
  shoulderR: 'shoulderL',
  upperArmR: 'upperArmL',
  foreArmR: 'foreArmL',
  handR: 'handL',
  thighR: 'thighL',
  shinR: 'shinL',
  footR: 'footL',
};
/** left/right mirror image of a pose */
function mirror(p: Pose): Pose {
  const out: Record<string, Euler3> = {};
  for (const [k, v] of Object.entries(p) as [string, Euler3][]) {
    if (k === 'root') out.root = [-v[0], v[1], v[2]];
    else out[SWAP[k] ?? k] = [v[0], -v[1], -v[2]];
  }
  return out as Pose;
}

function legDrop(hipsX: number, thigh?: Euler3, shin?: Euler3): number {
  const a = (thigh?.[0] ?? 0) + hipsX;
  const b = shin?.[0] ?? 0;
  const side = Math.cos((thigh?.[2] ?? 0) * D2R);
  return (0.44 * Math.cos(a * D2R) + 0.42 * Math.cos((a + b) * D2R)) * side;
}

/** Sets the hips height so the lowest foot touches the floor (upright poses); `lift` raises it (tiptoes, hops). */
function plant(p: Pose, lift = 0): Pose {
  const hx = p.hips?.[0] ?? 0;
  const drop = Math.max(legDrop(hx, p.thighL, p.shinL), legDrop(hx, p.thighR, p.shinR));
  const r = p.root ?? [0, 0, 0];
  return { ...p, root: [r[0], 0.09 - 0.95 + drop + lift, r[2]] };
}

/** hit pattern: windup `pre` frames before, strike ON the hit frame, held `hold` frames */
function strike(f: number, windup: Pose, hit: Pose, pre = 4, hold = 2): Key[] {
  return [K(f - pre, windup, 'out'), K(f, hit, 'in'), K(f + hold, hit)];
}

/** victim reaction: unchanged until the frame before, snaps ON the hit frame */
function react(f: number, before: Pose, hit: Pose): Key[] {
  return [K(f - 1, before), K(f, hit, 'out')];
}

// ---------------------------------------------------------------------------
// shared poses
// ---------------------------------------------------------------------------
const J = CLIP_JUGGLE_POSES();

/** relaxed upright legs, feet apart (spins, taunts) */
const OPEN_LEGS: Pose = {
  thighL: [-8, 0, 12],
  shinL: [14, 0, 0],
  footL: [-6, 0, 0],
  thighR: [-8, 0, -12],
  shinR: [14, 0, 0],
  footR: [-6, 0, 0],
};

/** double biceps flex */
const FLEX = plant(
  P(STANCE, OPEN_LEGS, {
    hips: [0, -30, 0],
    spine: [-4, 0, 0],
    chest: [-8, 0, 0],
    head: [-10, 10, 0],
    upperArmL: [0, 0, 88],
    foreArmL: [0, 0, 105],
    upperArmR: [0, 0, -88],
    foreArmR: [0, 0, -105],
    handL: [0, 0, 0],
    handR: [0, 0, 0],
  }),
);

/** arms crossed, chin up */
const CROSSED = plant(
  P(STANCE, OPEN_LEGS, {
    hips: [0, -50, 0],
    spine: [-4, 0, 0],
    chest: [-4, 0, 0],
    head: [-16, 22, 0],
    upperArmL: [-25, 0, 15],
    foreArmL: [-100, -60, 0],
    upperArmR: [-25, 0, -15],
    foreArmR: [-100, 60, 0],
    handL: [0, 0, 0],
    handR: [0, 0, 0],
  }),
);

const SQUAT = plant(
  P(CROUCH, {
    hips: [0, -10, 0],
    spine: [24, 0, 0],
    upperArmL: [30, 0, 30],
    foreArmL: [-20, 0, 0],
    upperArmR: [30, 0, -30],
    foreArmR: [-20, 0, 0],
  }),
);
const LANDING = plant(P(CROUCH, { hips: [0, -20, 0], spine: [26, 0, 0], upperArmL: [-40, 0, 40], foreArmL: [-30, 0, 0], upperArmR: [-40, 0, -40], foreArmR: [-30, 0, 0] }));

/** jumping, arms thrown up */
const RISE = P(AIR, {
  root: [0, 0, 0],
  hips: [0, 0, 0],
  spine: [-10, 0, 0],
  head: [-16, 0, 0],
  upperArmL: [-10, 0, 150],
  foreArmL: [-10, 0, 0],
  upperArmR: [-10, 0, -150],
  foreArmR: [-10, 0, 0],
  thighL: [-30, 0, 14],
  shinL: [60, 0, 0],
  thighR: [-10, 0, -14],
  shinR: [70, 0, 0],
});

/** belly bump (Dylan, Jacky) */
const BELLY_WIND = plant(
  P(STANCE, {
    root: [0, 0, -0.1],
    hips: [0, -34, 0],
    spine: [-14, -6, 0],
    chest: [-12, -6, 0],
    neck: [4, 0, 0],
    head: [6, 10, 0],
    upperArmL: [34, 0, 26],
    foreArmL: [-30, 0, 0],
    upperArmR: [34, 0, -26],
    foreArmR: [-30, 0, 0],
    thighL: [-34, 0, 10],
    shinL: [56, 0, 0],
    thighR: [8, 0, -10],
    shinR: [44, 0, 0],
  }),
);
const BELLY_BUMP = plant(
  P(STANCE, {
    root: [0, 0, 0.3],
    hips: [-14, 0, 0],
    spine: [-10, 0, 0],
    chest: [-8, 0, 0],
    neck: [10, 0, 0],
    head: [10, 0, 0],
    upperArmL: [48, 0, 24],
    foreArmL: [-16, 0, 0],
    upperArmR: [48, 0, -24],
    foreArmR: [-16, 0, 0],
    thighL: [-52, 0, 8],
    shinL: [44, 0, 0],
    thighR: [32, 0, -8],
    shinR: [10, 0, 0],
    footR: [-30, 0, 0],
  }),
);

/** belly-down starfish in the air, then flattened on the victim (body splash, belly flop) */
const SPLASH: Pose = {
  root: [0, 0, 0.1],
  hips: [70, 0, 0],
  spine: [-6, 0, 0],
  chest: [-6, 0, 0],
  neck: [-20, 0, 0],
  head: [-26, 0, 0],
  upperArmL: [10, 0, 115],
  foreArmL: [0, 0, 10],
  upperArmR: [10, 0, -115],
  foreArmR: [0, 0, -10],
  thighL: [8, 0, 24],
  shinL: [20, 0, 0],
  footL: [30, 0, 0],
  thighR: [8, 0, -24],
  shinR: [20, 0, 0],
  footR: [30, 0, 0],
};
const FLAT = P(SPLASH, {
  root: [0, -0.74, 0.18],
  hips: [90, 0, 0],
  upperArmL: [0, 0, 95],
  upperArmR: [0, 0, -95],
  neck: [-24, 0, 0],
  head: [-30, 0, 0],
});
const FLAT_BOUNCE = shift(P(FLAT, { head: [-36, -20, 0] }), 0, 0.05, 0);
const PUSH_UP = P(FLAT, {
  root: [0, -0.55, 0.1],
  hips: [62, 0, 0],
  upperArmL: [-70, 0, 20],
  foreArmL: [-10, 0, 0],
  upperArmR: [-70, 0, -20],
  foreArmR: [-10, 0, 0],
  thighL: [-30, 0, 10],
  shinL: [80, 0, 0],
  thighR: [-20, 0, -10],
  shinR: [70, 0, 0],
});

/** spinning back kick with the right leg: back turned to the victim, leg thrust back */
const BACK_CHAMBER = plant(
  P(STANCE, {
    hips: [0, 130, 0],
    spine: [14, 0, 0],
    neck: [-6, 30, 0],
    head: [-6, 40, 0],
    thighR: [-70, 0, -4],
    shinR: [120, 0, 0],
    footR: [20, 0, 0],
    thighL: [-12, 0, 6],
    shinL: [24, 0, 0],
    footL: [-10, 0, 0],
    upperArmL: [-40, 0, 30],
    foreArmL: [-110, 0, 0],
    upperArmR: [-30, 0, -30],
    foreArmR: [-110, 0, 0],
  }),
);
const BACK_KICK = plant(
  P(BACK_CHAMBER, {
    root: [0, 0, -0.06],
    hips: [0, 180, 0],
    spine: [32, 0, 0],
    chest: [10, 0, 0],
    neck: [-14, 40, 0],
    head: [-14, 46, 0],
    thighR: [92, 0, -4],
    shinR: [4, 0, 0],
    footR: [-40, 0, 0],
    thighL: [-14, 0, 6],
    shinL: [26, 0, 0],
  }),
);

/** victim: groggy, arms dangling, head lolling */
const DAZED = plant(
  P(STANCE, {
    hips: [0, -20, 0],
    spine: [10, 0, 6],
    chest: [6, 0, 4],
    neck: [10, 0, 0],
    head: [16, -10, 12],
    upperArmL: [-8, 0, 14],
    foreArmL: [-30, 0, 0],
    upperArmR: [-8, 0, -14],
    foreArmR: [-30, 0, 0],
    handL: [20, 0, 0],
    handR: [20, 0, 0],
  }),
);
const REEL = P(DAZED, { hips: [0, -10, 0], head: [10, 20, 10] });
/** victim hit across the face from its right (attacker's right hand / leg): head and chest twisted to its left */
const TWIST_L = P(HIT_HIGH, {
  hips: [-4, -8, 0],
  spine: [-6, 16, -8],
  chest: [-8, 22, -6],
  neck: [-10, 22, 0],
  head: [-16, 36, -14],
  upperArmL: [-10, 0, 55],
  foreArmL: [-40, 0, 0],
  upperArmR: [-30, 0, -30],
  foreArmR: [-70, 0, 0],
});
const TWIST_L2 = P(TWIST_L, { head: [-20, 48, -18], chest: [-10, 30, -8], spine: [-8, 20, -10] });
/** hit from its left */
const TWIST_R = mirror(TWIST_L);
const TWIST_R2 = mirror(TWIST_L2);
/** chin snapped up (palm, uppercut, headbutt) */
const CHIN_UP = P(HIT_HIGH, {
  root: [0, -0.04, -0.1],
  hips: [-10, -30, 0],
  spine: [-16, 0, 0],
  chest: [-14, 0, 0],
  neck: [-26, 0, 0],
  head: [-34, 0, 0],
  upperArmL: [-10, 0, 55],
  foreArmL: [-30, 0, 0],
  upperArmR: [-10, 0, -55],
  foreArmR: [-30, 0, 0],
});
/** folded in two around a blow to the stomach */
const DOUBLE = plant(
  P(HIT_MID, {
    root: [0, 0, -0.14],
    hips: [12, -20, 0],
    spine: [40, 0, 0],
    chest: [26, 0, 0],
    neck: [10, 0, 0],
    head: [20, 0, 0],
    upperArmL: [-50, 0, 10],
    foreArmL: [-100, 0, 0],
    upperArmR: [-50, 0, -10],
    foreArmR: [-100, 0, 0],
  }),
);
/** blown backward through the air, limbs trailing */
const FLY_BACK: Pose = {
  root: [0, -0.3, 0],
  hips: [-70, -10, 0],
  spine: [-6, 0, 0],
  chest: [-6, 0, 0],
  neck: [10, 0, 0],
  head: [20, 0, 0],
  upperArmL: [-100, 0, 40],
  foreArmL: [-30, 0, 0],
  upperArmR: [-100, 0, -40],
  foreArmR: [-30, 0, 0],
  thighL: [-50, 0, 10],
  shinL: [40, 0, 0],
  footL: [20, 0, 0],
  thighR: [-30, 0, -10],
  shinR: [60, 0, 0],
  footR: [20, 0, 0],
};
const FLY_BACK2 = P(FLY_BACK, { root: [0, -0.4, 0], hips: [-95, -10, 0], upperArmL: [-130, 0, 60], upperArmR: [-120, 0, -70], thighL: [-30, 0, 14], thighR: [-60, 0, -10] });
/** folded around a blow from above while airborne (axe kick, slam) */
const JACKKNIFE: Pose = P(J.c, {
  hips: [-80, -15, 0],
  spine: [40, 0, 0],
  chest: [20, 0, 0],
  neck: [16, 0, 0],
  head: [30, 0, 0],
  thighL: [-80, 0, 20],
  shinL: [20, 0, 0],
  thighR: [-70, 0, -20],
  shinR: [30, 0, 0],
  upperArmL: [-120, 0, 40],
  upperArmR: [-120, 0, -40],
});
/** flattened on the floor by a body splash: limbs jolt up */
const SQUASHED: Pose = P(LYING, {
  root: [0, -0.9, -0.05],
  spine: [6, 0, 0],
  chest: [8, 0, 0],
  neck: [20, 0, 0],
  head: [26, -10, 0],
  upperArmL: [-60, 0, 45],
  foreArmL: [-20, 0, 0],
  upperArmR: [-55, 0, -45],
  foreArmR: [-30, 0, 0],
  thighL: [-45, 0, 14],
  shinL: [35, 0, 0],
  thighR: [-50, 0, -12],
  shinR: [25, 0, 0],
  footL: [20, 0, 0],
  footR: [20, 0, 0],
});
const SQUASHED2 = P(SQUASHED, { thighL: [-30, 0, 14], thighR: [-34, 0, -12], upperArmL: [-40, 0, 50], upperArmR: [-40, 0, -50] });
/** small bounce after crashing on the back */
const LYING_BOUNCE = P(LYING, {
  root: [0, -0.78, -0.05],
  hips: [-82, -10, 0],
  head: [16, -20, 0],
  upperArmL: [-30, 0, 70],
  upperArmR: [-40, 0, -60],
  thighL: [-20, 0, 14],
  thighR: [-30, 0, -10],
});
/** sitting up (being pulled up / getting up) */
const SIT = merge(CROUCH, {
  root: [0, -0.62, -0.25],
  hips: [-40, -20, 0],
  spine: [30, 0, 0],
  head: [20, 0, 0],
  thighL: [-80, 0, 15],
  shinL: [90, 0, 0],
  thighR: [-60, 0, -10],
  shinR: [120, 0, 0],
  upperArmL: [30, 0, 20],
  upperArmR: [30, 0, -20],
  foreArmL: [-10, 0, 0],
  foreArmR: [-10, 0, 0],
});

/** both fists clasped overhead (jumping hammer), then brought down */
const HAMMER_UP = P(AIR, {
  root: [0, 0, 0],
  spine: [-16, 0, 0],
  chest: [-10, 0, 0],
  head: [-10, 0, 0],
  upperArmL: [-175, 0, -6],
  foreArmL: [-30, 0, 0],
  upperArmR: [-175, 0, 6],
  foreArmR: [-30, 0, 0],
  thighL: [-40, 0, 8],
  shinL: [70, 0, 0],
  thighR: [-20, 0, -8],
  shinR: [80, 0, 0],
});
const HAMMER_DOWN = P(AIR, {
  root: [0, 0, 0.08],
  hips: [0, -6, 0],
  spine: [32, 0, 0],
  chest: [14, 0, 0],
  head: [10, 0, 0],
  upperArmL: [-70, 0, -10],
  foreArmL: [-10, 0, 0],
  upperArmR: [-70, 0, 10],
  foreArmR: [-10, 0, 0],
  thighL: [-50, 0, 8],
  shinL: [60, 0, 0],
  thighR: [-10, 0, -8],
  shinR: [50, 0, 0],
});
/** victim: knees buckling under a blow on the head, then kneeling */
const SMASHED = plant(
  P(HIT_MID, {
    root: [0, 0, -0.02],
    hips: [10, -20, 0],
    spine: [30, 0, 0],
    neck: [30, 0, 0],
    head: [34, 0, 0],
    thighL: [-40, 0, 10],
    shinL: [80, 0, 0],
    thighR: [-30, 0, -10],
    shinR: [90, 0, 0],
    upperArmL: [-10, 0, 20],
    foreArmL: [-20, 0, 0],
    upperArmR: [-10, 0, -20],
    foreArmR: [-20, 0, 0],
  }),
);
const KNEEL = plant(P(CROUCH, { hips: [10, -20, 0], spine: [30, 0, 0], head: [30, 0, 0], upperArmL: [-10, 0, 20], foreArmL: [-20, 0, 0], upperArmR: [-10, 0, -20], foreArmR: [-20, 0, 0] }));
/** arm poses found by forward kinematics */
const WATCH_L: Pose = { upperArmL: [-65, -75, -10], foreArmL: [-70, 0, 0], handL: [0, 0, 0] };
const HAND_ON_HIP_L: Pose = { upperArmL: [50, -45, 40], foreArmL: [-80, 0, 0], handL: [0, 0, 0] };
const HAND_ON_HIP_R: Pose = { upperArmR: [50, 45, -40], foreArmR: [-80, 0, 0], handR: [0, 0, 0] };

/** adds degrees to one bone's X (arm windmills: Euler keys interpolate linearly) */
function boneX(p: Pose, bone: 'upperArmL' | 'upperArmR', dx: number): Pose {
  const e = p[bone] ?? [0, 0, 0];
  return { ...p, [bone]: [e[0] + dx, e[1], e[2]] };
}

/** crash on the back at `f`, small bounce, rest */
function crash(f: number, from?: Pose): Key[] {
  return [...(from ? [K(f - 1, from)] : []), K(f, LYING, 'in'), K(f + 4, LYING_BOUNCE, 'out'), K(f + 10, LYING, 'in')];
}

// ---------------------------------------------------------------------------
// Dylan — TORNADE ROUSSE
// ---------------------------------------------------------------------------
function tornado() {
  // arms out, slight lean: the right arm (at head height) leads; yaw 90 = right arm on the victim
  const lariat = plant(
    P(STANCE, OPEN_LEGS, {
      root: [0, 0, 0.04],
      hips: [0, 90, 0],
      spine: [4, 0, 10],
      chest: [0, 0, 6],
      neck: [0, 0, -6],
      head: [-4, 0, -10],
      upperArmL: [0, 0, 105],
      foreArmL: [0, 0, 12],
      handL: [0, 0, 0],
      upperArmR: [0, 0, -84],
      foreArmR: [0, 0, -4],
      handR: [0, 0, 0],
    }),
  );
  const lariatLow = shift(lariat, 0, -0.04, 0);
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(4, spin(lariatLow, -240), 'out'),
    K(12, lariat, 'linear'),
    K(18, spin(lariatLow, 180), 'linear'),
    K(24, spin(lariat, 360), 'linear'),
    K(30, spin(lariatLow, 540), 'linear'),
    K(36, spin(lariat, 720), 'linear'),
    K(42, spin(lariatLow, 900), 'linear'),
    K(48, spin(lariat, 1080), 'linear'),
    rewrap(60, BELLY_WIND, 1440, 'out'),
    K(66, shift(BELLY_WIND, 0, -0.03, -0.04), 'smooth'),
    K(70, BELLY_BUMP, 'in'),
    K(74, BELLY_BUMP),
    K(79, SQUAT, 'smooth'),
    K(86, RISE, 'out'),
    K(98, SPLASH, 'smooth'),
    K(110, FLAT, 'in'),
    K(116, FLAT_BOUNCE, 'out'),
    K(122, FLAT, 'smooth'),
    K(128, PUSH_UP, 'smooth'),
    K(134, SQUAT, 'smooth'),
    K(142, FLEX, 'out'),
    K(150, FLEX),
  );
  const v = clip(
    K(0, HIT_MID),
    K(6, REEL, 'smooth'),
    react(12, REEL, TWIST_L),
    K(18, REEL, 'smooth'),
    react(24, REEL, TWIST_L),
    K(30, REEL, 'smooth'),
    react(36, REEL, TWIST_L2),
    K(42, REEL, 'smooth'),
    react(48, REEL, TWIST_L2),
    // spun around by the last lariat, ends up facing Dylan again, groggy
    rewrap(62, DAZED, 360, 'out'),
    react(70, DAZED, J.a),
    K(80, J.b, 'smooth'),
    K(90, J.c, 'smooth'),
    crash(98),
    K(109, LYING),
    K(110, SQUASHED, 'out'),
    K(118, SQUASHED2, 'smooth'),
    K(128, LYING, 'smooth'),
    K(150, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Clément — COUP DE BOULE BARBU
// ---------------------------------------------------------------------------
function headbutt() {
  const lowKickWind = plant(P(STANCE, { hips: [0, -55, 0], spine: [4, -10, 0], thighR: [20, 0, -20], shinR: [70, 0, 0], footR: [-20, 0, 0] }));
  const lowKick = plant(
    P(STANCE, {
      root: [0, 0, 0.05],
      hips: [0, 50, 0],
      spine: [6, -10, -10],
      chest: [4, -10, 0],
      head: [-4, -40, 6],
      upperArmR: [-30, 0, -40],
      foreArmR: [-80, 0, 0],
      thighR: [-25, 0, -62],
      shinR: [12, 0, 0],
      footR: [10, 0, 0],
      thighL: [-6, 0, 8],
      shinL: [22, 0, 0],
      footL: [-10, 0, 0],
    }),
  );
  const midKickWind = plant(P(STANCE, { hips: [0, -10, 0], spine: [0, 0, 6], thighL: [-60, 0, 30], shinL: [100, 0, 0] }));
  const midKick = plant(
    P(STANCE, {
      root: [0.04, 0, 0.02],
      hips: [0, -85, 0],
      spine: [0, 0, 18],
      chest: [0, 0, 8],
      neck: [0, 20, -6],
      head: [0, 40, -8],
      upperArmL: [-40, 0, 20],
      foreArmL: [-110, 0, 0],
      upperArmR: [-20, 0, -50],
      foreArmR: [-60, 0, 0],
      thighL: [-6, 0, 90],
      shinL: [8, 0, 0],
      footL: [10, 0, 0],
      thighR: [6, 0, -8],
      shinR: [10, 0, 0],
      footR: [-14, 0, 0],
    }),
  );
  const highKick = P(ATTACKS.roundhouse.strike, { root: [0, -0.02, 0.04] });
  const clinch = plant(
    P(STANCE, {
      root: [0, 0, 0.06],
      hips: [0, -6, 0],
      spine: [10, 0, 0],
      chest: [6, 0, 0],
      neck: [6, 0, 0],
      head: [8, 0, 0],
      upperArmL: [-100, 0, -12],
      foreArmL: [-50, 0, 0],
      handL: [20, 0, 0],
      upperArmR: [-100, 0, 12],
      foreArmR: [-50, 0, 0],
      handR: [20, 0, 0],
      thighL: [-16, 0, 6],
      shinL: [26, 0, 0],
      thighR: [8, 0, -6],
      shinR: [20, 0, 0],
    }),
  );
  const pull: Pose = { upperArmL: [-80, 0, -12], foreArmL: [-60, 0, 0], upperArmR: [-80, 0, 12], foreArmR: [-60, 0, 0] };
  const kneeR = plant(
    P(clinch, pull, {
      root: [0, 0, 0.12],
      hips: [-8, -6, 0],
      spine: [18, 0, 0],
      chest: [10, 0, 0],
      thighR: [-112, 0, -4],
      shinR: [120, 0, 0],
      footR: [40, 0, 0],
      thighL: [6, 0, 6],
      shinL: [10, 0, 0],
      footL: [-6, 0, 0],
    }),
  );
  const kneeRWind = plant(P(clinch, { thighR: [30, 0, -6], shinR: [70, 0, 0] }));
  const kneeL = plant(
    P(clinch, pull, {
      root: [0, 0, 0.12],
      hips: [-8, 6, 0],
      spine: [18, 0, 0],
      chest: [10, 0, 0],
      thighL: [-112, 0, 4],
      shinL: [120, 0, 0],
      footL: [40, 0, 0],
      thighR: [6, 0, -6],
      shinR: [10, 0, 0],
      footR: [-6, 0, 0],
    }),
  );
  const kneeLWind = plant(P(clinch, { thighL: [30, 0, 6], shinL: [70, 0, 0], thighR: [-10, 0, -6], shinR: [20, 0, 0] }));
  const hbWind = plant(
    P(clinch, {
      root: [0, -0.02, -0.12],
      hips: [-6, -4, 0],
      spine: [-22, 0, 0],
      chest: [-18, 0, 0],
      neck: [-20, 0, 0],
      head: [-24, 0, 0],
      upperArmL: [-52, 0, -8],
      foreArmL: [-20, 0, 0],
      upperArmR: [-52, 0, 8],
      foreArmR: [-20, 0, 0],
      thighL: [-26, 0, 6],
      shinL: [40, 0, 0],
      thighR: [16, 0, -6],
      shinR: [30, 0, 0],
    }),
  );
  const hbWind2 = P(hbWind, { spine: [-28, 0, 0], chest: [-20, 0, 0], neck: [-24, 0, 0], head: [-28, 0, 0], upperArmL: [-44, 0, -8], upperArmR: [-44, 0, 8] });
  const grin = P(clinch, { hips: [0, -14, 0], spine: [4, -6, 0], neck: [0, -14, 0], head: [-6, -30, 0] });
  const hb = plant(
    P(clinch, {
      root: [0, -0.05, 0.22],
      hips: [8, -4, 0],
      spine: [24, 0, 0],
      chest: [16, 0, 0],
      neck: [18, 0, 0],
      head: [22, 0, 0],
      upperArmL: [-40, 0, 30],
      foreArmL: [-100, 0, 0],
      upperArmR: [-40, 0, -30],
      foreArmR: [-100, 0, 0],
      thighL: [-50, 0, 6],
      shinL: [56, 0, 0],
      thighR: [26, 0, -6],
      shinR: [16, 0, 0],
      footR: [-30, 0, 0],
    }),
  );
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
  const a = clip(
    K(0, ATTACKS.super.strike),
    strike(8, lowKickWind, lowKick, 4, 2),
    strike(18, midKickWind, midKick, 5, 2),
    strike(28, ATTACKS.roundhouse.windup, highKick, 5, 2),
    K(36, BACK_CHAMBER, 'smooth'),
    K(42, BACK_KICK, 'in'),
    K(45, BACK_KICK),
    rewrap(54, STANCE, 360, 'smooth'),
    K(58, clinch, 'smooth'),
    strike(62, kneeRWind, kneeR, 3, 2),
    K(68, clinch, 'smooth'),
    strike(74, kneeLWind, kneeL, 3, 2),
    K(80, clinch, 'smooth'),
    // grin at the camera (close-up), then lean way back and smash
    K(85, grin, 'smooth'),
    K(91, P(grin, { head: [-8, -40, 4] }), 'smooth'),
    K(95, hbWind2, 'out'),
    K(98, hb, 'in'),
    K(104, hb),
    K(114, STANCE, 'smooth'),
    K(122, beard, 'smooth'),
    K(130, beard2, 'smooth'),
    K(138, beard, 'smooth'),
    K(150, STANCE, 'smooth'),
  );
  const legHit = P(HIT_LOW, { thighL: [10, 0, 2], shinL: [40, 0, 0], hips: [0, -40, 0], spine: [18, 0, 0] });
  const bodyHit = P(HIT_MID, { root: [0, -0.1, -0.06], spine: [24, -10, -14], chest: [16, 0, -8], head: [10, 0, -10] });
  const hunched = plant(P(DOUBLE, { root: [0, 0, -0.02], spine: [34, 0, 0], head: [24, 0, 0], upperArmL: [-60, 0, 20], upperArmR: [-60, 0, -20] }));
  const kneeHit = shift(P(DOUBLE, { spine: [50, 0, 0], chest: [30, 0, 0], head: [30, 0, 0], root: [0, 0, -0.1] }), 0, 0.05, 0);
  const held = P(DAZED, { root: [0, -0.06, 0.02], spine: [8, 0, 0], head: [14, 0, 6], neck: [6, 0, 0] });
  const snap = P(CHIN_UP, { root: [0, -0.04, -0.16], hips: [-18, -30, 0], neck: [-34, 0, 0], head: [-40, 0, 0], upperArmL: [-20, 0, 75], upperArmR: [-20, 0, -75] });
  const v = clip(
    K(0, HIT_MID),
    K(5, STANCE, 'smooth'),
    react(8, STANCE, legHit),
    K(13, STANCE, 'smooth'),
    react(18, STANCE, bodyHit),
    K(23, REEL, 'smooth'),
    react(28, REEL, TWIST_L2),
    K(35, REEL, 'smooth'),
    react(42, REEL, DOUBLE),
    K(50, hunched, 'smooth'),
    K(61, hunched),
    K(62, kneeHit, 'out'),
    K(68, hunched, 'smooth'),
    react(74, hunched, kneeHit),
    K(84, held, 'smooth'),
    K(97, held),
    K(98, snap, 'out'),
    K(104, FLY_BACK, 'smooth'),
    K(114, FLY_BACK2, 'smooth'),
    crash(124),
    K(150, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Alex — BOUCLES INFERNALES
// ---------------------------------------------------------------------------
function curls() {
  const jabL = P(ATTACKS.jab.strike, { root: [0, -0.07, 0.08] });
  const jabR = P(ATTACKS.cross.strike, { root: [0, -0.08, 0.08], hips: [0, 4, 0], spine: [8, 6, 0], chest: [8, 8, 0] });
  const mid = P(STANCE, { root: [0, -0.07, 0.05], hips: [0, -20, 0] });
  const airUpWind = P(AIR, { root: [0, 0, 0], hips: [0, -40, 0], upperArmR: [-20, 0, -30], foreArmR: [-120, 0, 0] });
  const airUpper = P(AIR, {
    root: [0, 0, 0],
    hips: [0, 20, 0],
    spine: [-8, 12, 0],
    chest: [-12, 12, 0],
    head: [-16, -20, 0],
    upperArmR: [-165, 0, -8],
    foreArmR: [-25, 0, 0],
    handR: [0, 0, 0],
    upperArmL: [-40, 0, 30],
    foreArmL: [-100, 0, 0],
    thighL: [-70, 0, 8],
    shinL: [100, 0, 0],
    thighR: [-10, 0, -6],
    shinR: [50, 0, 0],
  });
  const axeRaise = P(AIR, {
    root: [0, 0, 0],
    hips: [0, -10, 0],
    spine: [-14, 0, 0],
    chest: [-10, 0, 0],
    head: [12, 0, 0],
    thighR: [-172, 0, -6],
    shinR: [0, 0, 0],
    footR: [-20, 0, 0],
    thighL: [10, 0, 8],
    shinL: [30, 0, 0],
    upperArmL: [-20, 0, 70],
    foreArmL: [-20, 0, 0],
    upperArmR: [-20, 0, -70],
    foreArmR: [-20, 0, 0],
  });
  const axeDown = P(axeRaise, {
    spine: [24, 0, 0],
    chest: [10, 0, 0],
    head: [16, 0, 0],
    thighR: [-60, 0, -4],
    shinR: [4, 0, 0],
    footR: [-30, 0, 0],
    thighL: [30, 0, 8],
    shinL: [40, 0, 0],
    upperArmL: [30, 0, 40],
    upperArmR: [30, 0, -40],
  });
  const fallPose = P(AIR, { root: [0, 0, 0], spine: [10, 0, 0], thighL: [-40, 0, 10], shinL: [50, 0, 0], thighR: [-20, 0, -10], shinR: [40, 0, 0], upperArmL: [-30, 0, 60], upperArmR: [-30, 0, -60] });
  const curlsPose = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 0],
      spine: [-4, 0, 6],
      head: [-8, 10, 12],
      upperArmR: [-150, 0, -40],
      foreArmR: [-110, 0, 0],
      handR: [20, 0, 0],
      upperArmL: [8, 0, 14],
      foreArmL: [-20, 0, 0],
    }),
  );
  const curlsPose2 = P(curlsPose, { head: [-12, 16, 4], upperArmR: [-150, 0, -30], foreArmR: [-120, 0, 0], hips: [0, -46, 0] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(3, mid, 'out'),
    K(6, jabL, 'in'),
    K(9, mid, 'out'),
    K(12, jabR, 'in'),
    K(15, mid, 'out'),
    K(18, jabL, 'in'),
    K(21, mid, 'out'),
    K(24, jabR, 'in'),
    K(27, mid, 'out'),
    K(30, jabL, 'in'),
    K(33, mid, 'out'),
    K(36, jabR, 'in'),
    K(38, jabR),
    K(44, ATTACKS.uppercut.windup, 'smooth'),
    K(47, shift(ATTACKS.uppercut.windup, 0, -0.03, 0)),
    K(50, ATTACKS.uppercut.strike, 'in'),
    K(53, shift(ATTACKS.uppercut.strike, 0, 0.04, 0)),
    K(57, spin(airUpWind, -360), 'smooth'),
    K(68, airUpper, 'linear'),
    K(71, airUpper),
    K(80, axeRaise, 'smooth'),
    K(85, axeRaise),
    K(88, axeDown, 'in'),
    K(92, axeDown),
    K(98, fallPose, 'smooth'),
    K(102, LANDING, 'in'),
    K(110, STANCE, 'smooth'),
    K(118, curlsPose, 'smooth'),
    K(126, curlsPose2, 'smooth'),
    K(132, curlsPose, 'smooth'),
    K(140, STANCE, 'smooth'),
  );
  const hA = P(HIT_HIGH, { head: [-24, 12, 0] });
  const hB = P(HIT_HIGH, { head: [-22, -14, 0], neck: [-18, -6, 0] });
  const hMid = P(HIT_HIGH, { root: [0, -0.06, -0.05], head: [-8, 0, 0], neck: [-10, 0, 0] });
  const launch = P(J.a, { head: [-40, 0, 0], neck: [-24, 0, 0] });
  const a2 = P(J.b, { head: [-30, 20, 0], upperArmL: [-90, 0, 90], upperArmR: [-60, 0, -100] });
  const v = clip(
    K(0, HIT_MID),
    K(3, hMid, 'smooth'),
    react(6, hMid, hA),
    K(9, hMid, 'smooth'),
    react(12, hMid, hB),
    K(15, hMid, 'smooth'),
    react(18, hMid, hA),
    K(21, hMid, 'smooth'),
    react(24, hMid, hB),
    K(27, hMid, 'smooth'),
    react(30, hMid, hA),
    K(33, hMid, 'smooth'),
    react(36, hMid, P(hB, { head: [-30, -20, 0] })),
    K(44, DAZED, 'smooth'),
    react(50, DAZED, launch),
    K(60, J.a, 'smooth'),
    react(68, J.a, a2),
    K(78, J.c, 'smooth'),
    K(87, P(J.c, { hips: [-100, -15, 0] })),
    K(88, JACKKNIFE, 'out'),
    crash(96),
    K(140, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Benji — COUP DU PALMIER
// ---------------------------------------------------------------------------
function palm() {
  // leaning hard to its right so the big hair sweeps out; yaw 90 = right side (and the hair) on the victim
  const whip = plant(
    P(STANCE, OPEN_LEGS, {
      root: [0, 0, 0.04],
      hips: [0, 90, 0],
      spine: [0, 0, 26],
      chest: [0, 0, 12],
      neck: [0, 0, 12],
      head: [0, 0, 14],
      upperArmL: [-10, 0, 75],
      foreArmL: [-20, 0, 0],
      upperArmR: [10, 0, -40],
      foreArmR: [-30, 0, 0],
    }),
  );
  const whipPre = P(whip, { spine: [6, 0, 8], chest: [4, 0, 4], neck: [0, 0, 4], head: [0, 0, 4], root: [0, -0.1, 0.04] });
  const diveWind = plant(
    P(CROUCH, {
      hips: [10, -10, 0],
      spine: [30, 0, 0],
      upperArmL: [40, 0, 20],
      foreArmL: [-10, 0, 0],
      upperArmR: [40, 0, -20],
      foreArmR: [-10, 0, 0],
    }),
  );
  const dive: Pose = {
    root: [0, -0.28, 0.1],
    hips: [82, 0, 0],
    spine: [4, 0, 0],
    chest: [4, 0, 0],
    neck: [0, 0, 0],
    head: [0, 0, 0],
    upperArmL: [30, 0, 12],
    foreArmL: [0, 0, 0],
    upperArmR: [30, 0, -12],
    foreArmR: [0, 0, 0],
    thighL: [10, 0, 6],
    shinL: [10, 0, 0],
    footL: [30, 0, 0],
    thighR: [10, 0, -6],
    shinR: [10, 0, 0],
    footR: [30, 0, 0],
  };
  const crouchFace = plant(P(CROUCH, { hips: [0, -55, 0], spine: [14, 0, 0], head: [-14, 10, 0] }));
  const tuck = P(AIR, {
    root: [0, 0, 0],
    hips: [60, 0, 0],
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
  const headDown = P(tuck, {
    root: [0, 0, 0.2],
    hips: [145, 0, 0],
    spine: [10, 0, 0],
    neck: [16, 0, 0],
    head: [18, 0, 0],
    upperArmL: [50, 0, 30],
    foreArmL: [-10, 0, 0],
    upperArmR: [50, 0, -30],
    foreArmR: [-10, 0, 0],
    thighL: [-70, 0, 10],
    shinL: [90, 0, 0],
    thighR: [-70, 0, -10],
    shinR: [90, 0, 0],
  });
  const brush = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 6],
      spine: [-6, 0, -6],
      chest: [-6, 0, 0],
      head: [-14, 10, -8],
      upperArmL: [-150, 0, 34],
      foreArmL: [-100, 0, 0],
      upperArmR: [-150, 0, -34],
      foreArmR: [-100, 0, 0],
      handL: [0, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const brush2 = P(brush, { hips: [0, -36, -6], spine: [-6, 0, 6], head: [-14, 14, 8], upperArmL: [-140, 0, 40], upperArmR: [-160, 0, -26] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(5, spin(whipPre, -200), 'out'),
    K(12, whip, 'linear'),
    K(19, spin(whipPre, 180), 'linear'),
    K(26, spin(whip, 360), 'linear'),
    K(33, spin(whipPre, 540), 'linear'),
    K(40, spin(whip, 720), 'linear'),
    rewrap(48, diveWind, 1080, 'out'),
    K(54, shift(diveWind, 0, -0.04, -0.06), 'smooth'),
    K(60, dive, 'out'),
    K(64, shift(dive, 0, 0, 0.04), 'linear'),
    K(66, dive),
    K(74, LANDING, 'smooth'),
    K(78, crouchFace, 'smooth'),
    K(81, SQUAT, 'smooth'),
    K(88, RISE, 'out'),
    K(94, tuck, 'smooth'),
    K(100, headDown, 'in'),
    K(103, headDown),
    K(108, rot(tuck, 230), 'smooth'),
    rewrap(112, LANDING, 0, 'smooth', 360),
    K(122, STANCE, 'smooth'),
    K(132, brush, 'smooth'),
    K(138, brush2, 'smooth'),
    K(144, brush, 'smooth'),
    K(150, brush2, 'smooth'),
  );
  const launch = P(J.a, { hips: [-10, -20, 0], spine: [30, 0, 0], chest: [20, 0, 0], head: [20, 0, 0] });
  const v = clip(
    K(0, HIT_MID),
    K(5, REEL, 'smooth'),
    react(12, REEL, TWIST_L),
    K(19, REEL, 'smooth'),
    react(26, REEL, TWIST_L2),
    K(33, REEL, 'smooth'),
    react(40, REEL, TWIST_L2),
    K(50, DAZED, 'smooth'),
    react(64, DAZED, launch),
    K(72, J.a, 'smooth'),
    K(82, J.b, 'smooth'),
    K(92, J.c, 'smooth'),
    react(100, J.c, JACKKNIFE),
    crash(106),
    K(150, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Isis — AFRO XXL
// ---------------------------------------------------------------------------
function afro() {
  const slapRWind = plant(
    P(STANCE, {
      hips: [0, -62, 0],
      spine: [0, -14, 0],
      chest: [-4, -10, 0],
      head: [-6, 30, 0],
      upperArmR: [-40, -20, -80],
      foreArmR: [-50, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const slapR = plant(
    P(STANCE, {
      root: [0, 0, 0.06],
      hips: [0, 8, 0],
      spine: [4, 12, 0],
      chest: [4, 16, 0],
      head: [-4, -24, 0],
      upperArmR: [-92, 0, 30],
      foreArmR: [-8, 0, 0],
      handR: [0, 0, -20],
      upperArmL: [-40, 0, 30],
      foreArmL: [-100, 0, 0],
    }),
  );
  const slapLWind = mirror(slapRWind);
  const slapL = mirror(slapR);
  const hipWind = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, 30, 0],
      spine: [0, 0, 14],
      chest: [0, 0, 6],
      neck: [0, -20, 0],
      head: [-6, -20, -8],
      upperArmL: [-30, 0, 50],
      foreArmL: [-60, 0, 0],
      upperArmR: [-20, 0, -30],
      foreArmR: [-80, 0, 0],
    }),
  );
  const hip = plant(
    P(STANCE, OPEN_LEGS, {
      root: [0, 0, 0.3],
      hips: [0, 92, 0],
      spine: [0, 0, -24],
      chest: [0, 0, -10],
      neck: [0, -30, 8],
      head: [-6, -34, 10],
      upperArmL: [-20, 0, 120],
      foreArmL: [-40, 0, 0],
      upperArmR: [-10, 0, -40],
      foreArmR: [-90, 0, 0],
      thighR: [-4, 0, -20],
      shinR: [8, 0, 0],
      thighL: [-6, 0, 16],
      shinL: [20, 0, 0],
    }),
  );
  const sitAir: Pose = {
    root: [0, 0, 0],
    hips: [-10, 0, 0],
    spine: [10, 0, 0],
    chest: [0, 0, 0],
    head: [10, 0, 0],
    thighL: [-95, 0, 22],
    shinL: [70, 0, 0],
    thighR: [-95, 0, -22],
    shinR: [70, 0, 0],
    upperArmL: [-20, 0, 140],
    foreArmL: [-20, 0, 0],
    upperArmR: [-20, 0, -140],
    foreArmR: [-20, 0, 0],
  };
  const butt = P(sitAir, {
    root: [0, -0.93, 0.35],
    hips: [-14, 0, 0],
    spine: [20, 0, 0],
    head: [20, 0, 0],
    thighL: [-80, 0, 34],
    shinL: [60, 0, 0],
    thighR: [-80, 0, -34],
    shinR: [60, 0, 0],
    upperArmL: [-10, 0, 100],
    upperArmR: [-10, 0, -100],
  });
  const butt2 = P(butt, { root: [0, -0.9, 0.35], spine: [6, 0, 0], head: [-10, 0, 0], upperArmL: [-10, 0, 150], upperArmR: [-10, 0, -150] });
  const hopBack = P(AIR, { root: [0, 0, 0], spine: [-10, 0, 0], head: [-10, 0, 0], thighL: [-50, 0, 10], shinL: [70, 0, 0], thighR: [-30, 0, -10], shinR: [80, 0, 0] });
  const fluff = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 0],
      spine: [-4, 0, 0],
      head: [-10, 10, 6],
      upperArmL: [-150, 0, 40],
      foreArmL: [-100, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-150, 0, -40],
      foreArmR: [-100, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const fluff2 = P(fluff, { hips: [0, -40, 8], spine: [-4, 0, -10], head: [-14, 16, -8], upperArmL: [-160, 0, 36], upperArmR: [-140, 0, -46] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    strike(10, slapRWind, slapR, 5, 2),
    strike(22, slapLWind, slapL, 6, 2),
    strike(34, slapRWind, slapR, 6, 2),
    strike(46, slapLWind, slapL, 6, 3),
    K(56, hipWind, 'smooth'),
    K(59, shift(hipWind, 0, -0.02, -0.04)),
    K(62, hip, 'in'),
    K(68, hip),
    K(78, SQUAT, 'smooth'),
    K(86, RISE, 'out'),
    K(96, sitAir, 'smooth'),
    K(106, P(sitAir, { head: [20, 0, 0] })),
    K(112, butt, 'in'),
    K(118, butt2, 'out'),
    K(124, hopBack, 'out'),
    K(132, LANDING, 'in'),
    K(138, STANCE, 'smooth'),
    K(142, fluff, 'smooth'),
    K(146, fluff2, 'smooth'),
    K(150, fluff, 'smooth'),
  );
  // reeling backward from the hip check, arms windmilling, half turn, falls on the back
  const reelBack = P(DAZED, {
    root: [0, -0.06, -0.06],
    hips: [-6, -20, 0],
    spine: [-14, 0, 10],
    chest: [-10, 0, 0],
    head: [-16, 10, 8],
    upperArmL: [-40, 0, 90],
    foreArmL: [-30, 0, 0],
    upperArmR: [-70, 0, -80],
    foreArmR: [-30, 0, 0],
  });
  const reelBack2 = P(reelBack, { spine: [-10, 0, -12], upperArmL: [-80, 0, 70], upperArmR: [-30, 0, -90], head: [-10, -10, -8] });
  const knocked = P(HIT_MID, { root: [0, -0.1, -0.16], hips: [-10, -20, 0], spine: [-10, 0, 14], head: [-14, 0, 10], upperArmL: [-50, 0, 80], upperArmR: [-40, 0, -80] });
  const v = clip(
    K(0, HIT_MID),
    K(5, REEL, 'smooth'),
    react(10, REEL, TWIST_L),
    K(16, REEL, 'smooth'),
    react(22, REEL, TWIST_R),
    K(28, REEL, 'smooth'),
    react(34, REEL, TWIST_L2),
    K(40, REEL, 'smooth'),
    react(46, REEL, TWIST_R2),
    K(55, DAZED, 'smooth'),
    react(62, DAZED, knocked),
    K(72, spin(reelBack, 120), 'smooth'),
    K(82, spin(reelBack2, 250), 'smooth'),
    K(90, spin(P(J.a, { root: [0, -0.2, 0] }), 330), 'smooth'),
    rewrap(96, LYING, 360, 'in'),
    K(100, LYING_BOUNCE, 'out'),
    K(106, LYING, 'in'),
    K(111, LYING),
    K(112, SQUASHED, 'out'),
    K(120, SQUASHED2, 'smooth'),
    K(130, LYING, 'smooth'),
    K(150, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Enola — SANG-FROID
// ---------------------------------------------------------------------------
function cold() {
  const glasses = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -45, 0],
      spine: [-2, 0, 0],
      neck: [4, 0, 0],
      head: [6, 14, 0],
      upperArmR: [-85, 45, 0],
      foreArmR: [-115, 0, 0],
      handR: [-20, 0, 0],
      upperArmL: [6, 0, 14],
      foreArmL: [-24, 0, 0],
    }),
  );
  const glasses2 = P(glasses, { head: [-6, 14, 0], handR: [-34, 0, 0], upperArmR: [-90, 45, 0], foreArmR: [-112, 0, 0] });
  const palmStrike = P(ATTACKS.cross.strike, { root: [0, -0.08, 0.12], upperArmR: [-100, 0, 0], handR: [-70, 0, 0] });
  // back turned to the victim, arms crossed, chin up — then pushes her glasses up
  const cool = plant(
    P(CROSSED, {
      hips: [0, 232, 0],
      head: [-12, 10, 0],
    }),
  );
  const coolGlasses = plant(
    P(glasses2, {
      hips: [0, 232, 0],
      head: [-10, 12, 0],
      upperArmL: [-25, 0, 15],
      foreArmL: [-100, -60, 0],
    }),
  );
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(8, glasses, 'out'),
    K(14, glasses2, 'smooth'),
    K(18, glasses2),
    strike(26, ATTACKS.elbow.windup, ATTACKS.elbow.strike, 4, 2),
    strike(38, ATTACKS.cross.windup, palmStrike, 4, 2),
    strike(50, ATTACKS.knee.windup, ATTACKS.knee.strike, 4, 2),
    K(57, spin(STANCE, 70), 'smooth'),
    K(61, BACK_CHAMBER, 'smooth'),
    K(66, BACK_KICK, 'in'),
    K(70, BACK_KICK),
    K(80, cool, 'smooth'),
    K(102, P(cool, { head: [-14, 20, 4] }), 'smooth'),
    // pushes her glasses up exactly when the victim crashes behind her
    K(108, coolGlasses, 'in'),
    K(124, coolGlasses),
    K(132, cool, 'smooth'),
    rewrap(144, STANCE, 360, 'smooth'),
    K(150, STANCE),
  );
  const tumble = P(J.b, {
    spine: [10, 0, 0],
    thighL: [-70, 0, 15],
    shinL: [80, 0, 0],
    thighR: [-60, 0, -15],
    shinR: [90, 0, 0],
    upperArmL: [-60, 0, 90],
    upperArmR: [-60, 0, -90],
  });
  const withPitch = (p: Pose, x: number): Pose => ({ ...p, hips: [x, -15, 0] });
  const launch = P(J.a, { hips: [-40, -20, 0], spine: [30, 0, 0], chest: [16, 0, 0], head: [16, 0, 0] });
  const wary = plant(P(STANCE, { hips: [0, -26, 0], head: [-2, 14, 0] }));
  const v = clip(
    K(0, HIT_MID),
    K(8, wary, 'smooth'),
    react(26, wary, TWIST_R2),
    K(32, REEL, 'smooth'),
    react(38, REEL, CHIN_UP),
    K(44, REEL, 'smooth'),
    react(50, REEL, DOUBLE),
    K(58, DOUBLE),
    react(66, DOUBLE, launch),
    K(76, withPitch(tumble, -150), 'smooth'),
    K(88, withPitch(tumble, -250), 'linear'),
    K(100, withPitch(J.c, -340), 'linear'),
    rewrap(108, LYING, 0, 'in', -360),
    K(112, LYING_BOUNCE, 'out'),
    K(118, LYING, 'in'),
    K(150, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Zia — REINE DES DREADS
// ---------------------------------------------------------------------------
function dreads() {
  const tkick = P(ATTACKS.roundhouse.strike, { root: [0, 0, 0], thighL: [-40, 0, 20], shinL: [70, 0, 0], footL: [-20, 0, 0] });
  const tkPre = P(tkick, {
    spine: [4, 0, -8],
    neck: [0, -10, 0],
    head: [0, -10, 0],
    thighR: [-70, 0, -30],
    shinR: [110, 0, 0],
    thighL: [-20, 0, 12],
    shinL: [40, 0, 0],
    upperArmL: [-40, 0, 40],
    upperArmR: [-40, 0, -40],
  });
  const flyWind = P(AIR, { root: [0, 0, 0], hips: [0, 60, 0], thighR: [-70, 0, -50], shinR: [120, 0, 0], thighL: [-60, 0, 10], shinL: [100, 0, 0] });
  const flyKick = P(AIR, {
    root: [0, 0, 0],
    hips: [0, 90, 0],
    spine: [0, 0, 22],
    chest: [0, 0, 8],
    neck: [0, -40, 0],
    head: [0, -40, -10],
    thighR: [0, 0, -92],
    shinR: [0, 0, 0],
    footR: [0, 0, 0],
    thighL: [-80, 0, 10],
    shinL: [120, 0, 0],
    upperArmL: [-40, 0, 40],
    foreArmL: [-110, 0, 0],
    upperArmR: [-40, 0, -20],
    foreArmR: [-110, 0, 0],
  });
  const spinKick = P(tkick, { thighL: [-60, 0, 10], shinL: [100, 0, 0] });
  const dkWind = P(AIR, {
    root: [0, 0, 0],
    hips: [-40, 0, 0],
    spine: [10, 0, 0],
    head: [16, 0, 0],
    thighL: [-110, 0, 8],
    shinL: [130, 0, 0],
    thighR: [-110, 0, -8],
    shinR: [130, 0, 0],
    upperArmL: [-20, 0, 60],
    upperArmR: [-20, 0, -60],
  });
  const dropKick: Pose = {
    root: [0, 0, 0],
    hips: [-70, 0, 0],
    spine: [10, 0, 0],
    chest: [10, 0, 0],
    neck: [20, 0, 0],
    head: [24, 0, 0],
    thighL: [-20, 0, 6],
    shinL: [0, 0, 0],
    footL: [-30, 0, 0],
    thighR: [-20, 0, -6],
    shinR: [0, 0, 0],
    footR: [-30, 0, 0],
    upperArmL: [-20, 0, 60],
    foreArmL: [-20, 0, 0],
    upperArmR: [-20, 0, -60],
    foreArmR: [-20, 0, 0],
  };
  const onBack = P(LYING, { head: [20, 0, 0], thighL: [-30, 0, 10], shinL: [40, 0, 0], thighR: [-30, 0, -10], shinR: [40, 0, 0] });
  const kip1 = P(onBack, {
    root: [0, -0.8, -0.1],
    hips: [-120, 0, 0],
    thighL: [-140, 0, 6],
    shinL: [40, 0, 0],
    thighR: [-140, 0, -6],
    shinR: [40, 0, 0],
    upperArmL: [-170, 0, 20],
    foreArmL: [-120, 0, 0],
    upperArmR: [-170, 0, -20],
    foreArmR: [-120, 0, 0],
  });
  const kip2 = P(AIR, { root: [0, -0.45, 0], hips: [-20, 0, 0], spine: [-20, 0, 0], chest: [-10, 0, 0], thighL: [-60, 0, 10], shinL: [110, 0, 0], thighR: [-50, 0, -10], shinR: [120, 0, 0], upperArmL: [-40, 0, 80], upperArmR: [-40, 0, -80] });
  const hairFlip = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 0],
      spine: [-4, 0, 8],
      chest: [-6, 0, 6],
      neck: [-10, 0, 10],
      head: [-20, 10, 16],
      upperArmL: [-160, 0, 30],
      foreArmL: [-110, 0, 0],
      upperArmR: [10, 0, -20],
      foreArmR: [-80, 0, 0],
    }),
  );
  const hairFlip2 = P(hairFlip, { spine: [-6, 0, -8], neck: [-10, 0, -10], head: [-22, 20, -16], hips: [0, -44, 0] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(5, spin(tkPre, -220), 'out'),
    K(12, tkick, 'linear'),
    K(18, spin(tkPre, 180), 'linear'),
    K(24, spin(tkick, 360), 'linear'),
    K(30, spin(tkPre, 540), 'linear'),
    K(36, spin(tkick, 720), 'linear'),
    rewrap(44, SQUAT, 1080, 'out'),
    K(48, flyWind, 'out'),
    K(52, flyKick, 'in'),
    K(55, flyKick),
    K(61, spin(P(tkPre, { thighL: [-60, 0, 10], shinL: [100, 0, 0] }), 180), 'smooth'),
    K(68, spin(spinKick, 360), 'linear'),
    rewrap(72, spinKick, 360),
    K(80, dkWind, 'smooth'),
    K(84, dkWind),
    K(86, dropKick, 'in'),
    K(90, dropKick),
    K(98, onBack, 'in'),
    K(103, kip1, 'smooth'),
    K(108, kip2, 'out'),
    K(112, LANDING, 'in'),
    K(118, STANCE, 'smooth'),
    K(124, hairFlip, 'smooth'),
    K(130, hairFlip2, 'smooth'),
    K(134, hairFlip, 'smooth'),
    K(140, STANCE, 'smooth'),
  );
  const chestHit = P(J.a, { spine: [20, 0, 0], chest: [10, 0, 0], head: [20, 0, 0] });
  const v = clip(
    K(0, HIT_MID),
    K(5, REEL, 'smooth'),
    react(12, REEL, TWIST_L),
    K(18, REEL, 'smooth'),
    react(24, REEL, TWIST_L2),
    K(30, REEL, 'smooth'),
    react(36, REEL, TWIST_L2),
    K(46, DAZED, 'smooth'),
    react(52, DAZED, chestHit),
    K(60, J.b, 'smooth'),
    react(68, J.b, spin(J.b, 60)),
    K(76, spin(J.c, 220), 'smooth'),
    K(85, spin(J.c, 360)),
    K(86, JACKKNIFE, 'out'),
    crash(98),
    K(140, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Tonton Jacky — BARBECUE PARTY
// ---------------------------------------------------------------------------
function bbq() {
  const bigBump = plant(P(BELLY_BUMP, { root: [0, 0, 0.36], hips: [-18, 0, 0], head: [16, 0, 0] }));
  const rub = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 0],
      spine: [-8, 0, 0],
      chest: [-8, 0, 0],
      neck: [-8, 0, 0],
      head: [-18, 10, 0],
      upperArmL: [-26, 0, 20],
      foreArmL: [-96, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-26, 0, -20],
      foreArmR: [-96, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const rub2 = P(rub, { spine: [-10, 6, 0], head: [-24, 4, 4], upperArmL: [-34, 0, 16], upperArmR: [-18, 0, -24], root: [rub.root![0], rub.root![1] - 0.02, 0] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    strike(10, BELLY_WIND, BELLY_BUMP, 5, 2),
    strike(22, BELLY_WIND, BELLY_BUMP, 6, 2),
    strike(34, BELLY_WIND, BELLY_BUMP, 6, 2),
    strike(46, BELLY_WIND, BELLY_BUMP, 6, 2),
    strike(58, shift(BELLY_WIND, 0, -0.03, -0.06), bigBump, 7, 3),
    K(68, rub, 'smooth'),
    K(74, rub2, 'smooth'),
    K(80, rub, 'smooth'),
    K(85, rub2, 'smooth'),
    K(90, SQUAT, 'smooth'),
    K(98, RISE, 'out'),
    K(106, SPLASH, 'smooth'),
    K(116, FLAT, 'in'),
    K(121, FLAT_BOUNCE, 'out'),
    K(126, FLAT, 'smooth'),
    K(131, PUSH_UP, 'smooth'),
    K(138, SQUAT, 'smooth'),
    K(144, rub, 'smooth'),
    K(150, rub2, 'smooth'),
  );
  const bumped = plant(P(HIT_MID, { root: [0, 0, -0.14], hips: [-6, -30, 0], spine: [18, 0, 0], upperArmL: [-40, 0, 40], upperArmR: [-40, 0, -40] }));
  const stagger = plant(P(DAZED, { root: [0, 0, -0.04], spine: [6, 0, 0], head: [6, 0, 0], thighL: [-20, 0, 10], shinL: [30, 0, 0] }));
  const v = clip(
    K(0, HIT_MID),
    K(5, stagger, 'smooth'),
    react(10, stagger, bumped),
    K(16, stagger, 'smooth'),
    react(22, stagger, bumped),
    K(28, stagger, 'smooth'),
    react(34, stagger, bumped),
    K(40, stagger, 'smooth'),
    react(46, stagger, bumped),
    K(52, stagger, 'smooth'),
    react(58, stagger, P(CHIN_UP, { upperArmL: [-80, 0, 90], upperArmR: [-60, 0, -100] })),
    K(64, J.a, 'smooth'),
    K(70, J.b, 'smooth'),
    crash(74),
    K(115, LYING),
    K(116, SQUASHED, 'out'),
    K(124, SQUASHED2, 'smooth'),
    K(134, LYING, 'smooth'),
    K(150, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Sécu — VIDÉ DU CLUB
// ---------------------------------------------------------------------------
function bouncer() {
  const grabWind = plant(P(STANCE, { hips: [0, -40, 0], upperArmR: [-60, 0, -40], foreArmR: [-60, 0, 0] }));
  const grab = plant(
    P(STANCE, {
      root: [0, 0, 0.04],
      hips: [0, -14, 0],
      spine: [4, 4, 0],
      chest: [0, 6, 0],
      head: [-4, -6, 0],
      upperArmR: [-88, 0, 6],
      foreArmR: [-10, 0, 0],
      handR: [-20, 0, 0],
      upperArmL: [-50, 0, 20],
      foreArmL: [-110, 0, 0],
    }),
  );
  const lift1 = P(grab, { upperArmR: [-118, 0, 6], foreArmR: [-10, 0, 0], spine: [-6, 4, 0], chest: [-8, 6, 0], head: [-16, -6, 0] });
  const lift2 = plant(
    P(STANCE, {
      root: [0, 0, 0],
      hips: [0, -14, 0],
      spine: [-10, 4, 0],
      chest: [-10, 6, 0],
      head: [-24, -6, 0],
      upperArmR: [-135, 0, 6],
      foreArmR: [-6, 0, 0],
      handR: [-20, 0, 0],
      upperArmL: [-20, 0, 50],
      foreArmL: [-40, 0, 0],
      thighL: [-14, 0, 8],
      shinL: [14, 0, 0],
      footL: [10, 0, 0],
      thighR: [10, 0, -8],
      shinR: [8, 0, 0],
      footR: [-10, 0, 0],
    }),
    0.03,
  );
  const lift3 = P(lift2, { upperArmR: [-140, 0, 6], head: [-28, -6, 0], spine: [-12, 4, 0] });
  const slam = plant(
    P(CROUCH, {
      root: [0, 0, 0.15],
      hips: [16, -10, 0],
      spine: [34, 0, 0],
      chest: [16, 0, 0],
      head: [16, 0, 0],
      upperArmR: [-62, 0, 0],
      foreArmR: [-10, 0, 0],
      upperArmL: [-20, 0, 40],
      foreArmL: [-60, 0, 0],
      thighL: [-80, 0, 10],
      shinL: [100, 0, 0],
      thighR: [-10, 0, -10],
      shinR: [100, 0, 0],
    }),
  );
  const pick1 = plant(
    P(STANCE, {
      hips: [10, -10, 0],
      spine: [40, 0, 0],
      chest: [20, 0, 0],
      head: [10, 0, 0],
      upperArmR: [-70, 0, 0],
      foreArmR: [-20, 0, 0],
      upperArmL: [-50, 0, 20],
      foreArmL: [-60, 0, 0],
      thighL: [-40, 0, 8],
      shinL: [60, 0, 0],
      thighR: [10, 0, -8],
      shinR: [40, 0, 0],
    }),
  );
  const pick2 = plant(P(STANCE, { hips: [0, -14, 0], spine: [10, 0, 0], head: [0, 0, 0], upperArmR: [-70, 0, 0], foreArmR: [-70, 0, 0] }));
  const hold = plant(P(STANCE, { hips: [0, -20, 0], upperArmL: [-85, 0, 6], foreArmL: [-20, 0, 0], upperArmR: [-30, 0, -30], foreArmR: [-110, 0, 0] }));
  const wind = plant(
    P(STANCE, {
      root: [0, -0.06, -0.12],
      hips: [0, -85, 0],
      spine: [-6, -10, 0],
      chest: [-6, -8, 0],
      neck: [0, 20, 0],
      head: [-10, 40, 0],
      upperArmL: [0, 0, 82],
      foreArmL: [-10, 0, 0],
      upperArmR: [20, 0, -60],
      foreArmR: [-120, 0, 0],
      thighL: [-30, 0, 8],
      shinL: [40, 0, 0],
      thighR: [16, 0, -8],
      shinR: [30, 0, 0],
    }),
  );
  const wind2 = P(wind, { root: [0, -0.08, -0.16], upperArmR: [30, 0, -70], spine: [-8, -16, 0], head: [-12, 46, 0] });
  const punch = plant(P(ATTACKS.powerPunch.strike, { root: [0, 0, 0.3], upperArmL: [-20, 0, 40], foreArmL: [-60, 0, 0], head: [-6, -30, 0] }));
  const a = clip(
    K(0, ATTACKS.super.strike),
    strike(10, grabWind, grab, 4, 6),
    K(22, lift1, 'smooth'),
    K(34, lift2, 'smooth'),
    K(42, lift3, 'smooth'),
    K(50, slam, 'in'),
    K(56, slam),
    K(62, pick1, 'smooth'),
    K(72, pick2, 'smooth'),
    K(80, hold, 'smooth'),
    K(88, wind, 'smooth'),
    K(94, wind2, 'smooth'),
    K(98, punch, 'in'),
    K(106, punch),
    K(116, STANCE, 'smooth'),
    K(126, CROSSED, 'smooth'),
    K(150, CROSSED),
  );
  const choked = P(STANCE, {
    root: [0, -0.02, -0.02],
    hips: [0, -20, 0],
    spine: [-6, 0, 0],
    chest: [-6, 0, 0],
    neck: [-20, 0, 0],
    head: [-20, 0, 0],
    // both hands on the attacker's wrist, at the throat
    upperArmL: [-62, 0, -10],
    foreArmL: [-96, 0, 0],
    handL: [10, 0, 0],
    upperArmR: [-62, 0, 10],
    foreArmR: [-96, 0, 0],
    handR: [10, 0, 0],
    thighL: [-6, 0, 6],
    shinL: [10, 0, 0],
    thighR: [6, 0, -6],
    shinR: [10, 0, 0],
  });
  const dangle1 = P(choked, { root: [0, 0, 0], thighL: [-20, 0, 6], shinL: [30, 0, 0], footL: [40, 0, 0], thighR: [10, 0, -6], shinR: [50, 0, 0], footR: [40, 0, 0] });
  const dangle2 = P(choked, { root: [0, 0, 0], thighL: [8, 0, 6], shinL: [50, 0, 0], footL: [40, 0, 0], thighR: [-24, 0, -6], shinR: [30, 0, 0], footR: [40, 0, 0], head: [-26, 0, 6] });
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
  const lyingKnees = P(slammed, { upperArmL: LYING.upperArmL!, upperArmR: LYING.upperArmR!, head: [8, -30, 0] });
  const held = P(DAZED, { head: [20, 0, 6] });
  const snap = P(CHIN_UP, { root: [0, -0.04, -0.14], hips: [-14, -30, 0], neck: [-30, 0, 0], head: [-36, 0, 0], upperArmL: [-20, 0, 70], upperArmR: [-20, 0, -70] });
  const v = clip(
    K(0, HIT_MID),
    react(10, HIT_MID, choked),
    K(16, choked),
    K(22, dangle1, 'out'),
    K(28, dangle2, 'smooth'),
    K(34, dangle1, 'out'),
    K(38, dangle2, 'smooth'),
    K(42, dangle1, 'smooth'),
    K(46, P(dangle1, { hips: [-50, -20, 0] }), 'in'),
    K(50, slammed, 'in'),
    K(56, P(slammed, { head: [10, -20, 0] })),
    K(62, lyingKnees, 'smooth'),
    K(70, SIT, 'smooth'),
    K(80, held, 'smooth'),
    K(97, P(held, { head: [24, 10, 0] })),
    K(98, snap, 'out'),
    K(104, FLY_BACK, 'smooth'),
    K(114, FLY_BACK2, 'smooth'),
    crash(124),
    K(150, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Papy Boxe — 40 ANS DE RING
// ---------------------------------------------------------------------------
function boxer() {
  const peek = plant(
    P(STANCE, {
      hips: [0, -28, 0],
      spine: [18, -4, 0],
      chest: [10, -4, 0],
      head: [-14, 6, 0],
      upperArmL: [-50, 0, 12],
      foreArmL: [-130, 0, 0],
      upperArmR: [-40, 0, -14],
      foreArmR: [-135, 0, 0],
      thighL: [-40, 0, 6],
      shinL: [60, 0, 0],
      thighR: [10, 0, -6],
      shinR: [36, 0, 0],
    }),
  );
  const hookL = plant(P(peek, { root: [0, 0, 0.08], hips: [0, 12, 0], spine: [22, 14, 8], chest: [10, 10, 0], head: [-10, -10, 0], upperArmL: [-50, 0, 52], foreArmL: [-88, 0, 0], handL: [0, 0, 0] }));
  const hookR = plant(P(peek, { root: [0, 0, 0.08], hips: [0, -58, 0], spine: [22, -16, -8], chest: [10, -14, 0], head: [-10, 30, 0], upperArmR: [-50, 0, -52], foreArmR: [-88, 0, 0], handR: [0, 0, 0] }));
  const liverWind = plant(P(peek, { hips: [0, -50, 0], spine: [24, -14, 0], upperArmL: [-30, 0, 40], foreArmL: [-100, 0, 0] }));
  const liver = plant(
    P(peek, {
      root: [0, 0, 0.12],
      hips: [0, 22, 0],
      spine: [26, 18, 14],
      chest: [12, 12, 0],
      head: [-8, -16, 0],
      upperArmL: [-46, 0, 58],
      foreArmL: [-92, 0, 0],
      thighL: [-55, 0, 6],
      shinL: [80, 0, 0],
      thighR: [12, 0, -6],
      shinR: [50, 0, 0],
    }),
  );
  const hayWind = plant(
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
  const hayWind2 = P(hayWind, { upperArmR: [62, 0, -26], foreArmR: [-60, 0, 0], spine: [-10, -20, 0], head: [-14, 44, 0] });
  const haymaker = plant(
    P(STANCE, {
      root: [0, 0, 0.26],
      hips: [0, 40, 0],
      spine: [22, 22, 0],
      chest: [14, 18, 0],
      neck: [0, -10, 0],
      head: [-8, -34, 0],
      upperArmR: [-115, 0, -8],
      foreArmR: [-20, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-30, 0, 30],
      foreArmL: [-100, 0, 0],
      thighL: [-56, 0, 6],
      shinL: [62, 0, 0],
      thighR: [28, 0, -6],
      shinR: [10, 0, 0],
      footR: [-30, 0, 0],
    }),
  );
  const hayFollow = plant(P(haymaker, { root: [0, 0, 0.2], hips: [0, 60, 0], spine: [26, 30, 0], upperArmR: [-70, 0, 30], foreArmR: [-40, 0, 0] }));
  const rocky = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 0],
      spine: [-6, 0, 0],
      chest: [-8, 0, 0],
      head: [-14, 10, 0],
      upperArmR: [-170, 0, -16],
      foreArmR: [-14, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-40, 0, 14],
      foreArmL: [-110, 0, 0],
    }),
  );
  const rocky2 = P(rocky, { upperArmR: [-165, 0, -24], head: [-18, 14, 4], root: [rocky.root![0], rocky.root![1] + 0.02, 0] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(4, peek, 'out'),
    strike(8, peek, hookL, 3, 1),
    strike(16, peek, hookR, 4, 1),
    strike(24, peek, hookL, 4, 1),
    strike(32, peek, hookR, 4, 2),
    K(40, liverWind, 'smooth'),
    K(43, shift(liverWind, 0, -0.03, 0)),
    K(46, liver, 'in'),
    K(50, liver),
    K(56, ATTACKS.uppercut.windup, 'smooth'),
    K(59, shift(ATTACKS.uppercut.windup, 0, -0.03, 0)),
    K(62, ATTACKS.uppercut.strike, 'in'),
    K(66, ATTACKS.uppercut.follow!, 'smooth'),
    K(72, hayWind, 'smooth'),
    K(80, hayWind2, 'smooth'),
    K(84, haymaker, 'in'),
    K(88, haymaker),
    K(98, hayFollow, 'smooth'),
    K(108, rocky, 'out'),
    K(118, rocky2, 'smooth'),
    K(128, rocky, 'smooth'),
    K(140, STANCE, 'smooth'),
  );
  const blowA = P(HIT_MID, { spine: [26, 8, 10], chest: [18, 6, 4], head: [12, -8, 0] });
  const blowB = P(HIT_MID, { spine: [28, -8, -10], chest: [18, -6, -4], head: [14, 8, 0] });
  const hunch = P(HIT_MID, { root: [0, -0.08, -0.06], spine: [18, 0, 0], head: [8, 0, 0] });
  const crumple = plant(
    P(HIT_MID, {
      root: [0, 0, -0.06],
      hips: [16, -30, 0],
      spine: [38, 0, -16],
      chest: [20, 0, -8],
      neck: [10, 0, 0],
      head: [16, 0, -10],
      upperArmL: [-30, 0, 10],
      foreArmL: [-100, 0, 0],
      upperArmR: [-10, 0, -10],
      foreArmR: [-110, 0, 0],
      thighL: [-60, 0, 8],
      shinL: [100, 0, 0],
      thighR: [-20, 0, -8],
      shinR: [110, 0, 0],
    }),
  );
  const straighten = P(HIT_HIGH, {
    root: [0, 0, -0.1],
    hips: [-12, -30, 0],
    spine: [-16, 0, 0],
    chest: [-16, 0, 0],
    neck: [-30, 0, 0],
    head: [-38, 0, 0],
    upperArmL: [-20, 0, 70],
    foreArmL: [-30, 0, 0],
    upperArmR: [-20, 0, -70],
    foreArmR: [-30, 0, 0],
    thighL: [-10, 0, 6],
    shinL: [20, 0, 0],
    thighR: [10, 0, -6],
    shinR: [20, 0, 0],
    footL: [30, 0, 0],
    footR: [30, 0, 0],
  });
  const wobble1 = P(DAZED, { head: [20, -20, 14], spine: [6, 0, 10] });
  const wobble2 = P(DAZED, { head: [16, 20, -14], spine: [6, 0, -10] });
  const knockout = P(TWIST_L2, { head: [-20, 60, -20], chest: [-10, 40, -10] });
  const v = clip(
    K(0, HIT_MID),
    K(4, hunch, 'smooth'),
    react(8, hunch, blowA),
    K(12, hunch, 'smooth'),
    react(16, hunch, blowB),
    K(20, hunch, 'smooth'),
    react(24, hunch, P(blowA, { spine: [32, 8, 12] })),
    K(28, hunch, 'smooth'),
    react(32, hunch, P(blowB, { spine: [34, -8, -12] })),
    K(40, hunch, 'smooth'),
    react(46, hunch, crumple),
    K(56, P(crumple, { head: [20, 0, -6] })),
    react(62, P(crumple, { head: [20, 0, -6] }), straighten),
    K(74, wobble1, 'smooth'),
    K(80, wobble2, 'smooth'),
    react(84, wobble2, knockout),
    K(92, spin(P(J.a, { root: [0, -0.2, 0] }), 200), 'smooth'),
    rewrap(100, LYING, 360, 'in'),
    K(104, LYING_BOUNCE, 'out'),
    K(110, LYING, 'in'),
    K(140, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// MC Grove — MIC DROP
// ---------------------------------------------------------------------------
function micdrop() {
  const micArm: Pose = { upperArmR: [-40, 0, 24], foreArmR: [-135, 0, 0], handR: [0, 0, 0] };
  const mic = plant(
    P(STANCE, OPEN_LEGS, micArm, {
      hips: [0, -50, 0],
      spine: [-4, 0, 0],
      chest: [-6, 0, 0],
      head: [-10, 16, 0],
      upperArmL: [-20, 0, 150],
      foreArmL: [-20, 0, 0],
    }),
  );
  const mic2 = shift(P(mic, { head: [-14, 10, 8], upperArmL: [-20, 0, 135], foreArmL: [-40, 0, 0] }), 0, -0.03, 0);
  const tap = plant(P(ATTACKS.jab.strike, micArm, { root: [0, 0, 0.06], handL: [-40, 0, 0], head: [-8, 10, 0] }));
  const tapWind = plant(P(STANCE, micArm, { hips: [0, -26, 0], upperArmL: [-60, 0, 14], foreArmL: [-100, 0, 0], head: [-8, 12, 0] }));
  const hookL = plant(
    P(STANCE, micArm, {
      root: [0, 0, 0.08],
      hips: [0, 20, 0],
      spine: [6, 16, 0],
      chest: [6, 14, 0],
      head: [-6, -16, 0],
      upperArmL: [-62, 0, 70],
      foreArmL: [-92, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  const hookWind = plant(P(STANCE, micArm, { hips: [0, -50, 0], spine: [4, -10, 0], upperArmL: [-40, 0, 60], foreArmL: [-100, 0, 0] }));
  const backfist = plant(
    P(STANCE, OPEN_LEGS, {
      root: [0, 0, 0.06],
      hips: [0, 90, 0],
      spine: [4, 0, 8],
      chest: [0, 10, 0],
      neck: [0, -30, 0],
      head: [-4, -40, 0],
      upperArmR: [-4, 0, -88],
      foreArmR: [0, 0, -6],
      handR: [0, 0, 0],
      upperArmL: [-40, 0, 20],
      foreArmL: [-110, 0, 0],
    }),
  );
  const bfWind = plant(P(STANCE, { hips: [0, -40, 0], spine: [6, -10, 0], upperArmR: [-70, 0, 30], foreArmR: [-140, 0, 0], head: [-6, 20, 0] }));
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
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(6, mic, 'out'),
    K(10, mic2, 'smooth'),
    K(14, mic, 'smooth'),
    strike(18, tapWind, tap, 3, 1),
    strike(26, tapWind, tap, 4, 1),
    strike(34, tapWind, tap, 4, 1),
    strike(42, hookWind, hookL, 4, 2),
    strike(50, ATTACKS.cross.windup, ATTACKS.cross.strike, 4, 1),
    K(54, bfWind, 'smooth'),
    K(66, spin(backfist, 360), 'in'),
    K(69, spin(backfist, 360)),
    rewrap(74, SQUAT, 720, 'smooth'),
    K(82, HAMMER_UP, 'out'),
    K(88, P(HAMMER_UP, { spine: [-22, 0, 0], upperArmL: [-185, 0, -6], upperArmR: [-185, 0, 6] }), 'smooth'),
    K(92, HAMMER_DOWN, 'in'),
    K(96, HAMMER_DOWN),
    K(100, LANDING, 'in'),
    K(106, STANCE, 'smooth'),
    K(114, drop, 'smooth'),
    K(122, drop),
    K(126, drop2, 'out'),
    K(134, drop2),
    K(140, STANCE, 'smooth'),
  );
  const tapHit = P(STANCE, { root: [0, -0.06, -0.04], head: [-20, 0, 0], neck: [-8, 0, 0] });
  const annoyed = plant(P(STANCE, { hips: [0, -26, 0], head: [-4, 8, 0] }));
  const v = clip(
    K(0, HIT_MID),
    K(8, annoyed, 'smooth'),
    react(18, annoyed, tapHit),
    K(22, annoyed, 'smooth'),
    react(26, annoyed, tapHit),
    K(30, annoyed, 'smooth'),
    react(34, annoyed, tapHit),
    K(38, REEL, 'smooth'),
    react(42, REEL, TWIST_R),
    K(46, REEL, 'smooth'),
    react(50, REEL, HIT_HIGH),
    K(56, REEL, 'smooth'),
    react(66, REEL, TWIST_L2),
    rewrap(78, DAZED, 360, 'out'),
    K(85, P(DAZED, { head: [10, 20, -10] }), 'smooth'),
    react(92, DAZED, SMASHED),
    K(98, KNEEL, 'smooth'),
    crash(104),
    K(140, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Kévin — LIVRAISON EXPRESS
// ---------------------------------------------------------------------------
function express() {
  const hop = plant(P(STANCE, { root: [0, 0, -0.04], hips: [0, -30, 0], spine: [-4, 0, 0], thighL: [-20, 0, 6], shinL: [30, 0, 0], thighR: [20, 0, -6], shinR: [40, 0, 0] }), 0.05);
  const dashLegs: Pose = { thighL: [-50, 0, 6], shinL: [50, 0, 0], thighR: [30, 0, -6], shinR: [20, 0, 0], footR: [-30, 0, 0] };
  const jabL = plant(P(ATTACKS.jab.strike, dashLegs, { root: [0, 0, 0.12], spine: [12, 8, 0] }));
  const jabR = plant(P(ATTACKS.cross.strike, dashLegs, { root: [0, 0, 0.14], spine: [14, 10, 0] }));
  const run = plant(
    P(STANCE, {
      hips: [0, -10, 0],
      spine: [24, 0, 0],
      head: [-14, 0, 0],
      upperArmL: [30, 0, 10],
      foreArmL: [-90, 0, 0],
      upperArmR: [-60, 0, -10],
      foreArmR: [-90, 0, 0],
      thighL: [-70, 0, 6],
      shinL: [80, 0, 0],
      thighR: [30, 0, -6],
      shinR: [60, 0, 0],
    }),
  );
  const slide: Pose = {
    root: [0, -0.62, 0.15],
    hips: [-62, 0, 0],
    spine: [24, 0, 0],
    chest: [10, 0, 0],
    neck: [10, 0, 0],
    head: [20, 0, 0],
    thighL: [-30, 0, 6],
    shinL: [0, 0, 0],
    footL: [-20, 0, 0],
    thighR: [-6, 0, -6],
    shinR: [70, 0, 0],
    footR: [0, 0, 0],
    upperArmL: [30, 0, 40],
    foreArmL: [-10, 0, 0],
    upperArmR: [30, 0, -40],
    foreArmR: [-10, 0, 0],
  };
  const kneeWind = P(AIR, { root: [0, 0, 0], thighR: [-40, 0, -4], shinR: [100, 0, 0], thighL: [-60, 0, 6], shinL: [90, 0, 0], upperArmL: [-120, 0, 30], upperArmR: [-120, 0, -30] });
  const flyKnee = P(AIR, {
    root: [0, 0, 0],
    hips: [-10, -10, 0],
    spine: [12, 0, 0],
    head: [6, 0, 0],
    thighR: [-125, 0, -4],
    shinR: [135, 0, 0],
    footR: [30, 0, 0],
    thighL: [24, 0, 6],
    shinL: [60, 0, 0],
    upperArmL: [-150, 0, 20],
    foreArmL: [-80, 0, 0],
    upperArmR: [-150, 0, -20],
    foreArmR: [-80, 0, 0],
  });
  const fall = P(AIR, { root: [0, 0, 0], thighL: [-40, 0, 10], shinL: [50, 0, 0], thighR: [-20, 0, -10], shinR: [40, 0, 0], upperArmL: [-30, 0, 60], upperArmR: [-30, 0, -60] });
  const watch = plant(P(STANCE, OPEN_LEGS, WATCH_L, { hips: [0, -40, 0], spine: [6, 0, 0], neck: [10, 0, 0], head: [24, 10, 0], upperArmR: [6, 0, -14], foreArmR: [-20, 0, 0] }));
  const watch2 = P(watch, { head: [20, 16, 4], neck: [6, 0, 0] });
  const thumbs = plant(P(STANCE, OPEN_LEGS, { hips: [0, -45, 0], head: [-10, 16, 0], upperArmR: [-80, 0, -30], foreArmR: [-80, 0, 0], handR: [0, 0, 0], upperArmL: [6, 0, 14], foreArmL: [-20, 0, 0] }));
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(7, hop, 'out'),
    K(9, hop),
    K(12, jabL, 'in'),
    K(16, hop, 'out'),
    K(17, hop),
    K(20, jabR, 'in'),
    K(24, hop, 'out'),
    K(25, hop),
    K(28, jabL, 'in'),
    K(32, hop, 'out'),
    K(33, hop),
    K(36, jabR, 'in'),
    K(38, jabR),
    K(42, hop, 'smooth'),
    K(46, run, 'smooth'),
    K(50, slide, 'out'),
    K(54, slide),
    K(58, LANDING, 'smooth'),
    K(64, kneeWind, 'out'),
    K(70, flyKnee, 'in'),
    K(74, flyKnee),
    K(84, fall, 'smooth'),
    K(92, LANDING, 'in'),
    K(100, STANCE, 'smooth'),
    K(106, watch, 'smooth'),
    K(118, watch2, 'smooth'),
    K(124, watch, 'smooth'),
    K(130, thumbs, 'smooth'),
    K(140, thumbs),
  );
  const swept = P(J.a, {
    root: [0, -0.28, 0],
    hips: [-50, -20, 0],
    thighL: [-70, 0, 15],
    shinL: [30, 0, 0],
    thighR: [-60, 0, -15],
    shinR: [40, 0, 0],
    upperArmL: [-60, 0, 90],
    upperArmR: [-60, 0, -90],
  });
  const v = clip(
    K(0, HIT_MID),
    K(5, REEL, 'smooth'),
    react(12, REEL, TWIST_R),
    K(16, REEL, 'smooth'),
    react(20, REEL, TWIST_L),
    K(24, REEL, 'smooth'),
    react(28, REEL, TWIST_R2),
    K(32, REEL, 'smooth'),
    react(36, REEL, TWIST_L2),
    K(44, DAZED, 'smooth'),
    react(50, DAZED, swept),
    K(56, J.b, 'smooth'),
    K(62, P(J.c, { hips: [-90, -15, 0] }), 'smooth'),
    react(70, P(J.c, { hips: [-92, -15, 0] }), JACKKNIFE),
    K(78, FLY_BACK2, 'smooth'),
    K(88, FLY_BACK, 'smooth'),
    crash(96),
    K(140, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Coach Bruno — SÉRIE DE BURPEES
// ---------------------------------------------------------------------------
function burpees() {
  const whistle = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -50, 0],
      spine: [-4, 0, 0],
      head: [-8, 14, 0],
      upperArmR: [-40, 0, 24],
      foreArmR: [-135, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-30, 0, 70],
      foreArmL: [-10, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  const whistle2 = shift(P(whistle, { head: [-14, 10, 4], upperArmL: [-40, 0, 60] }), 0, -0.02, 0);
  const squat = plant(
    P(CROUCH, {
      root: [0, 0, -0.14],
      hips: [26, -10, 0],
      spine: [26, 0, 0],
      chest: [10, 0, 0],
      neck: [-16, 0, 0],
      head: [-20, 0, 0],
      thighL: [-108, 0, 14],
      shinL: [136, 0, 0],
      footL: [-20, 0, 0],
      thighR: [-108, 0, -14],
      shinR: [136, 0, 0],
      footR: [-20, 0, 0],
      upperArmL: [-60, 0, 10],
      foreArmL: [0, 0, 0],
      upperArmR: [-60, 0, -10],
      foreArmR: [0, 0, 0],
    }),
  );
  const plank: Pose = {
    root: [0, -0.6, -0.4],
    hips: [72, -6, 0],
    spine: [0, 0, 0],
    chest: [0, 0, 0],
    neck: [-24, 0, 0],
    head: [-24, 6, 0],
    upperArmL: [-74, 0, 10],
    foreArmL: [0, 0, 0],
    handL: [-60, 0, 0],
    upperArmR: [-74, 0, -10],
    foreArmR: [0, 0, 0],
    handR: [-60, 0, 0],
    thighL: [0, 0, 4],
    shinL: [0, 0, 0],
    footL: [60, 0, 0],
    thighR: [0, 0, -4],
    shinR: [0, 0, 0],
    footR: [60, 0, 0],
  };
  const jumpUpper = P(AIR, {
    root: [0, 0, 0.05],
    hips: [0, 20, 0],
    spine: [-6, 12, 0],
    chest: [-10, 12, 0],
    head: [-14, -20, 0],
    upperArmR: [-165, 0, -8],
    foreArmR: [-25, 0, 0],
    handR: [0, 0, 0],
    upperArmL: [-20, 0, 40],
    foreArmL: [-90, 0, 0],
    thighL: [-20, 0, 8],
    shinL: [30, 0, 0],
    thighR: [0, 0, -8],
    shinR: [20, 0, 0],
    footL: [30, 0, 0],
    footR: [30, 0, 0],
  });
  const jumpKnee = P(AIR, {
    root: [0, 0, 0.06],
    hips: [-6, -10, 0],
    spine: [14, 0, 0],
    thighL: [-122, 0, 4],
    shinL: [132, 0, 0],
    footL: [30, 0, 0],
    thighR: [10, 0, -6],
    shinR: [30, 0, 0],
    upperArmL: [-100, 0, 20],
    foreArmL: [-60, 0, 0],
    upperArmR: [-100, 0, -20],
    foreArmR: [-60, 0, 0],
  });
  const jumpDouble = P(AIR, {
    root: [0, 0, 0.06],
    hips: [-4, 0, 0],
    spine: [-10, 0, 0],
    chest: [-8, 0, 0],
    head: [-24, 0, 0],
    upperArmL: [-170, 0, 12],
    foreArmL: [-20, 0, 0],
    upperArmR: [-170, 0, -12],
    foreArmR: [-20, 0, 0],
    thighL: [4, 0, 6],
    shinL: [16, 0, 0],
    footL: [40, 0, 0],
    thighR: [4, 0, -6],
    shinR: [16, 0, 0],
    footR: [40, 0, 0],
  });
  const stretch = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -30, 0],
      spine: [0, 0, 18],
      chest: [0, 0, 10],
      head: [-6, 0, 10],
      upperArmL: [-10, 0, 165],
      foreArmL: [-10, 0, 0],
      upperArmR: [-10, 0, -150],
      foreArmR: [-30, 0, 0],
    }),
  );
  const stretch2 = P(stretch, { spine: [0, 0, -18], chest: [0, 0, -10], head: [-6, 0, -10], upperArmL: [-10, 0, 150], foreArmL: [-30, 0, 0], upperArmR: [-10, 0, -165], foreArmR: [-10, 0, 0] });
  // squat, legs kicked back into a plank, squat, explosive jump (strike on the hit frame)
  const burpee = (f0: number, jump: Pose, hit: number): Key[] => [
    K(f0, squat, 'smooth'),
    K(f0 + 3, plank, 'out'),
    K(f0 + 6, squat, 'smooth'),
    K(hit - 3, shift(squat, 0, 0.12, 0), 'out'),
    K(hit, jump, 'in'),
    K(hit + 2, jump),
  ];
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(5, whistle, 'out'),
    K(9, whistle2, 'smooth'),
    K(12, whistle, 'smooth'),
    K(16, ATTACKS.jab.strike, 'in'),
    K(19, ATTACKS.cross.windup, 'out'),
    K(22, ATTACKS.cross.strike, 'in'),
    burpee(28, jumpUpper, 40),
    K(44, LANDING, 'in'),
    burpee(46, jumpKnee, 58),
    K(62, LANDING, 'in'),
    burpee(64, jumpDouble, 76),
    K(86, HAMMER_UP, 'smooth'),
    K(92, P(HAMMER_UP, { spine: [-22, 0, 0], upperArmL: [-185, 0, -6], upperArmR: [-185, 0, 6] }), 'smooth'),
    K(96, HAMMER_DOWN, 'in'),
    K(100, HAMMER_DOWN),
    K(106, LANDING, 'in'),
    K(114, STANCE, 'smooth'),
    K(120, stretch, 'smooth'),
    K(128, stretch2, 'smooth'),
    K(136, stretch, 'smooth'),
    K(142, whistle, 'smooth'),
    K(146, whistle2, 'smooth'),
    K(150, whistle, 'smooth'),
  );
  const v = clip(
    K(0, HIT_MID),
    K(6, REEL, 'smooth'),
    react(16, REEL, TWIST_R),
    react(22, P(TWIST_R, { head: [-10, -20, 8] }), TWIST_L2),
    K(30, REEL, 'smooth'),
    react(40, REEL, CHIN_UP),
    K(48, DAZED, 'smooth'),
    react(58, DAZED, shift(DOUBLE, 0, 0.04, 0)),
    K(66, DAZED, 'smooth'),
    react(76, DAZED, P(J.a, { head: [-40, 0, 0], neck: [-24, 0, 0] })),
    K(84, J.b, 'smooth'),
    K(92, J.c, 'smooth'),
    react(96, J.c, JACKKNIFE),
    crash(104),
    K(150, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Big Mo — GROVE STREET 4 LIFE
// ---------------------------------------------------------------------------
function grove() {
  const hookLWind = plant(P(STANCE, { hips: [0, -55, 0], spine: [0, -10, 0], upperArmL: [-50, 0, 70], foreArmL: [-100, 0, 0] }));
  const hookL = plant(
    P(STANCE, {
      root: [0, 0, 0.1],
      hips: [0, 20, 0],
      spine: [6, 16, 0],
      chest: [6, 14, 0],
      head: [-6, -16, 0],
      upperArmL: [-75, 0, 60],
      foreArmL: [-95, 0, 0],
      handL: [0, 0, 0],
      thighL: [-40, 0, 6],
      shinL: [46, 0, 0],
    }),
  );
  const hookRWind = plant(P(STANCE, { hips: [0, 10, 0], spine: [0, 10, 0], upperArmR: [-50, 0, -70], foreArmR: [-100, 0, 0] }));
  const hookR = plant(
    P(STANCE, {
      root: [0, 0, 0.1],
      hips: [0, -70, 0],
      spine: [6, -16, 0],
      chest: [6, -14, 0],
      head: [-6, 30, 0],
      upperArmR: [-75, 0, -60],
      foreArmR: [-95, 0, 0],
      handR: [0, 0, 0],
      thighL: [-40, 0, 6],
      shinL: [46, 0, 0],
    }),
  );
  const headlock = plant(
    P(STANCE, {
      hips: [0, -20, 0],
      spine: [20, 0, 0],
      chest: [8, 0, 0],
      head: [-4, 10, 0],
      upperArmL: [-50, 0, -20],
      foreArmL: [-90, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-40, 0, -10],
      foreArmR: [-110, 0, 0],
      thighL: [-30, 0, 8],
      shinL: [40, 0, 0],
    }),
  );
  const lockPunch = plant(P(headlock, { hips: [0, -10, 0], spine: [24, 6, 0], upperArmR: [-78, 0, 8], foreArmR: [-60, 0, 0], handR: [0, 0, 0] }));
  const shove = plant(P(STANCE, { root: [0, 0, 0.12], hips: [0, -6, 0], spine: [16, 0, 0], upperArmL: [-85, 0, 10], foreArmL: [-10, 0, 0], upperArmR: [-85, 0, -10], foreArmR: [-10, 0, 0], thighL: [-50, 0, 6], shinL: [50, 0, 0], thighR: [26, 0, -6], shinR: [16, 0, 0] }));
  // windmill windup facing the camera: the right arm turns two full circles
  const mill = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -55, 0],
      spine: [-4, 0, 0],
      head: [-10, 12, 0],
      upperArmR: [0, 0, -16],
      foreArmR: [-6, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-58, 0, 14],
      foreArmL: [-112, 0, 0],
    }),
  );
  const upperWind = plant(P(CROUCH, { hips: [0, -40, 0], spine: [20, -10, 0], upperArmR: [30, 0, -20], foreArmR: [-40, 0, 0], handR: [0, 0, 0] }));
  const giantUpper = plant(
    P(ATTACKS.uppercut.strike, {
      root: [0, 0, 0.15],
      spine: [-10, 14, 0],
      chest: [-10, 14, 0],
      head: [-24, -20, 0],
      upperArmR: [-175, 0, -6],
      foreArmR: [-5, 0, 0],
      thighL: [-20, 0, 6],
      shinL: [10, 0, 0],
      thighR: [10, 0, -6],
      shinR: [4, 0, 0],
      footR: [-30, 0, 0],
    }),
    0.04,
  );
  const lookUp = plant(
    P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, {
      hips: [0, -30, 0],
      spine: [-10, 0, 0],
      chest: [-8, 0, 0],
      neck: [-20, 0, 0],
      head: [-30, 0, 0],
      upperArmR: [-150, 30, -10],
      foreArmR: [-100, 0, 0],
      handR: [20, 0, 0],
    }),
  );
  const lookUp2 = P(lookUp, { head: [-36, 10, 6], neck: [-24, 6, 0] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    strike(10, hookLWind, hookL, 5, 2),
    strike(22, hookRWind, hookR, 6, 2),
    K(30, headlock, 'smooth'),
    K(36, headlock),
    ...[40, 48, 56].flatMap((f) => strike(f, headlock, lockPunch, 3, 1)),
    K(62, shove, 'in'),
    K(66, shove),
    K(70, mill, 'smooth'),
    K(86, boneX(mill, 'upperArmR', -720), 'linear'),
    K(89, boneX(upperWind, 'upperArmR', -720), 'out'),
    K(92, boneX(giantUpper, 'upperArmR', -720), 'in'),
    K(96, boneX(giantUpper, 'upperArmR', -720)),
    K(96, giantUpper),
    K(104, P(giantUpper, { head: [-34, -10, 0] }), 'smooth'),
    K(112, lookUp, 'smooth'),
    K(124, lookUp2, 'smooth'),
    K(132, lookUp, 'smooth'),
    K(140, STANCE, 'smooth'),
    K(148, CROSSED, 'smooth'),
    K(160, CROSSED),
  );
  // bent forward and to its left: the head ends up under Big Mo's left arm, at his side
  const locked = plant(
    P(HIT_MID, {
      root: [0, 0, 0.04],
      hips: [22, 38, 0],
      spine: [30, 0, 0],
      chest: [10, 0, 0],
      neck: [10, 0, 0],
      head: [20, 30, 0],
      upperArmL: [-70, 0, 20],
      foreArmL: [-60, 0, 0],
      upperArmR: [-60, 0, -20],
      foreArmR: [-60, 0, 0],
    }),
  );
  const lockedHit = P(locked, { head: [-14, 30, 0], neck: [-6, 0, 0] });
  const starfish: Pose = {
    root: [0, -0.3, 0],
    spine: [-6, 0, 0],
    chest: [-6, 0, 0],
    neck: [-10, 0, 0],
    head: [-20, 0, 0],
    upperArmL: [-20, 0, 110],
    foreArmL: [-20, 0, 0],
    upperArmR: [-20, 0, -110],
    foreArmR: [-20, 0, 0],
    thighL: [-10, 0, 30],
    shinL: [20, 0, 0],
    thighR: [-10, 0, -30],
    shinR: [20, 0, 0],
  };
  const sky = (x: number): Pose => ({ ...starfish, hips: [x, -15, 0] });
  const v = clip(
    K(0, HIT_MID),
    K(5, REEL, 'smooth'),
    react(10, REEL, TWIST_R2),
    K(16, REEL, 'smooth'),
    react(22, REEL, TWIST_L2),
    K(30, locked, 'smooth'),
    K(36, locked),
    ...[40, 48, 56].flatMap((f) => [...react(f, locked, lockedHit), K(f + 4, locked, 'smooth')]),
    K(62, REEL, 'out'),
    K(72, DAZED, 'smooth'),
    K(80, P(DAZED, { head: [10, 20, -10] }), 'smooth'),
    K(88, DAZED, 'smooth'),
    react(92, DAZED, P(CHIN_UP, { thighL: [-4, 0, 6], shinL: [6, 0, 0], thighR: [4, 0, -6], shinR: [6, 0, 0], footL: [30, 0, 0], footR: [30, 0, 0] })),
    K(100, sky(-30), 'out'),
    K(116, sky(-180), 'linear'),
    K(128, sky(-300), 'linear'),
    rewrap(136, LYING, 0, 'in', -360),
    K(140, LYING_BOUNCE, 'out'),
    K(146, LYING, 'in'),
    K(160, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Mamie Gigi — LE COUP DU SAC À MAIN
// ---------------------------------------------------------------------------
function handbag() {
  const wag = plant(
    P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, {
      hips: [0, -50, 0],
      spine: [4, 0, 0],
      head: [-4, 18, 6],
      upperArmR: [-50, 0, -6],
      foreArmR: [-125, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const wag2 = P(wag, { foreArmR: [-125, 0, 26], head: [0, 18, -6] });
  // overhand windmill swing of the right arm (the "handbag"): back, over the top, down on the head
  const swingBase = plant(P(STANCE, { hips: [0, -30, 0] }));
  const swR = (x: number, extra: Pose = {}): Pose => P(swingBase, { upperArmR: [x, 0, -14], foreArmR: [-8, 0, 0], handR: [0, 0, 0] }, extra);
  const swL = (x: number, extra: Pose = {}): Pose => P(swingBase, { upperArmL: [x, 0, 14], foreArmL: [-8, 0, 0], handL: [0, 0, 0] }, extra);
  const hitR: Pose = { root: [0, -0.08, 0.1], hips: [0, 10, 0], spine: [16, 14, 0], chest: [8, 10, 0], head: [6, -16, 0] };
  const hitL: Pose = { root: [0, -0.08, 0.1], hips: [0, -60, 0], spine: [16, -14, 0], chest: [8, -10, 0], head: [6, 24, 0] };
  const windR: Pose = { hips: [0, -60, 0], spine: [-8, -10, 0] };
  const windL: Pose = { hips: [0, 10, 0], spine: [-8, 10, 0] };
  const swing = (f: number, sw: (x: number, e?: Pose) => Pose, wind: Pose, hit: Pose): Key[] => [
    K(f - 6, sw(70, wind), 'out'),
    K(f - 3, sw(180, wind), 'linear'),
    K(f, sw(262, hit), 'in'),
    K(f + 3, sw(320, hit), 'out'),
    K(f + 3, sw(-40, hit)),
  ];
  const kick = plant(P(STANCE, { hips: [0, -20, 0], spine: [-8, 0, 0], thighL: [-45, 0, 6], shinL: [10, 0, 0], footL: [-20, 0, 0], upperArmL: [-20, 0, 50], foreArmL: [-30, 0, 0], upperArmR: [-20, 0, -50], foreArmR: [-30, 0, 0] }));
  const fury = plant(P(STANCE, OPEN_LEGS, { hips: [0, -50, 0], spine: [-6, 0, 0], head: [-12, 14, 0], upperArmL: [0, 0, 20], foreArmL: [-6, 0, 0], upperArmR: [0, 0, -20], foreArmR: [-6, 0, 0] }));
  const both = (p: Pose, dx: number) => boneX(boneX(p, 'upperArmL', dx), 'upperArmR', dx);
  const smashUp = P(fury, { root: [0, -0.02, -0.04], spine: [-14, 0, 0], head: [-16, 0, 0], hips: [0, -10, 0], upperArmL: [-180, 0, -4], upperArmR: [-180, 0, 4] });
  const smash = plant(P(STANCE, { root: [0, 0, 0.12], hips: [0, -6, 0], spine: [30, 0, 0], chest: [10, 0, 0], head: [10, 0, 0], upperArmL: [-80, 0, -8], foreArmL: [-6, 0, 0], upperArmR: [-80, 0, 8], foreArmR: [-6, 0, 0], thighL: [-50, 0, 6], shinL: [50, 0, 0], thighR: [24, 0, -6], shinR: [16, 0, 0] }));
  const dust = plant(P(STANCE, OPEN_LEGS, { hips: [0, -40, 0], head: [10, 10, 0], upperArmL: [-40, 0, 6], foreArmL: [-70, 0, 0], upperArmR: [-40, 0, -6], foreArmR: [-70, 0, 0] }));
  const dust2 = P(dust, { upperArmL: [-46, 0, 2], foreArmL: [-60, 0, 0], upperArmR: [-34, 0, -10], foreArmR: [-80, 0, 0] });
  const proud = plant(P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, HAND_ON_HIP_R, { hips: [0, -45, 0], spine: [-6, 0, 0], chest: [-6, 0, 0], head: [-14, 14, 0] }));
  const proud2 = P(proud, { head: [0, 14, 0] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(5, wag, 'out'),
    K(8, wag2, 'smooth'),
    K(11, wag, 'smooth'),
    K(14, wag2, 'smooth'),
    swing(24, swR, windR, hitR),
    swing(34, swL, windL, hitL),
    swing(44, swR, windR, hitR),
    K(52, swingBase, 'smooth'),
    K(56, kick, 'in'),
    K(59, kick),
    K(66, fury, 'smooth'),
    K(84, both(fury, -720), 'linear'),
    K(84, fury),
    K(91, smashUp, 'out'),
    K(96, smash, 'in'),
    K(102, smash),
    K(112, dust, 'smooth'),
    K(116, dust2, 'smooth'),
    K(120, dust, 'smooth'),
    K(124, dust2, 'smooth'),
    K(132, proud, 'smooth'),
    K(138, proud2, 'smooth'),
    K(144, proud, 'smooth'),
    K(150, proud2, 'smooth'),
  );
  const hop = plant(
    P(STANCE, {
      hips: [0, -20, 0],
      spine: [26, 0, 0],
      head: [10, 0, 0],
      thighL: [-70, 0, 10],
      shinL: [100, 0, 0],
      upperArmL: [-60, 0, 0],
      foreArmL: [-30, 0, 0],
      upperArmR: [-50, 0, 0],
      foreArmR: [-40, 0, 0],
    }),
  );
  const hop2 = P(hop, { spine: [20, 0, 6], head: [-10, 10, 0], thighL: [-76, 0, 10] });
  const headDown = (p: Pose): Pose => P(p, { neck: [10, 0, 0], head: [10, (p.head ?? [0, 0, 0])[1], (p.head ?? [0, 0, 0])[2]] });
  const v = clip(
    K(0, HIT_MID),
    K(8, REEL, 'smooth'),
    react(24, REEL, headDown(TWIST_L)),
    K(29, REEL, 'smooth'),
    react(34, REEL, headDown(TWIST_R)),
    K(39, REEL, 'smooth'),
    react(44, REEL, headDown(TWIST_L2)),
    K(50, DAZED, 'smooth'),
    react(56, DAZED, hop),
    K(64, hop2, 'smooth'),
    K(72, hop, 'smooth'),
    K(80, hop2, 'smooth'),
    K(88, DAZED, 'smooth'),
    react(96, DAZED, SMASHED),
    K(102, KNEEL, 'smooth'),
    crash(108),
    K(150, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------
const BUILDERS: Record<string, () => { a: Clip; v: Clip }> = {
  tornado,
  headbutt,
  curls,
  palm,
  afro,
  cold,
  dreads,
  bbq,
  bouncer,
  boxer,
  micdrop,
  express,
  burpees,
  grove,
  handbag,
};
for (const [id, build] of Object.entries(BUILDERS)) {
  const c = build();
  registerUltimate(id, c.a, c.v);
}

/** Register any extra clip (e.g. an extra actor's clip `ult:<id>:<actorId>`). */
export function registerClip(name: string, c: Clip) {
  CLIPS[name] = c;
}

/**
 * Toolkit for the cinematic clips written in other files (src/render/ults/*):
 * the key/clip helpers and the shared poses above.
 */
export const kit = {
  P,
  K,
  clip,
  rot,
  spin,
  rewrap,
  shift,
  mirror,
  legDrop,
  plant,
  strike,
  react,
  boneX,
  crash,
  J,
  OPEN_LEGS,
  FLEX,
  CROSSED,
  SQUAT,
  LANDING,
  RISE,
  BELLY_WIND,
  BELLY_BUMP,
  SPLASH,
  FLAT,
  FLAT_BOUNCE,
  PUSH_UP,
  BACK_CHAMBER,
  BACK_KICK,
  DAZED,
  REEL,
  TWIST_L,
  TWIST_L2,
  TWIST_R,
  TWIST_R2,
  CHIN_UP,
  DOUBLE,
  FLY_BACK,
  FLY_BACK2,
  JACKKNIFE,
  SQUASHED,
  SQUASHED2,
  LYING_BOUNCE,
  SIT,
  HAMMER_UP,
  HAMMER_DOWN,
  SMASHED,
  KNEEL,
  WATCH_L,
  HAND_ON_HIP_L,
  HAND_ON_HIP_R,
  // from ./poses
  STANCE,
  CROUCH,
  AIR,
  LYING,
  HIT_HIGH,
  HIT_MID,
  HIT_LOW,
  ATTACKS,
};
