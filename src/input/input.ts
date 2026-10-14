import { IN_DOWN, IN_LEFT, IN_LK, IN_LP, IN_RIGHT, IN_RK, IN_RP, IN_UP } from '../sim/types';

/**
 * Keyboard (physical key codes, so AZERTY & QWERTY both work), gamepads and
 * touch controls → 8-bit fighting-game inputs.
 */

export type ControlMode = 'solo' | 'versus';

type Binding = Record<'up' | 'down' | 'left' | 'right' | 'lp' | 'rp' | 'lk' | 'rk', string[]>;

/** P1 when two players share the keyboard: ZQSD/WASD + R T F G */
export const P1_KEYS: Binding = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  lp: ['KeyR'],
  rp: ['KeyT'],
  lk: ['KeyF'],
  rk: ['KeyG'],
};
/** P2 when two players share the keyboard: arrows + I O K L (or numpad 4 5 1 2) */
export const P2_KEYS: Binding = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  lp: ['KeyI', 'Numpad4'],
  rp: ['KeyO', 'Numpad5'],
  lk: ['KeyK', 'Numpad1'],
  rk: ['KeyL', 'Numpad2'],
};
/** Solo player: everything (WASD or arrows, U I J K or R T F G) */
export const SOLO_KEYS: Binding = {
  up: ['KeyW', 'ArrowUp', 'Space'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  lp: ['KeyU', 'KeyR', 'Numpad4'],
  rp: ['KeyI', 'KeyT', 'Numpad5'],
  lk: ['KeyJ', 'KeyF', 'Numpad1'],
  rk: ['KeyK', 'KeyG', 'Numpad2'],
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
};

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'start';
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
  Enter: ['confirm', -1],
  NumpadEnter: ['confirm', -1],
  Space: ['confirm', -1],
  KeyU: ['confirm', -1],
  KeyJ: ['confirm', -1],
  Escape: ['back', -1],
  Backspace: ['back', -1],
  KeyP: ['start', -1],
};

class InputManager {
  private down = new Set<string>();
  private menuQueue: MenuEvent[] = [];
  private padPrev: number[][] = [[], [], [], []];
  /** bits from the on-screen touch pad */
  touchBits = 0;
  /** true while a text field has focus (disable game keys) */
  private typing = false;
  private listeners = new Set<(code: string) => void>();

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      this.typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (this.typing) return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      this.down.add(e.code);
      const m = MENU_KEYS[e.code];
      if (m) this.menuQueue.push({ action: m[0], player: m[1] });
      for (const l of this.listeners) l(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  onKey(fn: (code: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private keyBits(b: Binding): number {
    let bits = 0;
    for (const k of Object.keys(b) as (keyof Binding)[]) {
      if (b[k].some((c) => this.down.has(c))) bits |= BIT[k];
    }
    return bits;
  }

  private pads(): Gamepad[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    return Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p && p.connected);
  }

  private padBits(p: Gamepad): number {
    const b = (i: number) => !!p.buttons[i]?.pressed;
    const ax = p.axes[0] ?? 0;
    const ay = p.axes[1] ?? 0;
    let bits = 0;
    if (b(12) || ay < -0.5) bits |= IN_UP;
    if (b(13) || ay > 0.5) bits |= IN_DOWN;
    if (b(14) || ax < -0.5) bits |= IN_LEFT;
    if (b(15) || ax > 0.5) bits |= IN_RIGHT;
    if (b(2)) bits |= IN_LP;
    if (b(3)) bits |= IN_RP;
    if (b(0)) bits |= IN_LK;
    if (b(1)) bits |= IN_RK;
    if (b(4)) bits |= IN_LP | IN_LK; // LB = throw
    if (b(5)) bits |= IN_RP | IN_RK;
    return bits;
  }

  /** Call once per rendered frame: turns gamepad edges into menu events. */
  poll() {
    const pads = this.pads();
    pads.forEach((p, i) => {
      const prev = this.padPrev[i] ?? [];
      const now = p.buttons.map((bt) => (bt.pressed ? 1 : 0));
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      now[100] = ay < -0.6 ? 1 : 0;
      now[101] = ay > 0.6 ? 1 : 0;
      now[102] = ax < -0.6 ? 1 : 0;
      now[103] = ax > 0.6 ? 1 : 0;
      const edge = (k: number) => now[k] && !prev[k];
      const player = pads.length > 1 ? i : -1;
      if (edge(12) || edge(100)) this.menuQueue.push({ action: 'up', player });
      if (edge(13) || edge(101)) this.menuQueue.push({ action: 'down', player });
      if (edge(14) || edge(102)) this.menuQueue.push({ action: 'left', player });
      if (edge(15) || edge(103)) this.menuQueue.push({ action: 'right', player });
      if (edge(0) || edge(2)) this.menuQueue.push({ action: 'confirm', player });
      if (edge(1) || edge(8)) this.menuQueue.push({ action: 'back', player });
      if (edge(9)) this.menuQueue.push({ action: 'start', player });
      this.padPrev[i] = now;
    });
  }

  menuEvents(): MenuEvent[] {
    const q = this.menuQueue;
    this.menuQueue = [];
    return q;
  }

  clearMenu() {
    this.menuQueue.length = 0;
  }

  /** Fighting inputs for a player. */
  bits(player: 0 | 1, mode: ControlMode): number {
    const pads = this.pads();
    if (mode === 'solo') {
      let bits = this.keyBits(SOLO_KEYS) | this.touchBits;
      for (const p of pads) bits |= this.padBits(p);
      return bits;
    }
    // versus on one machine
    let bits = this.keyBits(player === 0 ? P1_KEYS : P2_KEYS);
    if (pads.length >= 2) bits |= this.padBits(pads[player]);
    else if (pads.length === 1 && player === 1) bits |= this.padBits(pads[0]);
    if (player === 0) bits |= this.touchBits;
    return bits;
  }

  isDown(code: string) {
    return this.down.has(code);
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
    Numpad4: 'Num4',
    Numpad5: 'Num5',
    Numpad1: 'Num1',
    Numpad2: 'Num2',
  };
  if (special[code]) return special[code];
  const l = layoutMap?.get(code);
  if (l) return l.toUpperCase();
  return code.replace(/^Key/, '').replace(/^Digit/, '');
}
