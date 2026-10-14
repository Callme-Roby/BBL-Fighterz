import { relDist, type CurveKeys, type UltimateScript } from '../ultimates';

/**
 * BBL MAX scripts: Elies (with Baby Elies), Thomas, Dylan, Mihaï, Benji.
 * Built lazily (called from src/sim/ultimates.ts) so the helpers imported from
 * '../ultimates' are ready. Clips: src/render/ults/crew1.ts.
 */
export function crew1Scripts(): UltimateScript[] {
  return [baby(), feint(), kneecap(), saiyan(), config()];
}

/**
 * Elies — RETOUR EN ENFANCE: "forme ultime"… poof, Baby Elies. The toddler slaps and kicks
 * the victim's shins for zero damage while they laugh, poof, Elies is back and lands ONE
 * punch carrying the whole BBL MAX damage.
 */
function baby(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [46, 0],
    [57, 0.36],
    [126, 0.36],
    [172, 0.34],
    [182, 0.02],
    [214, 0.02],
    [234, -0.3],
    [240, -0.22],
    [250, -0.18],
  ];
  return {
    id: 'baby',
    length: 300,
    hits: [
      // Baby Elies: tiny slaps and kicks on the knees / shins, no damage at all
      { f: 64, dmg: 0, strength: 'light', y: 0.45 },
      { f: 76, dmg: 0, strength: 'light', y: 0.45 },
      { f: 88, dmg: 0, strength: 'light', y: 0.3 },
      { f: 100, dmg: 0, strength: 'light', y: 0.5 },
      { f: 112, dmg: 0, strength: 'light', y: 0.3 },
      { f: 124, dmg: 0, strength: 'light', y: 0.45 },
      // the grown-up punch: everything at once
      { f: 240, dmg: 60, strength: 'heavy', y: 1.55 },
    ],
    ay: [[0, 0]],
    vy: [
      [240, 0],
      [246, 0.7],
      [254, 1.15],
      [258, 1.25],
      [264, 1.0],
      [272, 0],
    ],
    ax,
    dist: relDist(
      [
        [2, 0.82],
        [240, 0.82],
        [246, 1.5],
        [256, 2.4],
        [266, 3.0],
        [272, 3.3],
        [280, 3.45],
      ],
      ax,
    ),
    fall: 272,
    cams: [
      [0, 'close'],
      [28, 'side'],
      [60, 'low'],
      [76, 'vface'],
      [126, 'two'],
      [186, 'close'],
      [212, 'vface'],
      [230, 'over'],
      [246, 'wide'],
      [282, 'close'],
    ],
    cine: {
      swaps: [{ who: 'a', cast: 'babyelies', from: 30, to: 186, fx: 'poof' }],
      events: [
        { f: 14, t: 'sfx', id: 'powerUp' },
        { f: 16, t: 'fx', fx: 'powerAura', at: 'a' },
        { f: 22, t: 'shake', amt: 0.3 },
        // (spoken with Baby Elies' own voice while the swap is on)
        { f: 32, t: 'say', who: 'a', text: 'Areuh ! Areuh !', pitch: 1.8, rate: 1.25, dur: 40 },
        { f: 66, t: 'fx', fx: 'question', at: 'v' },
        { f: 80, t: 'say', who: 'v', text: 'Hein ? C’est quoi ce bébé ?', rate: 1.3, dur: 74 },
        { f: 160, t: 'sfx', id: 'crowdLaugh' },
        { f: 164, t: 'say', who: 'v', text: 'Ha ha ha !', rate: 1.3, dur: 30 },
        { f: 160, t: 'fx', fx: 'veins', at: 'a', bone: 'head' },
        { f: 189, t: 'fx', fx: 'exclaim', at: 'v' },
        { f: 196, t: 'say', who: 'a', text: 'Le bébé a grandi.', rate: 1.2, dur: 46 },
        { f: 204, t: 'fx', fx: 'sweat', at: 'v' },
        { f: 240, t: 'shake', amt: 1 },
        { f: 240, t: 'flash', amt: 0.6 },
        { f: 241, t: 'text', text: 'BAM !', style: 'boom', dur: 40 },
        { f: 248, t: 'sfx', id: 'crowdOoh' },
        { f: 272, t: 'shake', amt: 0.5 },
      ],
    },
  };
}

/**
 * Thomas — REGARDE DERRIÈRE TOI !: points behind the victim, who turns around; tiptoes up,
 * three kicks in the backside, a big punt that sends them flat on their face, then runs
 * away to the other end of the arena and waves.
 */
function feint(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [66, 0],
    [94, 0.14],
    [100, 0.18],
    [110, 0.36],
    [116, 0.48],
    [126, 0.66],
    [132, 0.78],
    [144, 0.8],
    [152, 0.74],
    [158, 0.94],
    [168, 0.98],
    [190, 0.98],
    [196, 0.82],
    [206, -1.0],
    // runs to the wall (the sim stops the attacker there once every blow has landed)
    [248, -8],
  ];
  return {
    id: 'feint',
    length: 320,
    hits: [
      // kicks in the backside: the victim has its back turned, sparks on its back side
      { f: 100, dmg: 9, strength: 'medium', y: 0.95, dx: -0.14 },
      { f: 116, dmg: 10, strength: 'medium', y: 0.95, dx: -0.14 },
      { f: 132, dmg: 11, strength: 'medium', y: 0.95, dx: -0.14 },
      { f: 158, dmg: 30, strength: 'heavy', y: 0.95, dx: -0.14 },
    ],
    ay: [[0, 0]],
    vy: [
      [100, 0],
      [104, 0.2],
      [110, 0],
      [116, 0],
      [120, 0.22],
      [126, 0],
      [132, 0],
      [136, 0.25],
      [142, 0],
      [158, 0],
      [164, 0.75],
      [172, 1.0],
      [178, 0.8],
      [186, 0],
    ],
    ax,
    dist: relDist(
      [
        [2, 0.92],
        [54, 0.92],
        [70, 1.06],
        [88, 1.14],
        [99, 1.18],
        [100, 1.22],
        [108, 1.46],
        [115, 1.52],
        [116, 1.56],
        [124, 1.76],
        [131, 1.82],
        [132, 1.86],
        [140, 2.04],
        [157, 2.06],
        [158, 2.11],
        [168, 2.6],
        [178, 3.05],
        [186, 3.3],
        [194, 3.4],
      ],
      ax,
    ),
    fall: 186,
    victimTurn: [[54, 280]],
    cams: [
      [0, 'close'],
      [40, 'two'],
      [66, 'side'],
      [96, 'over'],
      [144, 'vface'],
      [154, 'side'],
      [164, 'low'],
      [192, 'wide'],
      [260, 'close'],
    ],
    cine: {
      events: [
        { f: 6, t: 'fx', fx: 'exclaim', at: 'a' },
        { f: 8, t: 'say', who: 'a', text: 'Oh ! Regarde derrière toi !', rate: 1.3, dur: 70 },
        { f: 58, t: 'fx', fx: 'question', at: 'v' },
        { f: 72, t: 'text', text: 'Chuuut…', style: 'caption', dur: 30 },
        { f: 96, t: 'say', who: 'v', text: 'Hein ? Où ça ?', rate: 1.2, dur: 40 },
        { f: 150, t: 'say', who: 'v', text: 'Aïe ! Mes fesses !', pitch: 1.3, rate: 1.15, dur: 44 },
        { f: 137, t: 'fx', fx: 'pain', at: 'v', dx: -0.15, y: 0.95 },
        { f: 140, t: 'sfx', id: 'crowdLaugh' },
        { f: 158, t: 'shake', amt: 0.8 },
        { f: 159, t: 'text', text: 'BOUM !', style: 'boom', dur: 36 },
        { f: 186, t: 'shake', amt: 0.5 },
        { f: 188, t: 'sfx', id: 'crowdOoh' },
        { f: 196, t: 'sfx', id: 'dash' },
        { f: 198, t: 'fx', fx: 'speed', at: 'a' },
        { f: 214, t: 'fx', fx: 'speed', at: 'a' },
        { f: 230, t: 'fx', fx: 'speed', at: 'a' },
        { f: 252, t: 'say', who: 'a', text: 'Bye bye ! Trop lent !', rate: 1.2, dur: 56 },
        { f: 262, t: 'sfx', id: 'crowdLaugh' },
      ],
    },
  };
}

/**
 * Dylan — JAMBES DE FEU: low kick, middle kick, high kick, spinning back kick, push kick,
 * jumping axe kick (legs only)… then his knee gives way: he hops around holding it.
 */
function kneecap(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [10, 0.04],
    [22, 0.12],
    [34, 0.26],
    [44, 0.28],
    [50, 0.3],
    [58, 0.45],
    [64, 0.55],
    [70, 0.6],
    [80, 1.05],
    [92, 1.3],
    [100, 1.32],
    [124, 1.32],
    // hopping around on one leg
    [136, 1.1],
    [148, 1.25],
    [160, 1.05],
    [172, 1.3],
    [188, 1.15],
    [290, 1.15],
  ];
  // hops: up on 128 + 8k, down on 132 + 8k
  const hops: CurveKeys = [];
  for (let f = 128; f <= 184; f += 8) hops.push([f, 0.14], [f + 4, 0]);
  return {
    id: 'kneecap',
    length: 290,
    hits: [
      { f: 10, dmg: 6, strength: 'light', y: 0.5 },
      { f: 22, dmg: 7, strength: 'medium', y: 0.98 },
      { f: 34, dmg: 8, strength: 'medium', y: 1.45 },
      { f: 50, dmg: 10, strength: 'heavy', y: 0.95 },
      { f: 64, dmg: 9, strength: 'medium', y: 1.0 },
      { f: 92, dmg: 24, strength: 'heavy', y: -1 },
    ],
    selfHits: [{ f: 118, dmg: 10, y: 0.5 }],
    ay: [[68, 0], [74, 0.7], [80, 1.15], [86, 1.3], [90, 1.18], [92, 0.96], [96, 0.5], [100, 0], [124, 0], ...hops],
    vy: [
      [64, 0],
      [72, 0.5],
      [80, 0.72],
      [86, 0.75],
      [92, 0.68],
      [98, 0],
    ],
    ax,
    dist: relDist(
      [
        [2, 0.82],
        [10, 0.86],
        [22, 1.08],
        [34, 1.12],
        [44, 1.14],
        [50, 1.16],
        [58, 1.42],
        [64, 1.45],
        [72, 1.8],
        [80, 2.0],
        [92, 2.15],
        [98, 2.25],
      ],
      ax,
    ),
    fall: 98,
    cams: [
      [0, 'side'],
      [28, 'front'],
      [46, 'over'],
      [66, 'low'],
      [90, 'high'],
      [106, 'close'],
      [116, 'side'],
      [126, 'close'],
      [150, 'two'],
      [196, 'close'],
    ],
    cine: {
      events: [
        { f: 92, t: 'shake', amt: 1 },
        { f: 93, t: 'text', text: 'BOUM !', style: 'boom', dur: 32 },
        { f: 100, t: 'shake', amt: 0.4 },
        { f: 112, t: 'sfx', id: 'flex' },
        { f: 118, t: 'sfx', id: 'crack' },
        { f: 118, t: 'fx', fx: 'pain', at: 'a', dx: 0.08, y: 0.5 },
        { f: 119, t: 'text', text: 'CRAC !', style: 'boom', color: '#ff5a4a', dur: 34 },
        { f: 120, t: 'shake', amt: 0.3 },
        { f: 126, t: 'say', who: 'a', text: 'Aïe aïe aïe, mon genou !', rate: 1.2, dur: 66 },
        { f: 134, t: 'sfx', id: 'crowdLaugh' },
        { f: 150, t: 'fx', fx: 'pain', at: 'a', dx: 0.1, y: 0.55 },
        { f: 168, t: 'fx', fx: 'sweat', at: 'a' },
        { f: 200, t: 'say', who: 'a', text: 'Je suis plus tout jeune…', rate: 0.95, dur: 80 },
      ],
    },
  };
}

/**
 * Mihaï — SUPER SAYAN BBL: screaming power-up, golden hair, shades on, "Trop facile.", six
 * nonchalant low blows (hands in the pockets) and a last one that sends the victim flying.
 */
function saiyan(): UltimateScript {
  const kicks = [148, 156, 164, 172, 180, 188];
  const ax: CurveKeys = [
    [2, 0],
    [12, -0.25],
    [130, -0.25],
    [142, 0.04],
    [148, 0.08],
    [196, 0.12],
    [202, -0.04],
    [208, 0.06],
    [216, 0.1],
  ];
  // the victim is lifted onto its toes by every low blow
  const lifts: CurveKeys = [];
  for (const f of kicks) lifts.push([f - 1, 0], [f + 2, 0.07], [f + 5, 0]);
  return {
    id: 'saiyan',
    length: 310,
    hits: [
      ...kicks.map((f, i) => ({ f, dmg: i < 3 ? 5 : 6, strength: i < 3 ? ('light' as const) : ('medium' as const), y: 0.88 - i * 0.015, dx: -0.1 })),
      { f: 208, dmg: 27, strength: 'heavy', y: 0.85, dx: -0.1 },
    ],
    ay: [[0, 0]],
    vy: [...lifts, [207, 0], [214, 1.2], [222, 2.0], [228, 2.2], [234, 2.0], [242, 1.0], [248, 0]],
    ax,
    dist: relDist(
      [
        [2, 0.85],
        [140, 0.92],
        [208, 0.92],
        [216, 1.3],
        [226, 1.9],
        [236, 2.4],
        [248, 2.8],
        [256, 2.9],
      ],
      ax,
    ),
    fall: 248,
    cams: [
      [0, 'close'],
      [22, 'hero'],
      [56, 'close'],
      [74, 'hero'],
      [102, 'close'],
      [136, 'side'],
      [166, 'vface'],
      [200, 'low'],
      [230, 'high'],
      [254, 'close'],
    ],
    cine: {
      swaps: [{ who: 'a', cast: 'mihai_ssj', from: 60, to: 310, fx: 'power' }],
      props: [{ prop: 'shades', on: 'a', bone: 'head', from: 112, to: 310 }],
      light: [
        [1, 0.4],
        [12, 0.4],
        [50, 0.15],
        [59, 0.15],
        [60, 1.3],
        [72, 0.6],
        [100, 0.45],
      ],
      events: [
        { f: 12, t: 'say', who: 'a', text: 'Haaaaaaaaa !', rate: 0.7, dur: 50 },
        { f: 14, t: 'sfx', id: 'powerUp' },
        { f: 18, t: 'fx', fx: 'powerAura', at: 'a' },
        { f: 26, t: 'shake', amt: 0.3 },
        { f: 32, t: 'fx', fx: 'powerAura', at: 'a' },
        { f: 40, t: 'shake', amt: 0.45 },
        { f: 46, t: 'fx', fx: 'powerAura', at: 'a', scale: 1.3 },
        { f: 54, t: 'shake', amt: 0.6 },
        { f: 60, t: 'flash', color: '#ffe066', amt: 0.9 },
        { f: 60, t: 'shake', amt: 1 },
        { f: 60, t: 'sfx', id: 'super' },
        { f: 62, t: 'text', text: 'SUPER SAYAN !', style: 'punch', color: '#ffd84a', dur: 50 },
        { f: 64, t: 'fx', fx: 'powerAura', at: 'a', scale: 1.5 },
        { f: 66, t: 'sfx', id: 'crowdOoh' },
        { f: 70, t: 'fx', fx: 'exclaim', at: 'v' },
        { f: 80, t: 'fx', fx: 'sweat', at: 'v' },
        { f: 84, t: 'fx', fx: 'powerAura', at: 'a' },
        { f: 112, t: 'sfx', id: 'shine' },
        { f: 114, t: 'fx', fx: 'shine', at: 'a', bone: 'head' },
        { f: 120, t: 'say', who: 'a', text: 'Trop facile.', dur: 44 },
        { f: 152, t: 'fx', fx: 'pain', at: 'v', dx: -0.1, y: 0.85 },
        { f: 168, t: 'say', who: 'v', text: 'Ouille !', pitch: 1.9, dur: 30 },
        { f: 166, t: 'sfx', id: 'crowdOoh' },
        { f: 176, t: 'fx', fx: 'pain', at: 'v', dx: -0.1, y: 0.8 },
        { f: 208, t: 'shake', amt: 1 },
        { f: 208, t: 'flash', color: '#ffe066', amt: 0.5 },
        { f: 209, t: 'sfx', id: 'boing' },
        { f: 209, t: 'text', text: 'DING !', style: 'boom', dur: 36 },
        { f: 212, t: 'say', who: 'v', text: 'Ouiiiiille !', pitch: 2.2, dur: 40 },
        { f: 248, t: 'shake', amt: 0.5 },
        { f: 266, t: 'sfx', id: 'shine' },
        { f: 266, t: 'fx', fx: 'shine', at: 'a', bone: 'head' },
      ],
    },
  };
}

/**
 * Benji — C'EST QUOI TA CONFIG ?: calmly asks about the victim's computer, who starts
 * answering enthusiastically… and eats one giant uppercut to the sky.
 */
function config(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [160, 0],
    [170, 0.22],
    [180, 0.28],
    [196, 0.3],
  ];
  return {
    id: 'config',
    length: 280,
    hits: [{ f: 170, dmg: 60, strength: 'heavy', y: 1.5 }],
    ay: [
      [170, 0],
      [176, 0.55],
      [182, 0.78],
      [188, 0.6],
      [194, 0],
    ],
    vy: [
      [170, 0],
      [176, 1.2],
      [182, 2.1],
      [188, 2.8],
      [194, 3.25],
      [200, 3.4],
      [206, 3.2],
      [212, 2.6],
      [218, 1.6],
      [223, 0.7],
      [226, 0],
    ],
    ax,
    dist: relDist(
      [
        [2, 0.92],
        [170, 0.92],
        [180, 1.3],
        [196, 1.65],
        [212, 1.95],
        [226, 2.2],
        [234, 2.3],
      ],
      ax,
    ),
    fall: 226,
    cams: [
      [0, 'two'],
      [86, 'vface'],
      [100, 'two'],
      [128, 'close'],
      [152, 'low'],
      [180, 'wide'],
      [220, 'high'],
      [230, 'close'],
    ],
    cine: {
      events: [
        { f: 8, t: 'say', who: 'a', text: 'Au fait… c’est quoi ta config ?', rate: 1.25, dur: 86 },
        { f: 90, t: 'fx', fx: 'exclaim', at: 'v' },
        { f: 98, t: 'say', who: 'v', text: 'Euh… une RTX… avec 32 gigas de…', rate: 1.25, dur: 72 },
        { f: 102, t: 'fx', fx: 'question', at: 'v' },
        { f: 170, t: 'shake', amt: 1 },
        { f: 170, t: 'flash', amt: 0.7 },
        { f: 171, t: 'text', text: 'POW !', style: 'boom', dur: 40 },
        { f: 178, t: 'sfx', id: 'crowdOoh' },
        { f: 226, t: 'shake', amt: 0.6 },
        { f: 230, t: 'fx', fx: 'stars', at: 'v' },
        { f: 232, t: 'say', who: 'a', text: 'Pas assez de RAM.', rate: 1.1, dur: 46 },
      ],
    },
  };
}
