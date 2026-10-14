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

/** Owns the renderer, the active screen and the main loop. */
export class App {
  readonly pipeline: RetroPipeline;
  readonly canvas: HTMLCanvasElement;
  readonly touch: TouchControls;
  private screen: Screen | null = null;
  private last = performance.now();
  width = 1;
  height = 1;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.pipeline = new RetroPipeline(this.canvas);
    this.touch = new TouchControls(document.getElementById('touch')!);
    this.applySettings();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    // audio needs a user gesture
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    requestAnimationFrame((t) => this.loop(t));
  }

  get aspect() {
    return this.width / Math.max(1, this.height);
  }

  applySettings() {
    this.pipeline.lines = settings.lines;
    this.pipeline.dither = settings.dither;
    this.resize();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.pipeline.setSize(Math.round(this.width * dpr), Math.round(this.height * dpr));
  }

  go(screen: Screen) {
    this.screen?.exit?.();
    clearUi();
    input.clearMenu();
    this.touch.setGameplay(false);
    this.screen = screen;
    screen.enter?.();
  }

  private loop(t: number) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    input.poll();
    try {
      this.screen?.frame(dt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }
}
