import { IN_ASSIST, IN_DOWN, IN_GRAB, IN_GUARD, IN_LEFT, IN_LK, IN_LP, IN_RIGHT, IN_RK, IN_RP, IN_SUPER, IN_UP } from '../sim/types';

/**
 * Keyboard (physical key codes, so AZERTY & QWERTY both work), gamepads and
 * arcade sticks (remappable per device, see "gamepads & arcade sticks" below)
 * and touch controls → 8-bit fighting-game inputs.
 */

export type ControlMode = 'solo' | 'versus';

type Binding = Record<'up' | 'down' | 'left' | 'right' | 'lp' | 'rp' | 'lk' | 'rk' | 'super' | 'guard' | 'grab' | 'assist', string[]>;

/** P1 when two players share the keyboard: ZQSD/WASD + R T F G, E = BBL MAX, Y = ASSIST */
export const P1_KEYS: Binding = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  lp: ['KeyR'],
  rp: ['KeyT'],
  lk: ['KeyF'],
  rk: ['KeyG'],
  super: ['KeyE'],
  guard: ['ShiftLeft'],
  grab: ['KeyQ'],
  assist: ['KeyY'],
};
/** P2 when two players share the keyboard: arrows + I O K L (or numpad 4 5 1 2), P = BBL MAX, M = ASSIST */
export const P2_KEYS: Binding = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  lp: ['KeyI', 'Numpad4'],
  rp: ['KeyO', 'Numpad5'],
  lk: ['KeyK', 'Numpad1'],
  rk: ['KeyL', 'Numpad2'],
  super: ['KeyP', 'Numpad6'],
  guard: ['ShiftRight', 'Numpad0'],
  grab: ['Slash', 'Numpad3'],
  assist: ['KeyM', 'Numpad7'],
};
/** Solo player: everything (WASD or arrows, U I J K or R T F G, E or O = BBL MAX, Y = ASSIST: between both hands) */
export const SOLO_KEYS: Binding = {
  up: ['KeyW', 'ArrowUp', 'Space'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  lp: ['KeyU', 'KeyR', 'Numpad4'],
  rp: ['KeyI', 'KeyT', 'Numpad5'],
  lk: ['KeyJ', 'KeyF', 'Numpad1'],
  rk: ['KeyK', 'KeyG', 'Numpad2'],
  super: ['KeyE', 'KeyO', 'Numpad6'],
  guard: ['ShiftLeft', 'KeyL', 'Numpad0'],
  grab: ['KeyQ', 'KeyH', 'Numpad3'],
  assist: ['KeyY', 'Numpad7'],
};

const BIT: Record<keyof Binding, number> = {
  up: IN_UP,
  down: IN_DOWN,
  left: IN_LEFT,
  right: IN_RIGHT,
  lp: IN_LP,
  rp: IN_RP,
  lk: IN_LK,
  rk: IN_RK,
  super: IN_SUPER,
  guard: IN_GUARD,
  grab: IN_GRAB,
  assist: IN_ASSIST,
};

/** prevPage / nextPage: previous / next character catalogue (CHOPE / BBL MAX keys, PageUp / PageDown, LB / RB) */
export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'start' | 'prevPage' | 'nextPage';
export interface MenuEvent {
  action: MenuAction;
  /** 0 = left side / P1 controls, 1 = right side / P2 controls, -1 = unknown */
  player: number;
}

const MENU_KEYS: Record<string, [MenuAction, number]> = {
  KeyW: ['up', 0],
  KeyS: ['down', 0],
  KeyA: ['left', 0],
  KeyD: ['right', 0],
  KeyR: ['confirm', 0],
  KeyF: ['confirm', 0],
  KeyT: ['back', 0],
  KeyG: ['back', 0],
  KeyQ: ['prevPage', 0],
  KeyE: ['nextPage', 0],
  ArrowUp: ['up', 1],
  ArrowDown: ['down', 1],
  ArrowLeft: ['left', 1],
  ArrowRight: ['right', 1],
  KeyI: ['confirm', 1],
  KeyK: ['confirm', 1],
  KeyO: ['back', 1],
  KeyL: ['back', 1],
  Numpad4: ['confirm', 1],
  Numpad5: ['back', 1],
  Slash: ['prevPage', 1],
  KeyP: ['nextPage', 1],
  Numpad3: ['prevPage', 1],
  Numpad6: ['nextPage', 1],
  PageUp: ['prevPage', -1],
  PageDown: ['nextPage', -1],
  Enter: ['confirm', -1],
  NumpadEnter: ['confirm', -1],
  Space: ['confirm', -1],
  KeyU: ['confirm', -1],
  KeyJ: ['confirm', -1],
  Escape: ['back', -1],
  Backspace: ['back', -1],
};

// ---------------------------------------------------------------- gamepads & arcade sticks

/** What a controller can be asked to do: the fight inputs, then two menu-only ones. */
export const PAD_ACTIONS = ['up', 'down', 'left', 'right', 'lp', 'rp', 'lk', 'rk', 'super', 'guard', 'grab', 'assist', 'start', 'back'] as const;
export type PadAction = (typeof PAD_ACTIONS)[number];
export type HatDir = 'up' | 'down' | 'left' | 'right';
/**
 * One physical input of a controller:
 * - `b`: button `i` (Gamepad.buttons[i])
 * - `a`: axis `i` pushed past half-way towards `d` (-1 / 1): a lever or stick axis, a trigger…
 * - `h`: direction `d` of a POV hat reported on axis `i` (DirectInput sticks / pads, axis 9 in
 *   Chrome on Windows: -1 = up then clockwise in steps of 2/7, neutral reads beyond ±1)
 */
export type PadInput = { t: 'b'; i: number } | { t: 'a'; i: number; d: 1 | -1 } | { t: 'h'; i: number; d: HatDir };
/** Inputs bound to each action (any of them triggers it). Saved per Gamepad.id in localStorage 'bbl.pads'. */
export type PadMap = Record<PadAction, PadInput[]>;

/** bit of each action in the controller masks (padState().held) */
export const PAD_BIT = Object.fromEntries(PAD_ACTIONS.map((a, i) => [a, 1 << i])) as Record<PadAction, number>;
const FIGHT_ACTIONS = PAD_ACTIONS.slice(0, 12) as (keyof Binding)[];
/** fight buttons: during a fight a press on one of them is a blow, never a menu "back" */
const BUTTON_MASK = FIGHT_ACTIONS.slice(4).reduce((m, a) => m | PAD_BIT[a], 0);

const btn = (i: number): PadInput => ({ t: 'b', i });
const ax = (i: number, d: 1 | -1): PadInput => ({ t: 'a', i, d });
const hat = (i: number, d: HatDir): PadInput => ({ t: 'h', i, d });
const DIRS: HatDir[] = ['up', 'down', 'left', 'right'];

/** The browser's "standard" layout (Xbox / PlayStation pads, sticks in PC / XInput mode): the historical controls. */
const STANDARD_MAP: PadMap = {
  up: [btn(12), ax(1, -1)],
  down: [btn(13), ax(1, 1)],
  left: [btn(14), ax(0, -1)],
  right: [btn(15), ax(0, 1)],
  lp: [btn(2)], // X / □
  rp: [btn(3)], // Y / △
  lk: [btn(0)], // A / ✕
  rk: [btn(1)], // B / ○
  super: [btn(5)], // RB / R1
  guard: [btn(6)], // LT / L2
  grab: [btn(4)], // LB / L1
  assist: [btn(7), btn(11)], // RT / R2, or right stick click
  start: [btn(9)],
  back: [btn(1), btn(8)], // B / ○ (menus only), View / Share
};

/**
 * Default of a controller without the standard layout (DirectInput sticks, USB encoders…):
 * the lever on axes 0/1 (when they rest centred) and on every axis that behaves like a POV hat,
 * the buttons at the standard indices (no d-pad buttons: they are often other buttons there).
 */
function genericMap(hats: number[], axes01: [boolean, boolean]): PadMap {
  const m = clonePadMap(STANDARD_MAP);
  for (const d of DIRS) m[d] = [];
  if (axes01[0]) m.left.push(ax(0, -1)), m.right.push(ax(0, 1));
  if (axes01[1]) m.up.push(ax(1, -1)), m.down.push(ax(1, 1));
  for (const i of hats) for (const d of DIRS) m[d].push(hat(i, d));
  return m;
}

export function clonePadMap(m: PadMap): PadMap {
  const out = {} as PadMap;
  for (const a of PAD_ACTIONS) out[a] = (m[a] ?? []).map((x) => ({ ...x }));
  return out;
}

const HAT_BITS = [IN_UP, IN_UP | IN_RIGHT, IN_RIGHT, IN_DOWN | IN_RIGHT, IN_DOWN, IN_DOWN | IN_LEFT, IN_LEFT, IN_UP | IN_LEFT];
const HAT_DIR_BIT: Record<HatDir, number> = { up: IN_UP, down: IN_DOWN, left: IN_LEFT, right: IN_RIGHT };

/** Directions (IN_UP… bits) of a POV hat axis value: 8 positions from -1 (up) clockwise in steps of 2/7; 0 = neutral. */
export function hatBits(v: number | undefined): number {
  if (v === undefined || !(v >= -1.05 && v <= 1.05)) return 0;
  const f = (v + 1) * 3.5;
  const k = Math.round(f);
  return Math.abs(f - k) < 0.3 ? HAT_BITS[k & 7] : 0;
}

// ---- storage (own key: 'bbl.pads' = { v: 1, maps: { [Gamepad.id]: PadMap } })
const PADS_KEY = 'bbl.pads';

function cleanInput(x: unknown): PadInput | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const i = o.i;
  if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i > 63) return null;
  if (o.t === 'b') return btn(i);
  if (o.t === 'a' && (o.d === 1 || o.d === -1)) return ax(i, o.d);
  if (o.t === 'h' && DIRS.includes(o.d as HatDir)) return hat(i, o.d as HatDir);
  return null;
}

function cleanMap(x: unknown): PadMap | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const m = {} as PadMap;
  for (const a of PAD_ACTIONS) {
    const list = Array.isArray(o[a]) ? (o[a] as unknown[]) : [];
    m[a] = list.map(cleanInput).filter((v): v is PadInput => !!v);
  }
  return m;
}

function loadMaps(): Record<string, PadMap> {
  const out: Record<string, PadMap> = {};
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PADS_KEY) : null;
    const data = raw ? (JSON.parse(raw) as { maps?: Record<string, unknown> }) : null;
    for (const [id, m] of Object.entries(data?.maps ?? {})) {
      const c = cleanMap(m);
      if (c) out[id] = c;
    }
  } catch {
    /* private mode, bad data: defaults */
  }
  return out;
}

/** Live state of one connected controller (keyed by its browser slot, Gamepad.index). */
class PadDevice {
  /** axes that behave like a POV hat (seen resting beyond ±1) */
  hat: boolean[] = [];
  /** axes seen near 0: a stick / lever axis (a trigger resting at -1 never is) */
  centered: boolean[] = [];
  /** axis i pushed towards -1 (slot 2i) / +1 (slot 2i+1), with a little hysteresis (no flicker) */
  axOn: boolean[] = [];
  axes: number[] = [];
  buttons: boolean[] = [];
  /** actions held at the last sample */
  held = 0;
  /** actions seen since the last simulation tick (a press shorter than a frame is never lost) */
  latch = 0;
  /** actions held at the sample before (menu events are edges) */
  prev = 0;
  /** actions pressed since the setup screen's input display last looked */
  taps = 0;
  /** no menu events until everything is released (the setup screen just gave it back) */
  mute = false;
  private defKey = '';
  private def: PadMap | null = null;

  constructor(
    readonly index: number,
    readonly id: string,
    readonly standard: boolean,
  ) {}

  /** Copies the browser's snapshot; true when a button was just pressed. */
  read(p: Gamepad): boolean {
    let fresh = false;
    const na = p.axes.length;
    this.axes.length = na;
    for (let i = 0; i < na; i++) {
      const v = Number(p.axes[i]) || 0;
      this.axes[i] = v;
      const a = Math.abs(v);
      if (a > 1.1) this.hat[i] = true; // a POV hat at rest (9/7 in Chrome): normalised axes never go there
      if (a < 0.3) this.centered[i] = true;
      // digital levers report ±1: half-way is plenty, and analog sticks don't flicker around it
      this.axOn[2 * i] = v < (this.axOn[2 * i] ? -0.4 : -0.5);
      this.axOn[2 * i + 1] = v > (this.axOn[2 * i + 1] ? 0.4 : 0.5);
    }
    const nb = p.buttons.length;
    this.buttons.length = nb;
    for (let i = 0; i < nb; i++) {
      const b = p.buttons[i];
      const on = !!b && (b.pressed || b.value > 0.5);
      if (on && !this.buttons[i]) fresh = true;
      this.buttons[i] = on;
    }
    return fresh;
  }

  /** the mapping used when the player saved none */
  defaultMap(): PadMap {
    if (this.standard) return STANDARD_MAP;
    const hats: number[] = [];
    this.hat.forEach((h, i) => h && hats.push(i));
    const a01: [boolean, boolean] = [!this.hat[0] && !!this.centered[0], !this.hat[1] && !!this.centered[1]];
    const key = hats.join(',') + '|' + a01.join(',');
    if (key !== this.defKey || !this.def) {
      this.defKey = key;
      this.def = genericMap(hats, a01);
    }
    return this.def;
  }

  on(x: PadInput): boolean {
    if (x.t === 'b') return !!this.buttons[x.i];
    if (x.t === 'a') return !!this.axOn[2 * x.i + (x.d > 0 ? 1 : 0)];
    return (hatBits(this.axes[x.i]) & HAT_DIR_BIT[x.d]) !== 0;
  }

  /** mask of the actions held (PAD_BIT) */
  actions(m: PadMap): number {
    let held = 0;
    for (let k = 0; k < PAD_ACTIONS.length; k++) {
      for (const x of m[PAD_ACTIONS[k]]) {
        if (this.on(x)) {
          held |= 1 << k;
          break;
        }
      }
    }
    return held;
  }

  /** where each axis rests (setup wizard): where it is now (a trigger rests at -1), snapped to 0 near the centre */
  restAxes(): number[] {
    return this.axes.map((v) => (Math.abs(v) < 0.35 ? 0 : v));
  }

  atRest(rest: number[]): boolean {
    if (this.buttons.includes(true)) return false;
    for (let i = 0; i < this.axes.length; i++) {
      const v = this.axes[i];
      if (this.hat[i] ? hatBits(v) !== 0 : Math.abs(v - (rest[i] ?? 0)) > 0.35) return false;
    }
    return true;
  }

  /** first input pushed away from rest: a button, a hat direction (straight ones only) or an axis direction */
  detect(rest: number[]): PadInput | null {
    for (let i = 0; i < this.buttons.length; i++) if (this.buttons[i]) return btn(i);
    for (let i = 0; i < this.axes.length; i++) {
      if (!this.hat[i]) continue;
      const b = hatBits(this.axes[i]);
      const d = DIRS.find((k) => HAT_DIR_BIT[k] === b);
      if (d) return hat(i, d);
    }
    for (let i = 0; i < this.axes.length; i++) {
      if (this.hat[i]) continue;
      const v = this.axes[i];
      const dv = v - (rest[i] ?? 0);
      if (Math.abs(dv) > 0.6 && Math.abs(v) > 0.5) return ax(i, dv > 0 ? 1 : -1);
    }
    return null;
  }
}

/** A controller as listed by the setup screen. */
export interface PadInfo {
  /** browser slot (Gamepad.index) */
  index: number;
  id: string;
  /** the browser knows its layout (mapping === 'standard') */
  standard: boolean;
  /** a mapping saved by the player is in use (otherwise the default) */
  custom: boolean;
  /** side it plays in local versus (0 = J1, 1 = J2, -1 = none) */
  seat: number;
}

interface Capture {
  index: number;
  /** everything was released: the next input pushed is the answer */
  armed: boolean;
  rest: number[];
  got: PadInput | null;
  since: number;
}

class InputManager {
  private down = new Set<string>();
  /** keys pressed since the last simulation tick (so very short taps are never lost) */
  private latch = new Set<string>();
  private menuQueue: MenuEvent[] = [];
  /** bits from the on-screen touch pad */
  touchBits = 0;
  /** touch buttons pressed since the last simulation tick (a very quick tap is never lost) */
  touchLatch = 0;
  /** true while a text field has focus (disable game keys) */
  private typing = false;
  private listeners = new Set<(code: string) => void>();

  // ---- controllers
  private devs = new Map<number, PadDevice>();
  private maps: Record<string, PadMap> = loadMaps();
  /** local versus: browser slot of the controller of each side (-1 = none) */
  private seats: [number, number] = [-1, -1];
  private seatKey = '#';
  private seatN = -1;
  /** last time a fight read the inputs / ended a simulation tick */
  private fightAt = -1e9;
  private tickAt = -1e9;
  /** rendered frames (poll) since the last simulation tick */
  private framesSinceTick = 1e9;
  /** controller taken over by the setup screen (test / wizard): no menu events from it */
  private claimed = -1;
  private cap: Capture | null = null;
  private sampler = 0;
  /** browser slot of the controller used last, and a counter bumped on each of its presses */
  lastPad = -1;
  padSeq = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      this.typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (this.typing) return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      this.down.add(e.code);
      if (!e.repeat) this.latch.add(e.code);
      const m = MENU_KEYS[e.code];
      if (m) this.menuQueue.push({ action: m[0], player: m[1] });
      for (const l of this.listeners) l(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());
    // hot-plug: controllers come and go at any time (the sampler below also notices)
    window.addEventListener('gamepadconnected', () => this.sample());
    window.addEventListener('gamepaddisconnected', () => this.sample());
    // console / tests: open the game with ?debug
    if (location.search.includes('debug')) (window as unknown as { bblInput: InputManager }).bblInput = this;
  }

  onKey(fn: (code: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private keyBits(b: Binding): number {
    let bits = 0;
    for (const k of Object.keys(b) as (keyof Binding)[]) {
      if (b[k].some((c) => this.down.has(c) || this.latch.has(c))) bits |= BIT[k];
    }
    return bits;
  }

  private rawPads(): Gamepad[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    try {
      return Array.from(navigator.getGamepads())
        .filter((p): p is Gamepad => !!p && p.connected)
        .sort((a, b) => a.index - b.index);
    } catch {
      return [];
    }
  }

  private mapOf(d: PadDevice): PadMap {
    return this.maps[d.id] ?? d.defaultMap();
  }

  /**
   * Reads every controller: held / latched actions, menu events (edges), the setup
   * wizard's capture. Runs every rendered frame (poll) and, while a controller is
   * plugged, about every 4 ms so that a tap shorter than a frame is still seen.
   */
  private sample() {
    const pads = this.rawPads();
    this.updateSeats(pads.map((p) => p.index));
    const fighting = performance.now() - this.fightAt < 300;
    for (const p of pads) {
      let d = this.devs.get(p.index);
      if (!d || d.id !== p.id) {
        d = new PadDevice(p.index, p.id, p.mapping === 'standard');
        this.devs.set(p.index, d);
      }
      const fresh = d.read(p);
      const held = d.actions(this.mapOf(d));
      const edge = held & ~d.prev;
      d.prev = held;
      d.held = held;
      d.latch |= held;
      d.taps |= edge;
      if (this.cap && this.cap.index === d.index) {
        this.captureSample(d);
        continue;
      }
      if (this.claimed === d.index) continue;
      if (d.mute) {
        if (!held && !d.buttons.includes(true)) d.mute = false;
        continue;
      }
      if (fresh || edge) {
        this.lastPad = d.index;
        this.padSeq++;
      }
      if (edge) this.padMenu(d, edge, pads.length, fighting);
    }
    if (this.devs.size !== pads.length) {
      for (const i of [...this.devs.keys()]) {
        if (pads.some((p) => p.index === i)) continue;
        this.devs.delete(i);
        if (this.claimed === i) {
          this.claimed = -1;
          this.cap = null;
        }
      }
    }
    this.runSampler(pads.length > 0);
  }

  private runSampler(on: boolean) {
    if (on && !this.sampler) this.sampler = window.setInterval(() => this.sample(), 4);
    else if (!on && this.sampler) {
      clearInterval(this.sampler);
      this.sampler = 0;
    }
  }

  /** menu events of a controller: its mapped directions, LP / LK = confirm, RETOUR, START */
  private padMenu(d: PadDevice, edge: number, count: number, fighting: boolean) {
    const player = count > 1 ? this.seats.indexOf(d.index) : -1;
    const push = (action: MenuAction) => this.menuQueue.push({ action, player });
    if (edge & PAD_BIT.up) push('up');
    if (edge & PAD_BIT.down) push('down');
    if (edge & PAD_BIT.left) push('left');
    if (edge & PAD_BIT.right) push('right');
    if (edge & (PAD_BIT.lp | PAD_BIT.lk)) push('confirm');
    // in a fight, B / ○ is RK (and RETOUR in menus): a blow, not a pause
    if (edge & PAD_BIT.back && !(fighting && edge & BUTTON_MASK)) push('back');
    if (edge & PAD_BIT.start) push('start');
    // shoulder buttons (CHOPE / BBL MAX): previous / next character catalogue
    if (edge & PAD_BIT.grab) push('prevPage');
    if (edge & PAD_BIT.super) push('nextPage');
  }

  /**
   * Local versus: the 1st controller plays J1 and the 2nd J2 (a lone controller plays J2, the
   * keyboard J1). When one is unplugged mid-game the others keep their side.
   */
  private updateSeats(idx: number[]) {
    const key = idx.join(',');
    if (key === this.seatKey) return;
    const n = idx.length;
    const shrunk = n > 0 && n < this.seatN;
    this.seatKey = key;
    this.seatN = n;
    if (shrunk) {
      const s = this.seats.map((x) => (idx.includes(x) ? x : -1)) as [number, number];
      if (n >= 2) for (const k of [0, 1]) if (s[k] < 0) s[k] = idx.find((x) => !s.includes(x)) ?? -1;
      if (s[0] >= 0 || s[1] >= 0) {
        this.seats = s;
        return;
      }
    }
    this.seats = n >= 2 ? [idx[0], idx[1]] : n === 1 ? [-1, idx[0]] : [-1, -1];
  }

  private captureSample(d: PadDevice) {
    const c = this.cap!;
    const now = performance.now();
    if (c.got) return;
    if (!c.armed) {
      if (d.atRest(c.rest)) {
        c.armed = true;
      } else if (!d.buttons.includes(true) && now - c.since > 1500) {
        // an axis that never settles (worn, floating): where it stays is its rest
        c.rest = d.axes.slice();
        c.since = now;
      }
      return;
    }
    const got = d.detect(c.rest);
    if (got) {
      c.got = got;
      c.armed = false;
      c.since = now;
    }
  }

  /** `latched`: add the presses seen since the last tick (not after a pause / between fights: stale) */
  private padFight(d: PadDevice, latched: boolean): number {
    const m = d.held | (latched ? d.latch : 0);
    let bits = 0;
    for (const a of FIGHT_ACTIONS) if (m & PAD_BIT[a]) bits |= BIT[a];
    return bits;
  }

  /** Call once per rendered frame: reads the controllers (menu events, held buttons). */
  poll() {
    this.framesSinceTick++;
    this.sample();
  }

  /** Call after each simulation tick that read the inputs. */
  endTick() {
    this.latch.clear();
    this.touchLatch = 0;
    for (const d of this.devs.values()) d.latch = 0;
    this.tickAt = performance.now();
    this.framesSinceTick = 0;
  }

  menuEvents(): MenuEvent[] {
    const q = this.menuQueue;
    this.menuQueue = [];
    return q;
  }

  /** Called on every screen change: also gives the controllers their default versus sides back. */
  clearMenu() {
    this.menuQueue.length = 0;
    this.seatKey = '#';
    this.seatN = -1;
  }

  /** Fighting inputs for a player. */
  bits(player: 0 | 1, mode: ControlMode): number {
    const now = performance.now();
    this.fightAt = now;
    // controller presses latched since the last tick (a tap between two polls is never lost),
    // unless the last tick is long gone (pause menu, previous fight): those presses were for the menus
    const latched = now - this.tickAt < 500 || this.framesSinceTick <= 2;
    let bits: number;
    if (mode === 'solo') {
      bits = this.keyBits(SOLO_KEYS) | this.touchBits | this.touchLatch;
      for (const d of this.devs.values()) if (d.index !== this.claimed) bits |= this.padFight(d, latched);
    } else {
      // versus on one machine
      bits = this.keyBits(player === 0 ? P1_KEYS : P2_KEYS);
      const d = this.devs.get(this.seats[player]);
      if (d) bits |= this.padFight(d, latched);
      if (player === 0) bits |= this.touchBits | this.touchLatch;
    }
    // SOCD (hitbox / leverless controllers): up + down = up; left + right cancel out in the sim (toRel)
    if (bits & IN_UP && bits & IN_DOWN) bits &= ~IN_DOWN;
    return bits;
  }

  isDown(code: string) {
    return this.down.has(code);
  }

  // ---- controller setup (OPTIONS → MANETTES & STICKS)

  /** Connected controllers, by browser slot. */
  padList(): PadInfo[] {
    return [...this.devs.values()]
      .sort((a, b) => a.index - b.index)
      .map((d) => ({ index: d.index, id: d.id, standard: d.standard, custom: !!this.maps[d.id], seat: this.seats.indexOf(d.index) }));
  }

  /** Mapping in use for a controller (saved or default; don't modify it: see clonePadMap). */
  padMap(index: number): PadMap | null {
    const d = this.devs.get(index);
    return d ? this.mapOf(d) : null;
  }

  defaultPadMap(index: number): PadMap | null {
    return this.devs.get(index)?.defaultMap() ?? null;
  }

  /** Saves the mapping of every controller with this id (null = back to the default). */
  setPadMap(id: string, map: PadMap | null) {
    if (map) this.maps[id] = clonePadMap(map);
    else delete this.maps[id];
    // a button held right now may mean something else under the new mapping: not a click
    for (const d of this.devs.values()) if (d.id === id) d.mute = true;
    try {
      localStorage.setItem(PADS_KEY, JSON.stringify({ v: 1, maps: this.maps }));
    } catch {
      /* private mode: kept for this session */
    }
  }

  /** Live state of a controller (setup screen: input display). */
  padState(index: number): { held: number; axes: readonly number[]; buttons: readonly boolean[]; hats: readonly boolean[] } | null {
    const d = this.devs.get(index);
    return d ? { held: d.held, axes: d.axes, buttons: d.buttons, hats: d.hat } : null;
  }

  /** Directions the game gets from one controller right now, SOCD applied (input display). */
  padDirs(index: number): number {
    const m = this.devs.get(index)?.held ?? 0;
    let b = 0;
    for (const a of FIGHT_ACTIONS.slice(0, 4)) if (m & PAD_BIT[a]) b |= BIT[a];
    return b & IN_UP && b & IN_DOWN ? b & ~IN_DOWN : b;
  }

  /** Actions pressed since the last call, even for less than a frame (input display). */
  takePadTaps(index: number): number {
    const d = this.devs.get(index);
    if (!d) return 0;
    const t = d.taps;
    d.taps = 0;
    return t;
  }

  /** The setup screen takes a controller over (test / wizard): its presses stop making menu events. */
  claimPad(index: number) {
    this.releasePad();
    this.claimed = index;
  }

  /** …and gives it back to the menus: whatever it still holds is not taken as a click. */
  releasePad() {
    const d = this.devs.get(this.claimed);
    if (d) d.mute = true;
    this.claimed = -1;
    this.cap = null;
  }

  get claimedPad() {
    return this.claimed;
  }

  /** Wizard: once the claimed controller is back at rest, its next press is reported by takeCapture (edge, never repeated). */
  startCapture() {
    const d = this.devs.get(this.claimed);
    this.cap = d ? { index: d.index, armed: false, rest: d.restAxes(), got: null, since: performance.now() } : null;
  }

  takeCapture(): PadInput | null {
    const c = this.cap;
    if (!c?.got) return null;
    const g = c.got;
    c.got = null;
    return g;
  }

  /** false while the wizard waits for everything to be released */
  get captureArmed() {
    return !!this.cap?.armed;
  }
}

export const input = new InputManager();

/** Human readable key label, honouring the user's keyboard layout when the browser exposes it. */
let layoutMap: Map<string, string> | null = null;
export async function initKeyLabels() {
  try {
    const kb = (navigator as unknown as { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
    if (kb?.getLayoutMap) layoutMap = await kb.getLayoutMap();
  } catch {
    layoutMap = null;
  }
}
export function keyLabel(code: string): string {
  const special: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Espace',
    ShiftLeft: 'Maj gauche',
    ShiftRight: 'Maj droite',
    Numpad4: 'Num4',
    Numpad5: 'Num5',
    Numpad1: 'Num1',
    Numpad2: 'Num2',
    Numpad7: 'Num7',
  };
  if (special[code]) return special[code];
  const l = layoutMap?.get(code);
  if (l) return l.toUpperCase();
  return code.replace(/^Key/, '').replace(/^Digit/, '');
}
