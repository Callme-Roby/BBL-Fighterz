import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import type { FighterDef } from '../data/roster';
import { fullRoster } from '../game/settings';
import { FightWorld } from '../game/world';
import { input } from '../input/input';
import { STAGES } from '../render/stages';
import { CpuBrain } from '../sim/ai';
import { createGame, step } from '../sim/sim';
import type { GameState } from '../sim/types';
import { h, Menu, uiRoot } from '../ui/dom';
import { goLab, goOnline, goOptions, goSelect, goTournament } from './flow';

/** CPU vs CPU match playing behind the title menu. */
class Attract {
  world: FightWorld | null = null;
  state: GameState;
  private brains = [new CpuBrain('hard'), new CpuBrain('normal')];
  private acc = 0;
  private loading = false;
  private disposed = false;

  constructor() {
    this.state = createGame({ skipIntro: true, roundsToWin: 1 });
    this.load();
  }

  private load() {
    if (this.loading) return;
    this.loading = true;
    const roster = fullRoster();
    const pick = (): FighterDef => roster[Math.floor(Math.random() * roster.length)];
    const a = pick();
    let b = pick();
    if (roster.length > 1) while (b.id === a.id) b = pick();
    const stage = STAGES[Math.floor(Math.random() * STAGES.length)].id;
    FightWorld.create(a, b, stage).then((w) => {
      this.loading = false;
      if (this.disposed) {
        w.dispose();
        return;
      }
      this.world?.dispose();
      w.sound = false;
      w.attract = true;
      this.world = w;
      this.state = createGame({ skipIntro: true, roundsToWin: 1 });
    });
  }

  frame(app: App, dt: number) {
    if (!this.world) return;
    this.acc += dt;
    let n = 0;
    while (this.acc >= 1 / 60 && n++ < 4) {
      this.acc -= 1 / 60;
      const s = this.state;
      step(s, [this.brains[0].think(s, 0), this.brains[1].think(s, 1)]);
      this.world.handleEvents(
        s.events.map((ev) => ({ frame: s.frame, ev })),
        s,
      );
    }
    if (this.state.phase === 'matchOver' && this.state.phaseFrame > 240) this.load();
    this.world.render(app.pipeline, this.state, dt, app.aspect);
  }

  dispose() {
    this.disposed = true;
    this.world?.dispose();
  }
}

export class TitleScreen implements Screen {
  private attract = new Attract();
  private menu: Menu | null = null;
  private pressEl: HTMLElement | null = null;
  private root!: HTMLElement;

  constructor(
    private app: App,
    private skipPress: boolean,
  ) {}

  enter() {
    audio.playMusic('title');
    this.root = h('div', { class: 'screen' });
    uiRoot().append(this.root);
    const logo = h('div', { class: 'logo' }, 'BBL', h('br'), 'FIGHTERZ', h('small', null, 'TOURNOI DES POTES'));
    this.root.append(logo);
    if (this.skipPress) this.showMenu();
    else {
      const touch = window.matchMedia?.('(pointer: coarse)').matches;
      this.pressEl = h('div', { class: 'title-hint blink', style: 'font-size:14px;margin-top:20px' }, touch ? "TOUCHE L'ÉCRAN" : 'APPUIE SUR ENTRÉE');
      this.root.append(this.pressEl);
      this.root.addEventListener('click', () => this.press(), { once: true });
    }
    this.root.append(h('div', { class: 'footer-hint' }, '© BBL CREW · jeu de combat fait maison · photos des potes non contractuelles'));
  }

  exit() {
    this.attract.dispose();
  }

  private press() {
    if (this.menu) return;
    audio.unlock();
    audio.sfx('confirm');
    void audio.announcer('gameTitle');
    this.pressEl?.remove();
    this.showMenu();
  }

  private showMenu() {
    this.menu = new Menu(
      [
        { label: 'ARCADE', sub: "Contre l'ordinateur", action: () => goSelect('cpu') },
        { label: 'VERSUS', sub: '2 joueurs sur le même écran', action: () => goSelect('versus') },
        { label: 'TOURNOI', sub: "Jusqu'à 16 potes, élimination directe", action: () => goTournament() },
        { label: 'EN LIGNE', sub: 'Envoie un lien à un pote', action: () => goOnline() },
        { label: 'LABO', sub: 'Crée ton perso avec ta photo', action: () => goLab() },
        { label: 'OPTIONS', sub: 'Son, difficulté, graphismes, commandes', action: () => goOptions() },
      ],
      () => audio.sfx('cursor'),
    );
    this.root.append(this.menu.el);
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (!this.menu) {
        if (e.action === 'confirm' || e.action === 'start') this.press();
        continue;
      }
      if (e.action === 'up') this.menu.move(-1);
      else if (e.action === 'down') this.menu.move(1);
      else if (e.action === 'confirm' || e.action === 'start') {
        audio.sfx('confirm');
        this.menu.activate();
        return;
      }
    }
    this.attract.frame(this.app, dt);
  }
}
