import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import type { FighterDef } from '../data/roster';
import { settings } from '../game/settings';
import { input } from '../input/input';
import type { NetLink } from '../net/peer';
import type { RetroPipeline } from '../render/pipeline';
import { PS1Globals } from '../render/ps1Material';
import { STAGES } from '../render/stages';
import { backButton, h, uiRoot } from '../ui/dom';
import type { FightMode } from './fight';
import { goMenu, goSelect, startFight } from './flow';

const thumbs = new Map<string, string>();

/** Renders a low-res thumbnail of every stage once (cached for the session). */
export function stageThumb(pipeline: RetroPipeline, id: string): string {
  const cached = thumbs.get(id);
  if (cached) return cached;
  const def = STAGES.find((s) => s.id === id) ?? STAGES[0];
  const env = def.build();
  const scene = new THREE.Scene();
  scene.add(env.group);
  env.update(1, 0.016);
  PS1Globals.uLightDir.value.copy(env.lightDir).normalize();
  PS1Globals.uLightColor.value.copy(env.lightColor);
  PS1Globals.uAmbient.value.copy(env.ambient);
  PS1Globals.uFogColor.value.copy(env.fogColor);
  PS1Globals.uFogNear.value = env.fogNear;
  PS1Globals.uFogFar.value = env.fogFar;
  const cam = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 420);
  cam.position.set(0, 2.2, 7.5);
  cam.lookAt(0, 1.4, 0);
  const url = pipeline.snapshot(scene, cam, env.clearColor, 320, 180);
  env.dispose();
  thumbs.set(id, url);
  return url;
}

export class StageSelectScreen implements Screen {
  private index = 0;
  private cards: HTMLDivElement[] = [];
  private done = false;

  constructor(
    private app: App,
    private mode: FightMode,
    private p1: FighterDef,
    private p2: FighterDef,
    private link?: NetLink,
  ) {}

  enter() {
    const list = h('div', { class: 'stages' });
    const entries = [...STAGES.map((s) => ({ id: s.id, name: s.name, sub: s.subtitle })), { id: 'random', name: 'ALÉATOIRE', sub: 'Surprise !' }];
    entries.forEach((s, i) => {
      let pic: HTMLElement;
      if (s.id !== 'random') pic = h('img', { alt: s.name, src: stageThumb(this.app.pipeline, s.id) });
      else pic = h('div', { class: 'cell special', style: 'width:100%;height:auto;aspect-ratio:16/9;font-size:64px;border:0' }, '?');
      const card = h('div', { class: 'stage-card' }, pic, h('div', { class: 'lbl' }, s.name, h('small', null, s.sub)));
      card.addEventListener('click', () => {
        if (this.index === i) this.confirm();
        else this.select(i);
      });
      list.append(card);
      this.cards.push(card);
    });
    // touch: tap a card, then C'EST PARTI ! (or tap the card again)
    const go = h('button', { class: 'btn primary stage-go touch-only' }, "C'EST PARTI !");
    go.addEventListener('click', () => this.confirm());
    uiRoot().append(
      h(
        'div',
        { class: 'screen dim stage-screen' },
        h('div', { class: 'h1' }, "CHOISIS L'ARÈNE"),
        h('div', { class: 'title-hint' }, `${this.p1.name}  VS  ${this.p2.name}`),
        list,
        go,
        h('div', { class: 'footer-hint kbd-only' }, '← → pour choisir · Entrée pour valider · Échap pour revenir'),
      ),
      backButton(() => this.back()),
    );
    this.select(0, false);
    if (this.link) this.link.onClose(() => goMenu());
  }

  private select(i: number, sound = true) {
    const n = this.cards.length;
    this.index = ((i % n) + n) % n;
    this.cards.forEach((c, k) => c.classList.toggle('sel', k === this.index));
    if (sound) audio.sfx('cursor');
  }

  private confirm() {
    if (this.done) return;
    this.done = true;
    audio.sfx('confirm');
    let stageId = this.index < STAGES.length ? STAGES[this.index].id : STAGES[Math.floor(Math.random() * STAGES.length)].id;
    if (!STAGES.find((s) => s.id === stageId)) stageId = STAGES[0].id;
    const seed = (Math.random() * 1e9) >>> 0;
    if (this.mode === 'online' && this.link) {
      this.link.send({ t: 'start', stage: stageId, p1: this.p1, p2: this.p2, seed, rounds: settings.rounds });
    }
    startFight({
      mode: this.mode,
      p1: this.p1,
      p2: this.p2,
      stageId,
      rounds: settings.rounds,
      difficulty: settings.difficulty,
      seed,
      link: this.link,
      localPlayer: 0,
    });
  }

  private back() {
    if (this.done) return;
    audio.sfx('cancel');
    if (this.mode === 'online' && this.link) {
      this.link.send({ t: 'toSelect' });
      goSelect('online', this.link);
    } else goSelect(this.mode);
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (e.action === 'left' || e.action === 'up') this.select(this.index - 1);
      else if (e.action === 'right' || e.action === 'down') this.select(this.index + 1);
      else if (e.action === 'confirm') this.confirm();
      else if (e.action === 'back') {
        this.back();
        return;
      }
    }
    void dt;
  }
}
