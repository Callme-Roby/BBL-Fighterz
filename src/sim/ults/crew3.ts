import { relDist, type CineEvent, type CurveKeys, type UltimateScript } from '../ultimates';
import { META_STRETCH } from './timing';

/**
 * BBL MAX scripts: Rayan (pacifist… then boxer) and Billel (League of Legends meta monologue).
 * Built lazily (called from src/sim/ultimates.ts) so the helpers imported from
 * '../ultimates' are ready.
 *
 * Clips: src/render/ults/crew3.ts (same frame base: frame k of the script = frame k of the clips).
 * One script frame lasts 1/36 s (cinematics play at 3/5 speed).
 */
export function crew3Scripts(): UltimateScript[] {
  // Billel's monologue is played 1.5× slower so the voice has time to say every line
  return [pacifist(), stretchScript(meta(), META_STRETCH)];
}


/** Every frame number of a script multiplied by `k` (rounded): same story, slower. */
function stretchScript(u: UltimateScript, k: number): UltimateScript {
  const F = (f: number) => Math.round(f * k);
  const keys = (c: CurveKeys | undefined) => c?.map(([f, v]) => [F(f), v] as [number, number]);
  const range = (r: [number, number]) => [F(r[0]), F(r[1])] as [number, number];
  const c = u.cine;
  return {
    ...u,
    length: F(u.length),
    hits: u.hits.map((h) => ({ ...h, f: F(h.f) })),
    ay: keys(u.ay)!,
    vy: keys(u.vy)!,
    ax: keys(u.ax),
    dist: keys(u.dist)!,
    fall: F(u.fall),
    cams: u.cams.map(([f, shot]) => [F(f), shot]),
    victimTurn: u.victimTurn?.map(range),
    selfHits: u.selfHits?.map((h) => ({ ...h, f: F(h.f) })),
    cine: c && {
      ...c,
      swaps: c.swaps?.map((w) => ({ ...w, from: F(w.from), to: F(w.to) })),
      actors: c.actors?.map((a) => ({ ...a, from: F(a.from), to: F(a.to), x: keys(a.x)!, y: keys(a.y), turn: a.turn?.map(range) })),
      props: c.props?.map((p) => ({ ...p, from: F(p.from), to: F(p.to) })),
      fade: keys(c.fade),
      light: keys(c.light),
      backdrop: c.backdrop?.map((b) => ({ ...b, from: F(b.from), to: F(b.to) })),
      events: c.events?.map((e) => {
        const o = { ...e, f: F(e.f) } as CineEvent & { dur?: number };
        if (o.dur !== undefined) o.dur = F(o.dur);
        return o;
      }),
    },
  };
}

// (function declarations: hoisted, so they are usable even through the import cycle with '../ultimates')
type SfxEvent = Extract<CineEvent, { t: 'sfx' }>;
function sfx(f: number, id: SfxEvent['id'], vol?: number, pitch?: number): CineEvent {
  const e: SfxEvent = { f, t: 'sfx', id };
  if (vol !== undefined) e.vol = vol;
  if (pitch !== undefined) e.pitch = pitch;
  return e;
}
/** comic-book text: 'boom' = onomatopoeia scattered around, 'punch' = big centred line, 'caption' = small top line */
type TextEvent = Extract<CineEvent, { t: 'text' }>;
function txt(f: number, text: string, style: NonNullable<TextEvent['style']>, dur: number, color?: string): CineEvent {
  const e: TextEvent = { f, t: 'text', text, style, dur };
  if (color) e.color = color;
  return e;
}

// ---------------------------------------------------------------------------
// Rayan — PACIFISTE… OU PAS
// Rayan backs off, hands up: he's a pacifist. Poof: the opponent has become Dylan.
// Rayan freezes, turns his back, puts on boxing gloves and a headgear, DING DING,
// spins back in guard and boxes Dylan: jab, jab, cross, left hook, right to the body,
// right hook to the head, a short flurry, uppercut.
// ---------------------------------------------------------------------------
function pacifist(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [14, -0.35],
    [200, -0.35],
    [207, -0.2],
    [212, 0.08],
    [214, 0.1],
    [220, 0.16],
    [227, 0.24],
    [235, 0.3],
    [243, 0.36],
    [251, 0.42],
    [257, 0.46],
    [263, 0.5],
    [269, 0.54],
    [276, 0.54],
    [282, 0.6],
    [292, 0.66],
  ];
  // victim (Dylan from frame 70): absolute position along the attacker's axis
  const vx: CurveKeys = [
    [2, 0.85],
    [208, 0.85],
    [214, 0.98],
    [220, 1.04],
    [227, 1.12],
    [235, 1.18],
    [243, 1.24],
    [251, 1.3],
    [257, 1.34],
    [263, 1.38],
    [269, 1.42],
    [282, 1.46],
    [288, 1.9],
    [296, 2.5],
    [306, 2.9],
    [314, 3.0],
  ];
  return {
    id: 'pacifist',
    length: 356,
    hits: [
      // English boxing on Dylan (short: heads ~1.45 m)
      { f: 214, dmg: 4, strength: 'light', y: 1.45 }, // jab
      { f: 220, dmg: 4, strength: 'light', y: 1.45 }, // jab
      { f: 227, dmg: 6, strength: 'medium', y: 1.45 }, // cross
      { f: 235, dmg: 6, strength: 'medium', y: 1.45 }, // left hook
      { f: 243, dmg: 7, strength: 'heavy', y: 1.0 }, // right to the body
      { f: 251, dmg: 7, strength: 'heavy', y: 1.45 }, // right hook to the head
      // short flurry
      { f: 257, dmg: 3, strength: 'light', y: 1.4 },
      { f: 263, dmg: 3, strength: 'light', y: 1.4 },
      { f: 269, dmg: 3, strength: 'light', y: 1.4 },
      // uppercut
      { f: 282, dmg: 17, strength: 'heavy', y: 1.4 },
    ],
    ay: [[0, 0]],
    vy: [
      [282, 0],
      [288, 0.75],
      [294, 1.05],
      [298, 1.0],
      [304, 0.4],
      [306, 0],
    ],
    ax,
    dist: relDist(vx, ax),
    fall: 306,
    cams: [
      [0, 'two'],
      [70, 'vface'],
      [92, 'close'],
      [130, 'hero'],
      [178, 'vface'],
      [199, 'side'],
      [247, 'over'],
      [272, 'low'],
      [308, 'close'],
    ],
    cine: {
      swaps: [{ who: 'v', cast: 'dylan', from: 70, to: 356, fx: 'poof' }],
      props: [
        { prop: 'glove', on: 'a', bone: 'handL', from: 136, to: 356 },
        { prop: 'glove', on: 'a', bone: 'handR', from: 146, to: 356 },
        { prop: 'headgear', on: 'a', bone: 'head', from: 162, to: 356 },
      ],
      events: [
        { f: 4, t: 'say', who: 'a', text: 'Wesh, calme-toi… moi je suis pacifiste.', rate: 1.1, dur: 64 },
        { f: 44, t: 'fx', fx: 'shine', at: 'a', bone: 'head', scale: 0.7 },
        sfx(44, 'shine', 0.5),
        // the opponent turns into Dylan
        { f: 72, t: 'rename', who: 'v', name: 'DYLAN' },
        { f: 74, t: 'fx', fx: 'question', at: 'v' },
        txt(76, '…DYLAN ?', 'punch', 34, '#ff9a3a'),
        // Rayan freezes
        sfx(90, 'scratch'),
        { f: 92, t: 'fx', fx: 'exclaim', at: 'a' },
        { f: 94, t: 'say', who: 'a', text: 'Ah… Dylan. Là c’est pas pareil.', rate: 1.0, dur: 80 },
        { f: 112, t: 'fx', fx: 'veins', at: 'a', y: 2.0, dx: -0.1, scale: 0.8 },
        // gearing up, back turned
        sfx(134, 'whiff', 0.5, 1.3),
        sfx(137, 'block', 0.6),
        sfx(144, 'whiff', 0.5, 1.3),
        sfx(147, 'block', 0.6),
        sfx(152, 'block', 0.9, 0.9),
        sfx(156, 'block', 0.9, 0.9),
        sfx(162, 'block', 0.6, 1.2),
        sfx(168, 'flex', 0.6),
        // Dylan protests
        { f: 180, t: 'say', who: 'v', text: 'Hein ?! Mais j’ai rien fait !', rate: 1.15, dur: 56 },
        { f: 182, t: 'fx', fx: 'sweat', at: 'v' },
        // round one
        sfx(199, 'roundBell'),
        txt(200, 'DING DING !', 'boom', 30, '#ffd23a'),
        sfx(202, 'whiffHeavy', 0.7),
        sfx(209, 'step', 0.6),
        // combo (punch sounds come with the hits)
        { f: 243, t: 'fx', fx: 'pain', at: 'v', y: 1.0 },
        txt(244, 'BOUM !', 'boom', 22, '#ff5a3a'),
        { f: 251, t: 'shake', amt: 0.3 },
        sfx(272, 'whiffHeavy'),
        // uppercut
        { f: 282, t: 'flash', amt: 0.5 },
        { f: 282, t: 'shake', amt: 0.9 },
        txt(283, 'UPPERCUT !', 'boom', 34, '#ffd23a'),
        sfx(286, 'crowdOoh'),
        { f: 284, t: 'say', who: 'a', text: 'Désolé… c’est un vieux contentieux.', rate: 1.1, dur: 70 },
        { f: 306, t: 'shake', amt: 0.5 },
        { f: 310, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        { f: 330, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Billel — LA MÉTA
// No blow at all: the camera faces Billel, a psychedelic tunnel opens behind him and he
// explains the League of Legends meta, fast and dense. Every keyword is a verbal blow:
// the victim (off-screen) gets dizzy, sits down, collapses. Billel stops, the tunnel goes
// away: "Hé ? T'es où ?"… the camera tilts down to the victim, K.O. on the floor.
// ---------------------------------------------------------------------------
function meta(): UltimateScript {
  const ax: CurveKeys = [
    [2, 0],
    [18, -0.5],
    [334, -0.5],
    [342, -0.38],
    [352, -0.32],
  ];
  // the victim staggers back after the dash strike and stays ~2.4 m away (out of the 'face' shot)
  const vx: CurveKeys = [
    [2, 0.85],
    [8, 1.3],
    [18, 1.9],
  ];
  return {
    id: 'meta',
    length: 380,
    hits: [
      // information overload: one verbal blow per keyword
      { f: 60, dmg: 4, strength: 'light', y: -1, kind: 'word' }, // full enchanteurs
      { f: 100, dmg: 5, strength: 'light', y: -1, kind: 'word' }, // power spikes
      { f: 148, dmg: 6, strength: 'medium', y: -1, kind: 'word' }, // invade niveau un
      { f: 186, dmg: 6, strength: 'medium', y: -1, kind: 'word' }, // grubs
      { f: 206, dmg: 7, strength: 'medium', y: -1, kind: 'word' }, // tempo du drake
      { f: 252, dmg: 8, strength: 'medium', y: -1, kind: 'word' }, // wave management
      { f: 280, dmg: 9, strength: 'heavy', y: -1, kind: 'word' }, // freeze, slow push, crash
      { f: 300, dmg: 15, strength: 'heavy', y: -1, kind: 'word' }, // zéro prio
    ],
    ay: [[0, 0]],
    vy: [[0, 0]],
    ax,
    dist: relDist(vx, ax),
    fall: 306,
    cams: [
      [0, 'two'],
      [22, 'face'],
      [100, 'vface'],
      [124, 'face'],
      [196, 'side'],
      [222, 'face'],
      [276, 'wide'],
      [312, 'face'],
      [356, 'floor'],
    ],
    cine: {
      // the tunnel only exists in Billel's head: it's there whenever we face him
      backdrop: [
        { kind: 'tunnel', from: 22, to: 100 },
        { kind: 'tunnel', from: 124, to: 196 },
        { kind: 'tunnel', from: 222, to: 276 },
        { kind: 'tunnel', from: 312, to: 330 },
      ],
      events: [
        { f: 4, t: 'say', who: 'a', text: 'Alors en fait, la bot c’est full enchanteurs, à cause des power spikes…', rate: 1.0, dur: 110 },
        { f: 22, t: 'flash', color: '#b46cff', amt: 0.45 },
        sfx(22, 'powerUp', 0.6, 1.2),
        txt(26, 'PATCH 14.3', 'caption', 50, '#7ad0ff'),
        { f: 30, t: 'fx', fx: 'question', at: 'v' },
        txt(60, 'FULL ENCHANTEURS', 'punch', 34, '#ff9ae8'),
        sfx(60, 'whiff', 0.5, 1.4),
        { f: 62, t: 'fx', fx: 'sweat', at: 'v' },
        txt(100, 'POWER SPIKE', 'punch', 30, '#ffd23a'),
        sfx(100, 'whiff', 0.5, 1.2),
        { f: 102, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        { f: 116, t: 'say', who: 'a', text: '…donc ton jungler invade niveau un, sinon adieu grubs, tempo et drake…', rate: 1.0, dur: 108 },
        { f: 124, t: 'flash', color: '#b46cff', amt: 0.3 },
        txt(148, 'INVADE NIV. 1', 'punch', 30, '#7ad0ff'),
        sfx(148, 'whiff', 0.5, 1.4),
        txt(186, 'GRUBS', 'boom', 24, '#a8ff5a'),
        sfx(186, 'whiff', 0.5, 1.2),
        txt(206, 'TEMPO !', 'boom', 24, '#ff9a1a'),
        sfx(206, 'bonk', 0.5, 1.3),
        { f: 210, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        { f: 222, t: 'flash', color: '#b46cff', amt: 0.3 },
        { f: 226, t: 'say', who: 'a', text: '…wave management, freeze, slow push, crash : zéro prio. Jungle gap.', rate: 1.0, dur: 110 },
        txt(252, 'WAVE MANAGEMENT', 'punch', 28, '#7ad0ff'),
        sfx(252, 'whiff', 0.5, 1.4),
        { f: 262, t: 'fx', fx: 'smoke', at: 'v', bone: 'head', scale: 0.6 },
        txt(280, 'FREEZE · SLOW PUSH · CRASH', 'punch', 22, '#ffffff'),
        sfx(280, 'whiff', 0.6, 1.1),
        txt(300, 'ZÉRO PRIO', 'boom', 26, '#ff3030'),
        sfx(300, 'bonk', 0.7, 0.9),
        sfx(306, 'crowdOoh', 0.7),
        txt(318, 'JUNGLE GAP', 'punch', 24, '#ff5a3a'),
        // he stops: the tunnel goes away
        sfx(330, 'recordStop'),
        { f: 330, t: 'flash', color: '#ffffff', amt: 0.25 },
        { f: 336, t: 'fx', fx: 'question', at: 'a' },
        { f: 338, t: 'say', who: 'a', text: '…Hé ? T’es où ?', rate: 0.95, dur: 40 },
        // the victim, K.O. on the floor
        { f: 358, t: 'fx', fx: 'stars', at: 'v', bone: 'head' },
        txt(360, 'K.O. PAR SURCHARGE D’INFORMATIONS', 'punch', 40, '#ffd23a'),
        sfx(362, 'crowdLaugh', 0.7),
      ],
    },
  };
}
