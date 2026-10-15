import { input } from '../input/input';
import { settings } from '../game/settings';
import { IN_ASSIST, IN_DOWN, IN_GRAB, IN_GUARD, IN_LEFT, IN_LK, IN_LP, IN_RIGHT, IN_RK, IN_RP, IN_SUPER, IN_UP } from '../sim/types';
import { h } from './dom';

/**
 * On-screen stick + buttons for phones/tablets (drives player 1).
 * Layout is pure CSS (src/ui/mobile-game.css): landscape = small translucent controls in the
 * bottom corners over the picture; portrait (#app.split) = a control deck under the game view.
 */
export class TouchControls {
  private pad: HTMLDivElement;
  private knob: HTMLDivElement;
  private btns: HTMLDivElement;
  private dirBits = 0;
  private btnBits = 0;
  private padPointer = -1;
  private gameplay = false;
  private shownState = false;
  /** ASSIST button: the friend's face + a cooldown ring / bar (--cd: 0 = just called, 1 = ready) */
  private assistBtn!: HTMLElement;
  private assistFace!: HTMLDivElement;
  private assistCd = -1;
  private assistMode = '';
  onPause: (() => void) | null = null;
  /** called when the controls appear / disappear (the app re-lays out the screen) */
  onLayout: (() => void) | null = null;

  constructor(private root: HTMLElement) {
    this.knob = h('div', { class: 'knob' });
    this.pad = h('div', { class: 'pad' }, this.knob);
    this.btns = h('div', { class: 'btns' });
    // [class, main label, sub label, input bit]
    const layout: [string, string, string, number][] = [
      ['lp', 'LP', 'POING G', IN_LP],
      ['rp', 'RP', 'POING D', IN_RP],
      ['lk', 'LK', 'PIED G', IN_LK],
      ['rk', 'RK', 'PIED D', IN_RK],
      ['bbl super', 'BBL', 'MAX', IN_SUPER],
      ['guard', 'GARDE', '', IN_GUARD],
      ['grab', 'SAISIE', '', IN_GRAB],
      ['assist', 'ASSIST', '', IN_ASSIST],
    ];
    for (const [cls, label, sub, bit] of layout) {
      const b = h('b', { class: cls }, h('span', null, label), sub ? h('small', null, sub) : null);
      if (bit === IN_ASSIST) {
        // face of the friend, under a cooldown sweep (see .assist in mobile-game.css)
        this.assistFace = h('div', { class: 'aface' });
        b.prepend(this.assistFace);
        this.assistBtn = b;
      }
      const on = (e: PointerEvent) => {
        e.preventDefault();
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          // synthetic pointers (tests) cannot always be captured
        }
        this.btnBits |= bit;
        input.touchLatch |= bit;
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
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      this.btns.append(b);
    }
    const pause = h('button', { class: 'pausebtn', 'aria-label': 'Pause' }, 'II');
    pause.addEventListener('click', () => this.onPause?.());
    this.pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.padPointer = e.pointerId;
      try {
        this.pad.setPointerCapture(e.pointerId);
      } catch {
        // see above
      }
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
      this.pad.classList.remove('on');
      this.flush();
    };
    this.pad.addEventListener('pointerup', end);
    this.pad.addEventListener('pointercancel', end);
    root.append(this.pad, this.btns, pause);
    this.setAssistFace(null);
    this.refresh();
    window.matchMedia?.('(pointer: coarse)').addEventListener?.('change', () => this.refresh());
  }

  private movePad(e: PointerEvent) {
    const r = this.pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    const max = r.width / 2 - r.width * 0.12;
    const k = len > max ? max / len : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    let bits = 0;
    const dead = Math.max(10, r.width * 0.11);
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
    this.pad.classList.toggle('on', bits !== 0);
    this.dirBits = bits;
    this.flush();
  }

  private flush() {
    input.touchBits = this.dirBits | this.btnBits;
  }

  private release() {
    this.dirBits = 0;
    this.btnBits = 0;
    this.padPointer = -1;
    this.knob.style.transform = '';
    this.pad.classList.remove('on');
    for (const b of Array.from(this.btns.children)) b.classList.remove('on');
    this.flush();
  }

  get enabled() {
    if (settings.touch === 'on') return true;
    if (settings.touch === 'off') return false;
    return !!window.matchMedia?.('(pointer: coarse)').matches;
  }

  /** true while the controls are on screen (fight in progress on a touch device) */
  get shown() {
    return this.gameplay && this.enabled;
  }

  /** Light up the BBL button when the local player's gauge is full. */
  setSuperReady(on: boolean) {
    this.root.classList.toggle('full', on);
  }

  /** Face of the friend on the ASSIST button (null = no assist this fight: the button is hidden). */
  setAssistFace(url: string | null) {
    this.root.classList.toggle('noassist', url === null);
    this.assistFace.style.backgroundImage = url ? `url(${url})` : '';
  }

  /**
   * ASSIST button state: 'ready' (lit), 'busy' (the friend is on screen) or 'cool' with
   * `frac` = recharge progress 0..1.
   */
  setAssistState(mode: 'ready' | 'busy' | 'cool', frac = 1) {
    if (mode !== this.assistMode) {
      this.assistMode = mode;
      this.assistBtn.classList.toggle('ready', mode === 'ready');
      this.assistBtn.classList.toggle('busy', mode === 'busy');
      this.assistBtn.classList.toggle('cool', mode === 'cool');
    }
    const cd = mode === 'cool' ? Math.round(Math.max(0, Math.min(1, frac)) * 100) / 100 : mode === 'ready' ? 1 : 0;
    if (cd !== this.assistCd) {
      this.assistCd = cd;
      this.assistBtn.style.setProperty('--cd', String(cd));
    }
  }

  /** Fade the controls while they do nothing (intros, BBL MAX cinematics, K.O.). */
  setIdle(on: boolean) {
    this.root.classList.toggle('idle', on);
  }

  /** Hide the controls under a menu (pause, results); the deck stays in place. */
  setCovered(on: boolean) {
    if (on && !this.root.classList.contains('covered')) this.release();
    this.root.classList.toggle('covered', on);
  }

  setGameplay(on: boolean) {
    this.gameplay = on;
    if (!on) {
      this.root.classList.remove('idle', 'covered', 'full');
      this.setAssistFace(null);
      this.setAssistState('ready');
    }
    this.refresh();
  }

  refresh() {
    const show = this.shown;
    this.root.classList.toggle('on', show);
    this.root.style.display = show ? '' : 'none';
    if (!show) this.release();
    if (show !== this.shownState) {
      this.shownState = show;
      this.onLayout?.();
    }
  }
}
