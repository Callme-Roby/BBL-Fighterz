import type { Clip, Key, Pose } from '../poses';
import { kit } from '../ultimatePoses';

/**
 * Clips of the BBL MAX cinematics of src/sim/ults/crew1.ts, keyed by full clip name:
 * `ult:<id>:a` (attacker), `ult:<id>:v` (victim), `ult:<id>:<actorId>` (extra actors).
 *
 *  baby     – Elies:  RETOUR EN ENFANCE (turns into Baby Elies, then one huge punch)
 *  feint    – Thomas: REGARDE DERRIÈRE TOI ! (victim turned away, kicks in the backside, runs off)
 *  kneecap  – Dylan:  JAMBES DE FEU (legs-only combo, then his knee gives way)
 *  saiyan   – Mihaï:  SUPER SAYAN BBL (transformation, shades, low blows)
 *  config   – Benji:  C'EST QUOI TA CONFIG ? (distraction, one giant uppercut)
 */

const {
  P,
  K,
  clip,
  rewrap,
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
  RISE,
  BACK_CHAMBER,
  BACK_KICK,
  DAZED,
  REEL,
  TWIST_L2,
  CHIN_UP,
  DOUBLE,
  FLY_BACK,
  FLY_BACK2,
  JACKKNIFE,
  LYING_BOUNCE,
  HAND_ON_HIP_L,
  HAND_ON_HIP_R,
  STANCE,
  CROUCH,
  AIR,
  LYING,
  HIT_HIGH,
  HIT_MID,
  HIT_LOW,
  ATTACKS,
} = kit;

/**
 * The same world pose seen from the other victim facing (`victimTurn`): the turned model is
 * the normal one mirrored front/back, i.e. a half turn of the left/right mirror image.
 * Two keys on the same frame (pose, then flipT(pose)) make the switch invisible.
 */
function flipT(p: Pose): Pose {
  const m = mirror(p);
  const h = m.hips ?? [0, 0, 0];
  const r = m.root ?? [0, 0, 0];
  return { ...m, hips: [-h[0], h[1] + 180, h[2]], root: [-r[0], r[1], -r[2]] };
}

/** both hands in the trouser pockets (relaxed, arrogant) */
const POCKETS: Pose = {
  upperArmL: [6, 6, 13],
  foreArmL: [-28, 0, 0],
  handL: [0, 0, 0],
  upperArmR: [6, -6, -13],
  foreArmR: [-28, 0, 0],
  handR: [0, 0, 0],
};
/** right hand flat over the eyes (scanning the horizon) */
const SHADE_EYES_R: Pose = { upperArmR: [-100, 29, 10], foreArmR: [-99, 0, 0], handR: [0, 0, 0] };
/** hands pressed on the backside (hips pitched back ~12°, spine ~-15°) */
const HANDS_ON_BUTT: Pose = { upperArmL: [30, -9, -10], foreArmL: [-18, 0, 0], handL: [0, 0, 0], upperArmR: [30, 9, 10], foreArmR: [-18, 0, 0], handR: [0, 0, 0] };
/** hands over the crotch (hips ~10°, spine ~30° forward) */
const HANDS_ON_CROTCH: Pose = { upperArmL: [-24, 0, -20], foreArmL: [-6, 0, 0], handL: [10, 0, 0], upperArmR: [-24, 0, 20], foreArmR: [-6, 0, 0], handR: [10, 0, 0] };
/** hands on the belly (laughing) */
const HANDS_ON_BELLY: Pose = { upperArmL: [-10, -60, 0], foreArmL: [-44, 0, 0], handL: [0, 0, 0], upperArmR: [-10, 60, 0], foreArmR: [-44, 0, 0], handR: [0, 0, 0] };
/** fist (right) pressed into the left palm in front of the chest */
const FIST_PALM: Pose = { upperArmL: [-45, -52, -11], foreArmL: [-58, 0, 0], handL: [0, 0, 0], upperArmR: [-31, 49, 0], foreArmR: [-74, 0, 0], handR: [0, 0, 0] };
/** finger on the lips ("chut"), right hand */
const HUSH_R: Pose = { upperArmR: [-77, 45, 23], foreArmR: [-110, 0, 0], handR: [0, 0, 0] };
/** hands up, palms out ("whoa, wait") */
const WHOA: Pose = { upperArmL: [-62, 0, 34], foreArmL: [-104, 0, 0], handL: [-40, 0, 0], upperArmR: [-62, 0, -34], foreArmR: [-104, 0, 0], handR: [-40, 0, 0] };
/** clapping the dust off the hands in front of the belly */
const DUST: Pose = { upperArmL: [-40, 0, 6], foreArmL: [-70, 0, 0], handL: [0, 0, 0], upperArmR: [-40, 0, -6], foreArmR: [-70, 0, 0], handR: [0, 0, 0] };
const DUST2: Pose = { upperArmL: [-46, 0, 2], foreArmL: [-60, 0, 0], handL: [0, 0, 0], upperArmR: [-34, 0, -10], foreArmR: [-80, 0, 0], handR: [0, 0, 0] };

/** alternates two poses every `step` frames over [from, to] (trembling, laughing, hopping) */
function alt(from: number, to: number, step: number, a: Pose, b: Pose, ease: Key['ease'] = 'smooth'): Key[] {
  const out: Key[] = [];
  for (let f = from, i = 0; f <= to; f += step, i++) out.push(K(f, i % 2 ? b : a, ease));
  return out;
}

/** victim on the floor, face down (in the frame where its local +Z points where the head goes) */
const PRONE: Pose = {
  root: [0, -0.84, 0.1],
  hips: [90, 0, 0],
  spine: [0, 0, 0],
  chest: [0, 0, 0],
  neck: [-10, 0, 0],
  head: [-16, 50, 0],
  upperArmL: [0, 0, 100],
  foreArmL: [0, 0, 40],
  handL: [0, 0, 0],
  upperArmR: [0, 0, -100],
  foreArmR: [0, 0, -40],
  handR: [0, 0, 0],
  thighL: [0, 0, 14],
  shinL: [10, 0, 0],
  footL: [40, 0, 0],
  thighR: [0, 0, -14],
  shinR: [10, 0, 0],
  footR: [40, 0, 0],
};

// ---------------------------------------------------------------------------
// Elies — RETOUR EN ENFANCE
// ---------------------------------------------------------------------------
function baby() {
  // "ultimate form" charge: horse stance, fists at the hips, head thrown back
  const charge = plant(
    P(STANCE, {
      root: [0, 0, 0],
      hips: [0, -8, 0],
      spine: [-6, 0, 0],
      chest: [-10, 0, 0],
      neck: [-8, 0, 0],
      head: [-18, 0, 0],
      upperArmL: [24, 0, 26],
      foreArmL: [-84, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [24, 0, -26],
      foreArmR: [-84, 0, 0],
      handR: [0, 0, 0],
      thighL: [-30, 0, 24],
      shinL: [56, 0, 0],
      footL: [-24, 0, 0],
      thighR: [-30, 0, -24],
      shinR: [56, 0, 0],
      footR: [-24, 0, 0],
    }),
  );
  const charge2 = P(charge, { chest: [-14, 4, 0], head: [-24, -4, 0], upperArmL: [27, 0, 30], upperArmR: [27, 0, -30] });

  // ---- Baby Elies (same clip on the toddler model): wide legs, belly out, looking up at the giant
  const toddler = plant(
    P(STANCE, {
      root: [0, 0, 0],
      hips: [-4, -6, 0],
      spine: [-10, 0, 0],
      chest: [-6, 0, 0],
      neck: [-8, 0, 0],
      head: [-22, 0, 0],
      upperArmL: [-36, 0, 38],
      foreArmL: [-50, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-36, 0, -38],
      foreArmR: [-50, 0, 0],
      handR: [0, 0, 0],
      thighL: [-8, 0, 14],
      shinL: [18, 0, 0],
      footL: [-10, 0, 0],
      thighR: [-8, 0, -14],
      shinR: [18, 0, 0],
      footR: [-10, 0, 0],
    }),
  );
  // "Areuh !": turned to the camera, bouncing, arms up, clapping
  const TO_CAM: Pose = { hips: [-4, -40, 0], spine: [-10, -10, 0], chest: [-6, -10, 0], neck: [-4, -6, 0], head: [18, -8, 0] };
  const gaga = plant(P(toddler, TO_CAM, { spine: [-14, -10, 0], head: [16, -8, 10], upperArmL: [-136, 0, 30], foreArmL: [-30, 0, 0], upperArmR: [-136, 0, -30], foreArmR: [-30, 0, 0] }), 0.05);
  const gaga2 = plant(P(toddler, TO_CAM, { head: [20, -8, -10], upperArmL: [-110, 0, 44], foreArmL: [-60, 0, 0], upperArmR: [-110, 0, -44], foreArmR: [-60, 0, 0] }));
  const clapOpen = plant(P(toddler, TO_CAM, { head: [18, -8, 6], upperArmL: [-74, 0, 34], foreArmL: [-26, 0, 0], upperArmR: [-74, 0, -34], foreArmR: [-26, 0, 0] }), 0.04);
  const clapShut = plant(P(toddler, TO_CAM, { head: [20, -8, -4], upperArmL: [-74, 0, -22], foreArmL: [-20, 0, 0], upperArmR: [-74, 0, 22], foreArmR: [-20, 0, 0] }));
  const lookUp = plant(P(toddler, { head: [-34, 0, 0], neck: [-12, 0, 0], upperArmL: [-10, 0, 20], foreArmL: [-30, 0, 0], upperArmR: [-10, 0, -20], foreArmR: [-30, 0, 0] }));
  const lookUp2 = P(lookUp, { head: [-34, 0, 14] });
  // angry: leaning in, fists clenched by the sides, glaring up
  const angry = plant(
    P(toddler, {
      hips: [4, -10, 0],
      spine: [16, 0, 0],
      chest: [6, 0, 0],
      neck: [0, 0, 0],
      head: [-28, 0, 0],
      upperArmL: [14, 0, 20],
      foreArmL: [-40, 0, 0],
      upperArmR: [14, 0, -20],
      foreArmR: [-40, 0, 0],
    }),
  );
  const angry2 = P(angry, { spine: [18, 0, -3], head: [-28, 0, 6], upperArmL: [18, 0, 24], upperArmR: [18, 0, -24] });
  // glaring half toward the camera (face close-up)
  const glare = P(angry, { neck: [0, -10, 0], head: [-14, -24, 0] });
  const glare2 = P(angry2, { neck: [0, -10, 0], head: [-14, -24, 6] });
  // waddling, rocking from one foot to the other
  const waddleL = plant(P(angry, { hips: [4, -10, 8], spine: [14, 0, -6], thighL: [-36, 0, 14], shinL: [40, 0, 0], thighR: [0, 0, -10], shinR: [8, 0, 0] }));
  const waddleR = plant(P(angry, { hips: [4, -10, -8], spine: [14, 0, 6], thighR: [-36, 0, -14], shinR: [40, 0, 0], thighL: [0, 0, 10], shinL: [8, 0, 0] }));
  // flurry of tiny fists on the knee
  const jabRWind = plant(P(angry, { hips: [2, -16, 0], spine: [10, 0, 0], head: [-26, 12, 0], upperArmR: [24, 0, -26], foreArmR: [-116, 0, 0], upperArmL: [-56, 0, 14], foreArmL: [-24, 0, 0] }));
  const jabR = plant(
    P(angry, {
      root: [0, 0, 0.04],
      hips: [4, 20, 0],
      spine: [16, 0, 0],
      chest: [6, 0, 0],
      neck: [-4, 0, 0],
      head: [-22, -16, 0],
      upperArmR: [-66, 0, 4],
      foreArmR: [-6, 0, 0],
      upperArmL: [16, 0, 28],
      foreArmL: [-104, 0, 0],
      thighL: [-26, 0, 12],
      shinL: [30, 0, 0],
      thighR: [6, 0, -12],
      shinR: [14, 0, 0],
    }),
  );
  const jabLWind = mirror(jabRWind);
  const jabL = mirror(jabR);
  // both little fists down on the knee
  const bothUp = plant(P(angry, { spine: [-16, 0, 0], head: [-30, 0, 0], upperArmL: [-170, 0, 10], foreArmL: [-30, 0, 0], upperArmR: [-170, 0, -10], foreArmR: [-30, 0, 0] }), 0.03);
  const bothDown = plant(
    P(angry, {
      root: [0, 0, 0.08],
      hips: [6, -4, 0],
      spine: [30, 0, 0],
      head: [-34, 0, 0],
      upperArmL: [-50, 0, 6],
      foreArmL: [-10, 0, 0],
      upperArmR: [-50, 0, -6],
      foreArmR: [-10, 0, 0],
      thighL: [-26, 0, 14],
      shinL: [30, 0, 0],
    }),
  );
  // the bull: head down, scraping the floor with the right foot
  const bull = plant(
    P(toddler, {
      hips: [16, 0, 0],
      spine: [16, 0, 0],
      chest: [6, 0, 0],
      neck: [-14, 0, 0],
      head: [-16, 0, 0],
      upperArmL: [30, 0, 30],
      foreArmL: [-30, 0, 0],
      upperArmR: [30, 0, -30],
      foreArmR: [-30, 0, 0],
      thighL: [-46, 0, 12],
      shinL: [56, 0, 0],
      thighR: [0, 0, -12],
      shinR: [20, 0, 0],
    }),
  );
  const bullScrape = plant(P(bull, { thighR: [34, 0, -12], shinR: [40, 0, 0], footR: [30, 0, 0] }));
  // charging, arms back like a little plane
  const runA = plant(
    P(toddler, {
      hips: [22, 0, 0],
      spine: [14, 0, 0],
      chest: [4, 0, 0],
      neck: [-10, 0, 0],
      head: [-12, 0, 0],
      upperArmL: [44, 0, 40],
      foreArmL: [-20, 0, 0],
      upperArmR: [44, 0, -40],
      foreArmR: [-20, 0, 0],
      thighL: [-70, 0, 10],
      shinL: [70, 0, 0],
      thighR: [6, 0, -10],
      shinR: [56, 0, 0],
    }),
    0.03,
  );
  const runB = plant(P(runA, { thighL: [6, 0, 10], shinL: [56, 0, 0], thighR: [-70, 0, -10], shinR: [70, 0, 0] }), 0.03);
  // headbutt: the top of the head into the knee
  const butt = plant(
    P(toddler, {
      root: [0, 0, 0.0],
      hips: [36, 0, 0],
      spine: [24, 0, 0],
      chest: [10, 0, 0],
      neck: [6, 0, 0],
      head: [14, 0, 0],
      upperArmL: [56, 0, 34],
      foreArmL: [-20, 0, 0],
      upperArmR: [56, 0, -34],
      foreArmR: [-20, 0, 0],
      thighL: [-72, 0, 10],
      shinL: [64, 0, 0],
      footL: [10, 0, 0],
      thighR: [-6, 0, -10],
      shinR: [40, 0, 0],
      footR: [20, 0, 0],
    }),
  );
  // bounced off, dizzy
  const dizzyA = plant(P(toddler, { root: [0, 0, -0.04], hips: [-8, 0, 8], spine: [-6, 0, 10], head: [-12, 0, 22], upperArmL: [-10, 0, 56], foreArmL: [-20, 0, 0], upperArmR: [-10, 0, -56], foreArmR: [-20, 0, 0] }));
  const dizzyB = plant(P(dizzyA, { hips: [-8, 0, -8], spine: [-6, 0, -10], head: [-12, 0, -22] }));
  // stiff-legged toe poke in the shin
  const kickRWind = plant(P(angry, { spine: [-6, 0, 0], thighR: [24, 0, -10], shinR: [40, 0, 0], upperArmL: [-20, 0, 70], upperArmR: [-20, 0, -70] }));
  const kickR = plant(
    P(angry, {
      root: [0, 0, 0.0],
      hips: [-10, 6, 0],
      spine: [-16, 0, 0],
      head: [-14, 0, 0],
      thighR: [-44, 0, -2],
      shinR: [18, 0, 0],
      footR: [-24, 0, 0],
      thighL: [-2, 0, 10],
      shinL: [10, 0, 0],
      upperArmL: [-30, 0, 80],
      foreArmL: [-20, 0, 0],
      upperArmR: [-30, 0, -80],
      foreArmR: [-20, 0, 0],
    }),
  );
  // victory dance: arms up, hopping, one knee up
  const victoryA = plant(P(toddler, TO_CAM, { spine: [-14, -10, 0], head: [14, -8, 0], upperArmL: [-150, 0, 22], foreArmL: [-10, 0, 0], upperArmR: [-150, 0, -22], foreArmR: [-10, 0, 0] }), 0.06);
  const victoryB = plant(P(toddler, TO_CAM, { spine: [-8, -10, 4], head: [18, -8, -8], upperArmL: [-130, 0, 44], foreArmL: [-40, 0, 0], upperArmR: [-130, 0, -44], foreArmR: [-40, 0, 0], thighL: [-50, 0, 14], shinL: [80, 0, 0] }));
  // tantrum: stomping, fists flailing
  const tantrumA = plant(
    P(toddler, {
      spine: [6, 0, 0],
      head: [-10, -10, 10],
      thighL: [-70, 0, 14],
      shinL: [90, 0, 0],
      thighR: [-4, 0, -12],
      shinR: [12, 0, 0],
      upperArmL: [-160, 0, 30],
      foreArmL: [-40, 0, 0],
      upperArmR: [-60, 0, -40],
      foreArmR: [-60, 0, 0],
    }),
  );
  const tantrumB = mirror(tantrumA);

  // ---- Elies is back: cracks his knuckles and his neck, then one huge punch
  const knuckles = plant(P(STANCE, OPEN_LEGS, FIST_PALM, { hips: [0, -24, 0], spine: [4, 0, 0], chest: [2, 0, 0], neck: [0, 0, 0], head: [4, 14, 0] }));
  const neckR = P(knuckles, { neck: [0, 0, 10], head: [6, 14, 16] });
  const neckL = P(knuckles, { neck: [0, 0, -10], head: [6, 14, -16] });
  const punchWind = plant(
    P(ATTACKS.powerPunch.windup, {
      root: [0, 0, -0.12],
      hips: [0, -80, 0],
      spine: [-4, -18, 0],
      chest: [-4, -10, 0],
      head: [-6, 44, 0],
      upperArmR: [14, 0, -62],
      foreArmR: [-112, 0, 0],
      upperArmL: [-72, 0, 30],
      foreArmL: [-30, 0, 0],
    }),
  );
  const punchWind2 = P(punchWind, { root: [punchWind.root![0], punchWind.root![1] - 0.02, -0.16], upperArmR: [24, 0, -64], spine: [-6, -22, 0] });
  const punch = plant(P(ATTACKS.powerPunch.strike, { root: [0, 0, 0.26], spine: [4, 15, 0], chest: [2, 18, 0], head: [-14, -30, 0], upperArmR: [-104, 0, 2], upperArmL: [-10, 0, 50], foreArmL: [-50, 0, 0] }));
  const recover = plant(P(STANCE, OPEN_LEGS, { hips: [0, -30, 0], spine: [-2, 0, 0], head: [-6, 10, 0], upperArmR: [-30, 0, -20], foreArmR: [-60, 0, 0] }));
  const dust = plant(P(STANCE, OPEN_LEGS, DUST, { hips: [0, -40, 0], head: [10, 10, 0] }));
  const dust2 = P(dust, DUST2);

  // a tiny jab every 6 frames: windup 3 frames before, fist out ON the hit frame
  const jab = (f: number, wind: Pose, hit: Pose): Key[] => [K(f - 3, wind, 'out'), K(f, hit, 'in'), K(f + 1, hit)];
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(8, STANCE, 'smooth'),
    K(12, charge, 'out'),
    ...alt(15, 29, 3, charge2, charge, 'linear'),
    K(31, charge2),
    // poof → Baby Elies: "Areuh ! Areuh !"
    K(32, toddler),
    K(35, gaga, 'out'),
    K(39, gaga2, 'smooth'),
    K(43, gaga, 'smooth'),
    K(47, gaga2, 'smooth'),
    K(51, clapOpen, 'smooth'),
    K(54, clapShut, 'in'),
    K(57, clapOpen, 'out'),
    K(60, clapShut, 'in'),
    K(66, toddler, 'smooth'),
    K(74, lookUp, 'smooth'),
    K(84, lookUp2, 'smooth'),
    K(94, lookUp, 'smooth'),
    // gets angry, waddles up to the knees
    K(99, angry, 'out'),
    ...alt(101, 105, 2, angry2, angry, 'linear'),
    K(107, waddleL, 'smooth'),
    K(110, waddleR, 'smooth'),
    K(113, waddleL, 'smooth'),
    K(116, waddleR, 'smooth'),
    K(118, angry, 'smooth'),
    ...jab(122, jabRWind, jabR),
    ...jab(128, jabLWind, jabL),
    ...jab(134, jabRWind, jabR),
    ...jab(140, jabLWind, jabL),
    K(142, bothUp, 'out'),
    K(146, bothDown, 'in'),
    K(149, bothDown),
    // furious close-up, backs up for a run-up
    K(152, glare, 'smooth'),
    ...alt(154, 158, 2, glare2, glare, 'linear'),
    K(160, waddleR, 'smooth'),
    K(163, waddleL, 'smooth'),
    K(166, angry, 'smooth'),
    K(169, bull, 'smooth'),
    K(171, bullScrape, 'smooth'),
    K(173, bull, 'smooth'),
    K(175, bullScrape, 'smooth'),
    K(177, runA, 'smooth'),
    K(180, runB, 'smooth'),
    K(183, runA, 'smooth'),
    K(186, butt, 'in'),
    K(187, butt),
    // bounced off, dizzy (stars)
    K(191, dizzyA, 'out'),
    K(194, dizzyB, 'smooth'),
    K(197, dizzyA, 'smooth'),
    // toe poke in the shin
    K(200, kickRWind, 'smooth'),
    K(204, kickR, 'in'),
    K(206, kickR),
    K(209, toddler, 'smooth'),
    // victory dance
    K(211, victoryA, 'out'),
    K(214, victoryB, 'smooth'),
    K(217, victoryA, 'smooth'),
    K(220, victoryB, 'smooth'),
    K(224, lookUp, 'smooth'),
    K(230, angry, 'smooth'),
    ...alt(232, 236, 2, angry2, angry, 'linear'),
    // tantrum, stomping backwards
    ...alt(239, 255, 4, tantrumA, tantrumB, 'smooth'),
    K(257, angry, 'smooth'),
    // poof → Elies
    K(258, knuckles),
    K(266, neckR, 'smooth'),
    K(274, neckL, 'smooth'),
    K(282, knuckles, 'smooth'),
    K(296, punchWind, 'smooth'),
    K(304, punchWind2, 'smooth'),
    K(308, punch, 'in'),
    K(314, punch),
    K(324, recover, 'smooth'),
    K(332, STANCE, 'smooth'),
    K(336, dust, 'smooth'),
    K(340, dust2, 'smooth'),
    K(344, dust, 'smooth'),
    K(348, dust2, 'smooth'),
    K(354, STANCE, 'smooth'),
    K(360, STANCE),
  );

  // ---- victim
  const wary = plant(P(STANCE, { hips: [0, -26, 0], head: [-2, 14, 0] }));
  const startled = plant(P(STANCE, OPEN_LEGS, { root: [0, 0, -0.06], hips: [-6, -20, 0], spine: [-10, 0, 0], neck: [10, 0, 0], head: [20, 6, 0], upperArmL: [-40, 0, 40], foreArmL: [-60, 0, 0], upperArmR: [-40, 0, -40], foreArmR: [-60, 0, 0] }));
  const lookDown = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -20, 0],
      spine: [8, 0, 0],
      chest: [6, 0, 0],
      neck: [16, 0, 0],
      head: [30, 8, 0],
      upperArmL: [-6, 0, 12],
      foreArmL: [-30, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-6, 0, -12],
      foreArmR: [-30, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const lookDown2 = P(lookDown, { head: [30, 8, 12] });
  // leaning over the baby, head tilted (seen in the face close-up)
  const peer = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [6, -24, 0],
      spine: [8, 0, 0],
      chest: [4, 0, 0],
      neck: [2, -4, 0],
      head: [6, -10, 16],
      upperArmL: [-16, 0, 10],
      foreArmL: [-36, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-16, 0, -10],
      foreArmR: [-36, 0, 0],
      handR: [0, 0, 0],
      thighL: [-16, 0, 12],
      shinL: [22, 0, 0],
      thighR: [-16, 0, -12],
      shinR: [22, 0, 0],
    }),
  );
  const peer2 = P(peer, { head: [8, -10, -14], neck: [4, -4, 0] });
  // hands on the hips, amused, looking down at the baby
  const hips = plant(P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, HAND_ON_HIP_R, { hips: [0, -20, 0], spine: [-4, 0, 0], chest: [-2, 0, 0], neck: [12, 0, 0], head: [22, 6, 0] }));
  const hipsFlinch = plant(P(hips, { head: [26, 6, 8], thighL: [-16, 0, 10], shinL: [30, 0, 0] }));
  const giggle = plant(P(hips, { spine: [-8, 0, 0], neck: [6, 0, 0], head: [10, 6, -6] }));
  // the knee jerks back a little (no pain, just surprise)
  const kneeJerk = plant(P(hips, { spine: [6, 0, 0], neck: [16, 0, 0], head: [28, 0, 10], thighL: [-8, 0, 10], shinL: [40, 0, 0], footL: [10, 0, 0] }));
  const shinFlinch = plant(P(hips, { spine: [4, 0, 0], head: [28, 0, -8], thighL: [-20, 0, 10], shinL: [44, 0, 0], footL: [10, 0, 0] }));
  const laugh = plant(P(STANCE, OPEN_LEGS, HANDS_ON_BELLY, { hips: [-6, -20, 0], spine: [-14, 0, 0], chest: [-8, 0, 0], neck: [-10, 0, 0], head: [-26, 0, 0] }));
  const laugh2 = plant(P(laugh, { spine: [-6, 0, 0], chest: [-4, 0, 0], head: [-12, 0, 8] }), -0.02);
  const laughPoint = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -20, 0],
      spine: [6, 0, 0],
      neck: [10, 0, 0],
      head: [16, 10, 6],
      upperArmR: [-52, 0, -6],
      foreArmR: [-6, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-10, -60, 0],
      foreArmL: [-44, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  const laughPoint2 = plant(P(laughPoint, { spine: [0, 0, 0], neck: [4, 0, 0], head: [6, 10, -6] }));
  const shock = plant(P(HIT_HIGH, WHOA, { root: [0, 0, -0.08], hips: [-8, -20, 0], spine: [-12, 0, 0], chest: [-6, 0, 0], neck: [-6, 0, 0], head: [-12, 0, 0] }));
  const fear = plant(P(shock, { thighL: [-22, 0, -2], shinL: [42, 0, 0], thighR: [-6, 0, 2], shinR: [40, 0, 0], head: [-4, 0, 0], neck: [0, 0, 0] }));
  const fear2 = plant(P(fear, { thighL: [-22, 0, 2], thighR: [-6, 0, -2], head: [-4, 4, 4], upperArmL: [-66, 0, 30], upperArmR: [-58, 0, -38] }));
  const launch = P(CHIN_UP, { root: [0, 0.02, -0.16], hips: [-24, -30, 0], neck: [-36, 0, 0], head: [-44, 0, 0], upperArmL: [-30, 0, 80], upperArmR: [-30, 0, -80] });
  const flurryV: Key[] = [];
  for (const f of [122, 128, 134, 140, 146]) flurryV.push(...react(f, hips, hipsFlinch), K(f + 3, hips, 'smooth'));
  const v = clip(
    K(0, HIT_MID),
    K(8, wary, 'smooth'),
    K(31, wary),
    K(35, startled, 'out'),
    K(44, lookDown, 'smooth'),
    K(54, lookDown2, 'smooth'),
    K(62, lookDown, 'smooth'),
    // "Hein ? C'est quoi ce bébé ?"
    K(68, peer, 'smooth'),
    K(80, peer2, 'smooth'),
    K(92, peer, 'smooth'),
    K(104, hips, 'smooth'),
    ...flurryV,
    // "Hi hi ! Ça chatouille !"
    ...alt(150, 166, 4, giggle, hips, 'smooth'),
    K(185, hips, 'smooth'),
    K(186, kneeJerk, 'out'),
    K(192, hips, 'smooth'),
    K(203, hips),
    K(204, shinFlinch, 'out'),
    K(209, hips, 'smooth'),
    // "Ha ha ha ! Trop mignon !"
    K(214, laugh, 'smooth'),
    ...alt(218, 234, 4, laugh2, laugh, 'smooth'),
    K(238, laughPoint, 'smooth'),
    ...alt(242, 254, 4, laughPoint2, laughPoint, 'smooth'),
    K(257, laughPoint),
    // poof → Elies
    K(261, shock, 'out'),
    K(268, fear, 'smooth'),
    ...alt(271, 304, 3, fear2, fear, 'linear'),
    K(307, fear),
    K(308, launch, 'out'),
    K(316, FLY_BACK, 'smooth'),
    K(328, FLY_BACK2, 'smooth'),
    crash(340),
    K(360, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Thomas — REGARDE DERRIÈRE TOI !
// ---------------------------------------------------------------------------
function feint() {
  // points far behind the victim, the other hand over the mouth ("Oh !")
  const point = plant(
    P(STANCE, OPEN_LEGS, {
      root: [0, 0, 0.02],
      hips: [0, -10, 0],
      spine: [6, 0, 0],
      chest: [4, 4, 0],
      neck: [-4, 0, 0],
      head: [-8, 8, 0],
      upperArmR: [-128, 0, -8],
      foreArmR: [-4, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-55, -19, -49],
      foreArmL: [-110, 0, 0],
      handL: [0, 0, 0],
    }),
    0.02,
  );
  const point2 = P(point, { upperArmR: [-138, 0, -8], chest: [2, 6, 0], head: [-10, 4, 4] });
  // evil grin, rubbing hands
  const rub = plant(P(STANCE, OPEN_LEGS, FIST_PALM, { hips: [0, -20, 0], spine: [14, 0, 0], chest: [6, 0, 0], neck: [-6, 0, 0], head: [-10, 16, 0] }));
  const rub2 = P(rub, { upperArmL: [-49, -52, -11], foreArmL: [-52, 0, 0], upperArmR: [-27, 49, 0], foreArmR: [-80, 0, 0], head: [-10, 10, 6] });
  // cartoon tiptoeing: knee high, toes pointed, hands dangling
  const sneakArms: Pose = { upperArmL: [-60, 0, 30], foreArmL: [-100, 0, 0], handL: [60, 0, 0], upperArmR: [-60, 0, -30], foreArmR: [-100, 0, 0], handR: [60, 0, 0] };
  const sneakA = plant(
    P(STANCE, sneakArms, {
      root: [0, 0, 0],
      hips: [10, -10, 0],
      spine: [20, 0, 0],
      chest: [6, 0, 0],
      neck: [-10, 0, 0],
      head: [-14, 0, 0],
      thighL: [-80, 0, 8],
      shinL: [110, 0, 0],
      footL: [30, 0, 0],
      thighR: [0, 0, -6],
      shinR: [30, 0, 0],
      footR: [20, 0, 0],
    }),
    0.04,
  );
  const sneakB = mirror(sneakA);
  const hushA = plant(P(sneakA, HUSH_R, { head: [-14, 20, 0] }), 0.04);
  const hushB = plant(P(sneakB, HUSH_R, { head: [-14, 20, 0] }), 0.04);
  // instep kick in the backside (right leg), then the left, then the right again
  const kickWind = plant(
    P(STANCE, {
      root: [0, 0, 0],
      hips: [0, -14, 0],
      spine: [8, 0, 0],
      head: [10, 0, 0],
      thighR: [36, 0, -6],
      shinR: [90, 0, 0],
      footR: [30, 0, 0],
      thighL: [-14, 0, 6],
      shinL: [24, 0, 0],
      upperArmL: [-60, 0, 40],
      foreArmL: [-40, 0, 0],
      upperArmR: [20, 0, -40],
      foreArmR: [-30, 0, 0],
    }),
  );
  const kick = plant(
    P(STANCE, {
      root: [0, 0, 0.06],
      hips: [-6, -10, 0],
      spine: [-10, 0, 0],
      chest: [-4, 0, 0],
      neck: [0, 0, 0],
      head: [12, 0, 0],
      thighR: [-92, 0, -6],
      shinR: [30, 0, 0],
      footR: [30, 0, 0],
      thighL: [-4, 0, 6],
      shinL: [14, 0, 0],
      footL: [-10, 0, 0],
      upperArmL: [-30, 0, 60],
      foreArmL: [-30, 0, 0],
      upperArmR: [-20, 0, -70],
      foreArmR: [-30, 0, 0],
    }),
  );
  const kickWindL = mirror(kickWind);
  const kickL = mirror(kick);
  const kick3 = P(kick, { thighR: [-96, 0, -6], spine: [-14, 0, 0], head: [16, 10, 0] });
  const ready = plant(P(STANCE, OPEN_LEGS, { hips: [0, -20, 0], spine: [14, 0, 0], head: [-6, 10, 0], upperArmL: [-50, 0, 30], foreArmL: [-90, 0, 0], upperArmR: [-50, 0, -30], foreArmR: [-90, 0, 0] }));
  // big run-up punt
  const puntWind = plant(
    P(STANCE, {
      root: [0, 0, -0.08],
      hips: [8, -20, 0],
      spine: [16, 0, 0],
      head: [16, 0, 0],
      thighR: [60, 0, -6],
      shinR: [100, 0, 0],
      footR: [30, 0, 0],
      thighL: [-30, 0, 6],
      shinL: [40, 0, 0],
      upperArmL: [-90, 0, 50],
      foreArmL: [-20, 0, 0],
      upperArmR: [40, 0, -50],
      foreArmR: [-20, 0, 0],
    }),
  );
  const puntWind2 = P(puntWind, { root: [0, puntWind.root![1] - 0.02, -0.14], thighR: [70, 0, -6], spine: [20, 0, 0] });
  const punt = plant(
    P(STANCE, {
      root: [0, 0, 0.12],
      hips: [-10, -6, 0],
      spine: [-12, 0, 0],
      chest: [-6, 0, 0],
      neck: [0, 0, 0],
      head: [14, 0, 0],
      thighR: [-92, 0, -6],
      shinR: [24, 0, 0],
      footR: [30, 0, 0],
      thighL: [4, 0, 6],
      shinL: [8, 0, 0],
      footL: [10, 0, 0],
      upperArmL: [40, 0, 50],
      foreArmL: [-20, 0, 0],
      upperArmR: [-110, 0, -40],
      foreArmR: [-20, 0, 0],
    }),
    0.02,
  );
  const puntFollow = plant(P(punt, { hips: [-18, -6, 0], spine: [-16, 0, 0], thighR: [-130, 0, -6], shinR: [6, 0, 0], head: [-6, 0, 0] }), 0.05);
  // admires the flight, hand over the eyes
  const watchFar = plant(P(STANCE, OPEN_LEGS, SHADE_EYES_R, HAND_ON_HIP_L, { hips: [0, -20, 0], spine: [-4, 0, 0], chest: [-2, 0, 0], head: [-8, 10, 0] }));
  const watchFar2 = P(watchFar, { head: [-6, 0, 0], hips: [0, -14, 0] });
  // runs away, back turned to the victim
  const runA = plant(
    P(STANCE, {
      hips: [0, 180, 0],
      spine: [22, 0, 0],
      chest: [4, 0, 0],
      neck: [-10, 0, 0],
      head: [-16, 0, 0],
      upperArmL: [50, 0, 10],
      foreArmL: [-90, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-70, 0, -10],
      foreArmR: [-90, 0, 0],
      handR: [0, 0, 0],
      thighL: [-80, 0, 6],
      shinL: [90, 0, 0],
      footL: [0, 0, 0],
      thighR: [40, 0, -6],
      shinR: [80, 0, 0],
      footR: [20, 0, 0],
    }),
    0.06,
  );
  const runB = P(mirror(runA), { hips: [0, 180, 0] });
  const skid = plant(
    P(STANCE, {
      hips: [-10, 180, 0],
      spine: [-16, 0, 0],
      chest: [-6, 0, 0],
      head: [-10, 0, 0],
      thighL: [-50, 0, 6],
      shinL: [10, 0, 0],
      footL: [-30, 0, 0],
      thighR: [10, 0, -6],
      shinR: [50, 0, 0],
      upperArmL: [-40, 0, 70],
      foreArmL: [-20, 0, 0],
      upperArmR: [-40, 0, -70],
      foreArmR: [-20, 0, 0],
    }),
  );
  // "Bye bye !" wave from the other end of the arena
  const wave = plant(P(STANCE, OPEN_LEGS, HAND_ON_HIP_L, { hips: [0, -20, 0], spine: [-4, 0, 0], chest: [-4, 0, 0], head: [-10, 10, 0], upperArmR: [-10, 0, -150], foreArmR: [0, 0, -24], handR: [0, 0, 0] }));
  const wave2 = P(wave, { foreArmR: [0, 0, 26], head: [-10, 10, 6] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(6, STANCE, 'smooth'),
    K(10, point, 'out'),
    ...alt(15, 50, 5, point2, point, 'smooth'),
    K(56, rub, 'smooth'),
    K(60, rub2, 'smooth'),
    K(64, rub, 'smooth'),
    K(70, hushA, 'smooth'),
    K(77, hushB, 'smooth'),
    K(84, sneakA, 'smooth'),
    K(90, sneakB, 'smooth'),
    strike(100, kickWind, kick, 5, 2),
    K(109, ready, 'smooth'),
    strike(116, kickWindL, kickL, 5, 2),
    K(125, ready, 'smooth'),
    strike(132, kickWind, kick3, 5, 2),
    K(141, ready, 'smooth'),
    K(150, puntWind, 'smooth'),
    K(154, puntWind2, 'smooth'),
    K(158, punt, 'in'),
    K(162, puntFollow, 'out'),
    K(168, puntFollow),
    K(176, watchFar, 'smooth'),
    K(188, watchFar2, 'smooth'),
    K(194, runA, 'smooth'),
    ...alt(199, 244, 5, runB, runA, 'linear'),
    K(252, skid, 'out'),
    rewrap(260, wave, 360, 'smooth'),
    ...alt(266, 302, 6, wave2, wave, 'smooth'),
    K(312, STANCE, 'smooth'),
    K(320, STANCE),
  );

  // ---- victim: faces Thomas until 42, then turned away (local +Z = away from Thomas) until 268
  const wary = plant(P(STANCE, { hips: [0, -26, 0], head: [-2, 14, 0] }));
  const lookBack = plant(P(STANCE, OPEN_LEGS, { hips: [0, -10, 0], spine: [0, 20, 0], chest: [0, 20, 0], neck: [0, 30, 0], head: [-6, 50, 0], upperArmL: [-30, 0, 20], foreArmL: [-90, 0, 0], upperArmR: [-30, 0, -20], foreArmR: [-90, 0, 0] }));
  const lookBack2 = P(lookBack, { head: [-10, 56, 6], neck: [0, 34, 0] });
  // (turned frame) scanning the horizon
  const search = plant(P(STANCE, OPEN_LEGS, SHADE_EYES_R, HAND_ON_HIP_L, { hips: [0, -10, 0], spine: [-4, 0, 0], chest: [-2, 0, 0], neck: [0, 0, 0], head: [-6, 0, 0] }));
  const searchR = P(search, { hips: [0, 4, 0], neck: [0, -12, 0], head: [-6, -30, 0] });
  const searchL = P(search, { hips: [0, -22, 0], neck: [0, 12, 0], head: [-6, 30, 0] });
  // kicked in the backside: pelvis thrown forward, back arched, hands on the bum, little jump
  const buttHit = plant(
    P(STANCE, HANDS_ON_BUTT, {
      root: [0, 0, 0.1],
      hips: [-14, -6, 0],
      spine: [-16, 0, 0],
      chest: [-8, 0, 0],
      neck: [-10, 0, 0],
      head: [-24, 0, 0],
      thighL: [-30, 0, 8],
      shinL: [40, 0, 0],
      thighR: [24, 0, -8],
      shinR: [70, 0, 0],
      footR: [30, 0, 0],
    }),
    0.06,
  );
  const buttHit2 = plant(P(mirror(buttHit), { head: [-30, 0, -8], spine: [-20, 0, 0] }), 0.08);
  const buttHit3 = plant(P(buttHit, { head: [-34, 0, 10], spine: [-22, 0, 0], hips: [-18, -6, 0] }), 0.1);
  const buttHitBig = plant(P(buttHit, { root: [0, 0, 0.16], hips: [-22, -6, 0], spine: [-26, 0, 0], neck: [-14, 0, 0], head: [-36, 0, 0], thighL: [10, 0, 8], shinL: [50, 0, 0], thighR: [30, 0, -8], shinR: [80, 0, 0] }), 0.04);
  const rubBum = plant(P(STANCE, OPEN_LEGS, HANDS_ON_BUTT, { root: [0, 0, 0.04], hips: [-6, -10, 0], spine: [-8, 0, 0], neck: [-4, 0, 0], head: [-10, 0, 0] }));
  const rubBum2 = P(rubBum, { hips: [-6, -10, 6], head: [-14, 0, 10], upperArmL: [36, -9, -14], upperArmR: [24, 9, 6] });
  // flung forward, then flat on the face
  const flung: Pose = {
    root: [0, 0.05, 0.15],
    hips: [30, 0, 0],
    spine: [-24, 0, 0],
    chest: [-10, 0, 0],
    neck: [-16, 0, 0],
    head: [-26, 0, 0],
    upperArmL: [40, 0, 60],
    foreArmL: [-20, 0, 0],
    handL: [0, 0, 0],
    upperArmR: [40, 0, -60],
    foreArmR: [-20, 0, 0],
    handR: [0, 0, 0],
    thighL: [30, 0, 10],
    shinL: [60, 0, 0],
    footL: [30, 0, 0],
    thighR: [20, 0, -10],
    shinR: [50, 0, 0],
    footR: [30, 0, 0],
  };
  const superman = P(flung, {
    root: [0, -0.1, 0.1],
    hips: [70, 0, 0],
    spine: [-12, 0, 0],
    head: [-30, 0, 0],
    upperArmL: [-160, 0, 30],
    foreArmL: [-10, 0, 0],
    upperArmR: [-160, 0, -30],
    foreArmR: [-10, 0, 0],
    thighL: [10, 0, 10],
    shinL: [30, 0, 0],
    thighR: [6, 0, -10],
    shinR: [44, 0, 0],
  });
  const proneBounce = P(PRONE, { root: [0, -0.76, 0.1], neck: [-20, 0, 0], head: [-24, 40, 0], thighL: [24, 0, 14], shinL: [40, 0, 0], thighR: [20, 0, -14], shinR: [50, 0, 0] });
  const proneTwitch = P(PRONE, { thighL: [30, 0, 14], shinL: [80, 0, 0], footL: [50, 0, 0] });
  const proneTwitch2 = P(PRONE, { thighR: [26, 0, -14], shinR: [90, 0, 0], footR: [50, 0, 0] });
  const proneUp = P(PRONE, { neck: [-26, 0, 0], head: [-20, 10, 0] });
  // (normal frame again) rolling over onto the back
  const onSide: Pose = P(flipT(PRONE), {
    root: [0, -0.74, -0.05],
    hips: [-90, 85, 0],
    upperArmL: [-90, 0, 0],
    foreArmL: [0, 0, 0],
    upperArmR: [-20, 0, -10],
    foreArmR: [-30, 0, 0],
    thighL: [-30, 0, 6],
    shinL: [40, 0, 0],
    thighR: [-20, 0, -6],
    shinR: [30, 0, 0],
  });
  const v = clip(
    K(0, HIT_MID),
    K(8, wary, 'smooth'),
    K(20, wary),
    K(27, lookBack, 'smooth'),
    K(34, lookBack2, 'smooth'),
    K(44, lookBack, 'smooth'),
    // turns around (normal frame → turned frame at 54)
    K(54, flipT(search), 'smooth'),
    K(54, search),
    K(66, searchR, 'smooth'),
    K(78, searchL, 'smooth'),
    K(90, searchR, 'smooth'),
    K(99, search, 'smooth'),
    K(100, buttHit, 'out'),
    K(108, rubBum, 'smooth'),
    K(112, rubBum2, 'smooth'),
    K(115, rubBum, 'smooth'),
    K(116, buttHit2, 'out'),
    K(124, rubBum2, 'smooth'),
    K(128, rubBum, 'smooth'),
    K(131, rubBum2, 'smooth'),
    K(132, buttHit3, 'out'),
    K(140, rubBum, 'smooth'),
    K(146, rubBum2, 'smooth'),
    K(152, rubBum, 'smooth'),
    K(157, rubBum),
    K(158, buttHitBig, 'out'),
    K(164, flung, 'smooth'),
    K(172, superman, 'smooth'),
    K(180, P(superman, { hips: [80, 0, 0] }), 'smooth'),
    K(186, PRONE, 'in'),
    K(190, proneBounce, 'out'),
    K(196, PRONE, 'in'),
    K(216, PRONE),
    K(220, proneTwitch, 'out'),
    K(226, PRONE, 'smooth'),
    K(232, proneTwitch2, 'out'),
    K(238, PRONE, 'smooth'),
    K(262, proneUp, 'smooth'),
    K(274, PRONE, 'smooth'),
    // back to the normal frame at 280, rolls over onto the back
    K(280, PRONE),
    K(280, flipT(PRONE)),
    K(288, onSide, 'smooth'),
    K(296, LYING, 'smooth'),
    K(300, LYING_BOUNCE, 'out'),
    K(306, LYING, 'in'),
    K(320, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Dylan — JAMBES DE FEU
// ---------------------------------------------------------------------------
function kneecap() {
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
      thighL: [-6, 0, 104],
      shinL: [8, 0, 0],
      footL: [10, 0, 0],
      thighR: [6, 0, -8],
      shinR: [10, 0, 0],
      footR: [-14, 0, 0],
    }),
  );
  const highWind = P(ATTACKS.roundhouse.windup, { thighR: [-50, 0, -50], shinR: [100, 0, 0] });
  const highKick = P(ATTACKS.roundhouse.strike, { root: [0, -0.02, 0.04], thighR: [-14, 0, -132] });
  // push kick (left sole in the stomach)
  const teepWind = plant(P(STANCE, { hips: [0, -20, 0], spine: [-4, 0, 0], thighL: [-95, 0, 6], shinL: [115, 0, 0], footL: [10, 0, 0], upperArmL: [-60, 0, 20], foreArmL: [-100, 0, 0] }));
  const teep = plant(
    P(STANCE, {
      root: [0, 0, 0.02],
      hips: [-8, -20, 0],
      spine: [-18, 0, 0],
      chest: [-8, 0, 0],
      head: [6, 6, 0],
      thighL: [-96, 0, 4],
      shinL: [4, 0, 0],
      footL: [-40, 0, 0],
      thighR: [8, 0, -6],
      shinR: [12, 0, 0],
      footR: [-14, 0, 0],
      upperArmL: [-30, 0, 50],
      foreArmL: [-60, 0, 0],
      upperArmR: [-30, 0, -50],
      foreArmR: [-60, 0, 0],
    }),
  );
  // jumping axe kick
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
    thighR: [-74, 0, -4],
    shinR: [4, 0, 0],
    footR: [-30, 0, 0],
    thighL: [30, 0, 8],
    shinL: [40, 0, 0],
    upperArmL: [30, 0, 40],
    upperArmR: [30, 0, -40],
  });
  const fallPose = P(AIR, { root: [0, 0, 0], spine: [10, 0, 0], thighL: [-40, 0, 10], shinL: [50, 0, 0], thighR: [-20, 0, -10], shinR: [40, 0, 0], upperArmL: [-30, 0, 60], upperArmR: [-30, 0, -60] });
  // proud flex... then the knee gives way
  const buckle = plant(
    P(STANCE, {
      root: [0, 0, 0],
      hips: [6, -14, 10],
      spine: [10, 0, -12],
      chest: [6, 0, -4],
      neck: [-10, 0, 6],
      head: [-26, 0, 10],
      thighR: [-24, 0, 4],
      shinR: [86, 0, 0],
      footR: [20, 0, 0],
      thighL: [-12, 0, 10],
      shinL: [20, 0, 0],
      upperArmL: [-40, 0, 70],
      foreArmL: [-30, 0, 0],
      upperArmR: [-20, 0, -60],
      foreArmR: [-30, 0, 0],
    }),
  );
  // hopping on the left leg, both hands around the raised right knee
  const holdKnee = (lift: number, extra: Pose = {}) =>
    plant(
      P(
        STANCE,
        {
          root: [0, 0, 0],
          hips: [0, -10, 0],
          spine: [45, 0, 0],
          chest: [10, 0, 0],
          neck: [-24, 0, 0],
          head: [-30, 0, 0],
          upperArmL: [-50, 0, -40],
          foreArmL: [-46, 0, 0],
          handL: [0, 0, 0],
          upperArmR: [-38, 6, 0],
          foreArmR: [-86, 0, 0],
          handR: [0, 0, 0],
          thighR: [-88, 0, -4],
          shinR: [95, 0, 0],
          footR: [20, 0, 0],
          thighL: [-6, 0, 4],
          shinL: [14, 0, 0],
          footL: [-10, 0, 0],
        },
        extra,
      ),
      lift,
    );
  const hopUp = holdKnee(0, { thighL: [4, 0, 4], shinL: [6, 0, 0], footL: [30, 0, 0], head: [-36, 0, 8] });
  const hopDown = holdKnee(0, { thighL: [-24, 0, 4], shinL: [46, 0, 0], footL: [-20, 0, 0], head: [-24, 0, -6], spine: [50, 0, 0] });
  // foot down, rubbing the knee, then the old man's hand on the lower back
  const limp = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [10, -20, 0],
      spine: [34, 0, 0],
      chest: [6, 0, 0],
      neck: [-16, 0, 0],
      head: [-20, 10, 0],
      upperArmR: [-40, 0, 7],
      foreArmR: [-6, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-36, 0, -6],
      foreArmL: [-20, 0, 0],
      handL: [0, 0, 0],
      thighR: [-24, 0, -10],
      shinR: [40, 0, 0],
    }),
  );
  const limp2 = P(limp, { upperArmR: [-46, 0, 7], upperArmL: [-42, 0, -6], head: [-14, 14, 4] });
  const oldMan = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [4, -30, 0],
      spine: [20, 0, 0],
      chest: [4, 0, 0],
      neck: [-10, 0, 0],
      head: [-12, 16, 0],
      upperArmR: [40, 67, -10],
      foreArmR: [-49, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-36, 0, 10],
      foreArmL: [-20, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  const oldMan2 = P(oldMan, { spine: [14, 0, 0], head: [-14, 16, 10], neck: [-8, 0, 6] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    strike(10, lowKickWind, lowKick, 5, 2),
    strike(22, midKickWind, midKick, 6, 2),
    strike(34, highWind, highKick, 6, 2),
    K(40, BACK_CHAMBER, 'smooth'),
    K(47, P(BACK_CHAMBER, { hips: [0, 150, 0] }), 'smooth'),
    K(50, BACK_KICK, 'in'),
    K(52, BACK_KICK),
    rewrap(58, teepWind, 360, 'smooth'),
    K(64, teep, 'in'),
    K(67, teep),
    K(72, RISE, 'out'),
    K(80, axeRaise, 'smooth'),
    K(88, axeRaise),
    K(92, axeDown, 'in'),
    K(94, axeDown),
    K(97, fallPose, 'smooth'),
    K(100, LANDING, 'in'),
    K(106, STANCE, 'smooth'),
    K(112, FLEX, 'out'),
    K(117, FLEX),
    K(118, buckle, 'out'),
    K(124, holdKnee(0), 'smooth'),
    // hops (ay bounces every 8 frames from 126 to 190): legs push on the way up
    ...alt(128, 188, 4, hopUp, hopDown, 'smooth'),
    K(196, limp, 'smooth'),
    ...alt(202, 232, 6, limp2, limp, 'smooth'),
    K(244, oldMan, 'smooth'),
    K(254, oldMan2, 'smooth'),
    K(264, oldMan, 'smooth'),
    K(280, STANCE, 'smooth'),
    K(290, STANCE),
  );
  const legHit = P(HIT_LOW, { thighL: [10, 0, 2], shinL: [40, 0, 0], hips: [0, -40, 0], spine: [18, 0, 0] });
  const bodyHit = P(HIT_MID, { root: [0, -0.1, -0.06], spine: [24, 10, 14], chest: [16, 0, 8], head: [10, 0, 10] });
  const launch = P(J.a, { hips: [-14, -20, 0], spine: [34, 0, 0], chest: [20, 0, 0], head: [20, 0, 0] });
  const peek = P(LYING, { neck: [30, 0, 0], head: [30, -10, 0] });
  const v = clip(
    K(0, HIT_MID),
    K(5, STANCE, 'smooth'),
    react(10, STANCE, legHit),
    K(16, REEL, 'smooth'),
    react(22, REEL, bodyHit),
    K(28, REEL, 'smooth'),
    react(34, REEL, TWIST_L2),
    K(42, REEL, 'smooth'),
    react(50, REEL, DOUBLE),
    K(58, P(DOUBLE, { spine: [30, 0, 0], head: [10, 0, 0] }), 'smooth'),
    K(63, DOUBLE),
    K(64, launch, 'out'),
    K(74, J.b, 'smooth'),
    K(84, J.c, 'smooth'),
    K(91, J.c),
    K(92, JACKKNIFE, 'out'),
    crash(98),
    K(140, LYING),
    K(150, peek, 'smooth'),
    K(186, peek),
    K(200, LYING, 'smooth'),
    K(290, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Mihaï — SUPER SAYAN BBL
// ---------------------------------------------------------------------------
function saiyan() {
  const powerCrouch = plant(
    P(STANCE, {
      root: [0, 0, 0],
      hips: [0, -6, 0],
      spine: [-8, 0, 0],
      chest: [-14, 0, 0],
      neck: [-14, 0, 0],
      head: [-26, 0, 0],
      upperArmL: [18, 0, 30],
      foreArmL: [-70, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [18, 0, -30],
      foreArmR: [-70, 0, 0],
      handR: [0, 0, 0],
      thighL: [-36, 0, 28],
      shinL: [64, 0, 0],
      footL: [-24, 0, 0],
      thighR: [-36, 0, -28],
      shinR: [64, 0, 0],
      footR: [-24, 0, 0],
    }),
  );
  const powerCrouch2 = P(powerCrouch, { chest: [-18, 3, 0], head: [-32, -3, 0], upperArmL: [20, 0, 34], upperArmR: [20, 0, -34] });
  // transformed: roaring, arms spread
  const roar = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -10, 0],
      spine: [-10, 0, 0],
      chest: [-16, 0, 0],
      neck: [-10, 0, 0],
      head: [-24, 0, 0],
      upperArmL: [-10, 0, 55],
      foreArmL: [-40, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-10, 0, -55],
      foreArmR: [-40, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const roar2 = P(roar, { chest: [-18, 2, 0], upperArmL: [-12, 0, 60], upperArmR: [-12, 0, -60], head: [-28, 0, 0] });
  const calm = plant(P(STANCE, OPEN_LEGS, { hips: [0, -26, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [4, 0, 0], head: [10, 10, 0], upperArmL: [4, 0, 12], foreArmL: [-20, 0, 0], upperArmR: [4, 0, -12], foreArmR: [-20, 0, 0] }));
  // putting the shades on (right hand at the temple)
  const SHADES_R: Pose = { upperArmR: [-91, 47, -23], foreArmR: [-128, 0, 0], handR: [-20, 0, 0] };
  const shadesOn = plant(P(calm, SHADES_R, { head: [6, 12, 0] }));
  const shadesOn2 = P(shadesOn, { head: [-6, 12, 0], upperArmR: [-95, 47, -23] });
  // cool: left hand in the pocket, pointing at the victim
  const cool = plant(
    P(STANCE, OPEN_LEGS, POCKETS, {
      hips: [0, -40, 0],
      spine: [-4, 0, 0],
      chest: [-4, 0, 0],
      neck: [-4, 0, 0],
      head: [-12, 30, 6],
      upperArmR: [-88, 30, -4],
      foreArmR: [-4, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const cool2 = P(cool, { head: [-14, 30, -4], upperArmR: [-92, 30, -4] });
  // low blows, hands in the pockets, eyes on the target
  const casual = plant(P(STANCE, OPEN_LEGS, POCKETS, { hips: [0, -20, 0], spine: [-4, 0, 0], chest: [-4, 0, 0], neck: [0, 0, 0], head: [-2, 14, 0] }));
  const casual2 = P(casual, { head: [0, 18, 6] });
  const stride = plant(P(casual, { thighL: [-34, 0, 8], shinL: [30, 0, 0], footL: [-6, 0, 0], thighR: [16, 0, -8], shinR: [26, 0, 0], footR: [-24, 0, 0] }));
  const lowChamber = plant(P(casual, { hips: [0, -6, 0], thighR: [-40, 0, 2], shinR: [96, 0, 0], footR: [30, 0, 0], thighL: [-6, 0, 8], shinL: [14, 0, 0], footL: [-6, 0, 0] }));
  // the instep swings up between the legs, right into the crotch
  const lowBlow = plant(
    P(casual, {
      root: [0, 0, 0.04],
      hips: [-6, 2, 0],
      spine: [-10, 0, 0],
      head: [4, 6, 0],
      thighR: [-86, 0, 6],
      shinR: [8, 0, 0],
      footR: [30, 0, 0],
      thighL: [-4, 0, 8],
      shinL: [12, 0, 0],
      footL: [-6, 0, 0],
    }),
    0.02,
  );
  const lowBlow2 = P(lowBlow, { head: [4, 2, 6] });
  // a look at the camera over the shades, then a shrug: "Quoi ? Ça marche."
  const lookCam = plant(P(STANCE, OPEN_LEGS, POCKETS, SHADES_R, { hips: [0, -36, 0], spine: [-4, -6, 0], chest: [-4, -4, 0], neck: [-4, -8, 0], head: [-8, -16, 4] }));
  const lookCam2 = P(lookCam, { head: [-4, -16, -4], upperArmR: [-88, 47, -23] });
  const shrug = plant(
    P(lookCam, {
      shoulderL: [0, 0, 10],
      shoulderR: [0, 0, -10],
      upperArmL: [-14, -20, 36],
      foreArmL: [-84, 0, 0],
      handL: [-40, 0, 0],
      upperArmR: [-14, 20, -36],
      foreArmR: [-84, 0, 0],
      handR: [-40, 0, 0],
      head: [-10, -18, 10],
    }),
  );
  const shrug2 = P(shrug, { shoulderL: [0, 0, 4], shoulderR: [0, 0, -4], head: [-6, -18, -6] });
  // the big one: hands out of the pockets, leg swung back, then up into the crotch
  const bigWind = plant(
    P(STANCE, {
      root: [0, 0, -0.08],
      hips: [6, -6, 0],
      spine: [12, 0, 0],
      head: [6, 6, 0],
      thighR: [50, 0, -6],
      shinR: [90, 0, 0],
      footR: [30, 0, 0],
      thighL: [-30, 0, 6],
      shinL: [40, 0, 0],
      upperArmL: [-80, 0, 50],
      foreArmL: [-20, 0, 0],
      upperArmR: [30, 0, -50],
      foreArmR: [-20, 0, 0],
    }),
  );
  const bigWind2 = P(bigWind, { root: [0, bigWind.root![1] - 0.02, -0.12], thighR: [60, 0, -6] });
  const bigKick = plant(
    P(STANCE, {
      root: [0, 0, 0.0],
      hips: [-8, 4, 0],
      spine: [-12, 0, 0],
      chest: [-6, 0, 0],
      head: [6, 4, 0],
      thighR: [-84, 0, 6],
      shinR: [6, 0, 0],
      footR: [30, 0, 0],
      thighL: [2, 0, 6],
      shinL: [10, 0, 0],
      footL: [10, 0, 0],
      upperArmL: [30, 0, 60],
      foreArmL: [-20, 0, 0],
      upperArmR: [-60, 0, -60],
      foreArmR: [-20, 0, 0],
    }),
    0.03,
  );
  // follow-through: the victim is lifted on the instep
  const bigFollow = plant(P(bigKick, { hips: [-14, 4, 0], spine: [-14, 0, 0], thighR: [-88, 0, 6], shinR: [6, 0, 0], head: [-4, 0, 0] }), 0.05);
  const adjust = plant(P(STANCE, OPEN_LEGS, SHADES_R, { hips: [0, -40, 0], spine: [-4, 0, 0], head: [-10, 20, 0], upperArmL: [6, 6, 13], foreArmL: [-28, 0, 0] }));
  const cross = plant(P(CROSSED, { head: [-18, 24, 0] }));
  const cross2 = P(cross, { head: [-14, 18, 4] });
  const slow = [150, 162, 174];
  const fast = [236, 244, 251, 257, 263, 269];
  const FIN = 290;
  const kicksA: Key[] = [];
  for (const f of slow) kicksA.push(K(f - 5, lowChamber, 'out'), K(f, lowBlow, 'in'), K(f + 2, lowBlow), K(f + 5, casual, 'smooth'));
  for (const [i, f] of fast.entries()) kicksA.push(K(f - 3, lowChamber, 'out'), K(f, i % 2 ? lowBlow2 : lowBlow, 'in'), K(f + 1, i % 2 ? lowBlow2 : lowBlow));
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(8, STANCE, 'smooth'),
    K(14, powerCrouch, 'out'),
    ...alt(18, 56, 3, powerCrouch2, powerCrouch, 'linear'),
    K(58, powerCrouch2),
    // transformation (swap at 60)
    K(62, roar, 'out'),
    ...alt(66, 90, 4, roar2, roar, 'linear'),
    K(98, calm, 'smooth'),
    K(104, shadesOn, 'smooth'),
    K(110, shadesOn2, 'smooth'),
    K(113, shadesOn2),
    K(120, cool, 'smooth'),
    K(128, cool2, 'smooth'),
    K(134, cool, 'smooth'),
    K(140, stride, 'smooth'),
    ...kicksA.slice(0, 12),
    K(186, casual2, 'smooth'),
    K(194, casual, 'smooth'),
    // look at the camera over the shades, shrug
    K(200, lookCam, 'smooth'),
    K(204, lookCam2, 'smooth'),
    K(210, shrug, 'smooth'),
    K(216, shrug2, 'smooth'),
    K(220, lookCam2, 'smooth'),
    K(224, lookCam, 'smooth'),
    K(229, casual, 'smooth'),
    ...kicksA.slice(12),
    K(273, casual, 'smooth'),
    // the last one
    K(280, bigWind, 'smooth'),
    K(286, bigWind2, 'smooth'),
    K(FIN, bigKick, 'in'),
    K(FIN + 4, bigFollow, 'out'),
    K(FIN + 9, bigFollow),
    K(FIN + 18, casual, 'smooth'),
    K(322, casual),
    K(330, adjust, 'smooth'),
    K(336, adjust),
    K(344, cross, 'smooth'),
    K(352, cross2, 'smooth'),
    K(360, STANCE, 'smooth'),
  );

  // ---- victim
  const groggy = plant(P(DAZED, OPEN_LEGS, { hips: [0, -20, 0], head: [6, -6, 8] }));
  const amazed = plant(P(STANCE, OPEN_LEGS, WHOA, { root: [0, 0, -0.04], hips: [-6, -20, 0], spine: [-10, 0, 0], chest: [-6, 0, 0], neck: [-6, 0, 0], head: [-14, 0, 0] }));
  const amazed2 = plant(P(amazed, { thighL: [-14, 0, 8], shinL: [30, 0, 0], thighR: [-14, 0, -8], shinR: [30, 0, 0], head: [-10, 0, 4] }));
  const watch = plant(P(STANCE, OPEN_LEGS, { hips: [0, -20, 0], spine: [4, 0, 0], head: [0, 10, 8], upperArmL: [-40, 0, 20], foreArmL: [-90, 0, 0], upperArmR: [-40, 0, -20], foreArmR: [-90, 0, 0] }));
  // ON the hit frame: jolted onto the toes, legs apart (the instep is between them),
  // arms flung out, face up; bent a little more every time (n = 0..8)
  const jolt = (n: number) =>
    plant(
      P(STANCE, {
        root: [0, 0, -0.02],
        hips: [-4, -8, 0],
        spine: [-6 + 3 * n, 0, 0],
        chest: [-4 + 2 * n, 0, 0],
        neck: [-10 - n, 0, 0],
        head: [-20 - n, 0, n % 2 ? 8 : -8],
        upperArmL: [n % 2 ? -100 : -40, 0, 64],
        foreArmL: [-30, 0, 0],
        handL: [-20, 0, 0],
        upperArmR: [n % 2 ? -40 : -100, 0, -64],
        foreArmR: [-30, 0, 0],
        handR: [-20, 0, 0],
        thighL: [-6, 0, 11],
        shinL: [12, 0, 0],
        footL: [40, 0, 0],
        thighR: [-6, 0, -11],
        shinR: [12, 0, 0],
        footR: [40, 0, 0],
      }),
      0.06,
    );
  // folded over, knees pinched together, both hands on the crotch, face up (n = 0..8)
  const fold = (n: number) =>
    plant(
      P(STANCE, HANDS_ON_CROTCH, {
        root: [0, 0, -0.03 - 0.006 * n],
        hips: [8 + 2 * n, -10, 0],
        spine: [10 + 4 * n, 0, 0],
        chest: [6 + 2 * n, 0, 0],
        neck: [-12 - n, 0, 0],
        head: [-12, 0, n % 2 ? 10 : -10],
        thighL: [-14 - 2 * n, 0, -4],
        shinL: [28 + 4 * n, 0, 0],
        footL: [-8, 0, 0],
        thighR: [-14 - 2 * n, 0, 4],
        shinR: [28 + 4 * n, 0, 0],
        footR: [-8, 0, 0],
      }),
    );
  // legs crossed, hopping from one foot to the other
  const crossLegs = (n: number) =>
    plant(
      P(fold(n), {
        hips: [8 + 2 * n, -10, 6],
        thighL: [-24 - 2 * n, 0, -14],
        shinL: [40 + 4 * n, 0, 0],
        thighR: [-8 - 2 * n, 0, 6],
        shinR: [20 + 3 * n, 0, 0],
      }),
    );
  const crossLegs2 = (n: number) => plant(P(crossLegs(n), { hips: [8 + 2 * n, -10, -6], thighL: [-10 - 2 * n, 0, -6], shinL: [22 + 3 * n, 0, 0], thighR: [-26 - 2 * n, 0, 14], shinR: [42 + 4 * n, 0, 0] }));
  const vk: Key[] = [];
  for (const [i, f] of [...slow, ...fast].entries()) vk.push(K(f - 1, i ? (i % 2 ? crossLegs(i - 1) : fold(i - 1)) : watch), K(f, jolt(i), 'out'), K(f + 3, fold(i), 'smooth'));
  // the last one: lifted on the instep, drops to its knees, falls face first
  const joltBig = plant(
    P(jolt(8), {
      spine: [-10, 0, 0],
      chest: [-8, 0, 0],
      neck: [-20, 0, 0],
      head: [-30, 0, 0],
      upperArmL: [-160, 0, 30],
      upperArmR: [-160, 0, -30],
    }),
    0.08,
  );
  const lifted = plant(
    P(STANCE, HANDS_ON_CROTCH, {
      root: [0, 0, -0.04],
      hips: [4, -10, 0],
      spine: [14, 0, 0],
      chest: [8, 0, 0],
      neck: [-20, 0, 0],
      head: [-28, 0, 0],
      thighL: [-8, 0, -3],
      shinL: [18, 0, 0],
      footL: [50, 0, 0],
      thighR: [-8, 0, 3],
      shinR: [18, 0, 0],
      footR: [50, 0, 0],
    }),
    0.08,
  );
  const KNEES: Pose = { thighL: [-10, 0, 8], shinL: [100, 0, 0], footL: [40, 0, 0], thighR: [-10, 0, -8], shinR: [100, 0, 0], footR: [40, 0, 0] };
  const kneelUp = P(STANCE, HANDS_ON_CROTCH, KNEES, { root: [0, -0.5, 0], hips: [0, -10, 0], spine: [8, 0, 0], chest: [4, 0, 0], neck: [-16, 0, 0], head: [-26, 0, 0] });
  const kneelUp2 = P(kneelUp, { spine: [12, 0, 4], neck: [-10, 0, 0], head: [-20, 0, 10] });
  // sits down hard on the floor, knees up, still holding it
  const sitHold = P(STANCE, HANDS_ON_CROTCH, {
    root: [0, -0.8, -0.2],
    hips: [-30, -10, 0],
    spine: [30, 0, 0],
    chest: [14, 0, 0],
    neck: [-10, 0, 0],
    head: [-24, 0, 0],
    thighL: [-100, 0, 6],
    shinL: [152, 0, 0],
    footL: [-20, 0, 0],
    thighR: [-100, 0, -6],
    shinR: [152, 0, 0],
    footR: [-20, 0, 0],
  });
  // flat on the back, knees pulled up, rocking from side to side (stars)
  const backCurl = P(LYING, HANDS_ON_CROTCH, {
    neck: [24, 0, 0],
    head: [10, -20, 0],
    thighL: [-96, 0, 8],
    shinL: [116, 0, 0],
    footL: [10, 0, 0],
    thighR: [-96, 0, -8],
    shinR: [116, 0, 0],
    footR: [10, 0, 0],
  });
  const backCurlBounce = P(backCurl, { root: [0, -0.82, -0.05], neck: [30, 0, 0] });
  const backRock = P(backCurl, { hips: [-90, -34, 0], head: [10, -36, 0] });
  const backRock2 = P(backCurl, { hips: [-90, 12, 0], head: [10, -6, 0] });
  const v = clip(
    K(0, HIT_MID),
    K(8, groggy, 'smooth'),
    K(20, groggy),
    K(28, amazed, 'smooth'),
    ...alt(32, 58, 4, amazed2, amazed, 'linear'),
    K(62, plant(P(amazed, { root: [0, 0, -0.12], head: [-20, 0, 0], thighL: [-30, 0, 8], shinL: [50, 0, 0], thighR: [-10, 0, -8], shinR: [40, 0, 0] })), 'out'),
    K(76, amazed2, 'smooth'),
    K(96, watch, 'smooth'),
    K(126, watch),
    K(132, P(watch, { head: [-6, 14, -6] }), 'smooth'),
    K(140, watch, 'smooth'),
    ...vk.slice(0, 9),
    // hopping around, legs crossed: "Pas là !!!"
    K(182, crossLegs(2), 'smooth'),
    K(184, crossLegs2(2), 'smooth'),
    K(189, crossLegs(2), 'smooth'),
    K(194, crossLegs2(2), 'smooth'),
    K(200, fold(2), 'smooth'),
    K(212, crossLegs(2), 'smooth'),
    K(222, fold(2), 'smooth'),
    // "Encore ?!": straightens up, terrified
    K(230, P(watch, { root: [0, 0, -0.04], neck: [-10, 0, 0], head: [-12, 0, 0] }), 'smooth'),
    ...vk.slice(9),
    K(FIN - 1, fold(8)),
    K(FIN, joltBig, 'out'),
    K(FIN + 5, lifted, 'smooth'),
    K(FIN + 10, lifted),
    K(FIN + 15, P(lifted, { thighL: [-20, 0, -3], shinL: [50, 0, 0], thighR: [-20, 0, 3], shinR: [50, 0, 0] }), 'smooth'),
    // knees on the floor
    K(306, kneelUp, 'in'),
    K(309, kneelUp2, 'out'),
    K(313, kneelUp, 'smooth'),
    // sits down, then falls on its back
    K(318, sitHold, 'smooth'),
    K(322, backCurl, 'in'),
    K(325, backCurlBounce, 'out'),
    K(328, backCurl, 'in'),
    ...alt(333, 345, 6, backRock, backRock2, 'smooth'),
    K(352, LYING, 'smooth'),
    K(360, LYING),
  );
  return { a, v };
}

// ---------------------------------------------------------------------------
// Benji — C'EST QUOI TA CONFIG ?
// ---------------------------------------------------------------------------
function config() {
  const chill = plant(P(STANCE, OPEN_LEGS, POCKETS, { hips: [0, -26, 0], spine: [-2, 0, 0], chest: [-2, 0, 0], neck: [0, 0, 0], head: [-4, 12, 6] }));
  const chill2 = P(chill, { head: [-6, 14, -2], hips: [0, -24, 2] });
  // "c'est quoi ta config ?": right hand out, palm up
  const ask = plant(P(chill, { head: [-2, 16, 10], upperArmR: [-40, 0, -24], foreArmR: [-70, 0, 0], handR: [0, 0, 0] }));
  const ask2 = P(ask, { head: [-4, 16, 4], foreArmR: [-80, 0, 0] });
  const nod = P(chill, { head: [10, 12, 4] });
  const nod2 = P(chill, { head: [-4, 12, 4] });
  // sinking slowly into an uppercut crouch, still nodding along
  const sink = plant(P(CROUCH, { hips: [0, -40, 0], spine: [18, -10, 0], chest: [10, 0, 0], head: [-16, 16, 0], upperArmR: [-10, 0, -30], foreArmR: [-110, 0, 0], upperArmL: [-62, 0, 16], foreArmL: [-112, 0, 0] }));
  const sink2 = P(sink, { head: [-6, 16, 0] });
  const sinkDeep = plant(
    P(sink, {
      root: [0, 0, -0.04],
      hips: [0, -60, 0],
      spine: [26, -16, 0],
      upperArmR: [20, 0, -30],
      foreArmR: [-120, 0, 0],
      thighL: [-92, 0, 10],
      shinL: [125, 0, 0],
      thighR: [-30, 0, -10],
      shinR: [125, 0, 0],
    }),
  );
  const uppercut = plant(
    P(ATTACKS.uppercut.strike, {
      root: [0, 0, 0.2],
      hips: [0, 24, 0],
      spine: [2, 14, 0],
      chest: [-4, 12, 0],
      head: [-20, -20, 0],
      upperArmR: [-50, 0, -10],
      foreArmR: [-104, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const shoryu = P(AIR, {
    root: [0, 0, 0.05],
    hips: [0, 30, 0],
    spine: [-10, 10, 0],
    chest: [-10, 10, 0],
    head: [-30, -10, 0],
    upperArmR: [-178, 0, -4],
    foreArmR: [-10, 0, 0],
    handR: [0, 0, 0],
    upperArmL: [-30, 0, 30],
    foreArmL: [-100, 0, 0],
    thighL: [-80, 0, 8],
    shinL: [100, 0, 0],
    thighR: [-10, 0, -8],
    shinR: [40, 0, 0],
  });
  // brushes his hair back, then the hands go back into the pockets
  const brush = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -40, 6],
      spine: [-6, 0, -6],
      chest: [-6, 0, 0],
      head: [-14, 10, -8],
      upperArmL: [-149, -59, 20],
      foreArmL: [-72, 0, 0],
      upperArmR: [-149, 59, -20],
      foreArmR: [-72, 0, 0],
      handL: [0, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const brush2 = P(brush, { hips: [0, -36, -6], spine: [-6, 0, 6], head: [-14, 14, 8], upperArmL: [-139, -59, 26], upperArmR: [-158, 59, -14] });
  const a = clip(
    K(0, ATTACKS.super.strike),
    K(8, STANCE, 'smooth'),
    K(14, chill, 'smooth'),
    K(22, ask, 'smooth'),
    K(32, ask2, 'smooth'),
    K(42, ask, 'smooth'),
    K(52, ask2, 'smooth'),
    K(62, ask, 'smooth'),
    K(74, chill, 'smooth'),
    K(84, chill2, 'smooth'),
    K(94, chill, 'smooth'),
    ...alt(104, 136, 8, nod, nod2, 'smooth'),
    K(146, sink, 'smooth'),
    K(154, sink2, 'smooth'),
    K(162, sinkDeep, 'smooth'),
    K(166, P(sinkDeep, { root: [0, sinkDeep.root![1], -0.07], spine: [30, -18, 0] }), 'smooth'),
    K(170, uppercut, 'in'),
    K(174, shoryu, 'out'),
    K(188, shoryu),
    K(194, LANDING, 'in'),
    K(202, STANCE, 'smooth'),
    K(208, brush, 'smooth'),
    K(213, brush2, 'smooth'),
    K(218, brush, 'smooth'),
    K(223, brush2, 'smooth'),
    K(230, chill, 'smooth'),
    K(240, chill2, 'smooth'),
    K(250, chill, 'smooth'),
    K(264, STANCE, 'smooth'),
    K(280, STANCE),
  );
  // ---- victim: guard, surprise, thinks, then answers counting on the fingers
  const guard = plant(P(STANCE, { hips: [0, -26, 0], head: [-2, 10, 0] }));
  const surprised = plant(
    P(STANCE, OPEN_LEGS, {
      root: [0, 0, -0.04],
      hips: [-6, -20, 0],
      spine: [-10, 0, 0],
      chest: [-6, 0, 0],
      neck: [-6, 0, 0],
      head: [-14, 0, 0],
      upperArmL: [-30, 0, 40],
      foreArmL: [-60, 0, 0],
      upperArmR: [-30, 0, -40],
      foreArmR: [-60, 0, 0],
    }),
  );
  const think = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -20, 0],
      spine: [-2, 0, 0],
      chest: [0, 0, 0],
      neck: [-6, 0, 0],
      head: [-20, -20, 0],
      upperArmR: [-68, 45, 25],
      foreArmR: [-116, 0, 0],
      handR: [0, 0, 0],
      upperArmL: [-70, -57, -40],
      foreArmL: [-64, 0, 0],
      handL: [0, 0, 0],
    }),
  );
  const think2 = P(think, { head: [-24, -26, 6] });
  const count = plant(
    P(STANCE, OPEN_LEGS, {
      hips: [0, -20, 0],
      spine: [-4, 0, 0],
      chest: [-2, 0, 0],
      neck: [-6, 0, 0],
      head: [-18, -16, 8],
      upperArmL: [-40, -45, -8],
      foreArmL: [-64, 0, 0],
      handL: [0, 0, 0],
      upperArmR: [-33, 62, -10],
      foreArmR: [-79, 0, 0],
      handR: [0, 0, 0],
    }),
  );
  const count2 = P(count, { head: [-22, -22, 4], upperArmR: [-50, 56, 10], foreArmR: [-59, 0, 0] });
  const launch = P(CHIN_UP, { root: [0, 0.02, -0.14], hips: [-30, -30, 0], neck: [-36, 0, 0], head: [-44, 0, 0], upperArmL: [-20, 0, 100], upperArmR: [-20, 0, -100] });
  const tumble = P(J.b, { spine: [10, 0, 0], thighL: [-70, 0, 15], shinL: [80, 0, 0], thighR: [-60, 0, -15], shinR: [90, 0, 0], upperArmL: [-60, 0, 90], upperArmR: [-60, 0, -90] });
  const pitch = (p: Pose, x: number): Pose => ({ ...p, hips: [x, -15, 0] });
  const guardTilt = P(guard, { head: [-2, 18, 8] });
  const v = clip(
    K(0, HIT_MID),
    K(10, guard, 'smooth'),
    K(30, guard),
    K(40, guardTilt, 'smooth'),
    K(66, guardTilt),
    K(76, guard, 'smooth'),
    K(86, guard),
    K(90, surprised, 'out'),
    K(98, think, 'smooth'),
    K(104, think2, 'smooth'),
    K(110, count, 'smooth'),
    ...alt(118, 166, 8, count2, count, 'smooth'),
    K(169, count),
    K(170, launch, 'out'),
    K(180, pitch(launch, -60), 'smooth'),
    K(192, pitch(tumble, -150), 'smooth'),
    K(204, pitch(tumble, -250), 'linear'),
    K(216, pitch(J.c, -330), 'linear'),
    rewrap(226, LYING, 0, 'in', -360),
    K(230, LYING_BOUNCE, 'out'),
    K(236, LYING, 'in'),
    K(280, LYING),
  );
  return { a, v };
}

const BUILDERS: Record<string, () => Record<string, Clip>> = { baby, feint, kneecap, saiyan, config };

export function crew1Clips(): Record<string, Clip> {
  const out: Record<string, Clip> = {};
  for (const [id, build] of Object.entries(BUILDERS)) {
    for (const [role, c] of Object.entries(build())) out[`ult:${id}:${role}`] = c;
  }
  return out;
}
