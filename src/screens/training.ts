/**
 * ENTRAÎNEMENT — what the training mode adds on top of a normal FightScreen:
 *  - the training dummy (P2): standing, crouching, jumping, guarding (high / low / auto /
 *    after the first hit), CPU, or replaying a sequence recorded by the player;
 *  - the options (health regen, endless BBL MAX gauge, unbreakable guard, instant assist);
 *  - the displays: P1's input history, combo info, frame advantage after each exchange;
 *  - the training pause menu (a list of rows whose values change with ← →).
 * The fight is local (no rollback), so the screen may adjust the state between two steps.
 */
import { audio } from '../audio/audio';
import { CpuBrain } from '../sim/ai';
import { MOVES } from '../sim/moves';
import { createGame, step, type MatchOptions } from '../sim/sim';
import {
  ARENA_HALF_WIDTH,
  IN_ASSIST,
  IN_DOWN,
  IN_GRAB,
  IN_GUARD,
  IN_LEFT,
  IN_LK,
  IN_LP,
  IN_RIGHT,
  IN_RK,
  IN_RP,
  IN_SUPER,
  IN_UP,
  MAX_METER,
  R_B,
  R_D,
  R_F,
  R_U,
  START_X,
  type Action,
  type GameState,
  type MoveId,
} from '../sim/types';
import { h } from '../ui/dom';

// ---------------------------------------------------------------- options

export type DummyMode = 'stand' | 'crouch' | 'jump' | 'guardHigh' | 'guardLow' | 'guardAuto' | 'guardAfter' | 'cpu' | 'cpuHard' | 'record';
export type Placement = 'center' | 'left' | 'right';

export interface TrainingOptions {
  dummy: DummyMode;
  /** health: back to full after each combo / only when (almost) empty */
  life: 'regen' | 'normal';
  /** P1's BBL MAX gauge */
  meter: 'infinite' | 'normal';
  /** guard gauges */
  guard: 'normal' | 'infinite';
  /** P1's assist recharge */
  assist: 'instant' | 'normal';
  inputs: boolean;
  combo: boolean;
  frames: boolean;
  /** last placement chosen for « Remettre en place » */
  place: Placement;
}

const DEFAULTS: TrainingOptions = {
  dummy: 'stand',
  life: 'regen',
  meter: 'normal',
  guard: 'normal',
  assist: 'normal',
  inputs: true,
  combo: true,
  frames: true,
  place: 'center',
};

const STORE_KEY = 'bbl.training';

export const DUMMY_MODES: { id: DummyMode; label: string; help: string }[] = [
  { id: 'stand', label: 'DEBOUT', help: 'Le mannequin reste debout, sans bouger ni se protéger.' },
  { id: 'crouch', label: 'ACCROUPI', help: 'Le mannequin reste accroupi : les coups hauts passent au-dessus.' },
  { id: 'jump', label: 'SAUTE', help: 'Le mannequin saute sans arrêt : entraîne tes anti-aériens.' },
  { id: 'guardHigh', label: 'GARDE DEBOUT', help: 'Garde debout : bloque les coups hauts et moyens, pas les bas.' },
  { id: 'guardLow', label: 'GARDE BASSE', help: 'Garde accroupie : bloque les coups bas, les moyens passent.' },
  { id: 'guardAuto', label: 'GARDE AUTO', help: 'Bloque chaque coup à la bonne hauteur (debout ou accroupi).' },
  { id: 'guardAfter', label: 'GARDE APRÈS 1ER COUP', help: 'Prend le premier coup, puis bloque tout jusqu’au retour au calme.' },
  { id: 'cpu', label: 'CPU NORMAL', help: 'Le mannequin se bat comme l’ordinateur (normal).' },
  { id: 'cpuHard', label: 'CPU DIFFICILE', help: 'Le mannequin se bat comme l’ordinateur (difficile).' },
  { id: 'record', label: 'ENREGISTRER / REJOUER', help: 'Tu contrôles le mannequin (10 s max), puis il rejoue ta séquence en boucle.' },
];

function loadOptions(): TrainingOptions {
  const o = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<TrainingOptions>) : null;
    if (v && typeof v === 'object') {
      if (DUMMY_MODES.some((m) => m.id === v.dummy)) o.dummy = v.dummy as DummyMode;
      if (v.life === 'regen' || v.life === 'normal') o.life = v.life;
      if (v.meter === 'infinite' || v.meter === 'normal') o.meter = v.meter;
      if (v.guard === 'infinite' || v.guard === 'normal') o.guard = v.guard;
      if (v.assist === 'instant' || v.assist === 'normal') o.assist = v.assist;
      if (typeof v.inputs === 'boolean') o.inputs = v.inputs;
      if (typeof v.combo === 'boolean') o.combo = v.combo;
      if (typeof v.frames === 'boolean') o.frames = v.frames;
      if (v.place === 'center' || v.place === 'left' || v.place === 'right') o.place = v.place;
    }
  } catch {
    /* private mode, bad data: defaults */
  }
  return o;
}

function saveOptions(o: TrainingOptions) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- state helpers

/** the fighter can act freely: the sim runs its neutral() logic in these actions */
const FREE: ReadonlySet<Action> = new Set<Action>(['idle', 'walkF', 'walkB', 'crouch', 'guard']);
/** nothing is going on for this fighter (health regen waits for both) */
const CALM: ReadonlySet<Action> = new Set<Action>(['idle', 'walkF', 'walkB', 'crouch', 'guard', 'jump', 'prejump', 'land', 'dashF', 'dashB']);
/** the dummy is being hit / is down (« Garde après le 1er coup » starts guarding) */
const HURT: ReadonlySet<Action> = new Set<Action>(['hitstun', 'juggle', 'knockdown', 'getup', 'wallSplat', 'thrown', 'guardCrush', 'superVictim']);
/** actions that start from neutral() with actionFrame 0 (the fighter was actionable on that frame) */
const FROM_NEUTRAL: ReadonlySet<Action> = new Set<Action>(['prejump', 'dashF', 'dashB', 'superFlash']);

/** health regen waits this long once both fighters are back to neutral */
const REGEN_DELAY = 60;
/** « Garde après le 1er coup »: guard dropped after this long without pressure */
const AFTER_HIT_QUIET = 30;
/** recording: 10 s max, then a short pause between two replays */
const REC_MAX = 600;
const REPLAY_GAP = 30;
/** history rows kept (the CSS may show fewer on small screens) */
const HISTORY = 14;
/** an exchange that doesn't settle within this many frames gives no advantage */
const EXCHANGE_TIMEOUT = 300;

const mirror = (bits: number) => (bits & ~(IN_LEFT | IN_RIGHT)) | (bits & IN_LEFT ? IN_RIGHT : 0) | (bits & IN_RIGHT ? IN_LEFT : 0);

/** absolute input → directions relative to the fighter's facing (R_* bits) */
function relDir(bits: number, facing: 1 | -1): number {
  let d = 0;
  if (bits & IN_UP) d |= R_U;
  if (bits & IN_DOWN) d |= R_D;
  const fwd = facing === 1 ? IN_RIGHT : IN_LEFT;
  const back = facing === 1 ? IN_LEFT : IN_RIGHT;
  if (bits & fwd && !(bits & back)) d |= R_F;
  if (bits & back && !(bits & fwd)) d |= R_B;
  return d;
}

/** arrow angle (deg, ↑ = 0, clockwise) of relative directions, -1 = neutral */
function dirAngle(d: number): number {
  const u = d & R_U ? 1 : d & R_D ? -1 : 0;
  const f = d & R_F ? 1 : d & R_B ? -1 : 0;
  if (!u && !f) return -1;
  const table: Record<string, number> = { '1,0': 0, '1,1': 45, '0,1': 90, '-1,1': 135, '-1,0': 180, '-1,-1': 225, '0,-1': 270, '1,-1': 315 };
  return table[`${u},${f}`];
}

const BUTTONS: [number, string, string][] = [
  [IN_LP, 'LP', 'p'],
  [IN_RP, 'RP', 'p'],
  [IN_LK, 'LK', 'k'],
  [IN_RK, 'RK', 'k'],
  [IN_SUPER, 'BBL', 's'],
  [IN_GUARD, 'GARDE', 'g'],
  [IN_GRAB, 'CHOPPE', 'c'],
  [IN_ASSIST, 'ASSIST', 'a'],
];
const BUTTON_MASK = BUTTONS.reduce((m, [b]) => m | b, 0);

/**
 * A fresh training state, as at the start of the fight: a new game played through its
 * round intro, then the fighters placed (`left` / `right` = the dummy with its back to that wall).
 * Health, guard and BBL gauge sizes / values are carried over from `old`.
 */
export function trainingState(opts: MatchOptions, old: GameState, place: Placement): GameState {
  const s = createGame({ ...opts, skipIntro: true, training: true });
  for (let n = 0; s.phase !== 'fight' && n < 600; n++) step(s, [0, 0]);
  for (const i of [0, 1] as const) {
    const f = s.fighters[i];
    const o = old.fighters[i];
    f.variant = o.variant;
    f.meter = o.meter;
    if (o.maxHp > 0) f.maxHp = o.maxHp;
    if (f.maxHp > 0) f.hp = f.maxHp;
    if (o.guardMax > 0) f.guardMax = o.guardMax;
    if (f.guardMax > 0) f.guard = f.guardMax;
  }
  const [p1, dummy] = s.fighters;
  const wall = ARENA_HALF_WIDTH - 0.3;
  if (place === 'center') {
    p1.x = -START_X;
    dummy.x = START_X;
  } else {
    const side = place === 'left' ? -1 : 1;
    dummy.x = side * wall;
    p1.x = side * (wall - 1.5);
  }
  p1.facing = dummy.x > p1.x ? 1 : -1;
  dummy.facing = (-p1.facing) as 1 | -1;
  s.frame = old.frame + 1;
  s.events.length = 0;
  return s;
}

// ---------------------------------------------------------------- the pause menu

/** A row of the training pause menu: a value changed with ← → (or a tap), and / or an action. */
export interface TrainingRow {
  label: string;
  /** current value (cycling rows) */
  value?: () => string;
  cycle?: (d: 1 | -1) => void;
  /** Entrée / tap on the label (default: next value) */
  action?: () => void;
  /** line shown under the menu while the row is selected */
  help?: () => string;
  hidden?: () => boolean;
  cls?: string;
}

/** Keyboard / pad / touch menu of TrainingRows (up / down select, left / right change, confirm acts). */
export class RowMenu {
  readonly el: HTMLDivElement;
  readonly helpEl: HTMLDivElement;
  index = 0;
  private shown: TrainingRow[] = [];
  private buttons: HTMLButtonElement[] = [];

  constructor(
    private rows: TrainingRow[],
    private onMove?: () => void,
  ) {
    this.el = h('div', { class: 'menu tr-menu' });
    this.helpEl = h('div', { class: 'tr-help' });
    this.render();
  }

  /** Rebuilds the rows (values or visibility changed), keeping the selected one. */
  render() {
    const cur = this.shown[this.index];
    this.shown = this.rows.filter((r) => !r.hidden?.());
    this.buttons = this.shown.map((r, i) => {
      const b = h('button', { class: 'tr-row ' + (r.cls ?? '') }, h('span', { class: 'tr-lbl' }, r.label));
      if (r.value) {
        const prev = h('i', { class: 'tr-arr', 'aria-label': 'précédent' }, '◀');
        const next = h('i', { class: 'tr-arr', 'aria-label': 'suivant' }, '▶');
        const val = h('span', { class: 'tr-val' }, prev, h('b', null, r.value()), next);
        prev.addEventListener('click', (e) => {
          e.stopPropagation();
          this.select(i, false);
          this.change(-1);
        });
        next.addEventListener('click', (e) => {
          e.stopPropagation();
          this.select(i, false);
          this.change(1);
        });
        b.append(val);
      }
      b.addEventListener('mouseenter', () => this.select(i, false));
      b.addEventListener('click', () => {
        this.select(i, false);
        this.activate();
      });
      return b;
    });
    this.el.replaceChildren(...this.buttons);
    // two columns on short screens (see training.css): filled top to bottom
    this.el.style.setProperty('--rows', String(Math.ceil(this.buttons.length / 2)));
    const keep = cur ? this.shown.indexOf(cur) : -1;
    this.select(keep >= 0 ? keep : Math.min(this.index, this.shown.length - 1), false);
  }

  select(i: number, sound = true) {
    const n = this.shown.length;
    if (!n) return;
    const j = ((i % n) + n) % n;
    if (j !== this.index && sound) this.onMove?.();
    this.index = j;
    this.buttons.forEach((b, k) => b.classList.toggle('sel', k === j));
    this.helpEl.textContent = this.shown[j]?.help?.() ?? '';
    this.buttons[j]?.scrollIntoView?.({ block: 'nearest' });
  }

  move(d: number) {
    this.select(this.index + d);
  }

  /** ← → on the selected row */
  change(d: 1 | -1) {
    const r = this.shown[this.index];
    if (!r?.cycle) return;
    r.cycle(d);
    audio.sfx('cursor');
    this.render();
  }

  activate() {
    const r = this.shown[this.index];
    if (!r) return;
    if (r.action) {
      audio.sfx('confirm');
      r.action();
    } else if (r.cycle) this.change(1);
  }
}

// ---------------------------------------------------------------- the session

interface HistEntry {
  dir: number;
  btn: number;
  n: number;
}

interface Exchange {
  att: 0 | 1;
  def: 0 | 1;
  kind: 'hit' | 'block';
  counter: boolean;
  t0: number;
  /** frame each fighter became actionable again (null = not yet) */
  free: [number | null, number | null];
}

/** Hooks of the pause menu back into the fight screen. */
export interface TrainingMenuHooks {
  resume(): void;
  reset(place: Placement): void;
  changeFighters(): void;
  help(): void;
  quit(): void;
}

export class TrainingSession {
  readonly opts = loadOptions();
  /** displays (input history, frame advantage, combo info), over the fight */
  readonly el: HTMLDivElement;
  private histEl: HTMLDivElement;
  private infoEl: HTMLDivElement;
  private advEl: HTMLDivElement;
  private comboEl: HTMLDivElement;
  private recEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private toastT = 0;

  private hist: HistEntry[] = [];
  private histDirty = true;
  private brains: Partial<Record<'cpu' | 'cpuHard', CpuBrain>> = {};
  /** recording: 'wait' = armed (starts with the first input), 'rec' = recording, 'play' = replaying */
  private rec: { phase: 'off' | 'wait' | 'rec' | 'play'; data: number[]; idx: number; gap: number } = { phase: 'off', data: [], idx: 0, gap: 0 };
  /** « Garde après le 1er coup » */
  private afterHit = false;
  private afterQuiet = 0;
  /** frames both fighters have been calm (health regen) */
  private calm = 0;
  /** frame advantage */
  private ex: Exchange | null = null;
  private prev: { action: Action; moveId: MoveId | null }[] = [];
  private adv: { v: number; kind: 'hit' | 'block'; counter: boolean } | null = null;
  private advShown = '';
  /** last / current combo of P1 on the dummy */
  private combo = { hits: 0, dmg: 0, pct: 0, live: false };
  private comboShown = '';
  private recShown = '';

  constructor(private hasAssist: boolean) {
    this.histEl = h('div', { class: 'tr-inputs' });
    this.advEl = h('div', { class: 'tr-adv' });
    this.comboEl = h('div', { class: 'tr-combo' });
    this.recEl = h('div', { class: 'tr-rec' });
    this.toastEl = h('div', { class: 'tr-toast' });
    this.infoEl = h('div', { class: 'tr-info' }, this.recEl, this.advEl, this.comboEl, this.toastEl);
    this.el = h('div', { class: 'training-hud passthrough' }, this.infoEl, this.histEl);
    // nothing to show before the first recording / exchange / combo
    this.recEl.hidden = true;
    // a recording can't survive a new fight
    if (this.opts.dummy === 'record') this.opts.dummy = 'stand';
    this.applyVisibility();
  }

  get recording(): boolean {
    return this.rec.phase === 'wait' || this.rec.phase === 'rec';
  }

  // ------------------------------------------------------------ per tick

  /**
   * Inputs of both sides for this frame from the human's controls: P1 = the human
   * (nothing while recording), P2 = the dummy's behaviour (the human while recording).
   */
  inputs(s: GameState, human: number): [number, number] {
    const [p1, dummy] = s.fighters;
    const fighting = s.phase === 'fight';
    if (fighting) this.pushHistory(human, this.recording ? dummy.facing : p1.facing);
    if (this.recording) {
      if (fighting) this.recordFrame(human, dummy.facing);
      return [0, human];
    }
    return [human, fighting ? this.dummyInput(s) : 0];
  }

  /** After the step: frame advantage, combo info, regen and the options' gauges. */
  after(s: GameState) {
    if (s.phase !== 'fight') return;
    this.trackExchange(s);
    this.trackCombo(s);
    this.trackAfterHit(s);
    this.regen(s);
    this.applyGauges(s);
  }

  private dummyInput(s: GameState): number {
    switch (this.opts.dummy) {
      case 'stand':
        return 0;
      case 'crouch':
        return IN_DOWN;
      case 'jump':
        return IN_UP;
      case 'guardHigh':
        return IN_GUARD;
      case 'guardLow':
        return IN_GUARD | IN_DOWN;
      case 'guardAuto':
        return this.autoGuard(s);
      case 'guardAfter':
        return this.afterHit ? this.autoGuard(s) : 0;
      case 'cpu':
      case 'cpuHard': {
        const k = this.opts.dummy;
        const brain = (this.brains[k] ??= new CpuBrain(k === 'cpu' ? 'normal' : 'hard'));
        return brain.think(s, 1);
      }
      case 'record':
        return this.replayFrame(s.fighters[1].facing);
    }
  }

  /**
   * Guard held all the time (so a guard press never opens a parry window right before a hit),
   * crouched against a low: reads the level of P1's current move.
   */
  private autoGuard(s: GameState): number {
    const a = s.fighters[0];
    const low = (a.action === 'attack' || a.action === 'airAttack') && !!a.moveId && MOVES[a.moveId]?.level === 'low';
    return IN_GUARD | (low ? IN_DOWN : 0);
  }

  private trackAfterHit(s: GameState) {
    if (this.opts.dummy !== 'guardAfter') {
      this.afterHit = false;
      return;
    }
    const [p1, d] = s.fighters;
    if (HURT.has(d.action)) {
      this.afterHit = true;
      this.afterQuiet = 0;
      return;
    }
    if (!this.afterHit) return;
    const pressure = p1.action === 'attack' || p1.action === 'airAttack' || d.action === 'blockstun' || !!s.projectiles?.[0] || (s.assists?.[0]?.phase ?? 'off') !== 'off';
    this.afterQuiet = pressure ? 0 : this.afterQuiet + 1;
    if (this.afterQuiet >= AFTER_HIT_QUIET) this.afterHit = false;
  }

  // ------------------------------------------------------------ recording

  /** Arms a new recording: the human controls the dummy from the first input, 10 s max. */
  startRecording() {
    this.opts.dummy = 'record';
    saveOptions(this.opts);
    this.rec = { phase: 'wait', data: [], idx: 0, gap: 0 };
    this.toast('ENREGISTREMENT : TU CONTRÔLES LE MANNEQUIN', 150);
  }

  /** Ends the recording (10 s reached, or pause): the dummy replays it in a loop. */
  stopRecording() {
    if (!this.recording) return;
    const d = this.rec.data;
    while (d.length && d[d.length - 1] === 0) d.pop();
    this.rec = { phase: d.length ? 'play' : 'off', data: d, idx: 0, gap: REPLAY_GAP };
    if (d.length) this.toast('LE MANNEQUIN REJOUE TA SÉQUENCE', 120);
  }

  /** Recorded with « forward = right »: replayed mirrored when the sides switched. */
  private recordFrame(human: number, facing: 1 | -1) {
    const r = this.rec;
    if (r.phase === 'wait') {
      if (!human) return;
      r.phase = 'rec';
    }
    r.data.push(facing === 1 ? human : mirror(human));
    if (r.data.length >= REC_MAX) this.stopRecording();
  }

  private replayFrame(facing: 1 | -1): number {
    const r = this.rec;
    if (r.phase !== 'play' || !r.data.length) return 0;
    if (r.gap > 0) {
      r.gap--;
      return 0;
    }
    const v = r.data[r.idx++];
    if (r.idx >= r.data.length) {
      r.idx = 0;
      r.gap = REPLAY_GAP;
    }
    return facing === 1 ? v : mirror(v);
  }

  // ------------------------------------------------------------ input history

  private pushHistory(bits: number, facing: 1 | -1) {
    const dir = relDir(bits, facing);
    const btn = bits & BUTTON_MASK;
    const top = this.hist[0];
    if (top && top.dir === dir && top.btn === btn) {
      top.n++;
      return;
    }
    this.hist.unshift({ dir, btn, n: 1 });
    if (this.hist.length > HISTORY) this.hist.length = HISTORY;
    this.histDirty = true;
  }

  // ------------------------------------------------------------ frame advantage

  /** frame on which fighter i became actionable again (this step), or null */
  private becameActionable(s: GameState, i: 0 | 1): number | null {
    const f = s.fighters[i];
    const p = this.prev[i];
    if (!p || FREE.has(p.action)) return null;
    // recovery of an attack ends with the sim's neutral() on the same frame; stuns, landings,
    // get-ups… end one frame before the fighter can act
    if (FREE.has(f.action)) return p.action === 'attack' ? s.frame : s.frame + 1;
    // a fresh move (not a cancel: chain 1, first frame) or a jump / dash started straight
    // from the recovery of the previous move
    if (p.action === 'attack' && f.action === 'attack' && f.chain === 1 && f.actionFrame === 1) return s.frame;
    if (p.action === 'attack' && FROM_NEUTRAL.has(f.action) && f.actionFrame === 0) return s.frame;
    return null;
  }

  private trackExchange(s: GameState) {
    for (const ev of s.events) {
      let att: 0 | 1;
      let kind: 'hit' | 'block';
      let counter = false;
      if (ev.t === 'hit') {
        if (ev.self) continue;
        att = ev.p === 1 ? 1 : 0;
        kind = 'hit';
        counter = ev.counter;
      } else if (ev.t === 'block') {
        att = ev.p === 1 ? 0 : 1;
        kind = 'block';
      } else if (ev.t === 'parry') {
        this.ex = null;
        continue;
      } else continue;
      const def = (1 - att) as 0 | 1;
      const free: [number | null, number | null] = [null, null];
      // projectiles / assists: the attacker may already be free
      if (FREE.has(s.fighters[att].action)) free[att] = s.frame;
      this.ex = { att, def, kind, counter, t0: s.frame, free };
    }
    const ex = this.ex;
    if (ex) {
      for (const i of [0, 1] as const) {
        if (ex.free[i] !== null || ex.t0 === s.frame) continue;
        const t = this.becameActionable(s, i);
        if (t !== null) ex.free[i] = t;
      }
      const [a, b] = ex.free;
      if (a !== null && b !== null) {
        const v = ex.free[ex.def]! - ex.free[ex.att]!;
        // shown from P1's point of view: + = P1 can act first
        this.adv = { v: ex.att === 0 ? v : -v, kind: ex.kind, counter: ex.counter };
        this.ex = null;
      } else if (s.frame - ex.t0 > EXCHANGE_TIMEOUT) this.ex = null;
    }
    this.prev = s.fighters.map((f) => ({ action: f.action, moveId: f.moveId }));
  }

  // ------------------------------------------------------------ combo, regen, gauges

  private trackCombo(s: GameState) {
    const d = s.fighters[1];
    if (d.comboCount > 0) {
      const max = d.maxHp > 0 ? d.maxHp : 1;
      this.combo = { hits: d.comboCount, dmg: d.comboDamage, pct: Math.round((d.comboDamage / max) * 100), live: true };
    } else this.combo.live = false;
  }

  private regen(s: GameState) {
    const calm = s.fighters.every((f) => f.comboCount === 0 && CALM.has(f.action)) && !s.projectiles?.some((p) => !!p);
    this.calm = calm ? this.calm + 1 : 0;
    if (this.calm !== REGEN_DELAY) return;
    for (const f of s.fighters) {
      const max = f.maxHp > 0 ? f.maxHp : f.hp;
      // « normale »: only refilled once (almost) empty, so the fight goes on
      if (this.opts.life === 'regen' || f.hp <= Math.max(1, max * 0.02)) f.hp = max;
    }
  }

  private applyGauges(s: GameState) {
    if (this.opts.meter === 'infinite') s.fighters[0].meter = MAX_METER;
    if (this.opts.guard === 'infinite') for (const f of s.fighters) if (f.action !== 'guardCrush' && f.guardMax > 0) f.guard = f.guardMax;
    const a = s.assists?.[0];
    if (this.opts.assist === 'instant' && a && a.phase === 'off') a.cooldown = 0;
  }

  /** After « Remettre en place » / a new state: nothing pending refers to the old one. */
  onReset(s: GameState) {
    this.ex = null;
    this.prev = s.fighters.map((f) => ({ action: f.action, moveId: f.moveId }));
    this.calm = 0;
    this.afterHit = false;
    this.afterQuiet = 0;
    this.brains = {};
    this.combo.live = false;
    if (this.recording) this.rec = { phase: 'off', data: [], idx: 0, gap: 0 };
    else {
      this.rec.idx = 0;
      this.rec.gap = REPLAY_GAP;
    }
    this.applyGauges(s);
  }

  /** The pause menu opens: a recording in progress ends there. */
  onPause() {
    this.stopRecording();
  }

  // ------------------------------------------------------------ displays

  private applyVisibility() {
    this.histEl.hidden = !this.opts.inputs;
    this.advEl.hidden = !this.opts.frames || !this.adv;
    this.comboEl.hidden = !this.opts.combo || !this.combo.hits;
  }

  /** Short message under the info box (fades by itself). */
  toast(text: string, frames = 150) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('on');
    this.toastT = frames;
  }

  /** Called every rendered frame. */
  render(dtFrames: number) {
    if (this.toastT > 0) {
      this.toastT -= dtFrames;
      if (this.toastT <= 0) this.toastEl.classList.remove('on');
    }
    // recording banner
    const r = this.rec;
    const recText =
      r.phase === 'wait'
        ? '● ENREGISTREMENT · À TOI !'
        : r.phase === 'rec'
          ? `● ENREGISTREMENT ${((REC_MAX - r.data.length) / 60).toFixed(1)} s`
          : this.opts.dummy === 'record' && r.phase === 'play'
            ? '▶ REJOUE EN BOUCLE'
            : '';
    if (recText !== this.recShown) {
      this.recShown = recText;
      this.recEl.textContent = recText;
      this.recEl.hidden = !recText;
      this.recEl.classList.toggle('play', r.phase === 'play');
    }
    if (this.opts.frames) {
      const a = this.adv;
      const key = a ? `${a.v}|${a.kind}|${a.counter}` : '-';
      if (key !== this.advShown) {
        this.advShown = key;
        this.advEl.hidden = !a;
        const val = a ? (a.v > 0 ? '+' : a.v < 0 ? '−' : '±') + Math.abs(a.v) : '—';
        const cls = !a ? 'none' : a.v > 0 ? 'pos' : a.v < 0 ? 'neg' : 'even';
        const what = a ? (a.kind === 'block' ? 'BLOQUÉ' : a.counter ? 'TOUCHÉ · CONTRE' : 'TOUCHÉ') : 'FAIS UN COUP';
        this.advEl.replaceChildren(h('span', { class: 'k' }, 'AVANTAGE'), h('b', { class: cls }, val), h('small', null, what));
      }
    }
    if (this.opts.combo) {
      const c = this.combo;
      const key = `${c.hits}|${c.dmg}|${c.live}`;
      if (key !== this.comboShown) {
        this.comboShown = key;
        this.comboEl.hidden = !c.hits;
        this.comboEl.classList.toggle('live', c.live);
        this.comboEl.replaceChildren(
          h('span', { class: 'k' }, 'COMBO'),
          ...(c.hits
            ? [h('b', null, String(c.hits)), c.hits > 1 ? ' COUPS · ' : ' COUP · ', h('b', null, String(c.dmg)), ' DÉGÂTS ', h('small', null, `(${c.pct} %)`)]
            : [h('small', null, 'AUCUN POUR L’INSTANT')]),
        );
      }
    }
    if (this.opts.inputs) this.renderHistory();
  }

  private renderHistory() {
    if (this.histDirty) {
      this.histDirty = false;
      const rows = this.hist.map((e) => {
        const ang = dirAngle(e.dir);
        const arrow = ang < 0 ? h('i', { class: 'arr n' }, '•') : h('i', { class: 'arr', style: `--r:${ang}deg` }, '↑');
        const btns = BUTTONS.filter(([b]) => e.btn & b).map(([, label, c]) => h('span', { class: 'b ' + c }, label));
        return h('div', { class: 'tr-in' + (ang < 0 && !e.btn ? ' idle' : '') }, h('span', { class: 'n' }, ''), arrow, ...btns);
      });
      this.histEl.replaceChildren(...rows);
    }
    // frame counts (the top line keeps counting)
    const kids = this.histEl.children;
    for (let i = 0; i < kids.length && i < this.hist.length; i++) {
      const n = kids[i].firstChild as HTMLElement;
      const t = String(Math.min(999, this.hist[i].n));
      if (n.textContent !== t) n.textContent = t;
    }
  }

  // ------------------------------------------------------------ pause menu

  menuRows(hooks: TrainingMenuHooks): TrainingRow[] {
    const o = this.opts;
    const save = () => {
      saveOptions(o);
      this.applyVisibility();
    };
    const cycleOf = <T>(values: T[], get: () => T, set: (v: T) => void) => (d: 1 | -1) => {
      const i = values.indexOf(get());
      set(values[(i + d + values.length) % values.length]);
      save();
    };
    const onOff = (v: boolean) => (v ? 'AFFICHÉ' : 'CACHÉ');
    const places: Placement[] = ['center', 'left', 'right'];
    const placeLabel: Record<Placement, string> = { center: 'CENTRE', left: 'COIN GAUCHE', right: 'COIN DROIT' };
    const mode = () => DUMMY_MODES.find((m) => m.id === o.dummy) ?? DUMMY_MODES[0];
    return [
      { label: 'REPRENDRE', action: () => hooks.resume(), help: () => 'Retour au combat (Échap / Start / II)' },
      {
        label: 'REMETTRE EN PLACE',
        value: () => placeLabel[o.place],
        cycle: cycleOf(places, () => o.place, (v) => (o.place = v)),
        action: () => hooks.reset(o.place),
        help: () =>
          o.place === 'center' ? 'Entrée / toucher : les deux persos au centre, vie et garde pleines' : 'Entrée / toucher : le mannequin dos au mur, toi devant lui',
        cls: 'act',
      },
      {
        label: 'MANNEQUIN',
        value: () => mode().label,
        cycle: cycleOf(
          DUMMY_MODES.map((m) => m.id),
          () => o.dummy,
          (v) => {
            o.dummy = v;
            this.brains = {};
            this.afterHit = false;
          },
        ),
        help: () => mode().help,
      },
      {
        label: '● ENREGISTRER (10 S MAX)',
        hidden: () => o.dummy !== 'record',
        action: () => {
          this.startRecording();
          hooks.resume();
        },
        help: () =>
          this.rec.data.length
            ? `Séquence actuelle : ${(this.rec.data.length / 60).toFixed(1)} s, rejouée en boucle. Pause = fin de l’enregistrement.`
            : 'Tu prends le mannequin jusqu’à 10 s (Pause = fin), puis il rejoue ta séquence en boucle.',
        cls: 'act rec',
      },
      {
        label: 'VIE',
        value: () => (o.life === 'regen' ? 'RÉGÉNÉRATION' : 'NORMALE'),
        cycle: cycleOf<TrainingOptions['life']>(['regen', 'normal'], () => o.life, (v) => (o.life = v)),
        help: () => (o.life === 'regen' ? 'La vie remonte à fond après chaque combo.' : 'La vie ne remonte que quand elle est vide.'),
      },
      {
        label: 'JAUGE BBL MAX',
        value: () => (o.meter === 'infinite' ? 'INFINIE' : 'NORMALE'),
        cycle: cycleOf<TrainingOptions['meter']>(['normal', 'infinite'], () => o.meter, (v) => (o.meter = v)),
        help: () => (o.meter === 'infinite' ? 'Ta jauge BBL est toujours pleine : BBL MAX à volonté.' : 'La jauge BBL se remplit normalement.'),
      },
      {
        label: 'GARDE',
        value: () => (o.guard === 'infinite' ? 'INFINIE' : 'NORMALE'),
        cycle: cycleOf<TrainingOptions['guard']>(['normal', 'infinite'], () => o.guard, (v) => (o.guard = v)),
        help: () => (o.guard === 'infinite' ? 'Les jauges de garde ne s’usent pas : pas de garde brisée.' : 'Chaque coup bloqué use la jauge de garde ; vide = GARDE BRISÉE.'),
      },
      {
        label: 'ASSIST',
        value: () => (o.assist === 'instant' ? 'RECHARGE INSTANTANÉE' : 'NORMALE'),
        cycle: cycleOf<TrainingOptions['assist']>(['normal', 'instant'], () => o.assist, (v) => (o.assist = v)),
        hidden: () => !this.hasAssist,
        help: () => (o.assist === 'instant' ? 'Ton assist revient dès qu’il est reparti.' : 'Ton assist recharge normalement.'),
      },
      {
        label: 'HISTORIQUE DES TOUCHES',
        value: () => onOff(o.inputs),
        cycle: () => ((o.inputs = !o.inputs), save()),
        help: () => 'Tes dernières entrées (flèches : → = avant) et combien de frames chacune a duré.',
      },
      {
        label: 'INFOS COMBO',
        value: () => onOff(o.combo),
        cycle: () => ((o.combo = !o.combo), save()),
        help: () => 'Nombre de coups et dégâts de ton combo.',
      },
      {
        label: 'AVANTAGE (FRAMES)',
        value: () => onOff(o.frames),
        cycle: () => ((o.frames = !o.frames), save()),
        help: () => 'Après chaque échange : + = tu peux rejouer avant le mannequin, − = après lui.',
      },
      { label: 'CHANGER DE PERSO', action: () => hooks.changeFighters(), help: () => 'Retour à la sélection des persos' },
      { label: 'COMMANDES', action: () => hooks.help(), help: () => 'Les touches et les techniques' },
      { label: 'MENU PRINCIPAL', action: () => hooks.quit(), help: () => 'Quitter l’entraînement' },
    ];
  }

  /** Message shown when the fight resumes (current dummy behaviour). */
  resumeToast() {
    if (this.recording) return;
    const m = DUMMY_MODES.find((d) => d.id === this.opts.dummy);
    if (this.opts.dummy === 'record' && this.rec.phase !== 'play') {
      this.toast('MANNEQUIN : PAS ENCORE DE SÉQUENCE', 120);
      return;
    }
    if (m) this.toast('MANNEQUIN : ' + m.label, 110);
  }
}
