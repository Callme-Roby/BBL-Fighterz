import { audio } from './audio/audio';
import { input } from './input/input';
import { RetroPipeline } from './render/pipeline';
import { settings } from './game/settings';
import { clearUi } from './ui/dom';
import { TouchControls } from './ui/touch';

export interface Screen {
  /** called once when the screen becomes active */
  enter?(): void;
  /** called every animation frame */
  frame(dt: number): void;
  exit?(): void;
}

/** Height (CSS px) of the touch deck reference design, see mobile-game.css */
const DECK_REF_H = 330;

/** Owns the renderer, the active screen and the main loop. */
export class App {
  readonly pipeline: RetroPipeline;
  readonly canvas: HTMLCanvasElement;
  readonly touch: TouchControls;
  private screen: Screen | null = null;
  private last = performance.now();
  private root: HTMLElement;
  private safeProbe: HTMLDivElement;
  /** while a screen change is in progress the layout is computed once at the end */
  private holdLayout = false;
  private pixelW = 0;
  /** automatic quality: highest resolution allowed on this device (lowered when it struggles) */
  private autoCap = 9999;
  private perfFrames: number[] = [];
  private perfLast = 0;
  private fpsEl: HTMLElement | null = null;
  private pixelH = 0;
  /** size of the 3D view (CSS px): the whole window, or the top of it in a portrait fight */
  width = 1;
  height = 1;
  /** portrait fight on a touch device: game view on top, control deck below */
  split = false;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.root = document.getElementById('app') ?? document.body;
    this.pipeline = new RetroPipeline(this.canvas);
    this.safeProbe = document.createElement('div');
    this.safeProbe.style.cssText =
      'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
    document.body.append(this.safeProbe);
    this.touch = new TouchControls(document.getElementById('touch')!);
    this.touch.onLayout = () => {
      if (!this.holdLayout) this.resize();
    };
    this.applySettings();
    const relayout = () => this.resize();
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', () => {
      relayout();
      // some browsers report the new size a little after the event
      setTimeout(relayout, 250);
    });
    window.visualViewport?.addEventListener('resize', relayout);
    this.resize();
    // audio needs a user gesture
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    requestAnimationFrame((t) => this.loop(t));
  }

  /** aspect ratio of the 3D view */
  get aspect() {
    return this.width / Math.max(1, this.height);
  }

  applySettings() {
    this.pipeline.lines = settings.autoQuality === false ? settings.lines : Math.min(settings.lines, this.autoCap);
    this.updateFpsCounter();
    this.pipeline.dither = settings.dither;
    this.resize(true);
  }

  resize(force = false) {
    // the #app box (fixed, inset 0) is what the CSS lays out: measure it rather than the window
    const W = Math.max(1, this.root.clientWidth || window.innerWidth);
    const H = Math.max(1, this.root.clientHeight || window.innerHeight);
    const touchUi = this.touch.shown;
    // phone held upright: don't cover the fight with the controls, split the screen
    const split = touchUi && H > W;
    // about square (both fighters fit side by side), leaving at least ~290px (more on tablets) to the deck
    const deckMin = Math.max(290, Math.min(360, H * 0.32));
    const gameH = split ? Math.round(Math.max(H * 0.45, Math.min(W * 1.05, H - deckMin))) : H;
    this.split = split;
    this.width = W;
    this.height = gameH;
    const safeB = this.safeProbe.offsetHeight || 0;
    // size unit of the touch controls (1 = reference design: 390x330 deck / 844x390 landscape)
    const u = split ? Math.min(W / 390, (H - gameH - safeB) / DECK_REF_H) : Math.min(W / 844, H / 390);
    const st = this.root.style;
    st.setProperty('--game-h', gameH + 'px');
    st.setProperty('--tu', Math.max(0.7, Math.min(1.3, u)).toFixed(3) + 'px');
    this.root.classList.toggle('touchui', touchUi);
    this.root.classList.toggle('split', split);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(W * dpr);
    const ph = Math.round(gameH * dpr);
    // resizing the canvas clears it: only when something changed
    if (!force && pw === this.pixelW && ph === this.pixelH) return;
    this.pixelW = pw;
    this.pixelH = ph;
    this.pipeline.setSize(pw, ph);
  }

  go(screen: Screen) {
    this.screen?.exit?.();
    clearUi();
    input.clearMenu();
    this.holdLayout = true;
    try {
      this.touch.setGameplay(false);
      this.screen = screen;
      screen.enter?.();
    } finally {
      this.holdLayout = false;
      this.resize();
    }
  }

  private updateFpsCounter() {
    if (settings.showFps && !this.fpsEl) {
      this.fpsEl = document.createElement('div');
      this.fpsEl.style.cssText =
        'position:fixed;top:max(4px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:50;pointer-events:none;' +
        'font:10px "Press Start 2P",monospace;color:#7ef0a0;background:rgba(0,0,0,.55);padding:3px 6px;border-radius:3px';
      document.body.append(this.fpsEl);
    } else if (!settings.showFps && this.fpsEl) {
      this.fpsEl.remove();
      this.fpsEl = null;
    }
  }

  /**
   * Frame-rate watch: shows the counter and, if the device stays well under 60 images / s
   * for a few seconds, lowers the internal resolution one step (480 → 360 → 270; this
   * session only, the saved setting is kept).
   */
  private watchPerf(t: number, rawDt: number) {
    // tab switches, loading screens: not a measure of the device
    if (rawDt > 250 || document.visibilityState !== 'visible') {
      this.perfFrames.length = 0;
      return;
    }
    this.perfFrames.push(rawDt);
    if (t - this.perfLast < 3000) return;
    this.perfLast = t;
    const n = this.perfFrames.length;
    const fps = n ? (1000 * n) / this.perfFrames.reduce((a, b) => a + b, 0) : 60;
    this.perfFrames.length = 0;
    const lines = this.pipeline.lines;
    if (settings.autoQuality !== false && n > 30 && fps < 45 && lines > 270) {
      this.autoCap = lines > 360 ? 360 : 270;
      console.info(`[qualité auto] ${fps.toFixed(0)} images/s : résolution ${this.autoCap}p`);
      this.applySettings();
    }
    if (this.fpsEl) this.fpsEl.textContent = `${fps.toFixed(0)} IPS · ${this.pipeline.lines}p`;
  }

  private loop(t: number) {
    const rawDt = t - this.last;
    const dt = Math.min(0.1, rawDt / 1000);
    this.last = t;
    this.watchPerf(t, rawDt);
    input.poll();
    try {
      this.screen?.frame(dt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }
}
