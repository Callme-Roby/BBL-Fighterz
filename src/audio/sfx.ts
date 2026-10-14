/**
 * sfx.ts — procedural, punchy, slightly crunchy retro sound effects.
 *
 * Each effect is a handful of short-lived oscillators / noise bursts scheduled
 * at time `t`. `p` is a pitch multiplier applied to every frequency.
 */

import type { SfxId } from './types';
import { gainNode, noiseBurst, osc, perc, shaper, sweepTone } from './synth';
import type { Wave } from './synth';

export interface SfxEnv {
  ctx: BaseAudioContext;
  /** per-play output (already carries volume + pan) */
  out: AudioNode;
  /** shared SFX reverb input, if any */
  reverb: AudioNode | null;
}

/** Effects that get a tiny random pitch variation (±4 %) so repeats don't sound robotic. */
export const RANDOMIZED_SFX: ReadonlySet<SfxId> = new Set<SfxId>([
  'hitLight',
  'hitMedium',
  'hitHeavy',
  'block',
  'whiff',
  'whiffHeavy',
  'land',
  'step',
  'fall',
  'throw',
]);

/**
 * Per-effect trim so every effect sits at a sensible loudness (measured offline):
 * the heaviest impacts peak around 1.0 before the sfx/master volumes.
 */
const LEVEL: Record<SfxId, number> = {
  hitLight: 0.7,
  hitMedium: 0.7,
  hitHeavy: 0.45,
  block: 0.6,
  whiff: 1.6,
  whiffHeavy: 1.4,
  land: 1,
  step: 1,
  fall: 0.85,
  throw: 0.6,
  super: 0.45,
  ko: 0.5,
  cursor: 1,
  confirm: 1,
  cancel: 1,
  roundBell: 0.7,
};

/** Play a procedural effect. */
export function playSfx(env: SfxEnv, id: SfxId, t: number, p: number): void {
  const level = LEVEL[id] ?? 1;
  const out = level === 1 ? env.out : gainNode(env.ctx, level, env.out);
  SFX[id]({ ...env, out }, t, p);
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

/** A saturating insert feeding env.out: anything connected to it gets crunchy. */
function crunch(env: SfxEnv, amount: number, level = 0.8): AudioNode {
  const ws = shaper(env.ctx, amount);
  ws.connect(gainNode(env.ctx, level, env.out));
  return ws;
}

/** Send env.out into the shared reverb. */
function reverbSend(env: SfxEnv, amount: number): void {
  if (!env.reverb) return;
  env.out.connect(gainNode(env.ctx, amount, env.reverb));
}

/** A short pitched blip; `steps` = [time offset, frequency] pairs (instant pitch jumps). */
function blip(env: SfxEnv, t: number, type: Wave, steps: [number, number][], peak: number, decay: number, cutoff = 0): void {
  const { ctx } = env;
  const o = osc(ctx, type);
  for (const [dt, f] of steps) o.frequency.setValueAtTime(f, t + dt);
  const g = ctx.createGain();
  const end = perc(g.gain, t, peak, 0.002, decay);
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.connect(f);
    f.connect(g);
  } else {
    o.connect(g);
  }
  g.connect(env.out);
  o.start(t);
  o.stop(end);
}

/** The body of a heavy impact (shared by hitHeavy / super / throw). */
function heavyImpact(env: SfxEnv, t: number, p: number, size = 1): void {
  const { ctx, out } = env;
  const cr = crunch(env, 1.0, 0.7);
  sweepTone(ctx, crunch(env, 0.5, 0.9), t, { f0: 150 * p, f1: 38 * p, sweep: 0.18 * size, peak: 1.0, decay: 0.45 * size });
  noiseBurst(ctx, out, t, { filter: 'lowpass', freq: 900 * p, peak: 0.6, decay: 0.28 * size });
  noiseBurst(ctx, cr, t, { filter: 'bandpass', freq: 1100 * p, q: 0.7, peak: 0.9, decay: 0.16 * size });
  noiseBurst(ctx, out, t, { filter: 'highpass', freq: 4000 * p, peak: 0.4, decay: 0.035 });
}

/* ------------------------------------------------------------------------ */
/* The effects                                                               */
/* ------------------------------------------------------------------------ */

const SFX: Record<SfxId, (env: SfxEnv, t: number, p: number) => void> = {
  /** Slap / snap. */
  hitLight(env, t, p) {
    const { ctx, out } = env;
    noiseBurst(ctx, out, t, { filter: 'bandpass', freq: 2600 * p, q: 0.9, peak: 0.85, decay: 0.07 });
    noiseBurst(ctx, out, t, { filter: 'highpass', freq: 5000 * p, peak: 0.45, attack: 0.0005, decay: 0.018 });
    sweepTone(ctx, out, t, { f0: 340 * p, f1: 120 * p, sweep: 0.05, peak: 0.55, decay: 0.09 });
  },

  /** Solid punch: crunchy mid burst + thump. */
  hitMedium(env, t, p) {
    const { ctx, out } = env;
    const cr = crunch(env, 0.6);
    noiseBurst(ctx, cr, t, { filter: 'bandpass', freq: 1500 * p, q: 0.8, peak: 0.9, decay: 0.12 });
    sweepTone(ctx, cr, t, { f0: 240 * p, f1: 70 * p, sweep: 0.08, peak: 0.8, decay: 0.18 });
    noiseBurst(ctx, out, t, { filter: 'highpass', freq: 3800 * p, peak: 0.35, decay: 0.03 });
  },

  /** Big thump + crunch + low boom. */
  hitHeavy(env, t, p) {
    heavyImpact(env, t, p);
  },

  /** Short metallic tick / clack. */
  block(env, t, p) {
    const { ctx, out } = env;
    // Inharmonic partials = metal.
    for (const [f, g, d] of [
      [1720, 0.22, 0.09],
      [2630, 0.16, 0.07],
      [4150, 0.1, 0.05],
    ] as const) {
      sweepTone(ctx, out, t, { type: 'square', f0: f * p, f1: f * p * 0.97, sweep: 0.05, peak: g, decay: d });
    }
    sweepTone(ctx, out, t, { type: 'triangle', f0: 650 * p, f1: 420 * p, sweep: 0.04, peak: 0.5, decay: 0.05 });
    noiseBurst(ctx, out, t, { filter: 'highpass', freq: 3000 * p, peak: 0.5, decay: 0.025 });
  },

  /** Quick filtered-noise swish. */
  whiff(env, t, p) {
    const { ctx, out } = env;
    noiseBurst(ctx, out, t, {
      filter: 'bandpass', freq: 600 * p, freqEnd: 2800 * p, sweep: 0.12, q: 1.8,
      peak: 0.55, attack: 0.05, decay: 0.12,
    });
  },

  /** Longer, lower swish. */
  whiffHeavy(env, t, p) {
    const { ctx, out } = env;
    noiseBurst(ctx, out, t, {
      filter: 'bandpass', freq: 260 * p, freqEnd: 1300 * p, sweep: 0.22, q: 1.4,
      peak: 0.7, attack: 0.09, decay: 0.24, rate: 0.8,
    });
    noiseBurst(ctx, out, t + 0.04, { filter: 'lowpass', freq: 500 * p, peak: 0.25, attack: 0.06, decay: 0.18 });
  },

  /** Soft thud. */
  land(env, t, p) {
    const { ctx, out } = env;
    sweepTone(ctx, out, t, { f0: 115 * p, f1: 50 * p, sweep: 0.08, peak: 0.5, decay: 0.14 });
    noiseBurst(ctx, out, t, { filter: 'lowpass', freq: 500 * p, peak: 0.3, decay: 0.08 });
  },

  /** Very soft tick. */
  step(env, t, p) {
    const { ctx, out } = env;
    noiseBurst(ctx, out, t, { filter: 'highpass', freq: 2500 * p, peak: 0.12, decay: 0.02 });
    sweepTone(ctx, out, t, { f0: 140 * p, f1: 90 * p, sweep: 0.03, peak: 0.12, decay: 0.04 });
  },

  /** Body hitting the ground: low thud, a small bounce and a cloud of dust. */
  fall(env, t, p) {
    const { ctx, out } = env;
    sweepTone(ctx, crunch(env, 0.4, 0.9), t, { f0: 85 * p, f1: 32 * p, sweep: 0.2, peak: 1.0, decay: 0.4 });
    noiseBurst(ctx, out, t, { filter: 'lowpass', freq: 700 * p, peak: 0.5, attack: 0.005, decay: 0.3 });
    sweepTone(ctx, out, t + 0.14, { f0: 75 * p, f1: 35 * p, sweep: 0.12, peak: 0.45, decay: 0.2 });
    noiseBurst(ctx, out, t + 0.02, { filter: 'bandpass', freq: 420 * p, q: 0.6, peak: 0.25, attack: 0.04, decay: 0.5, rate: 0.6 });
  },

  /** Grab (cloth) then slam. */
  throw(env, t, p) {
    const { ctx, out } = env;
    noiseBurst(ctx, out, t, { filter: 'bandpass', freq: 1200 * p, q: 1.5, peak: 0.45, decay: 0.06 });
    noiseBurst(ctx, out, t + 0.03, {
      filter: 'bandpass', freq: 400 * p, freqEnd: 1600 * p, sweep: 0.12, q: 1.4, peak: 0.35, attack: 0.05, decay: 0.1,
    });
    const tt = t + 0.2;
    sweepTone(ctx, crunch(env, 0.5, 0.9), tt, { f0: 100 * p, f1: 34 * p, sweep: 0.16, peak: 1.0, decay: 0.35 });
    noiseBurst(ctx, out, tt, { filter: 'lowpass', freq: 900 * p, peak: 0.6, decay: 0.25 });
    noiseBurst(ctx, crunch(env, 1, 0.6), tt, { filter: 'bandpass', freq: 900 * p, q: 0.8, peak: 0.7, decay: 0.1 });
  },

  /** Rising charge zap, then a big impact. */
  super(env, t, p) {
    const { ctx, out } = env;
    reverbSend(env, 0.35);
    const charge = 0.5;
    // Zappy saw + square sweeping up, frequency-wobbled by a fast LFO.
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 28;
    const lfoAmt = gainNode(ctx, 250);
    lfo.connect(lfoAmt);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(400 * p, t);
    bp.frequency.exponentialRampToValueAtTime(3500 * p, t + charge);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + charge * 0.9);
    g.gain.linearRampToValueAtTime(0, t + charge + 0.02);
    for (const [type, mul] of [['sawtooth', 1], ['square', 0.5]] as const) {
      const o = osc(ctx, type);
      o.frequency.setValueAtTime(180 * p * mul, t);
      o.frequency.exponentialRampToValueAtTime(1500 * p * mul, t + charge);
      lfoAmt.connect(o.detune);
      o.connect(bp);
      o.start(t);
      o.stop(t + charge + 0.05);
    }
    lfo.start(t);
    lfo.stop(t + charge + 0.05);
    bp.connect(g);
    g.connect(out);
    noiseBurst(ctx, out, t, {
      filter: 'bandpass', freq: 400 * p, freqEnd: 5000 * p, sweep: charge, q: 2, peak: 0.22, attack: charge * 0.9, decay: 0.05,
    });
    // Impact + sparkle.
    const ti = t + charge;
    heavyImpact(env, ti, p, 1.2);
    noiseBurst(ctx, out, ti, { filter: 'highpass', freq: 6000 * p, peak: 0.3, attack: 0.002, decay: 0.4 });
    blip(env, ti, 'square', [[0, 1320 * p], [0.05, 1760 * p]], 0.08, 0.25, 4000);
  },

  /** Huge impact with a long reverb tail, slightly slowed down. */
  ko(env, t, p) {
    const { ctx, out } = env;
    const q = p * 0.85;
    reverbSend(env, 0.6);
    sweepTone(ctx, crunch(env, 0.6, 1), t, { f0: 120 * q, f1: 26 * q, sweep: 0.5, peak: 1.1, decay: 1.2 });
    noiseBurst(ctx, out, t, { filter: 'lowpass', freq: 1200 * q, peak: 0.8, decay: 0.7, rate: 0.85 });
    noiseBurst(ctx, crunch(env, 1.2, 0.7), t, { filter: 'bandpass', freq: 900 * q, q: 0.7, peak: 1.0, decay: 0.3, rate: 0.85 });
    noiseBurst(ctx, out, t, { filter: 'highpass', freq: 3500 * q, peak: 0.5, decay: 0.05 });
    noiseBurst(ctx, out, t + 0.03, { filter: 'lowpass', freq: 220, peak: 0.45, attack: 0.05, decay: 1.8, rate: 0.5 });
  },

  /** Menu cursor blip. */
  cursor(env, t, p) {
    blip(env, t, 'pulse25', [[0, 880 * p], [0.03, 1320 * p]], 0.16, 0.07);
  },

  /** Menu confirm chime: quick rising arpeggio. */
  confirm(env, t, p) {
    const notes = [1046.5, 1568, 2093];
    notes.forEach((f, i) => {
      const ti = t + i * 0.065;
      blip(env, ti, 'square', [[0, f * p]], 0.1, 0.22, 5000);
      blip(env, ti, 'triangle', [[0, f * p * 0.5]], 0.18, 0.3);
    });
    reverbSend(env, 0.15);
  },

  /** Low "back" blip. */
  cancel(env, t, p) {
    blip(env, t, 'square', [[0, 392 * p], [0.06, 262 * p]], 0.15, 0.12, 1800);
  },

  /** Boxing bell ding: inharmonic bell partials with a long ring. */
  roundBell(env, t, p) {
    const { ctx, out } = env;
    reverbSend(env, 0.3);
    const f = 1180 * p;
    for (const [ratio, g, d] of [
      [1, 0.4, 2.2],
      [1.004, 0.3, 2.0],
      [2.0, 0.18, 1.4],
      [2.76, 0.25, 1.1],
      [5.4, 0.12, 0.6],
      [8.93, 0.06, 0.35],
    ] as const) {
      sweepTone(ctx, out, t, { f0: f * ratio, f1: f * ratio, sweep: 0, peak: g, attack: 0.001, decay: d });
    }
    noiseBurst(ctx, out, t, { filter: 'highpass', freq: 3000, peak: 0.35, decay: 0.02 });
  },
};
