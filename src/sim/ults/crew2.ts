import { relDist, type CineEvent, type CurveKeys, type UltimateScript } from '../ultimates';

/**
 * BBL MAX scripts: Alex, Isis, Zia, Clément, Enola.
 * Built lazily (called from src/sim/ultimates.ts) so the helpers imported from
 * '../ultimates' are ready.
 *
 * Clips: src/render/ults/crew2.ts (same frame base: frame k of the script = frame k of the clips).
 */
export function crew2Scripts(): UltimateScript[] {
  return [mignon(), buff(), rap(), arsenal(), spider()];
}

// (function declarations: hoisted, so they are usable even through the import cycle with '../ultimates')
type SfxEvent = Extract<CineEvent, { t: 'sfx' }>;
function sfx(f: number, id: SfxEvent['id'], vol?: number, pitch?: number): CineEvent {
  const e: SfxEvent = { f, t: 'sfx', id };
  if (vol !== undefined) e.vol = vol;
  if (pitch !== undefined) e.pitch = pitch;
  return e;
}
/** comic-book onomatopoeia */
function boom(f: number, text: string, color: string, dur = 24): CineEvent {
  return { f, t: 'text', text, style: 'boom', color, dur };
}

// ---------------------------------------------------------------------------
// Alex — VIENS LÀ MON MIGNON
// A grin, a "come here", knuckles cracking… then the screen goes black and we
// only HEAR the (cartoon) beating. Picture back: the victim lies K.O. with stars
// circling, Alex fixes his hair: "Suivant."
// ---------------------------------------------------------------------------
function mignon(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [60, 0],
    [72, 0.2],
  ];
  return {
    id: 'mignon',
    length: 296,
    // every blow lands in the dark: no spark, no punch sound (the soundtrack is in cine.events)
    hits: [
      { f: 84, dmg: 6, strength: 'light', y: 1.55, kind: 'none' },
      { f: 98, dmg: 7, strength: 'medium', y: 1.2, kind: 'none' },
      { f: 112, dmg: 7, strength: 'medium', y: 1.5, kind: 'none' },
      { f: 126, dmg: 8, strength: 'medium', y: 1.05, kind: 'none' },
      { f: 140, dmg: 8, strength: 'heavy', y: 1.5, kind: 'none' },
      { f: 156, dmg: 9, strength: 'heavy', y: 1.3, kind: 'none' },
      { f: 178, dmg: 17, strength: 'heavy', y: 1.4, kind: 'none' },
    ],
    ay: [[0, 0]],
    vy: [[0, 0]],
    ax,
    dist: relDist(
      [
        [2, 0.88],
        [64, 0.95],
        [84, 1.0],
        [140, 1.05],
        [178, 1.15],
        [188, 1.75],
      ],
      ax,
    ),
    fall: 188,
    cams: [
      [0, 'close'],
      [36, 'vface'],
      [50, 'two'],
      [190, 'high'],
      [214, 'close'],
      [244, 'side'],
    ],
    cine: {
      // ~2 s of black screen; the victim is already K.O. on the floor when the picture comes back
      fade: [
        [64, 0],
        [72, 1],
        [194, 1],
        [206, 0],
      ],
      events: [
        { f: 8, t: 'say', who: 'a', text: 'Viens là mon mignon…', rate: 0.9, pitch: 0.95, dur: 70 },
        // cheeky glint of the grin
        { f: 10, t: 'fx', fx: 'shine', at: 'a', bone: 'head', scale: 0.7 },
        sfx(10, 'shine', 0.6),
        { f: 40, t: 'fx', fx: 'sweat', at: 'v' },
        // knuckles, then neck
        sfx(54, 'crack'),
        sfx(59, 'crack', 0.8, 1.2),
        sfx(64, 'crack', 1, 0.85),
        // --- black screen: cartoon fight soundtrack ---
        // (after Alex's line: the beating cuts this reply short, on purpose)
        { f: 76, t: 'say', who: 'v', text: 'Euh… non merci ?', rate: 1.15, dur: 24 },
        sfx(78, 'whiffHeavy'),
        sfx(84, 'hitHeavy'),
        boom(84, 'BIM !', '#ffd23a'),
        sfx(92, 'whiff'),
        sfx(98, 'bonk'),
        boom(98, 'BAM !', '#ff5a3a'),
        { f: 100, t: 'say', who: 'v', text: 'Non !', rate: 1.25, dur: 22 },
        sfx(106, 'boing'),
        sfx(112, 'crash'),
        boom(112, 'KLONG !', '#7ad0ff'),
        sfx(120, 'whiffHeavy'),
        sfx(126, 'hitMedium'),
        sfx(127, 'boing', 0.8, 1.3),
        boom(126, 'POW !', '#ffffff'),
        { f: 130, t: 'say', who: 'v', text: 'Pitié !', rate: 1.25, dur: 24 },
        sfx(134, 'bonk', 0.9, 1.3),
        sfx(140, 'crash'),
        sfx(141, 'hitHeavy'),
        boom(140, 'SBRAF !', '#ff9a1a'),
        sfx(148, 'boing', 1, 0.8),
        sfx(156, 'hitHeavy'),
        boom(156, 'PAF !', '#a8ff5a'),
        { f: 160, t: 'say', who: 'v', text: 'Aïïïe !', rate: 1.1, pitch: 1.15, dur: 30 },
        sfx(166, 'crash', 0.8),
        sfx(170, 'bonk', 1, 0.8),
        sfx(178, 'hitHeavy'),
        sfx(179, 'crash'),
        boom(178, 'KLONG !!!', '#ff3030', 30),
        sfx(184, 'boing', 1, 0.7),
        // --- picture back ---
        { f: 196, t: 'fx', fx: 'smoke', at: 'v', y: 0.3 },
        { f: 198, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        { f: 220, t: 'say', who: 'a', text: 'Suivant.', rate: 0.9, dur: 40 },
        { f: 228, t: 'fx', fx: 'shine', at: 'a', bone: 'head', scale: 0.8 },
        sfx(228, 'shine', 0.6),
        { f: 236, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        sfx(248, 'hitLight', 0.3, 1.6),
        sfx(254, 'hitLight', 0.3, 1.6),
        sfx(260, 'hitLight', 0.3, 1.6),
        { f: 272, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Isis — MUSCLES XXL
// Effort, veins, power burst: Isis turns into a bodybuilder (swap 'isis_buff'),
// double biceps, hooks, double hammer fist, overhead press with reps, slam,
// giant punch that sends the victim flying.
// ---------------------------------------------------------------------------
function buff(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [94, 0],
    [100, 0.12],
    [128, 0.2],
    [196, 0.2],
    [200, 0.34],
    [212, 0.38],
  ];
  return {
    id: 'buff',
    length: 300,
    hits: [
      { f: 104, dmg: 7, strength: 'medium', y: 1.15 },
      { f: 114, dmg: 8, strength: 'medium', y: 1.55 },
      { f: 128, dmg: 9, strength: 'heavy', y: 1.55 },
      { f: 182, dmg: 13, strength: 'heavy', y: 0.3 },
      { f: 200, dmg: 24, strength: 'heavy', y: 1.45 },
    ],
    ay: [[0, 0]],
    vy: [
      [132, 0],
      [138, 0.45],
      [146, 1.95],
      [155, 1.6],
      [166, 1.95],
      [172, 1.98],
      [176, 2.05],
      [182, 0],
      [188, 0.25],
      [192, 0.38],
      [200, 0.35],
      [208, 1.0],
      [214, 1.2],
      [220, 0.8],
      [226, 0],
    ],
    ax,
    dist: relDist(
      [
        [2, 0.85],
        [94, 0.85],
        [104, 0.86],
        [109, 0.9],
        [114, 0.88],
        [119, 0.92],
        [128, 0.92],
        [132, 0.9],
        [138, 0.78],
        [146, 0.36],
        [170, 0.36],
        [176, 0.44],
        [182, 1.3],
        [192, 1.2],
        [200, 1.15],
        [214, 2.5],
        [226, 3.3],
      ],
      ax,
    ),
    fall: 226,
    cams: [
      [0, 'close'],
      [20, 'hero'],
      [82, 'vface'],
      [98, 'side'],
      [122, 'low'],
      [158, 'high'],
      [190, 'side'],
      [204, 'wide'],
      [230, 'hero'],
    ],
    cine: {
      swaps: [{ who: 'a', cast: 'isis_buff', from: 44, to: 300, fx: 'power' }],
      events: [
        sfx(4, 'flex'),
        { f: 6, t: 'fx', fx: 'veins', at: 'a' },
        sfx(14, 'powerUp'),
        { f: 16, t: 'shake', amt: 0.15 },
        { f: 22, t: 'fx', fx: 'veins', at: 'a', scale: 1.2 },
        sfx(24, 'flex', 1, 0.85),
        { f: 30, t: 'fx', fx: 'powerAura', at: 'a' },
        { f: 32, t: 'shake', amt: 0.3 },
        { f: 36, t: 'fx', fx: 'veins', at: 'a', scale: 1.5 },
        { f: 44, t: 'flash', color: '#fff4c0', amt: 0.8 },
        { f: 44, t: 'shake', amt: 0.5 },
        { f: 46, t: 'fx', fx: 'question', at: 'v' },
        // double biceps
        sfx(52, 'flex'),
        { f: 54, t: 'say', who: 'a', text: 'Regarde-moi ces biceps !', rate: 1.05, pitch: 0.9, dur: 70 },
        { f: 58, t: 'fx', fx: 'shine', at: 'a', bone: 'foreArmR' },
        sfx(58, 'shine'),
        { f: 64, t: 'fx', fx: 'shine', at: 'a', bone: 'foreArmL' },
        { f: 72, t: 'fx', fx: 'shine', at: 'a', bone: 'head', scale: 0.7 },
        { f: 84, t: 'fx', fx: 'sweat', at: 'v' },
        // hammer fist, then overhead press: one rep… two reps…
        { f: 128, t: 'shake', amt: 0.35 },
        { f: 140, t: 'fx', fx: 'veins', at: 'a' },
        { f: 144, t: 'say', who: 'a', text: 'Une !', rate: 1.1, dur: 20 },
        sfx(155, 'flex', 0.7),
        { f: 166, t: 'say', who: 'a', text: 'Deux !', rate: 1.1, dur: 20 },
        // slam
        sfx(182, 'crash'),
        { f: 182, t: 'shake', amt: 0.6 },
        { f: 184, t: 'fx', fx: 'smoke', at: 'v', y: 0.2 },
        sfx(186, 'boing'),
        // giant punch (finisher)
        { f: 196, t: 'fx', fx: 'veins', at: 'a', scale: 1.3 },
        { f: 216, t: 'fx', fx: 'speed', at: 'v' },
        // most-muscular pose
        sfx(230, 'flex'),
        { f: 232, t: 'say', who: 'a', text: 'Séance terminée !', rate: 1.0, pitch: 0.9, dur: 64 },
        { f: 240, t: 'fx', fx: 'shine', at: 'a', bone: 'chest' },
        sfx(240, 'shine'),
        { f: 262, t: 'fx', fx: 'shine', at: 'a', bone: 'foreArmR' },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Zia — RAP CONTENDERS
// No blows: a rap battle on a boom-bap beat. Every punchline hurts (kind 'word'),
// the victim's comeback flops, final punchline + mic drop.
// ---------------------------------------------------------------------------
function rap(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [18, -0.05],
    [60, 0],
    [106, 0.2],
    [118, 0.25],
    [216, 0.42],
    [226, 0.48],
    [300, 0.55],
    [378, 0.7],
    [390, 0.75],
  ];
  const punch = (f: number, text: string, color: string, dur = 52): CineEvent => ({ f, t: 'text', text, style: 'punch', color, dur });
  // lines are spaced by their speaking time: a newer line cuts off the one still being spoken
  return {
    id: 'rap',
    length: 420,
    hits: [
      { f: 118, dmg: 14, strength: 'medium', y: 1.6, kind: 'word' },
      { f: 226, dmg: 16, strength: 'medium', y: 1.6, kind: 'word' },
      { f: 272, dmg: 8, strength: 'light', y: 1.6, kind: 'word' },
      { f: 390, dmg: 24, strength: 'heavy', y: 1.6, kind: 'word' },
    ],
    ay: [[0, 0]],
    vy: [[0, 0]],
    ax,
    dist: relDist(
      [
        [2, 0.95],
        [18, 1.25],
        [117, 1.25],
        [124, 1.48],
        [225, 1.52],
        [232, 1.72],
        [271, 1.75],
        [278, 1.9],
        [389, 1.95],
        [398, 2.15],
        [408, 2.3],
      ],
      ax,
    ),
    fall: 408,
    cams: [
      [0, 'hero'],
      [16, 'close'],
      [110, 'vface'],
      [128, 'low'],
      [218, 'two'],
      [234, 'vface'],
      [262, 'wide'],
      [278, 'close'],
      [372, 'low'],
      [400, 'high'],
    ],
    cine: {
      props: [{ prop: 'mic', on: 'a', bone: 'handR', from: 6, to: 386 }],
      events: [
        sfx(2, 'recordStop'),
        sfx(8, 'scratch'),
        { f: 10, t: 'text', text: 'RAP CONTENDERS — {a} vs {v}', style: 'caption', dur: 80 },
        { f: 12, t: 'music', id: 'rap' },
        sfx(14, 'crowdOoh', 0.6),
        // punchline 1
        { f: 18, t: 'say', who: 'a', text: 'T’as le flow d’un PDF scanné de travers !', rate: 1.2, dur: 104 },
        punch(64, 'FLOW DE PDF SCANNÉ !', '#ffd23a'),
        sfx(118, 'crowdOoh'),
        { f: 118, t: 'fx', fx: 'sweat', at: 'v' },
        // punchline 2
        { f: 126, t: 'say', who: 'a', text: 'Ton charisme ? En mode avion.', rate: 1.2, dur: 100 },
        punch(168, 'CHARISME : MODE AVION !', '#7ad0ff'),
        sfx(226, 'crowdOoh'),
        { f: 226, t: 'fx', fx: 'sweat', at: 'v', scale: 1.2 },
        // the comeback that never comes (Zia's last punchline cuts it off)
        { f: 234, t: 'say', who: 'v', text: 'Euh… yo… ton… ta… euh…', dur: 46 },
        { f: 252, t: 'fx', fx: 'question', at: 'v' },
        sfx(266, 'crowdLaugh'),
        { f: 272, t: 'fx', fx: 'sweat', at: 'v', scale: 1.3 },
        // final punchline + mic drop
        { f: 280, t: 'say', who: 'a', text: '{v}… même ton écho te ghoste !', rate: 1.15, dur: 106 },
        punch(330, 'MÊME TON ÉCHO TE GHOSTE !', '#ff5a8a', 56),
        boom(388, 'MIC DROP !', '#ffffff', 40),
        sfx(392, 'bonk', 1, 0.8),
        sfx(394, 'crowdOoh'),
        { f: 396, t: 'fx', fx: 'confetti', at: 'a' },
        sfx(412, 'crowdLaugh', 0.8),
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Clément — ARSENAL BARBU
// SMG bursts (the victim jitters, then dances under the bullets), two grenades,
// bazooka finisher. Cartoon: soot and smoke, no blood.
// ---------------------------------------------------------------------------
function arsenal(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [20, -0.2],
    [36, -0.45],
    [200, -0.5],
    [214, -0.5],
    [219, -0.82],
    [236, -0.72],
  ];
  const shot = (f: number, y: number) => ({ f, dmg: 2, strength: 'light' as const, y, kind: 'shot' as const });
  return {
    id: 'arsenal',
    length: 330,
    hits: [
      // burst 1: the victim jitters
      shot(46, 1.3),
      shot(50, 1.2),
      shot(54, 1.4),
      shot(58, 1.25),
      shot(62, 1.35),
      // burst 2: at the feet, the victim dances
      shot(72, 0.12),
      shot(76, 0.12),
      shot(80, 0.12),
      shot(84, 0.12),
      shot(88, 0.12),
      shot(92, 0.12),
      // grenades
      { f: 150, dmg: 9, strength: 'heavy', y: -1, kind: 'boom' },
      { f: 158, dmg: 10, strength: 'heavy', y: -1, kind: 'boom' },
      // bazooka
      { f: 226, dmg: 22, strength: 'heavy', y: -1, kind: 'boom' },
    ],
    ay: [[0, 0]],
    vy: [
      [70, 0],
      [73, 0.24],
      [76, 0.06],
      [79, 0.26],
      [82, 0.06],
      [85, 0.24],
      [88, 0.06],
      [91, 0.26],
      [95, 0],
      [150, 0],
      [156, 0.7],
      [158, 0.74],
      [166, 0.95],
      [172, 0.55],
      [178, 0],
      [226, 0],
      [232, 1.0],
      [238, 1.35],
      [244, 0.9],
      [250, 0],
    ],
    ax,
    dist: relDist(
      [
        [2, 0.92],
        [44, 0.95],
        [64, 1.15],
        [94, 1.3],
        [150, 1.35],
        [158, 1.7],
        [178, 2.0],
        [226, 2.05],
        [238, 2.85],
        [250, 3.4],
      ],
      ax,
    ),
    fall: 250,
    cams: [
      [0, 'close'],
      [36, 'over'],
      [64, 'front'],
      [96, 'close'],
      [128, 'side'],
      [176, 'vface'],
      [188, 'hero'],
      [208, 'over'],
      [226, 'wide'],
      [252, 'close'],
    ],
    cine: {
      props: [
        { prop: 'smg', on: 'a', bone: 'handR', from: 30, to: 106 },
        { prop: 'grenade', on: 'a', bone: 'handR', from: 108, to: 130 },
        { prop: 'grenade', on: 'a', bone: 'handL', from: 108, to: 136 },
        // on the shoulder: forearm horizontal-forward, tube pushed back over the shoulder and up
        { prop: 'bazooka', on: 'a', bone: 'handR', from: 188, to: 306, pos: [0, 0.45, 0.1] },
      ],
      events: [
        { f: 6, t: 'say', who: 'a', text: 'On va faire simple.', rate: 0.95, pitch: 0.95, dur: 56 },
        sfx(30, 'whiff'),
        sfx(38, 'block', 0.7, 1.6),
        sfx(41, 'block', 0.7, 1.3),
        { f: 40, t: 'fx', fx: 'exclaim', at: 'v' },
        { f: 86, t: 'say', who: 'a', text: 'Danse !', rate: 1.1, dur: 24 },
        { f: 96, t: 'fx', fx: 'smoke', at: 'a', bone: 'handR', scale: 0.6 },
        sfx(99, 'whiff', 0.3, 0.7),
        sfx(104, 'whiff'),
        sfx(116, 'land', 0.5, 1.3),
        // grenades: both pins pulled with the teeth
        sfx(116, 'pin'),
        sfx(124, 'pin', 1, 1.1),
        sfx(130, 'throw'),
        { f: 130, t: 'projectile', kind: 'grenade', from: 'a', to: 'v', fromBone: 'handR', dur: 20, arc: 1.3, boom: true },
        sfx(136, 'throw'),
        { f: 136, t: 'projectile', kind: 'grenade', from: 'a', to: 'v', fromBone: 'handL', dur: 22, arc: 1.6, boom: true },
        { f: 140, t: 'fx', fx: 'exclaim', at: 'v' },
        { f: 164, t: 'fx', fx: 'smoke', at: 'v' },
        { f: 180, t: 'fx', fx: 'smoke', at: 'v', y: 1.7 },
        { f: 182, t: 'say', who: 'v', text: 'Kof… kof…', rate: 0.9, dur: 34 },
        // bazooka
        sfx(188, 'whiffHeavy'),
        sfx(198, 'land', 0.7, 0.8),
        { f: 204, t: 'fx', fx: 'sweat', at: 'v' },
        sfx(214, 'rocket'),
        { f: 214, t: 'projectile', kind: 'rocket', from: 'a', to: 'v', fromBone: 'handR', dur: 12, arc: 0.1, boom: true },
        { f: 214, t: 'fx', fx: 'smoke', at: 'a', bone: 'shoulderR' },
        { f: 214, t: 'shake', amt: 0.3 },
        { f: 240, t: 'fx', fx: 'smoke', at: 'v' },
        // said over the flight and the crash, then the close-up
        { f: 230, t: 'say', who: 'a', text: 'Barbu, mais pas barbare… enfin si.', rate: 1.1, pitch: 0.95, dur: 130 },
        sfx(304, 'whiffHeavy'),
        sfx(316, 'crash', 0.6),
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Enola — SPIDER-POTE
// Enola calls her masked buddy (parody hero 'spiderpote'), he swings in and lands
// behind the victim: sandwich combo, web shot, double launch kick, high five
// under the airborne victim, then he swings away.
// ---------------------------------------------------------------------------
function spider(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [90, 0],
    [122, 0.12],
    [174, 0.15],
    [186, 0.2],
    [198, 0.74],
    [206, 0.74],
    [218, 0.95],
    [228, 0.95],
    [234, 0.6],
    [240, 0.25],
  ];
  return {
    id: 'spider',
    length: 324,
    hits: [
      { f: 124, dmg: 6, strength: 'light', y: 1.55 },
      { f: 132, dmg: 6, strength: 'light', y: 1.5, dx: 0.22 },
      { f: 140, dmg: 6, strength: 'medium', y: 1.5 },
      { f: 148, dmg: 7, strength: 'medium', y: 1.1, dx: 0.22 },
      { f: 160, dmg: 8, strength: 'medium', y: 1.55 },
      // web splat (Spider-Pote): the sound and the web fx are cine events
      { f: 174, dmg: 5, strength: 'light', y: 1.3, dx: 0.15, kind: 'none' },
      // double launch kick from both sides
      { f: 202, dmg: 24, strength: 'heavy', y: 1.45, dx: 0 },
    ],
    ay: [
      [228, 0],
      [233, 0.25],
      [240, 0],
    ],
    vy: [
      [202, 0],
      [208, 1.2],
      [216, 2.2],
      [224, 2.75],
      [230, 2.85],
      [236, 2.6],
      [242, 1.9],
      [248, 0.9],
      [252, 0],
    ],
    ax,
    dist: relDist(
      [
        [2, 0.88],
        [124, 0.86],
        [129, 0.98],
        [132, 0.98],
        [137, 0.86],
        [140, 0.86],
        [145, 1.0],
        [148, 1.0],
        [153, 0.88],
        [160, 0.88],
        [168, 1.1],
        [174, 1.1],
        [186, 1.36],
        [252, 1.36],
      ],
      ax,
    ),
    fall: 252,
    cams: [
      [0, 'close'],
      [24, 'wide'],
      [66, 'vface'],
      [88, 'actor'],
      [122, 'side'],
      [154, 'over'],
      [170, 'low'],
      [210, 'two'],
      [236, 'high'],
      [258, 'wide'],
    ],
    cine: {
      actors: [
        {
          id: 'pote',
          cast: 'spiderpote',
          from: 26,
          to: 292,
          // swings in from far behind the victim, lands ~0.9 m behind them
          x: [
            [26, 6.2],
            [32, 5.1],
            [38, 4.0],
            [44, 3.0],
            [48, 2.45],
            [52, 1.95],
            [54, 1.85],
            [124, 1.85],
            [128, 1.74],
            [134, 1.74],
            [142, 1.82],
            [148, 1.78],
            [154, 1.85],
            [168, 2.0],
            [174, 2.0],
            [186, 2.25],
            [196, 2.34],
            [206, 2.34],
            [218, 1.85],
            [228, 1.85],
            [234, 2.1],
            [240, 2.45],
            [262, 2.45],
            [270, 2.9],
            [280, 3.9],
            [292, 5.0],
          ],
          y: [
            [26, 4.6],
            [32, 3.2],
            [38, 2.0],
            [44, 1.4],
            [48, 1.6],
            [52, 0.6],
            [54, 0],
            [228, 0],
            [233, 0.25],
            [240, 0],
            [264, 0],
            [270, 1.3],
            [280, 3.2],
            [292, 5.2],
          ],
          facing: -1,
          // turns around to swing away
          turn: [[262, 292]],
          poof: false,
        },
      ],
      events: [
        { f: 2, t: 'say', who: 'a', text: 'Spider-Pote, à l’aide !', rate: 1.2, dur: 86 },
        sfx(26, 'thwip'),
        sfx(40, 'thwip', 0.8, 1.1),
        { f: 30, t: 'fx', fx: 'speed', at: 'pote' },
        sfx(54, 'land'),
        { f: 54, t: 'shake', amt: 0.2 },
        { f: 70, t: 'fx', fx: 'question', at: 'v' },
        // (after Enola's call: a newer line would cut hers off)
        { f: 94, t: 'say', who: 'pote', text: 'Ton gentil voisin, le Spider-Pote !', dur: 110 },
        // web shot
        sfx(168, 'thwip'),
        { f: 168, t: 'projectile', kind: 'web', from: 'pote', to: 'v', fromBone: 'handR', dur: 6 },
        { f: 174, t: 'fx', fx: 'web', at: 'v' },
        sfx(174, 'hitLight', 0.5, 0.7),
        sfx(180, 'whiff'),
        // double kick: the victim flies straight up; high five underneath
        sfx(222, 'hitLight', 0.9, 1.4),
        { f: 222, t: 'fx', fx: 'shine', at: 'a', bone: 'handR' },
        { f: 222, t: 'text', text: 'TOPE-LÀ !', style: 'boom', color: '#ffd23a', dur: 26 },
        { f: 228, t: 'fx', fx: 'exclaim', at: 'a' },
        { f: 228, t: 'fx', fx: 'exclaim', at: 'pote' },
        sfx(230, 'dash'),
        { f: 258, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        // leaves
        sfx(264, 'thwip'),
        { f: 260, t: 'say', who: 'a', text: 'Merci, voisin !', rate: 1.1, dur: 50 },
        { f: 274, t: 'fx', fx: 'speed', at: 'pote' },
      ],
    },
  };
}
