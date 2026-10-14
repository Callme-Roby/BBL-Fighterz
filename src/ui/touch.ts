import { input } from '../input/input';
import { settings } from '../game/settings';
import { IN_DOWN, IN_LEFT, IN_LK, IN_LP, IN_RIGHT, IN_RK, IN_RP, IN_SUPER, IN_UP } from '../sim/types';
import { h } from './dom';

/** On-screen stick + 4 buttons for phones/tablets (drives player 1). */
export class TouchControls {
  private pad: HTMLDivElement;
  private knob: HTMLDivElement;
  private btns: HTMLDivElement;
  private dirBits = 0;
  private btnBits = 0;
  private padPointer = -1;
  private gameplay = false;
  onPause: (() => void) | null = null;

  constructor(private root: HTMLElement) {
    this.knob = h('div', { class: 'knob' });
    this.pad = h('div', { class: 'pad' }, this.knob);
    this.btns = h('div', { class: 'btns' });
    const layout: [string, number, number, number][] = [
      ['LP', IN_LP, 8, 28],
      ['RP', IN_RP, 92, 0],
      ['LK', IN_LK, 8, 104],
      ['RK', IN_RK, 92, 76],
      ['BBL', IN_SUPER, -66, 60],
    ];
    for (const [label, bit, left, top] of layout) {
      const b = h('b', { class: label === 'BBL' ? 'super' : '', style: `left:${left}px;top:${top}px` }, label);
      const on = (e: PointerEvent) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.btnBits |= bit;
        b.classList.add('on');
        this.flush();
      };
      const off = () => {
        this.btnBits &= ~bit;
        b.classList.remove('on');
        this.flush();
      };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      this.btns.append(b);
    }
    const pause = h('button', { class: 'pausebtn' }, 'II');
    pause.addEventListener('click', () => this.onPause?.());
    this.pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.padPointer = e.pointerId;
      this.pad.setPointerCapture(e.pointerId);
      this.movePad(e);
    });
    this.pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.padPointer) this.movePad(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.padPointer) return;
      this.padPointer = -1;
      this.dirBits = 0;
      this.knob.style.transform = '';
      this.flush();
    };
    this.pad.addEventListener('pointerup', end);
    this.pad.addEventListener('pointercancel', end);
    root.append(this.pad, this.btns, pause);
    this.refresh();
    window.matchMedia?.('(pointer: coarse)').addEventListener?.('change', () => this.refresh());
  }

  private movePad(e: PointerEvent) {
    const r = this.pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    const max = r.width / 2 - 20;
    const k = len > max ? max / len : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    let bits = 0;
    const dead = 18;
    if (len > dead) {
      const a = Math.atan2(dy, dx);
      const sector = Math.round(a / (Math.PI / 4));
      // 8 directions
      const map: Record<string, number> = {
        '0': IN_RIGHT,
        '1': IN_RIGHT | IN_DOWN,
        '2': IN_DOWN,
        '3': IN_LEFT | IN_DOWN,
        '4': IN_LEFT,
        '-4': IN_LEFT,
        '-3': IN_LEFT | IN_UP,
        '-2': IN_UP,
        '-1': IN_RIGHT | IN_UP,
      };
      bits = map[String(sector)] ?? 0;
    }
    this.dirBits = bits;
    this.flush();
  }

  private flush() {
    input.touchBits = this.dirBits | this.btnBits;
  }

  get enabled() {
    if (settings.touch === 'on') return true;
    if (settings.touch === 'off') return false;
    return !!window.matchMedia?.('(pointer: coarse)').matches;
  }

  /** Light up the BBL button when the local player's gauge is full. */
  setSuperReady(on: boolean) {
    this.root.classList.toggle('full', on);
  }

  setGameplay(on: boolean) {
    this.gameplay = on;
    this.refresh();
  }

  refresh() {
    const show = this.gameplay && this.enabled;
    this.root.classList.toggle('on', show);
    this.root.style.display = show ? '' : 'none';
    if (!show) {
      this.dirBits = 0;
      this.btnBits = 0;
      this.flush();
    }
  }
}
