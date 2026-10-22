import { curve, relDist, type CineEvent, type CurveKeys, type UltimateScript } from '../ultimates';

/**
 * BBL MAX scripts of the second roster page: Matteo (the M6 penalty).
 * Built lazily (called from src/sim/ultimates.ts) so the helpers imported from
 * '../ultimates' are ready.
 *
 * Clips: src/render/ults/crew4.ts (same frame base: frame k of the script = frame k of the clips).
 * One script frame lasts 1/36 s (cinematics play at 3/5 speed).
 */
export function crew4Scripts(): UltimateScript[] {
  return [m6()];
}

// (function declarations: hoisted, so they are usable even through the import cycle with '../ultimates')
type SfxEvent = Extract<CineEvent, { t: 'sfx' }>;
function sfx(f: number, id: SfxEvent['id'], vol?: number, pitch?: number): CineEvent {
  const e: SfxEvent = { f, t: 'sfx', id };
  if (vol !== undefined) e.vol = vol;
  if (pitch !== undefined) e.pitch = pitch;
  return e;
}
type TextEvent = Extract<CineEvent, { t: 'text' }>;
function txt(f: number, text: string, style: NonNullable<TextEvent['style']>, dur: number, color?: string): CineEvent {
  const e: TextEvent = { f, t: 'text', text, style, dur };
  if (color) e.color = color;
  return e;
}

/** A point of a scripted path: frame, position (x on the attacker's axis, y up, z toward the camera), arc height of the hop that reaches it. */
type Waypoint = [f: number, x: number, y: number, z: number, arc?: number];

/**
 * Position curves of an object hopping from waypoint to waypoint: straight lines in x / z,
 * a parabola in y (`arc` = extra height at mid-flight), one key per script frame.
 */
function hops(points: Waypoint[]): { x: CurveKeys; y: CurveKeys; z: CurveKeys } {
  const x: CurveKeys = [];
  const y: CurveKeys = [];
  const z: CurveKeys = [];
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  for (let i = 0; i < points.length; i++) {
    const [f1, x1, y1, z1, arc = 0] = points[i];
    if (i === 0) {
      x.push([f1, x1]);
      y.push([f1, y1]);
      z.push([f1, z1]);
      continue;
    }
    const [f0, x0, y0, z0] = points[i - 1];
    for (let f = f0 + 1; f <= f1; f++) {
      const t = (f - f0) / (f1 - f0);
      x.push([f, r3(x0 + (x1 - x0) * t)]);
      y.push([f, r3(y0 + (y1 - y0) * t + 4 * arc * t * (1 - t))]);
      z.push([f, r3(z0 + (z1 - z0) * t)]);
    }
  }
  return { x, y, z };
}

// ---------------------------------------------------------------------------
// Matteo — LE M6
// "On règle ça aux tirs au but." Poof: the opponent is a goalkeeper, a goal pops up behind
// them. Matteo kisses the ball, places it (twice), steps back, runs up, shoots… way over the
// bar. The ball bounces everywhere like a bouncy ball: behind the goal, on the crossbar, on the
// floor, into the camera lens, on the floor, on the goalkeeper's head (BONK), up to the
// "ceiling", down behind Matteo — who is laughing — and into his back: it carries him AND the
// goalkeeper into the net. GOAL ! The net springs them out: both end up on the floor.
// ---------------------------------------------------------------------------
/** goal line (the goal mouth faces the attacker, its net goes 1.5 m further) */
const GOAL_X = 3.75;
/** penalty spot */
const SPOT_X = 1.55;
const BALL_R = 0.13;

function m6(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [8, -0.08],
    [86, -0.08],
    // walks to the spot with the ball
    [92, 0.2],
    [98, 0.5],
    [104, 0.82],
    [108, 0.92],
    [124, 0.92],
    // steps back, four steps
    [130, 0.68],
    [136, 0.44],
    [142, 0.2],
    [148, -0.04],
    [158, -0.04],
    // run-up and the shot
    [162, 0.1],
    [166, 0.4],
    [170, 0.78],
    [172, 0.98],
    [178, 1.14],
    [186, 1.2],
    [270, 1.2],
    // the ball hits him in the back: carried away, into the goalkeeper, into the net
    [276, 1.2],
    [282, 1.9],
    [288, 2.95],
    [298, 3.75],
    // the net springs him out: falls on his back
    [304, 3.4],
    [310, 3.0],
    [316, 2.92],
  ];
  // victim (goalkeeper from 34): absolute position along the attacker's axis
  const vx: CurveKeys = [
    [2, 0.85],
    [10, 1.15],
    [33, 1.15],
    // poof: on the goal line
    [34, 3.45],
    [288, 3.45],
    // carried into the net
    [294, 4.15],
    [298, 4.62],
    [302, 4.4],
    [306, 4.25],
  ];
  // the ball: placed on the spot, shot over the bar, bouncing everywhere, into Matteo's back
  const BACK_Y = 1.25;
  const flight = hops([
    [172, SPOT_X, BALL_R, 0],
    [186, 6.1, BALL_R, -1.3, 2.7], // way over the bar, lands behind the goal
    [198, GOAL_X + 0.05, 2.2, -0.7, 0.9], // back onto the crossbar
    [210, 2.5, BALL_R, 1.5, 0.8], // floor, in front of the goal
    [224, 1.35, 1.36, 4.85, 0.7], // into the camera lens
    [238, 2.55, BALL_R, 1.2, 0.5], // floor
    [248, 3.33, 1.74, 0.05, 0.45], // the goalkeeper's head
    [266, -1.1, BALL_R, 0.25, 3.4], // up to the "ceiling", down behind Matteo
    [276, 1.2 - 0.24, BACK_Y, 0, 0.5], // into Matteo's back
  ]);
  // carried on his back, then into the net, then rolling out a little
  const carryX: CurveKeys = [];
  const carryY: CurveKeys = [];
  for (let f = 277; f <= 298; f++) {
    const t = Math.min(1, (f - 276) / 6);
    carryX.push([f, Math.round((curve(ax, f) - 0.24 + 0.1 * t) * 1000) / 1000]);
    carryY.push([f, Math.round((curve(ay(), f) + BACK_Y - 0.13 * t) * 1000) / 1000]);
  }
  const ballX: CurveKeys = [...flight.x, ...carryX, [304, 5.0], [312, 4.85], [330, 4.7]];
  const ballY: CurveKeys = [...flight.y, ...carryY, [302, 1.0], [306, BALL_R], [309, 0.3], [312, BALL_R], [314, 0.18], [316, BALL_R]];
  const ballZ: CurveKeys = [...flight.z, [298, 0], [304, 0.35], [330, 0.55]];
  // rolling: quarter turns while it is adjusted, then a fast spin in flight
  const spin: CurveKeys = [
    [104, 0],
    [108, 0],
    [112, 70],
    [116, 70],
    [120, 35],
    [172, 35],
    [276, 35 + 104 * 24],
    [298, 35 + 104 * 24 + 22 * 10],
    [330, 35 + 104 * 24 + 22 * 10 + 200],
  ];
  // the goal shakes when they crash into the net
  const goalX: CurveKeys = [
    [34, GOAL_X],
    [297, GOAL_X],
    [298, GOAL_X + 0.09],
    [300, GOAL_X - 0.05],
    [302, GOAL_X + 0.04],
    [304, GOAL_X - 0.02],
    [306, GOAL_X],
  ];

  return {
    id: 'm6',
    length: 384,
    hits: [
      // the ball on the goalkeeper's head (the script plays its own bonk)
      { f: 248, dmg: 10, strength: 'medium', y: 1.74, dx: -0.12, kind: 'none' },
      // Matteo carried by the ball crashes into the goalkeeper
      { f: 288, dmg: 16, strength: 'heavy', y: 1.3 },
      // both into the net
      { f: 298, dmg: 34, strength: 'heavy', y: 1.0 },
    ],
    // the ball in his own back
    selfHits: [{ f: 276, dmg: 8, y: 1.2 }],
    attackerDown: true,
    ay: ay(),
    vy: [
      [288, 0],
      [292, 0.35],
      [298, 0.5],
      [302, 0.3],
      [306, 0],
    ],
    ax,
    dist: relDist(vx, ax),
    fall: 306,
    cams: [
      [0, 'two'],
      [34, 'path'],
      [46, 'vface'],
      [70, 'close'],
      [88, 'path'],
      [124, 'over'],
      [158, 'low'],
      [168, 'path'],
    ],
    cine: {
      swaps: [
        {
          who: 'v',
          cast: 'self',
          // long-sleeved goalkeeper jersey, black shorts, socks up
          outfit: { top: 'tracksuit', topColor: '#c6f02e', trimColor: '#1b1c20', pantsColor: '#1b1c20', shoesColor: '#1b1c20', shorts: true, baggy: false, beltColor: undefined, stains: undefined, web: undefined },
          from: 34,
          to: 384,
          fx: 'poof',
        },
      ],
      props: [
        { prop: 'gkglove', on: 'v', bone: 'handL', from: 34, to: 384 },
        { prop: 'gkglove', on: 'v', bone: 'handR', from: 34, to: 384 },
        { prop: 'football', on: 'a', bone: 'handR', from: 72, to: 104, pos: [0, -0.12, 0.13] },
      ],
      objects: [
        { id: 'goal', prop: 'goal', from: 34, to: 384, x: goalX, yaw: 180, poof: true },
        { id: 'ball', prop: 'football', from: 104, to: 384, x: ballX, y: ballY, z: ballZ, spin },
      ],
      cams: [
        // the goal pops up: wide, from the side, slightly behind Matteo
        { from: 34, to: 46, x: [[34, 1.9]], y: [[34, 1.6]], z: [[34, 5.9]], look: { x: [[34, 2.0]], y: [[34, 1.0]] } },
        // walking to the spot, then low close-up on the ball being placed
        { from: 88, to: 104, x: [[88, 1.7], [104, 2.1]], y: [[88, 1.35], [104, 1.0]], z: [[88, 3.8], [104, 2.9]], look: { at: 'a', dy: -0.6 } },
        { from: 104, to: 124, x: [[104, 2.05], [124, 2.15]], y: [[104, 0.6], [124, 0.5]], z: [[104, 1.35], [124, 1.2]], look: { at: 'obj:ball', dy: 0.22 } },
        // the shot: following the ball over the bar (high, wide)
        { from: 168, to: 198, x: [[168, 0.4], [198, 2.4]], y: [[168, 1.5], [198, 2.2]], z: [[168, 5.4], [198, 6.4]], look: { at: 'obj:ball' } },
        // the lens: a fixed camera the ball comes straight into
        { from: 198, to: 232, x: [[198, 1.35]], y: [[198, 1.4]], z: [[198, 5.4]], look: { at: 'obj:ball' } },
        // floor, the goalkeeper's head, up to the sky and down behind Matteo
        { from: 232, to: 276, x: [[232, 1.3], [276, 0.6]], y: [[232, 1.5], [276, 1.4]], z: [[232, 6.8], [276, 6.0]], look: { at: 'obj:ball' } },
        // carried away: tracking from the side
        { from: 276, to: 299, x: [[276, 1.2], [299, 3.4]], y: [[276, 1.3], [299, 1.3]], z: [[276, 4.0], [299, 4.6]], look: { at: 'a', dy: -0.4 } },
        // GOAL: front view of the goal, slightly from the side
        { from: 299, to: 318, x: [[299, 0.5], [318, 1.0]], y: [[299, 1.8], [318, 1.6]], z: [[299, 3.1], [318, 2.8]], look: { x: [[299, 4.0]], y: [[299, 1.25], [318, 0.6]], z: [[299, 0]] } },
        // both on the floor, seen from above
        { from: 318, to: 384, x: [[318, 0.3], [384, 0.6]], y: [[318, 2.8], [384, 2.6]], z: [[318, 1.8], [384, 1.6]], look: { x: [[318, 3.2]], y: [[318, 0.2]], z: [[318, 0.1]] } },
      ],
      events: [
        { f: 8, t: 'say', who: 'a', text: 'Stop ! On règle ça aux tirs au but.', rate: 1.1, dur: 56 },
        { f: 12, t: 'fx', fx: 'exclaim', at: 'a' },
        // finger snap: the opponent becomes a goalkeeper, the goal appears
        sfx(31, 'crack', 0.6, 1.8),
        { f: 32, t: 'fx', fx: 'shine', at: 'a', bone: 'handR', scale: 0.6 },
        { f: 34, t: 'rename', who: 'v', name: 'GARDIEN' },
        txt(37, 'PENALTY !', 'punch', 32, '#ffffff'),
        sfx(38, 'crowdOoh', 0.8),
        { f: 46, t: 'fx', fx: 'question', at: 'v' },
        { f: 48, t: 'say', who: 'v', text: 'Hein ?! Pourquoi j’ai des gants ?', rate: 1.15, dur: 50 },
        // the ball, the kiss
        { f: 72, t: 'fx', fx: 'shine', at: 'a', bone: 'handR', scale: 0.8 },
        sfx(72, 'shine', 0.6),
        sfx(80, 'pin', 0.3, 1.6),
        txt(81, 'SMACK', 'boom', 20, '#ff8ad0'),
        // placing it (twice, it has to be perfect)
        sfx(104, 'land', 0.4, 1.6),
        sfx(112, 'step', 0.4, 1.4),
        sfx(120, 'step', 0.4, 1.4),
        { f: 106, t: 'say', who: 'a', text: 'Lucarne. Facile.', rate: 1.0, dur: 44 },
        // stepping back, the goalkeeper taunts
        sfx(130, 'step', 0.5),
        sfx(136, 'step', 0.5),
        sfx(142, 'step', 0.5),
        sfx(148, 'step', 0.5),
        { f: 138, t: 'say', who: 'v', text: 'Allez, tire ! J’ai peur !', rate: 1.2, dur: 40 },
        sfx(150, 'block', 0.6, 1.3),
        sfx(154, 'block', 0.6, 1.3),
        { f: 152, t: 'fx', fx: 'veins', at: 'a', y: 2.0, dx: -0.1, scale: 0.7 },
        // run-up and the shot
        sfx(162, 'step', 0.6),
        sfx(166, 'step', 0.6),
        sfx(170, 'step', 0.6),
        sfx(172, 'hitHeavy', 0.9, 1.2),
        { f: 172, t: 'shake', amt: 0.3 },
        { f: 173, t: 'fx', fx: 'speed', at: 'a' },
        // way over the bar
        sfx(180, 'crowdOoh'),
        txt(181, 'LOUPÉ !', 'punch', 24, '#ff5a3a'),
        { f: 182, t: 'fx', fx: 'sweat', at: 'a' },
        // bouncy ball tour
        sfx(186, 'boing', 0.8, 1.1),
        sfx(198, 'bonk', 0.9, 0.7),
        sfx(198, 'block', 0.7, 0.7),
        txt(199, 'POTEAU !', 'boom', 22, '#ffffff'),
        sfx(210, 'boing', 0.8, 1.2),
        // into the lens
        sfx(224, 'bonk', 1, 1.1),
        { f: 224, t: 'shake', amt: 0.9 },
        { f: 224, t: 'flash', color: '#ffffff', amt: 0.35 },
        txt(225, 'BONK !', 'boom', 26, '#ffd23a'),
        sfx(228, 'crowdLaugh', 0.7),
        sfx(238, 'boing', 0.8, 1.3),
        // on the goalkeeper's head
        sfx(248, 'bonk', 1, 0.9),
        sfx(249, 'boing', 0.7, 1.0),
        { f: 249, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        txt(250, 'TOC !', 'boom', 20, '#ffd23a'),
        { f: 252, t: 'say', who: 'a', text: 'Ha ha ! En pleine tête !', rate: 1.2, dur: 30 },
        sfx(256, 'whiff', 0.5, 0.6),
        sfx(266, 'boing', 0.8, 1.0),
        // …in Matteo's back
        sfx(276, 'hitHeavy', 1, 0.8),
        sfx(277, 'boing', 0.9, 0.8),
        { f: 276, t: 'shake', amt: 0.6 },
        txt(277, 'PAF !', 'boom', 20, '#ff5a3a'),
        { f: 278, t: 'fx', fx: 'speed', at: 'a' },
        { f: 284, t: 'fx', fx: 'speed', at: 'a' },
        // GOAL
        { f: 298, t: 'flash', color: '#fff6c0', amt: 0.6 },
        { f: 298, t: 'shake', amt: 1.0 },
        txt(299, 'GOAL !', 'punch', 70, '#ffd23a'),
        sfx(299, 'roundBell'),
        sfx(300, 'crowdOoh', 1),
        { f: 300, t: 'fx', fx: 'confetti', at: 'v', y: 2.2, scale: 1.4 },
        { f: 306, t: 'fx', fx: 'confetti', at: 'a', y: 2.2, scale: 1.2 },
        sfx(310, 'fall', 0.9),
        { f: 310, t: 'shake', amt: 0.4 },
        sfx(312, 'crowdLaugh', 0.8),
        // both on the floor
        { f: 318, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        { f: 322, t: 'fx', fx: 'stars', at: 'a', bone: 'head' },
        { f: 314, t: 'say', who: 'a', text: '…Il compte, hein ?', rate: 1.05, dur: 40 },
        { f: 356, t: 'say', who: 'v', text: '…Hors-jeu.', rate: 0.9, dur: 30 },
      ],
    },
  };
}

/** Matteo's height: on the floor, then carried by the ball, then thrown back out of the net. */
function ay(): CurveKeys {
  return [
    [276, 0],
    [280, 0.45],
    [288, 0.62],
    [298, 0.6],
    [304, 0.45],
    [310, 0],
  ];
}
