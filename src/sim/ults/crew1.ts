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
 * Elies — RETOUR EN ENFANCE: "Forme ultime !"… poof, Baby Elies (the star of the show).
 * "Areuh !", a flurry of tiny fists on the knee, a charging headbutt, a kick in the shin
 * and a victory dance — all for zero damage while the victim laughs — then a tantrum,
 * poof, Elies is back and lands ONE punch carrying the whole BBL MAX damage.
 */
function baby(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [104, 0],
    // waddles up to the victim's knees
    [118, 0.28],
    [142, 0.28],
    [146, 0.34],
    [152, 0.34],
    // backs up for a run-up
    [166, -0.12],
    [176, -0.12],
    // charges, head first
    [185, 0.26],
    [186, 0.26],
    // bounces off the knee, dizzy
    [192, 0.14],
    [198, 0.14],
    [204, 0.27],
    [242, 0.27],
    // tantrum, stomping backwards
    [256, 0.16],
    [258, 0.16],
    // Elies again: steps back cracking his knuckles, winds up, one punch
    [270, 0.02],
    [292, 0.02],
    [302, -0.3],
    [308, -0.22],
    [318, -0.18],
  ];
  // the flurry of tiny fists on the front knee (zero damage)
  const flurry = [122, 128, 134, 140, 146];
  return {
    id: 'baby',
    length: 360,
    hits: [
      ...flurry.map((f, i) => ({ f, dmg: 0, strength: 'light' as const, y: i === 4 ? 0.44 : 0.53, dx: i === 4 ? -0.22 : -0.21 })),
      // charging headbutt on the knee
      { f: 186, dmg: 0, strength: 'medium', y: 0.6, dx: -0.14 },
      // toe poke in the shin
      { f: 204, dmg: 0, strength: 'light', y: 0.25, dx: -0.13 },
      // the grown-up punch: everything at once
      { f: 308, dmg: 60, strength: 'heavy', y: 1.55 },
    ],
    ay: [[0, 0]],
    vy: [
      [308, 0],
      [314, 0.7],
      [322, 1.15],
      [326, 1.25],
      [332, 1.0],
      [340, 0],
    ],
    ax,
    dist: relDist(
      [
        [2, 0.82],
        [308, 0.82],
        [314, 1.5],
        [324, 2.4],
        [334, 3.0],
        [340, 3.3],
        [348, 3.45],
      ],
      ax,
    ),
    fall: 340,
    cams: [
      [0, 'close'],
      // Baby Elies: full-body shots at his own scale
      [32, 'amid'],
      [66, 'vface'],
      [98, 'amid'],
      [150, 'close'],
      [168, 'amid'],
      [218, 'vface'],
      [236, 'amid'],
      // poof: Elies is back
      [258, 'close'],
      [292, 'over'],
    ],
    cine: {
      swaps: [{ who: 'a', cast: 'babyelies', from: 32, to: 258, fx: 'poof' }],
      events: [
        { f: 3, t: 'say', who: 'a', text: 'Forme ultime… !', rate: 1.15, dur: 28 },
        { f: 10, t: 'sfx', id: 'powerUp' },
        { f: 12, t: 'fx', fx: 'powerAura', at: 'a' },
        { f: 20, t: 'shake', amt: 0.3 },
        { f: 24, t: 'fx', fx: 'powerAura', at: 'a', scale: 1.3 },
        { f: 28, t: 'shake', amt: 0.5 },
        // (Baby Elies speaks with his own voice while the swap is on)
        { f: 36, t: 'say', who: 'a', text: 'Areuh ! Areuh !', pitch: 1.4, rate: 1.15, dur: 34 },
        { f: 38, t: 'text', text: 'AREUH !', style: 'boom', color: '#ff8fd0', dur: 28 },
        { f: 44, t: 'sfx', id: 'crowdOoh' },
        { f: 64, t: 'fx', fx: 'question', at: 'v' },
        { f: 68, t: 'say', who: 'v', text: 'Hein ? C’est quoi ce bébé ?', rate: 1.25, dur: 52 },
        { f: 99, t: 'fx', fx: 'veins', at: 'a', bone: 'head' },
        { f: 123, t: 'text', text: 'PIF !', style: 'boom', dur: 16 },
        { f: 135, t: 'text', text: 'PAF !', style: 'boom', dur: 16 },
        { f: 147, t: 'text', text: 'POUF !', style: 'boom', dur: 18 },
        { f: 124, t: 'say', who: 'v', text: 'Ça chatouille !', rate: 1.2, dur: 30 },
        { f: 151, t: 'fx', fx: 'veins', at: 'a', bone: 'head' },
        { f: 156, t: 'say', who: 'a', text: 'Grrrrr !', pitch: 1.1, rate: 0.9, dur: 24 },
        { f: 157, t: 'shake', amt: 0.15 },
        { f: 170, t: 'sfx', id: 'step' },
        { f: 174, t: 'sfx', id: 'step' },
        { f: 177, t: 'sfx', id: 'dash' },
        { f: 178, t: 'fx', fx: 'speed', at: 'a' },
        { f: 186, t: 'sfx', id: 'bonk' },
        { f: 187, t: 'text', text: 'TOC !', style: 'boom', color: '#ffd84a', dur: 22 },
        // (placed low enough to stay in the toddler-sized shot)
        { f: 189, t: 'fx', fx: 'stars', at: 'a', y: 1.0 },
        { f: 205, t: 'text', text: 'BIM !', style: 'boom', dur: 16 },
        { f: 208, t: 'say', who: 'a', text: 'Gagné !', pitch: 1.2, rate: 1.1, dur: 14 },
        { f: 211, t: 'fx', fx: 'confetti', at: 'a' },
        { f: 218, t: 'sfx', id: 'crowdLaugh' },
        { f: 220, t: 'say', who: 'v', text: 'Ha ha ! Trop chou !', rate: 1.3, dur: 32 },
        // tantrum
        { f: 238, t: 'fx', fx: 'veins', at: 'a', bone: 'head' },
        { f: 239, t: 'shake', amt: 0.2 },
        { f: 243, t: 'sfx', id: 'step' },
        { f: 247, t: 'shake', amt: 0.2 },
        { f: 250, t: 'say', who: 'a', text: 'Ouiiiin !', pitch: 1.3, rate: 0.85, dur: 12 },
        { f: 251, t: 'text', text: 'OUIIIN !', style: 'boom', color: '#7ad0ff', dur: 24 },
        { f: 251, t: 'sfx', id: 'step' },
        { f: 255, t: 'shake', amt: 0.2 },
        // poof (swap ends at 258): Elies is back, the crying stops
        { f: 260, t: 'fx', fx: 'exclaim', at: 'v' },
        { f: 262, t: 'say', who: 'a', text: 'Le bébé a grandi.', rate: 1.15, dur: 34 },
        { f: 276, t: 'fx', fx: 'sweat', at: 'v' },
        { f: 296, t: 'say', who: 'v', text: 'Pitié !', rate: 1.2, dur: 16 },
        { f: 308, t: 'shake', amt: 1 },
        { f: 308, t: 'flash', amt: 0.6 },
        { f: 309, t: 'text', text: 'BAM !', style: 'boom', dur: 40 },
        { f: 316, t: 'sfx', id: 'crowdOoh' },
        { f: 340, t: 'shake', amt: 0.5 },
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
 * Mihaï — SUPER SAYAN BBL: screaming power-up, golden hair, shades on, "Trop facile."… and
 * then he ONLY kicks the crotch: three nonchalant low blows (hands in the pockets), a smug
 * look at the camera over his shades, six faster ones, and a last giant one: the victim
 * drops to its knees, then falls on its back, curled up.
 */
function saiyan(): UltimateScript {
  const slow = [150, 162, 174];
  const fast = [236, 244, 251, 257, 263, 269];
  const FIN = 290;
  const ax: CurveKeys = [
    [2, 0],
    [12, -0.25],
    [134, -0.25],
    [146, 0.06],
    [278, 0.06],
    [286, -0.04],
    [FIN, 0.08],
    [296, 0.12],
    [326, 0.12],
    [338, 0.04],
  ];
  // every low blow lifts the victim onto its toes; it hops around holding the crotch
  const lifts: CurveKeys = [];
  for (const f of slow) lifts.push([f - 1, 0], [f + 2, 0.07], [f + 5, 0]);
  for (const f of [184, 189, 194]) lifts.push([f - 2, 0], [f, 0.05], [f + 2, 0]);
  for (const f of fast) lifts.push([f - 1, 0], [f + 2, 0.06], [f + 4, 0]);
  const kicks = [...slow, ...fast];
  // impact on the crotch (instep between the legs)
  const crotch = (f: number, i: number) => ({
    f,
    dmg: i < 6 ? 4 : 5,
    strength: i < 3 ? ('medium' as const) : ('light' as const),
    y: 0.93,
    dx: -0.06,
  });
  return {
    id: 'saiyan',
    length: 360,
    hits: [...kicks.map(crotch), { f: FIN, dmg: 21, strength: 'heavy', y: 0.97, dx: -0.06 }],
    ay: [[0, 0]],
    vy: [...lifts, [FIN - 1, 0], [FIN + 3, 0.2], [FIN + 8, 0.28], [FIN + 13, 0.12], [FIN + 16, 0]],
    ax,
    dist: relDist(
      [
        [2, 0.85],
        [140, 0.97],
        [FIN, 0.97],
        [FIN + 8, 1.17],
        [FIN + 16, 1.29],
        [FIN + 26, 1.35],
      ],
      ax,
    ),
    fall: 322,
    cams: [
      [0, 'close'],
      [22, 'hero'],
      [98, 'close'],
      // the low blows: side view, the victim's face, Mihaï's smug face, low angle
      [136, 'side'],
      [180, 'vface'],
      [198, 'close'],
      [228, 'vface'],
      [240, 'low'],
      [272, 'side'],
      [328, 'close'],
    ],
    cine: {
      swaps: [{ who: 'a', cast: 'mihai_ssj', from: 60, to: 360, fx: 'power' }],
      props: [
        { prop: 'shades', on: 'a', bone: 'head', from: 110, to: 202 },
        // pulled down the nose to look at the camera over them
        { prop: 'shades', on: 'a', bone: 'head', from: 202, to: 224, pos: [0, -0.05, 0.016] },
        { prop: 'shades', on: 'a', bone: 'head', from: 224, to: 360 },
      ],
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
        { f: 10, t: 'say', who: 'a', text: 'Haaaaaaaaa !', rate: 0.7, dur: 48 },
        { f: 12, t: 'sfx', id: 'powerUp' },
        { f: 16, t: 'fx', fx: 'powerAura', at: 'a' },
        { f: 24, t: 'shake', amt: 0.3 },
        { f: 30, t: 'fx', fx: 'powerAura', at: 'a' },
        { f: 38, t: 'shake', amt: 0.45 },
        { f: 44, t: 'fx', fx: 'powerAura', at: 'a', scale: 1.3 },
        { f: 52, t: 'shake', amt: 0.6 },
        { f: 60, t: 'flash', color: '#ffe066', amt: 0.9 },
        { f: 60, t: 'shake', amt: 1 },
        { f: 60, t: 'sfx', id: 'super' },
        { f: 62, t: 'text', text: 'SUPER SAYAN !', style: 'punch', color: '#ffd84a', dur: 44 },
        { f: 64, t: 'fx', fx: 'powerAura', at: 'a', scale: 1.5 },
        { f: 66, t: 'sfx', id: 'crowdOoh' },
        { f: 70, t: 'fx', fx: 'exclaim', at: 'v' },
        { f: 80, t: 'fx', fx: 'sweat', at: 'v' },
        { f: 84, t: 'fx', fx: 'powerAura', at: 'a' },
        { f: 110, t: 'sfx', id: 'shine' },
        { f: 112, t: 'fx', fx: 'shine', at: 'a', bone: 'head' },
        { f: 116, t: 'say', who: 'a', text: 'Trop facile.', dur: 30 },
        // three slow low blows
        { f: 151, t: 'text', text: 'DING !', style: 'boom', dur: 20 },
        { f: 151, t: 'fx', fx: 'pain', at: 'v', dx: -0.04, y: 0.9 },
        { f: 152, t: 'say', who: 'v', text: 'Ouille !', pitch: 2, dur: 18 },
        { f: 154, t: 'sfx', id: 'crowdOoh' },
        { f: 163, t: 'text', text: 'DONG !', style: 'boom', dur: 20 },
        { f: 163, t: 'sfx', id: 'boing' },
        { f: 175, t: 'text', text: 'CRAC !', style: 'boom', color: '#ff5a4a', dur: 22 },
        { f: 175, t: 'fx', fx: 'pain', at: 'v', dx: -0.04, y: 0.9 },
        { f: 176, t: 'shake', amt: 0.25 },
        { f: 182, t: 'say', who: 'v', text: 'Pas là !', pitch: 2.1, rate: 1.1, dur: 18 },
        { f: 184, t: 'fx', fx: 'sweat', at: 'v' },
        // a look at the camera over the shades
        { f: 198, t: 'say', who: 'a', text: 'Quoi ? Ça marche.', rate: 1.2, dur: 34 },
        { f: 204, t: 'sfx', id: 'shine' },
        { f: 205, t: 'fx', fx: 'shine', at: 'a', bone: 'head' },
        { f: 208, t: 'sfx', id: 'crowdLaugh' },
        // and again, faster and faster
        { f: 232, t: 'say', who: 'v', text: 'Encore ?!', pitch: 2.1, rate: 1.1, dur: 20 },
        { f: 230, t: 'fx', fx: 'exclaim', at: 'v' },
        { f: 237, t: 'text', text: 'DING !', style: 'boom', dur: 14 },
        { f: 245, t: 'text', text: 'DONG !', style: 'boom', dur: 14 },
        { f: 245, t: 'sfx', id: 'boing' },
        { f: 252, t: 'text', text: 'DING !', style: 'boom', dur: 14 },
        { f: 252, t: 'fx', fx: 'pain', at: 'v', dx: -0.04, y: 0.9 },
        { f: 258, t: 'text', text: 'DONG !', style: 'boom', dur: 14 },
        { f: 258, t: 'sfx', id: 'bonk' },
        { f: 264, t: 'text', text: 'CRAC !', style: 'boom', color: '#ff5a4a', dur: 14 },
        { f: 270, t: 'text', text: 'PAS LÀ !!!', style: 'punch', color: '#ff5a4a', dur: 24 },
        { f: 270, t: 'fx', fx: 'pain', at: 'v', dx: -0.04, y: 0.9 },
        // the last one
        { f: FIN, t: 'shake', amt: 1 },
        { f: FIN, t: 'flash', color: '#ffe066', amt: 0.5 },
        { f: FIN, t: 'sfx', id: 'boing' },
        { f: FIN + 1, t: 'sfx', id: 'crack' },
        { f: FIN + 1, t: 'text', text: 'DING DONG !!!', style: 'punch', color: '#ffd84a', dur: 40 },
        { f: FIN + 2, t: 'fx', fx: 'pain', at: 'v', dx: -0.04, y: 1.1 },
        { f: FIN + 2, t: 'say', who: 'v', text: 'Ouiiiiille…', pitch: 2.4, rate: 0.8, dur: 44 },
        { f: FIN + 6, t: 'sfx', id: 'crowdOoh' },
        { f: 305, t: 'sfx', id: 'land' },
        { f: 322, t: 'shake', amt: 0.4 },
        { f: 325, t: 'fx', fx: 'stars', at: 'v' },
        { f: 328, t: 'say', who: 'a', text: 'Dans le mille.', rate: 1.1, dur: 28 },
        { f: 340, t: 'sfx', id: 'shine' },
        { f: 340, t: 'fx', fx: 'shine', at: 'a', bone: 'head' },
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
