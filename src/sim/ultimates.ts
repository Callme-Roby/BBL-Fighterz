import type { MusicId, SfxId } from '../audio/types';
import type { Strength } from './types';
import { crew1Scripts } from './ults/crew1';
import { crew2Scripts } from './ults/crew2';

/**
 * BBL MAX cinematic combos ("ultimates").
 *
 * When the BBL MAX dash strike connects, the attacker plays a scripted
 * sequence. Everything here is plain data evaluated frame by frame by the
 * deterministic simulation (online play stays in sync); the matching
 * animations live in `src/render/ultimatePoses.ts` (clips `ult:<id>:a` for the
 * attacker and `ult:<id>:v` for the victim) and the camera follows `cams`.
 *
 * Frames are counted from 1 (first frame of the cinematic).
 */

/** [frame, value] keys, linear interpolation, clamped at both ends */
export type CurveKeys = [number, number][];

export interface UltimateHit {
  f: number;
  /** damage (0 allowed: a hit that only makes the victim flinch) */
  dmg: number;
  strength: Strength;
  /** impact height in metres; -1 = on the victim's body (follows their height) */
  y: number;
  /**
   * impact x as an offset from the victim's centre along the attacker's facing
   * (negative = the side facing the attacker). Default: between the two fighters.
   * Use it for blows delivered from behind the victim (by an extra actor, a back attack...).
   */
  dx?: number;
  /**
   * how the impact is presented (damage is identical):
   *  hit  – punch/kick spark + impact sound (default)
   *  shot – bullet impact: small spark, gunshot + muzzle flash at the attacker's right hand
   *  boom – explosion on the victim (fireball, smoke, big boom, strong shake)
   *  word – verbal blow (rap punchline): no spark, no punch sound, the victim just flinches
   *  none – nothing at all (e.g. while the screen is black); the script adds its own sounds
   */
  kind?: HitKind;
}

export type HitKind = 'hit' | 'shot' | 'boom' | 'word' | 'none';

/**
 * Camera shots (see FightWorld):
 *  over   – over the attacker's shoulder, looking at the victim
 *  front  – from behind the victim, looking at the attacker
 *  low    – low wide angle looking up (good for launches)
 *  high   – high wide angle looking down (good for slams)
 *  side   – classic side view, a bit closer than gameplay
 *  close  – close-up on the attacker's face
 *  victim – close-up on the victim
 *  wide   – very wide establishing shot
 */
export type CamShot =
  | 'over'
  | 'front'
  | 'low'
  | 'high'
  | 'side'
  | 'close'
  | 'victim'
  | 'wide'
  /** medium two-shot from the side at chest height (dialogues) */
  | 'two'
  /** close-up on the victim's face (reactions) */
  | 'vface'
  /** close-up on the first extra actor present (cine.actors) */
  | 'actor'
  /** slow dramatic low-angle orbit around the attacker (transformations, poses) */
  | 'hero';

export interface UltimateScript {
  id: string;
  /** total length in frames (≈ 120–170) */
  length: number;
  /** hits in chronological order; the LAST one is the finisher (the only one that can KO) */
  hits: UltimateHit[];
  /** attacker height above the ground */
  ay: CurveKeys;
  /** victim height above the ground */
  vy: CurveKeys;
  /** distance from attacker to victim along the attacker's facing */
  dist: CurveKeys;
  /** attacker forward travel from the starting point (metres, can be negative) */
  ax?: CurveKeys;
  /** frame at which the victim crashes on the floor (dust + sound) */
  fall: number;
  /** camera cuts: [first frame, shot] */
  cams: [number, CamShot][];
  /**
   * frame ranges [from, to) during which the victim turns its back to the attacker
   * (e.g. tricked into looking behind). Outside these ranges the victim faces the attacker.
   */
  victimTurn?: [number, number][];
  /** blows the attacker inflicts on themself (never below 1 HP), e.g. a knee giving way */
  selfHits?: { f: number; dmg: number; y: number }[];
  /** presentation-only timeline: extra characters, props, dialogue, effects (ignored by the simulation) */
  cine?: Cinematic;
}

// ---------------------------------------------------------------------------
// cinematic presentation (render side only, see src/game/cinematic.ts)
// ---------------------------------------------------------------------------

/**
 * Who something refers to: 'a' = attacker, 'v' = victim, any other string = the id
 * of an extra actor declared in `cine.actors`.
 */
export type CineRef = 'a' | 'v' | (string & {});

/** Bones a prop can be attached to (see src/render/characterModel.ts BONE_NAMES). */
export type PropBone = 'handR' | 'handL' | 'head' | 'chest' | 'shoulderR' | 'shoulderL' | 'hips' | 'spine' | 'foreArmR' | 'foreArmL';

/**
 * Props (low-poly meshes, see src/render/props.ts), built in the space of the bone they
 * are attached to. Bind pose: character faces +Z, +X = their left, arms hang down.
 * Guns / launchers (smg, bazooka): grip at the hand bone origin, barrel along the bone's -Y
 * (= along the arm, so an arm swung forward with upperArm X = -90 aims it forward), the
 * top of the object toward the bone's +Z (= up when the arm points forward).
 * Mic, rose, phone, grenade: held in the fist, sticking out on the thumb side (bone +Z,
 * i.e. forward when the arm hangs, up toward the mouth when the elbow is bent ~110°).
 * Shades: attach to 'head', they sit on the eyes by default.
 * Fine-tune with `pos`/`rot` when needed.
 *  smg      – compact sub-machine gun, held in one hand
 *  grenade  – hand grenade (fits in the palm)
 *  bazooka  – long tube launcher, rests on the shoulder (attach to handR, use rot)
 *  mic      – hand-held microphone (rap battle)
 *  shades   – sunglasses (attach to head; default offset sits on the eyes)
 *  phone    – smartphone
 *  rose     – a red rose
 */
export type PropId = 'smg' | 'grenade' | 'bazooka' | 'mic' | 'shades' | 'phone' | 'rose';

/**
 * One-shot visual effects (src/render/effects.ts):
 *  explosion  – fireball + smoke + debris
 *  muzzle     – muzzle flash (place it at a hand)
 *  poof       – cartoon smoke cloud (appear/disappear/transform)
 *  powerAura  – golden flames burst around the target (super-saiyan style)
 *  stars      – dizzy stars circling above the target's head
 *  sweat      – sweat drops flying off the head (panic / embarrassment)
 *  question   – big "?" popping above the head
 *  exclaim    – big "!" popping above the head
 *  shine      – sparkle glint
 *  smoke      – lingering grey smoke
 *  confetti   – colourful confetti burst (crowd hype)
 *  pain       – red "pain" lines burst (e.g. on a knee), use y to place it
 *  veins      – anger/effort veins + steam puffs (muscle contraction)
 *  web        – white web splat (on the victim)
 *  speed      – speed lines / dust trail behind a running character
 */
export type CineFx =
  | 'explosion'
  | 'muzzle'
  | 'poof'
  | 'powerAura'
  | 'stars'
  | 'sweat'
  | 'question'
  | 'exclaim'
  | 'shine'
  | 'smoke'
  | 'confetti'
  | 'pain'
  | 'veins'
  | 'web'
  | 'speed';

/** Projectiles flying from one place to another (pure presentation). */
export type ProjectileKind = 'grenade' | 'rocket' | 'web' | 'bullet';

export interface CineActor {
  /** id used by events/props (`on`/`who`/`at`) and the clip name `ult:<script id>:<id>` */
  id: string;
  /** look of the actor: key of CAST in src/data/cast.ts */
  cast: string;
  /** present during [from, to) */
  from: number;
  to: number;
  /** forward position on the attacker's axis, same origin as `ax` (the attacker's start point) */
  x: CurveKeys;
  /** height above the ground (default 0) */
  y?: CurveKeys;
  /** +1 = faces the same way as the attacker, -1 = faces back toward the attacker's side (default +1) */
  facing?: 1 | -1;
  /** frames [from, to) during which `facing` is reversed (turning around) */
  turn?: [number, number][];
  /** smoke puff + sound when appearing / disappearing (default false) */
  poof?: boolean;
}

export interface CineSwap {
  /** whose model is replaced: the attacker or the victim */
  who: 'a' | 'v';
  /** CAST id of the replacement look (it plays the same animation) */
  cast: string;
  /** active during [from, to) */
  from: number;
  to: number;
  /** effect at both switches: smoke puff, or a golden power burst (default 'poof') */
  fx?: 'poof' | 'power' | 'none';
}

export interface CineProp {
  prop: PropId;
  /** holder: attacker, victim or actor id */
  on: CineRef;
  bone: PropBone;
  /** visible during [from, to) */
  from: number;
  to: number;
  /** extra offset in the bone's space (metres) */
  pos?: [number, number, number];
  /** extra rotation in the bone's space (degrees, XYZ) */
  rot?: [number, number, number];
  scale?: number;
}

export type CineEvent =
  /** dialogue line: subtitle with the speaker's portrait + text-to-speech in their voice */
  | { f: number; t: 'say'; who: CineRef; text: string; pitch?: number; rate?: number; dur?: number }
  /** big comic-book text over the picture ("BIM !", a punchline...). dur in frames (default 50) */
  | { f: number; t: 'text'; text: string; dur?: number; style?: 'boom' | 'punch' | 'caption'; color?: string }
  | { f: number; t: 'sfx'; id: SfxId; vol?: number; pitch?: number }
  /** switch the music (null = back to the stage music; it is restored automatically at the end anyway) */
  | { f: number; t: 'music'; id: MusicId | null }
  /**
   * effect anchored on a character: dx = offset along the attacker's facing (metres),
   * y = height (default: chest/head depending on the effect), bone = follow that bone instead
   */
  | { f: number; t: 'fx'; fx: CineFx; at: CineRef; dx?: number; y?: number; bone?: PropBone; scale?: number }
  /** projectile from one character to another, `dur` frames of flight, `arc` = apex height above the straight line */
  | {
      f: number;
      t: 'projectile';
      kind: ProjectileKind;
      from: CineRef;
      to: CineRef;
      dur: number;
      arc?: number;
      /** launch point: a bone of `from` (default handR) */
      fromBone?: PropBone;
      /** target height (default chest of `to`) */
      toY?: number;
      /** explode on arrival (explosion fx + sound + shake) */
      boom?: boolean;
    }
  | { f: number; t: 'shake'; amt: number }
  /** full-screen colour flash (amt 0..1) */
  | { f: number; t: 'flash'; color?: string; amt?: number };

export interface Cinematic {
  swaps?: CineSwap[];
  actors?: CineActor[];
  props?: CineProp[];
  /** screen fade: 0 = picture, 1 = black (e.g. [[40,0],[46,1],[120,1],[126,0]]) */
  fade?: CurveKeys;
  /** stage lighting multiplier (default: 0.4 dimmed during the whole cinematic, 1 = normal) */
  light?: CurveKeys;
  /** one-shot events (any order) */
  events?: CineEvent[];
}

export function curve(keys: CurveKeys | undefined, f: number): number {
  if (!keys || keys.length === 0) return 0;
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    if (f <= f1) {
      const [f0, v0] = keys[i - 1];
      const t = (f - f0) / (f1 - f0);
      return v0 + (v1 - v0) * t;
    }
  }
  return keys[keys.length - 1][1];
}

/** Generic boxing rush: jab, cross, knee, elbow, uppercut launch, jumping hammer smash. */
const rush: UltimateScript = {
  id: 'rush',
  length: 132,
  hits: [
    { f: 8, dmg: 6, strength: 'light', y: 1.55 },
    { f: 18, dmg: 7, strength: 'medium', y: 1.6 },
    { f: 30, dmg: 8, strength: 'medium', y: 1.15 },
    { f: 44, dmg: 8, strength: 'medium', y: 1.5 },
    { f: 58, dmg: 12, strength: 'heavy', y: 1.4 },
    { f: 92, dmg: 19, strength: 'heavy', y: -1 },
  ],
  ay: [
    [66, 0],
    [75, 1.3],
    [84, 1.8],
    [92, 1.8],
    [106, 0],
  ],
  vy: [
    [58, 0],
    [69, 1.05],
    [80, 1.5],
    [92, 1.62],
    [102, 0],
  ],
  dist: [
    [58, 0.7],
    [92, 0.9],
  ],
  fall: 102,
  cams: [
    [0, 'over'],
    [26, 'front'],
    [56, 'low'],
    [92, 'high'],
  ],
};

// ---------------------------------------------------------------------------
// per-fighter scripts
// ---------------------------------------------------------------------------

/**
 * `dist` keys from the victim's forward travel `vx` (same origin and axis as `ax`):
 * lets a script say where the victim IS (e.g. lying still on the floor while the
 * attacker jumps on them) instead of the relative distance. Computed once at load
 * (plain arithmetic on constants: identical on every machine).
 */
export function relDist(vx: CurveKeys, ax: CurveKeys): CurveKeys {
  const frames = [...new Set([...vx.map((k) => k[0]), ...ax.map((k) => k[0])])].sort((a, b) => a - b);
  return frames.map((f) => [f, Math.round((curve(vx, f) - curve(ax, f)) * 1000) / 1000]);
}

/** Dylan — TORNADE ROUSSE: 4 lariat spins, belly bump launch, jumping body splash. */
const tornadoAx: CurveKeys = [
  [2, 0],
  [48, 0.7],
  [58, 0.8],
  [66, 0.72],
  [70, 0.9],
  [80, 0.9],
  [110, 2.45],
  [122, 2.45],
  [134, 1.6],
];
const tornado: UltimateScript = {
  id: 'tornado',
  length: 150,
  hits: [
    { f: 12, dmg: 5, strength: 'light', y: 1.45 },
    { f: 24, dmg: 5, strength: 'light', y: 1.45 },
    { f: 36, dmg: 6, strength: 'medium', y: 1.45 },
    { f: 48, dmg: 7, strength: 'medium', y: 1.45 },
    { f: 70, dmg: 13, strength: 'heavy', y: 1.05 },
    { f: 110, dmg: 24, strength: 'heavy', y: 0.35 },
  ],
  ay: [
    [80, 0],
    [88, 1.45],
    [96, 2.05],
    [100, 2.1],
    [106, 1.25],
    [110, 0.28],
    [122, 0.28],
    [127, 0.5],
    [134, 0],
  ],
  vy: [
    [70, 0],
    [78, 0.95],
    [86, 1.3],
    [90, 1.28],
    [98, 0],
  ],
  ax: tornadoAx,
  dist: relDist(
    [
      [2, 0.95],
      [48, 1.65],
      [58, 1.75],
      [70, 1.8],
      [78, 2.2],
      [90, 2.65],
      [98, 2.8],
    ],
    tornadoAx,
  ),
  fall: 98,
  cams: [
    [0, 'over'],
    [28, 'low'],
    [54, 'close'],
    [66, 'side'],
    [80, 'low'],
    [104, 'high'],
  ],
};

/** Clément — COUP DE BOULE BARBU: low/mid/high kicks, spinning back kick, clinch knees, giant headbutt. */
const headbuttAx: CurveKeys = [
  [2, 0],
  [30, 0.1],
  [42, 0.2],
  [50, 0.3],
  [58, 1.0],
  [90, 0.95],
  [98, 1.08],
  [112, 1.08],
  [128, 0.85],
];
const headbutt: UltimateScript = {
  id: 'headbutt',
  length: 150,
  hits: [
    { f: 8, dmg: 5, strength: 'light', y: 0.45 },
    { f: 18, dmg: 6, strength: 'medium', y: 1.1 },
    { f: 28, dmg: 7, strength: 'medium', y: 1.6 },
    { f: 42, dmg: 9, strength: 'heavy', y: 1.15 },
    { f: 62, dmg: 6, strength: 'medium', y: 1.05 },
    { f: 74, dmg: 7, strength: 'medium', y: 1.1 },
    { f: 98, dmg: 22, strength: 'heavy', y: 1.62 },
  ],
  ay: [[0, 0]],
  vy: [
    [98, 0],
    [104, 0.75],
    [112, 1.05],
    [118, 0.8],
    [124, 0],
  ],
  ax: headbuttAx,
  dist: relDist(
    [
      [2, 1.0],
      [30, 1.1],
      [41, 1.2],
      [42, 1.25],
      [50, 1.65],
      [58, 1.62],
      [90, 1.57],
      [98, 1.7],
      [110, 3.0],
      [124, 4.4],
      [132, 4.75],
    ],
    headbuttAx,
  ),
  fall: 124,
  cams: [
    [0, 'side'],
    [36, 'low'],
    [52, 'over'],
    [82, 'close'],
    [98, 'victim'],
    [104, 'wide'],
  ],
};

/** Alex — BOUCLES INFERNALES: jab flurry, rising uppercut, spinning air uppercut, axe kick. */
const curlsAx: CurveKeys = [
  [2, 0],
  [36, 0.3],
  [50, 0.37],
  [66, 0.6],
  [68, 0.62],
  [86, 1.0],
  [102, 1.05],
  [120, 0.95],
];
const curls: UltimateScript = {
  id: 'curls',
  length: 140,
  hits: [
    { f: 6, dmg: 3, strength: 'light', y: 1.58 },
    { f: 12, dmg: 3, strength: 'light', y: 1.55 },
    { f: 18, dmg: 3, strength: 'light', y: 1.58 },
    { f: 24, dmg: 3, strength: 'light', y: 1.55 },
    { f: 30, dmg: 4, strength: 'light', y: 1.58 },
    { f: 36, dmg: 4, strength: 'medium', y: 1.55 },
    { f: 50, dmg: 10, strength: 'heavy', y: 1.5 },
    { f: 68, dmg: 9, strength: 'medium', y: -1 },
    { f: 88, dmg: 23, strength: 'heavy', y: -1 },
  ],
  ay: [
    [52, 0],
    [60, 0.9],
    [68, 1.5],
    [78, 2.35],
    [86, 2.5],
    [88, 2.45],
    [96, 1.2],
    [102, 0],
  ],
  vy: [
    [50, 0],
    [58, 0.9],
    [68, 1.5],
    [76, 1.95],
    [82, 2.05],
    [88, 1.95],
    [96, 0],
  ],
  ax: curlsAx,
  dist: relDist(
    [
      [2, 0.7],
      [36, 1.0],
      [50, 1.05],
      [66, 1.35],
      [68, 1.4],
      [82, 1.75],
      [88, 1.8],
      [96, 2.25],
    ],
    curlsAx,
  ),
  fall: 96,
  cams: [
    [0, 'over'],
    [20, 'front'],
    [44, 'low'],
    [90, 'high'],
    [106, 'close'],
  ],
};

/** Benji — COUP DU PALMIER: spinning hair whips, head-first dive launch, flipping overhead headbutt slam. */
const palmAx: CurveKeys = [
  [2, 0],
  [40, 0.4],
  [54, -0.1],
  [64, 0.2],
  [74, 0.45],
  [80, 0.6],
  [100, 1.6],
  [106, 1.35],
  [112, 1.15],
  [128, 1.0],
];
const palm: UltimateScript = {
  id: 'palm',
  length: 150,
  hits: [
    { f: 12, dmg: 6, strength: 'light', y: 1.62 },
    { f: 26, dmg: 6, strength: 'medium', y: 1.62 },
    { f: 40, dmg: 7, strength: 'medium', y: 1.62 },
    { f: 64, dmg: 13, strength: 'heavy', y: 1.15 },
    { f: 100, dmg: 28, strength: 'heavy', y: -1 },
  ],
  ay: [
    [54, 0],
    [58, 0.35],
    [64, 0.45],
    [70, 0.3],
    [74, 0],
    [80, 0],
    [88, 1.5],
    [94, 2.3],
    [98, 2.5],
    [100, 2.45],
    [106, 1.6],
    [112, 0],
  ],
  vy: [
    [64, 0],
    [72, 0.9],
    [82, 1.5],
    [92, 1.75],
    [100, 1.7],
    [106, 0],
  ],
  ax: palmAx,
  dist: relDist(
    [
      [2, 0.75],
      [40, 1.15],
      [54, 1.25],
      [63, 1.3],
      [64, 1.32],
      [72, 1.6],
      [82, 1.9],
      [100, 2.1],
      [106, 2.2],
    ],
    palmAx,
  ),
  fall: 106,
  cams: [
    [0, 'side'],
    [22, 'over'],
    [46, 'low'],
    [74, 'close'],
    [84, 'low'],
    [103, 'high'],
  ],
};

/** Isis — AFRO XXL: four big slaps, hip check, jumping butt-drop. */
const afroAx: CurveKeys = [
  [2, 0],
  [46, 0.15],
  [58, 0.08],
  [62, 0.25],
  [80, 0.3],
  [112, 2.1],
  [118, 2.1],
  [132, 1.3],
];
const afro: UltimateScript = {
  id: 'afro',
  length: 150,
  hits: [
    { f: 10, dmg: 5, strength: 'light', y: 1.55 },
    { f: 22, dmg: 5, strength: 'light', y: 1.55 },
    { f: 34, dmg: 6, strength: 'medium', y: 1.55 },
    { f: 46, dmg: 7, strength: 'medium', y: 1.55 },
    { f: 62, dmg: 12, strength: 'heavy', y: 1.0 },
    { f: 112, dmg: 26, strength: 'heavy', y: 0.35 },
  ],
  ay: [
    [80, 0],
    [90, 1.3],
    [98, 1.75],
    [102, 1.75],
    [108, 0.9],
    [112, 0.3],
    [118, 0.3],
    [124, 0.75],
    [132, 0],
  ],
  vy: [[0, 0]],
  ax: afroAx,
  dist: relDist(
    [
      [2, 0.7],
      [46, 0.85],
      [58, 0.82],
      [62, 0.95],
      [76, 1.9],
      [90, 2.3],
      [96, 2.4],
    ],
    afroAx,
  ),
  fall: 96,
  cams: [
    [0, 'over'],
    [28, 'victim'],
    [56, 'side'],
    [80, 'low'],
    [104, 'high'],
    [134, 'close'],
  ],
};

/** Enola — SANG-FROID: sunglasses, elbow / palm / knee, spinning back kick, back turned while the victim crashes. */
const coldAx: CurveKeys = [
  [2, 0],
  [20, 0],
  [26, 0.1],
  [38, 0.15],
  [50, 0.25],
  [58, 0.15],
  [66, 0.3],
];
const cold: UltimateScript = {
  id: 'cold',
  length: 150,
  hits: [
    { f: 26, dmg: 8, strength: 'medium', y: 1.55 },
    { f: 38, dmg: 9, strength: 'medium', y: 1.45 },
    { f: 50, dmg: 9, strength: 'medium', y: 1.1 },
    { f: 66, dmg: 13, strength: 'heavy', y: 1.2 },
    { f: 108, dmg: 24, strength: 'heavy', y: 0.4 },
  ],
  ay: [[0, 0]],
  vy: [
    [66, 0],
    [74, 1.0],
    [84, 1.75],
    [92, 1.95],
    [100, 1.4],
    [108, 0],
  ],
  ax: coldAx,
  dist: relDist(
    [
      [2, 0.75],
      [20, 0.72],
      [26, 0.78],
      [38, 0.88],
      [50, 0.88],
      [58, 0.98],
      [66, 1.25],
      [84, 1.55],
      [100, 1.75],
      [108, 1.85],
      [116, 1.95],
    ],
    coldAx,
  ),
  fall: 108,
  cams: [
    [0, 'close'],
    [22, 'over'],
    [44, 'side'],
    [58, 'low'],
    [76, 'side'],
    [100, 'high'],
  ],
};

/** Zia — REINE DES DREADS: tornado kicks, flying kick launch, aerial spin kick, drop kick. */
const dreadsAx: CurveKeys = [
  [2, 0],
  [36, 0.5],
  [44, 0.55],
  [52, 0.75],
  [68, 1.15],
  [86, 1.5],
  [98, 1.2],
];
const dreads: UltimateScript = {
  id: 'dreads',
  length: 140,
  hits: [
    { f: 12, dmg: 5, strength: 'light', y: 1.5 },
    { f: 24, dmg: 6, strength: 'medium', y: 1.5 },
    { f: 36, dmg: 6, strength: 'medium', y: 1.55 },
    { f: 52, dmg: 11, strength: 'heavy', y: 1.3 },
    { f: 68, dmg: 10, strength: 'medium', y: -1 },
    { f: 86, dmg: 22, strength: 'heavy', y: -1 },
  ],
  ay: [
    [4, 0],
    [8, 0.18],
    [12, 0.28],
    [16, 0.12],
    [18, 0],
    [20, 0.18],
    [24, 0.28],
    [28, 0.12],
    [30, 0],
    [32, 0.18],
    [36, 0.28],
    [40, 0.12],
    [44, 0],
    [48, 0.3],
    [52, 0.5],
    [60, 1.05],
    [68, 1.5],
    [76, 1.85],
    [82, 1.95],
    [86, 1.85],
    [92, 1.0],
    [98, 0],
  ],
  vy: [
    [52, 0],
    [60, 0.9],
    [68, 1.4],
    [76, 1.75],
    [82, 1.85],
    [86, 1.85],
    [94, 0.6],
    [98, 0],
  ],
  ax: dreadsAx,
  dist: relDist(
    [
      [2, 0.95],
      [36, 1.45],
      [44, 1.5],
      [52, 1.55],
      [68, 2.0],
      [86, 2.4],
      [98, 2.95],
      [104, 3.1],
    ],
    dreadsAx,
  ),
  fall: 98,
  cams: [
    [0, 'side'],
    [26, 'over'],
    [44, 'low'],
    [90, 'high'],
    [112, 'close'],
  ],
};

/** Tonton Jacky — BARBECUE PARTY: five belly bumps, huge jumping belly flop. */
const bbqAx: CurveKeys = [
  [2, 0],
  [6, -0.05],
  [10, 0.12],
  [16, 0.08],
  [22, 0.3],
  [28, 0.26],
  [34, 0.48],
  [40, 0.44],
  [46, 0.66],
  [52, 0.6],
  [58, 0.86],
  [86, 0.8],
  [90, 0.9],
  [116, 2.15],
  [126, 2.15],
  [138, 1.35],
];
const bbq: UltimateScript = {
  id: 'bbq',
  length: 150,
  hits: [
    { f: 10, dmg: 5, strength: 'light', y: 1.1 },
    { f: 22, dmg: 6, strength: 'medium', y: 1.1 },
    { f: 34, dmg: 6, strength: 'medium', y: 1.1 },
    { f: 46, dmg: 7, strength: 'medium', y: 1.1 },
    { f: 58, dmg: 9, strength: 'heavy', y: 1.05 },
    { f: 116, dmg: 28, strength: 'heavy', y: 0.35 },
  ],
  ay: [
    [90, 0],
    [98, 1.6],
    [104, 2.3],
    [108, 2.4],
    [112, 1.6],
    [116, 0.25],
    [126, 0.25],
    [130, 0.5],
    [138, 0],
  ],
  vy: [
    [58, 0],
    [64, 0.3],
    [70, 0.2],
    [74, 0],
  ],
  ax: bbqAx,
  dist: relDist(
    [
      [2, 0.8],
      [9, 0.8],
      [10, 0.9],
      [21, 0.98],
      [22, 1.1],
      [33, 1.18],
      [34, 1.3],
      [45, 1.38],
      [46, 1.5],
      [57, 1.58],
      [58, 1.75],
      [66, 2.2],
      [74, 2.45],
    ],
    bbqAx,
  ),
  fall: 74,
  cams: [
    [0, 'side'],
    [24, 'front'],
    [52, 'over'],
    [76, 'close'],
    [88, 'low'],
    [108, 'high'],
  ],
};

/** Sécu — VIDÉ DU CLUB: throat grab, chokeslam, picks the victim up, huge punch that sends them flying. */
const bouncerAx: CurveKeys = [
  [2, 0],
  [50, 0.1],
  [80, 0.1],
  [94, 0.0],
  [98, 0.2],
];
const bouncer: UltimateScript = {
  id: 'bouncer',
  length: 150,
  hits: [
    { f: 10, dmg: 5, strength: 'light', y: 1.5 },
    { f: 22, dmg: 6, strength: 'medium', y: 1.85 },
    { f: 34, dmg: 6, strength: 'medium', y: 2.0 },
    { f: 50, dmg: 15, strength: 'heavy', y: 0.3 },
    { f: 98, dmg: 28, strength: 'heavy', y: 1.5 },
  ],
  ay: [[0, 0]],
  vy: [
    [10, 0],
    [24, 0.4],
    [34, 0.55],
    [42, 0.58],
    [50, 0],
    [98, 0],
    [106, 0.8],
    [114, 0.95],
    [124, 0],
  ],
  ax: bouncerAx,
  dist: relDist(
    [
      [2, 0.66],
      [10, 0.64],
      [42, 0.66],
      [50, 0.85],
      [62, 0.85],
      [72, 0.85],
      [80, 0.8],
      [94, 0.75],
      [98, 0.95],
      [106, 2.2],
      [114, 3.4],
      [124, 4.3],
      [134, 4.7],
    ],
    bouncerAx,
  ),
  fall: 124,
  cams: [
    [0, 'over'],
    [14, 'low'],
    [44, 'high'],
    [78, 'close'],
    [98, 'victim'],
    [104, 'wide'],
  ],
};

/** Papy Boxe — 40 ANS DE RING: body blows, liver shot, uppercut, haymaker. */
const boxerAx: CurveKeys = [
  [2, 0],
  [32, 0.25],
  [46, 0.32],
  [62, 0.4],
  [78, 0.35],
  [84, 0.55],
];
const boxer: UltimateScript = {
  id: 'boxer',
  length: 140,
  hits: [
    { f: 8, dmg: 4, strength: 'light', y: 1.15 },
    { f: 16, dmg: 4, strength: 'light', y: 1.15 },
    { f: 24, dmg: 5, strength: 'light', y: 1.15 },
    { f: 32, dmg: 5, strength: 'medium', y: 1.15 },
    { f: 46, dmg: 10, strength: 'heavy', y: 1.05 },
    { f: 62, dmg: 11, strength: 'heavy', y: 1.5 },
    { f: 84, dmg: 23, strength: 'heavy', y: 1.55 },
  ],
  ay: [[0, 0]],
  vy: [
    [62, 0],
    [68, 0.3],
    [74, 0.12],
    [78, 0],
    [84, 0],
    [90, 0.35],
    [100, 0],
  ],
  ax: boxerAx,
  dist: relDist(
    [
      [2, 0.7],
      [32, 0.95],
      [46, 1.07],
      [62, 1.1],
      [78, 1.1],
      [84, 1.3],
      [100, 2.0],
    ],
    boxerAx,
  ),
  fall: 100,
  cams: [
    [0, 'side'],
    [36, 'over'],
    [54, 'low'],
    [68, 'close'],
    [84, 'side'],
    [104, 'close'],
  ],
};

/** MC Grove — MIC DROP: mic taunt, tapping flurry, spinning backfist, jumping double-fist hammer. */
const micdropAx: CurveKeys = [
  [2, 0],
  [50, 0.3],
  [56, 0.25],
  [66, 0.4],
  [74, 0.45],
  [92, 0.55],
];
const micdrop: UltimateScript = {
  id: 'micdrop',
  length: 140,
  hits: [
    { f: 18, dmg: 4, strength: 'light', y: 1.6 },
    { f: 26, dmg: 4, strength: 'light', y: 1.6 },
    { f: 34, dmg: 5, strength: 'light', y: 1.6 },
    { f: 42, dmg: 5, strength: 'medium', y: 1.5 },
    { f: 50, dmg: 6, strength: 'medium', y: 1.55 },
    { f: 66, dmg: 12, strength: 'heavy', y: 1.55 },
    { f: 92, dmg: 26, strength: 'heavy', y: 1.62 },
  ],
  ay: [
    [74, 0],
    [82, 0.7],
    [88, 0.85],
    [92, 0.7],
    [98, 0],
  ],
  vy: [[0, 0]],
  ax: micdropAx,
  dist: relDist(
    [
      [2, 0.72],
      [18, 0.72],
      [50, 1.0],
      [56, 0.98],
      [66, 1.15],
      [74, 1.25],
      [92, 1.3],
      [98, 1.55],
      [104, 1.8],
    ],
    micdropAx,
  ),
  fall: 104,
  cams: [
    [0, 'close'],
    [16, 'over'],
    [54, 'side'],
    [74, 'low'],
    [90, 'high'],
    [110, 'close'],
  ],
};

/** Kévin — LIVRAISON EXPRESS: hit-and-run dash punches, baseball slide, flying knee. */
const expressAx: CurveKeys = [
  [2, 0],
  [7, -0.5],
  [9, -0.5],
  [12, 0.2],
  [16, -0.5],
  [17, -0.5],
  [20, 0.2],
  [24, -0.5],
  [25, -0.5],
  [28, 0.2],
  [32, -0.5],
  [33, -0.5],
  [36, 0.22],
  [42, -0.25],
  [46, -0.2],
  [50, 0.45],
  [56, 0.55],
  [62, 0.6],
  [70, 1.1],
  [80, 1.45],
  [92, 1.6],
];
const express: UltimateScript = {
  id: 'express',
  length: 140,
  hits: [
    { f: 12, dmg: 5, strength: 'light', y: 1.55 },
    { f: 20, dmg: 5, strength: 'light', y: 1.55 },
    { f: 28, dmg: 6, strength: 'light', y: 1.55 },
    { f: 36, dmg: 6, strength: 'medium', y: 1.55 },
    { f: 50, dmg: 10, strength: 'medium', y: 0.35 },
    { f: 70, dmg: 28, strength: 'heavy', y: -1 },
  ],
  ay: [
    [56, 0],
    [62, 0.3],
    [70, 0.75],
    [78, 0.85],
    [86, 0.4],
    [92, 0],
  ],
  vy: [
    [50, 0],
    [56, 0.5],
    [62, 0.85],
    [70, 1.05],
    [78, 1.3],
    [86, 0.9],
    [96, 0],
  ],
  ax: expressAx,
  dist: relDist(
    [
      [2, 0.9],
      [36, 0.95],
      [50, 1.05],
      [56, 1.15],
      [70, 1.6],
      [86, 2.9],
      [96, 3.4],
      [104, 3.6],
    ],
    expressAx,
  ),
  fall: 96,
  cams: [
    [0, 'side'],
    [24, 'front'],
    [44, 'low'],
    [76, 'wide'],
    [100, 'close'],
  ],
};

/** Coach Bruno — SÉRIE DE BURPEES: whistle, jab-cross, three burpees ending in jumping strikes, aerial hammer. */
const burpeesAx: CurveKeys = [
  [2, 0],
  [22, 0.1],
  [40, 0.15],
  [58, 0.25],
  [76, 0.4],
  [96, 0.9],
  [106, 1.0],
];
const burpees: UltimateScript = {
  id: 'burpees',
  length: 150,
  hits: [
    { f: 16, dmg: 4, strength: 'light', y: 1.55 },
    { f: 22, dmg: 5, strength: 'light', y: 1.55 },
    { f: 40, dmg: 7, strength: 'medium', y: 1.5 },
    { f: 58, dmg: 8, strength: 'medium', y: 1.25 },
    { f: 76, dmg: 11, strength: 'heavy', y: 1.5 },
    { f: 96, dmg: 25, strength: 'heavy', y: -1 },
  ],
  ay: [
    [34, 0],
    [40, 0.5],
    [46, 0],
    [52, 0],
    [58, 0.55],
    [64, 0],
    [70, 0],
    [76, 0.6],
    [84, 1.4],
    [92, 1.9],
    [96, 1.85],
    [102, 0.8],
    [106, 0],
  ],
  vy: [
    [36, 0],
    [40, 0.2],
    [46, 0],
    [56, 0],
    [60, 0.25],
    [66, 0],
    [76, 0],
    [84, 1.1],
    [92, 1.6],
    [96, 1.6],
    [104, 0],
  ],
  ax: burpeesAx,
  dist: relDist(
    [
      [2, 0.75],
      [22, 0.86],
      [40, 0.95],
      [58, 0.95],
      [76, 1.15],
      [92, 1.6],
      [96, 1.7],
      [104, 2.25],
    ],
    burpeesAx,
  ),
  fall: 104,
  cams: [
    [0, 'close'],
    [14, 'side'],
    [54, 'front'],
    [72, 'low'],
    [100, 'high'],
    [116, 'close'],
  ],
};

/** Big Mo — GROVE STREET 4 LIFE: big hooks, headlock punches, windmill windup, uppercut to the moon. */
const groveAx: CurveKeys = [
  [2, 0],
  [22, 0.15],
  [30, 0.3],
  [62, 0.3],
  [70, 0.25],
  [88, 0.2],
  [92, 0.4],
];
const grove: UltimateScript = {
  id: 'grove',
  length: 160,
  hits: [
    { f: 10, dmg: 7, strength: 'medium', y: 1.55 },
    { f: 22, dmg: 8, strength: 'medium', y: 1.55 },
    { f: 40, dmg: 5, strength: 'light', y: 1.15 },
    { f: 48, dmg: 5, strength: 'light', y: 1.15 },
    { f: 56, dmg: 6, strength: 'medium', y: 1.15 },
    { f: 92, dmg: 27, strength: 'heavy', y: 1.55 },
  ],
  ay: [[0, 0]],
  vy: [
    [92, 0],
    [98, 1.1],
    [106, 2.3],
    [116, 2.9],
    [122, 2.9],
    [130, 1.6],
    [136, 0],
  ],
  ax: groveAx,
  dist: relDist(
    [
      [2, 0.85],
      [10, 0.85],
      [22, 0.95],
      [30, 1.02],
      [62, 1.02],
      [70, 1.1],
      [88, 1.0],
      [92, 1.15],
      [116, 1.6],
      [136, 1.75],
    ],
    groveAx,
  ),
  fall: 136,
  cams: [
    [0, 'side'],
    [28, 'over'],
    [66, 'close'],
    [90, 'low'],
    [104, 'wide'],
    [126, 'high'],
  ],
};

/** Mamie Gigi — LE COUP DU SAC À MAIN: finger wag, windmill handbag swings, shin kick, double handbag smash. */
const handbagAx: CurveKeys = [
  [2, 0],
  [24, 0.08],
  [34, 0.15],
  [44, 0.22],
  [56, 0.3],
  [96, 0.4],
];
const handbag: UltimateScript = {
  id: 'handbag',
  length: 150,
  hits: [
    { f: 24, dmg: 8, strength: 'medium', y: 1.6 },
    { f: 34, dmg: 8, strength: 'medium', y: 1.6 },
    { f: 44, dmg: 9, strength: 'medium', y: 1.6 },
    { f: 56, dmg: 6, strength: 'light', y: 0.4 },
    { f: 96, dmg: 27, strength: 'heavy', y: 1.62 },
  ],
  ay: [[0, 0]],
  vy: [
    [56, 0],
    [60, 0.15],
    [64, 0],
    [68, 0.15],
    [72, 0],
    [76, 0.12],
    [80, 0],
  ],
  ax: handbagAx,
  dist: relDist(
    [
      [2, 0.8],
      [24, 0.85],
      [34, 0.92],
      [44, 1.0],
      [56, 1.05],
      [70, 1.1],
      [96, 1.15],
      [102, 1.25],
      [108, 1.6],
    ],
    handbagAx,
  ),
  fall: 108,
  cams: [
    [0, 'close'],
    [18, 'over'],
    [40, 'side'],
    [64, 'close'],
    [90, 'low'],
    [104, 'high'],
  ],
};

export const ULTIMATES: Record<string, UltimateScript> = {
  rush,
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

for (const u of [...crew1Scripts(), ...crew2Scripts()]) ULTIMATES[u.id] = u;

export function getUltimate(id: string | undefined): UltimateScript {
  return (id && ULTIMATES[id]) || rush;
}

/** Total damage of a script (dash strike excluded). */
export function ultimateDamage(u: UltimateScript): number {
  return u.hits.reduce((a, h) => a + h.dmg, 0);
}
