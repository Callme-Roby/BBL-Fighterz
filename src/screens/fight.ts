import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import type { FighterDef } from '../data/roster';
import { FightWorld } from '../game/world';
import { input } from '../input/input';
import type { NetLink, NetMsg } from '../net/peer';
import { RollbackSession, type TimedEvent } from '../net/rollback';
import { getStage } from '../render/stages';
import { CpuBrain, type Difficulty } from '../sim/ai';
import { createGame, step } from '../sim/sim';
import { INTRO_SPLIT, type GameState, type SimEvent } from '../sim/types';
import { h, Menu, uiRoot } from '../ui/dom';
import { Hud } from '../ui/hud';
import { controlsHelp } from './help';
import { goMenu, goSelect, startFight } from './flow';

export type FightMode = 'cpu' | 'versus' | 'online';

export interface FightSetup {
  mode: FightMode;
  p1: FighterDef;
  p2: FighterDef;
  stageId: string;
  rounds: number;
  difficulty: Difficulty;
  seed: number;
  link?: NetLink;
  localPlayer?: 0 | 1;
  skipIntro?: boolean;
  /** player names shown instead of the fighter names (tournament participants) */
  names?: [string, string];
  /** local modes: which sides are played by the CPU (overrides the mode default) */
  cpuSides?: [boolean, boolean];
  /** set when the match is part of a tournament */
  tournament?: TournamentHooks;
}

export interface TournamentHooks {
  /** short label shown on the VS screen / HUD, e.g. "DEMI-FINALE" */
  title: string;
  /** called when the match is over and the players continue (2 = draw) */
  onResult(winner: 0 | 1 | 2): void;
  /** called when the players leave the match without a result (pause menu) */
  onAbort(): void;
}

const STEP = 1 / 60;

export class FightScreen implements Screen {
  private state: GameState;
  private session: RollbackSession | null = null;
  private world: FightWorld | null = null;
  private hud: Hud;
  private cpu: [CpuBrain | null, CpuBrain | null] = [null, null];
  private acc = 0;
  private paused = false;
  private overlay: HTMLElement | null = null;
  private menu: Menu | null = null;
  private remoteReady = false;
  private introShown = [false, false];
  private resultsShown = false;
  private winLineSaid = false;
  private rematchMine = false;
  private rematchTheirs = false;
  private unsubs: (() => void)[] = [];
  private loadingEl: HTMLElement | null = null;
  private vsEl: HTMLElement | null = null;
  private vsUntil = 0;
  private readySent = false;
  private disposed = false;

  constructor(
    private app: App,
    private setup: FightSetup,
  ) {
    this.state = createGame({ roundsToWin: setup.rounds, skipIntro: setup.skipIntro });
    // deterministic variant choices for intro animations (same on both peers)
    this.state.fighters[0].variant = setup.seed % 2;
    this.state.fighters[1].variant = (setup.seed >> 1) % 2;
    if (setup.mode !== 'online') {
      const cpuSides = setup.cpuSides ?? (setup.mode === 'cpu' ? [false, true] : [false, false]);
      for (const i of [0, 1] as const) if (cpuSides[i]) this.cpu[i] = new CpuBrain(setup.difficulty);
    }
    if (setup.mode === 'online' && setup.link) {
      // created right away so no early input packet is lost
      this.session = new RollbackSession(this.state, setup.localPlayer ?? 0, setup.link);
      this.unsubs.push(setup.link.on((m) => this.onNet(m)));
      this.unsubs.push(setup.link.onClose((reason) => this.disconnected(reason)));
    }
    this.hud = new Hud(this.labels(), this.superKeys());
    // console access for testing: open the game with ?debug
    if (location.search.includes('debug')) (window as unknown as { bblFight: unknown }).bblFight = this;
    FightWorld.create(setup.p1, setup.p2, setup.stageId).then((w) => {
      if (this.disposed) {
        w.dispose();
        return;
      }
      this.world = w;
    });
  }

  enter() {
    uiRoot().append(this.hud.el);
    this.hud.setVisible(false);
    if (!this.setup.skipIntro) this.showVs();
    this.loadingEl = h('div', { class: 'screen passthrough' }, h('div', { class: 'title-hint blink' }, 'CHARGEMENT…'));
    uiRoot().append(this.loadingEl);
    audio.playMusic(getStage(this.setup.stageId).music, { fade: 1 });
    this.app.touch.setGameplay(true);
    this.app.touch.onPause = () => this.togglePause();
  }

  exit() {
    this.disposed = true;
    for (const u of this.unsubs) u();
    this.session?.dispose();
    this.world?.dispose();
    this.app.touch.onPause = null;
    audio.duck(false);
  }

  /** "P1 VS P2" splash shown while the match loads. */
  private showVs() {
    const names = this.setup.names;
    const side = (def: FighterDef, cls: string) => {
      const who = names ? names[cls === 'l' ? 0 : 1] : null;
      const ph = h('div', { class: 'portrait' });
      import('../render/faceTexture').then(({ loadFace }) => loadFace(def).then((f) => (ph.style.backgroundImage = `url(${f.portraitUrl})`)));
      const sub = who && who.toUpperCase() !== def.name.toUpperCase() ? `avec ${def.name} — ${def.title}` : def.title;
      return h('div', { class: 'side ' + cls }, ph, h('div', { class: 'pname ' + (cls === 'l' ? 'p1' : 'p2') }, who ? who.toUpperCase() : def.name, h('span', { class: 'ttl' }, sub)));
    };
    const mid = h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:10px' });
    if (this.setup.tournament) mid.append(h('div', { class: 'title-hint', style: 'color:#fff;font-size:12px' }, this.setup.tournament.title));
    mid.append(h('div', { class: 'vsword' }, 'VS'));
    this.vsEl = h('div', { class: 'vs' }, side(this.setup.p1, 'l'), mid, side(this.setup.p2, 'r'));
    uiRoot().append(this.vsEl);
    this.vsUntil = performance.now() + 2600;
    audio.sfx('super');
  }

  private onNet(m: NetMsg) {
    if (m.t === 'ready') this.remoteReady = true;
    if (m.t === 'rematch') {
      this.rematchTheirs = true;
      this.checkRematch();
      if (this.overlay && !this.rematchMine) this.showResults();
    }
    if (m.t === 'start' && this.setup.link && !this.setup.link.isHost) {
      startFight({ ...this.setup, stageId: m.stage, seed: m.seed, skipIntro: true });
    }
    if (m.t === 'toSelect') goSelect('online', this.setup.link);
    if (m.t === 'leave') this.disconnected("L'adversaire a quitté la partie.");
  }

  private disconnected(reason: string) {
    if (this.disposed) return;
    this.paused = true;
    this.closeOverlay();
    this.menu = new Menu([{ label: 'RETOUR AU MENU', action: () => this.quitToMenu() }], () => audio.sfx('cursor'));
    this.overlay = h('div', { class: 'overlay' }, h('div', { class: 'h1' }, 'DÉCONNEXION'), h('div', { class: 'status err' }, reason), this.menu.el);
    uiRoot().append(this.overlay);
  }

  private quitToMenu() {
    this.setup.link?.close();
    goMenu();
  }

  /** HUD / result labels: participant names when given, otherwise fighter names */
  private labels(): [string, string] {
    const [n1, n2] = this.setup.names ?? [this.setup.p1.name, this.setup.p2.name];
    const tag = (n: string, def: FighterDef) => (n.toUpperCase() === def.name.toUpperCase() ? def.name : `${n.toUpperCase()} (${def.name})`);
    return [tag(n1, this.setup.p1), tag(n2, this.setup.p2)];
  }

  // ---------------------------------------------------------------- input
  private get humans(): number {
    return (this.cpu[0] ? 0 : 1) + (this.cpu[1] ? 0 : 1);
  }

  private localBits(player: 0 | 1): number {
    // two humans share the keyboard; a single human gets every key
    if (this.setup.mode !== 'online' && this.humans >= 2) return input.bits(player, 'versus');
    return input.bits(0, 'solo');
  }

  /** key shown in the HUD next to "BBL MAX !" for each side */
  private superKeys(): [string, string] {
    if (this.setup.mode === 'online') return this.setup.localPlayer === 1 ? ['', 'E'] : ['E', ''];
    if (this.humans >= 2) return ['E', 'P'];
    return [this.cpu[0] ? '' : 'E', this.cpu[1] ? '' : 'E'];
  }

  /** side played by the human using the touch controls / solo keys (-1 = none) */
  private get localSide(): number {
    if (this.setup.mode === 'online') return this.setup.localPlayer ?? 0;
    if (!this.cpu[0]) return 0;
    if (!this.cpu[1]) return 1;
    return -1;
  }

  private handleMenuInput() {
    for (const e of input.menuEvents()) {
      if (this.menu) {
        if (e.action === 'up') this.menu.move(-1);
        else if (e.action === 'down') this.menu.move(1);
        else if (e.action === 'confirm') {
          audio.sfx('confirm');
          this.menu.activate();
        } else if ((e.action === 'back' || e.action === 'start') && this.paused && !this.resultsShown) this.togglePause();
        continue;
      }
      if ((e.action === 'start' || (e.action === 'back' && e.player === -1)) && !this.resultsShown) this.togglePause();
    }
  }

  private togglePause() {
    if (this.resultsShown) return;
    if (this.setup.mode === 'online') {
      if (this.overlay) this.closeOverlay();
      else {
        this.menu = new Menu(
          [
            { label: 'CONTINUER', action: () => this.closeOverlay() },
            { label: 'QUITTER LE MATCH', action: () => this.quitToMenu() },
          ],
          () => audio.sfx('cursor'),
        );
        this.overlay = h('div', { class: 'overlay' }, h('div', { class: 'h1' }, 'EN LIGNE'), h('div', { class: 'status' }, 'Le match continue pendant ce menu !'), this.menu.el);
        uiRoot().append(this.overlay);
      }
      return;
    }
    this.paused = !this.paused;
    if (!this.paused) {
      this.closeOverlay();
      audio.duck(false);
      return;
    }
    audio.duck(true);
    const t = this.setup.tournament;
    this.menu = new Menu(
      t
        ? [
            { label: 'REPRENDRE', action: () => this.togglePause() },
            { label: 'RECOMMENCER LE MATCH', action: () => this.restart(false) },
            { label: 'COMMANDES', action: () => this.showHelp() },
            { label: 'RETOUR AU TABLEAU', sub: 'Le match ne compte pas', action: () => t.onAbort() },
          ]
        : [
            { label: 'REPRENDRE', action: () => this.togglePause() },
            { label: 'RECOMMENCER', action: () => this.restart(false) },
            { label: 'CHANGER DE PERSO', action: () => goSelect(this.setup.mode) },
            { label: 'COMMANDES', action: () => this.showHelp() },
            { label: 'MENU PRINCIPAL', action: () => goMenu() },
          ],
      () => audio.sfx('cursor'),
    );
    this.overlay = h('div', { class: 'overlay' }, h('div', { class: 'h1' }, 'PAUSE'), this.menu.el);
    uiRoot().append(this.overlay);
  }

  private showHelp() {
    this.closeOverlay();
    this.menu = new Menu([{ label: 'RETOUR', action: () => (this.togglePause(), this.togglePause()) }], () => audio.sfx('cursor'));
    this.overlay = h('div', { class: 'overlay' }, h('div', { class: 'panel options' }, controlsHelp(this.humans >= 2 && this.setup.mode !== 'online')), this.menu.el);
    uiRoot().append(this.overlay);
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
    this.menu = null;
  }

  private restart(skipIntro: boolean) {
    startFight({ ...this.setup, seed: (this.setup.seed * 1103515245 + 12345) >>> 0, skipIntro });
  }

  private checkRematch() {
    if (this.rematchMine && this.rematchTheirs && this.setup.link?.isHost) {
      const seed = (Math.random() * 1e9) >>> 0;
      this.setup.link.send({ t: 'start', stage: this.setup.stageId, p1: this.setup.p1, p2: this.setup.p2, seed, rounds: this.setup.rounds });
      startFight({ ...this.setup, seed, skipIntro: true });
    }
  }

  private showResults() {
    this.resultsShown = true;
    this.closeOverlay();
    const online = this.setup.mode === 'online';
    const items = online
      ? [
          {
            label: this.rematchMine ? 'EN ATTENTE…' : this.rematchTheirs ? 'REVANCHE ! (ACCEPTER)' : 'REVANCHE',
            disabled: this.rematchMine,
            action: () => {
              this.rematchMine = true;
              this.setup.link?.send({ t: 'rematch' });
              this.checkRematch();
              this.showResults();
            },
          },
          {
            label: 'CHANGER DE PERSO',
            action: () => {
              this.setup.link?.send({ t: 'toSelect' });
              goSelect('online', this.setup.link);
            },
          },
          { label: 'QUITTER', action: () => this.quitToMenu() },
        ]
      : this.setup.tournament
        ? [
            {
              label: this.state.matchWinner === 2 ? 'REJOUER (MATCH NUL)' : 'CONTINUER LE TOURNOI',
              action: () => this.setup.tournament!.onResult(this.state.matchWinner as 0 | 1 | 2),
            },
            { label: 'REJOUER LE MATCH', sub: 'Ce résultat ne compte pas', action: () => this.restart(true) },
          ]
        : [
            { label: 'REVANCHE', action: () => this.restart(true) },
            { label: 'CHANGER DE PERSO', action: () => goSelect(this.setup.mode) },
            { label: 'MENU PRINCIPAL', action: () => goMenu() },
          ];
    this.menu = new Menu(items, () => audio.sfx('cursor'));
    const w = this.state.matchWinner;
    const title = w === 2 ? 'MATCH NUL' : this.winnerName(w) + ' GAGNE';
    this.overlay = h('div', { class: 'overlay', style: 'background:rgba(4,4,12,0.35);justify-content:flex-end;padding-bottom:12vh' }, h('div', { class: 'h1' }, title), this.menu.el);
    uiRoot().append(this.overlay);
  }

  // ---------------------------------------------------------------- loop
  frame(dt: number) {
    this.handleMenuInput();
    if (!this.world || performance.now() < this.vsUntil) return;
    if (this.vsEl) {
      this.vsEl.remove();
      this.vsEl = null;
    }
    if (this.loadingEl) {
      this.loadingEl.remove();
      this.loadingEl = null;
    }
    if (!this.readySent) {
      this.readySent = true;
      this.setup.link?.send({ t: 'ready' });
    }
    const online = this.setup.mode === 'online';
    if (online && !this.remoteReady) {
      this.hud.setNetInfo("En attente de l'adversaire…");
      this.world.render(this.app.pipeline, this.state, dt, this.app.aspect);
      return;
    }

    if (!this.paused || online) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.acc -= STEP;
        steps++;
        this.tick();
      }
      if (steps >= 5) this.acc = 0;
    }

    this.world.render(this.app.pipeline, this.state, dt, this.app.aspect);
    this.hud.update(this.state, dt * 60);
    const side = this.localSide;
    this.app.touch.setSuperReady(side >= 0 && this.state.fighters[side].meter >= 100);
    if (online && this.session) {
      this.hud.setNetInfo(`${this.session.pingMs} ms${this.session.desynced ? ' · DESYNC!' : ''}`);
    }
    this.presentation();
  }

  private tick() {
    this.tickInner();
    input.endTick();
  }

  private tickInner() {
    if (this.session) {
      const evs = this.session.tick(this.localBits(0));
      this.state = this.session.state;
      this.world!.handleEvents(evs, this.state, { onEvent: (e) => this.onEvent(e) });
      return;
    }
    const s = this.state;
    const i0 = this.cpu[0] ? this.cpu[0].think(s, 0) : this.localBits(0);
    const i1 = this.cpu[1] ? this.cpu[1].think(s, 1) : this.localBits(1);
    step(s, [i0, i1]);
    const evs: TimedEvent[] = s.events.map((ev) => ({ frame: s.frame, ev }));
    this.world!.handleEvents(evs, s, { onEvent: (e) => this.onEvent(e) });
  }

  private nameOf(i: number) {
    return this.winnerName(i);
  }

  private winnerName(i: number) {
    const n = this.setup.names?.[i];
    if (n) return n.toUpperCase();
    return i === 0 ? this.setup.p1.name : this.setup.p2.name;
  }

  private onEvent(ev: SimEvent) {
    const s = this.state;
    switch (ev.t) {
      case 'phase':
        if (ev.phase === 'roundIntro') {
          this.hud.clearSubtitle();
          this.hud.setVisible(true);
          audio.duck(false);
          const last = s.fighters[0].wins === s.roundsToWin - 1 && s.fighters[1].wins === s.roundsToWin - 1;
          const label = last && s.round > 1 ? 'FINAL ROUND' : `ROUND ${s.round}`;
          this.hud.announce(label, 'small', 60);
          void audio.announcer(last && s.round > 1 ? 'finalRound' : s.round === 1 ? 'round1' : s.round === 2 ? 'round2' : 'round3');
        }
        if (ev.phase === 'roundOver') {
          if (s.roundWinner === 2) this.hud.announce('DRAW', 'small', 90);
        }
        if (ev.phase === 'matchOver') {
          audio.playMusic('victory', { loop: false, fade: 0.3 });
        }
        break;
      case 'fight':
        this.hud.announce('FIGHT !', '', 50);
        audio.sfx('roundBell');
        void audio.announcer('fight');
        break;
      case 'ko': {
        const both = s.fighters[0].hp <= 0 && s.fighters[1].hp <= 0;
        this.hud.announce(both ? 'DOUBLE K.O.' : 'K.O.', 'ko', 110);
        void audio.announcer(both ? 'doubleKo' : 'ko');
        this.app.pipeline.post.uFlash.value = 0.9;
        break;
      }
      case 'timeUp':
        this.hud.announce('TIME UP', 'small', 100);
        void audio.announcer('timeUp');
        break;
      case 'perfect':
        setTimeout(() => {
          if (this.disposed) return;
          this.hud.announce('PERFECT', '', 90);
          void audio.announcer('perfect');
        }, 1200);
        break;
      case 'super': {
        this.app.pipeline.post.uFlash.value = 0.6;
        this.app.pipeline.post.uFlashColor.value.setRGB(1, 0.6, 0.2);
        setTimeout(() => this.app.pipeline.post.uFlashColor.value.setRGB(1, 1, 1), 300);
        // the fighter shouts their BBL MAX line during the close-up
        const def = ev.p === 0 ? this.setup.p1 : this.setup.p2;
        const lines = def.superLines?.length ? def.superLines : ['Prends ça… BBL MAX !'];
        const line = lines[(this.setup.seed + this.state.frame) % lines.length];
        this.hud.announce('BBL MAX', 'small super', 70);
        this.hud.subtitle(def.name, this.world!.faces[ev.p].portraitUrl, line);
        audio.duck(true);
        void audio.say(line, { lang: def.voice?.lang, pitch: def.voice?.pitch, rate: (def.voice?.rate ?? 1) * 1.05 });
        const myFrame = this.state.frame;
        setTimeout(() => {
          if (this.disposed) return;
          this.hud.clearSubtitle();
          audio.duck(false);
          void myFrame;
        }, 2600);
        break;
      }
      case 'superCombo':
        this.app.pipeline.post.uFlash.value = 0.55;
        break;
      case 'throwBreak':
        this.hud.announce('ÉCHAPPÉ !', 'small', 40);
        break;
      default:
        break;
    }
  }

  /** Things that depend on phase timing rather than on events. */
  private presentation() {
    const s = this.state;
    if (s.phase === 'intro') {
      for (const i of [0, 1] as const) {
        const due = i === 0 ? s.phaseFrame >= 8 : s.phaseFrame >= INTRO_SPLIT + 4;
        if (due && !this.introShown[i]) {
          this.introShown[i] = true;
          const def = i === 0 ? this.setup.p1 : this.setup.p2;
          const lines = def.introLines.length ? def.introLines : ['Je vais te tuer.'];
          const line = lines[(this.setup.seed + i * 7) % lines.length];
          const face = this.world!.faces[i];
          this.hud.subtitle(def.name, face.portraitUrl, line);
          audio.duck(true);
          void audio.say(line, { lang: def.voice?.lang, pitch: def.voice?.pitch, rate: def.voice?.rate, file: def.voice?.introFile });
        }
      }
    } else if (this.introShown[0] || this.introShown[1]) {
      if (s.phase !== 'roundIntro' || s.phaseFrame > 2) {
        // keep flags; subtitles are cleared at round start
      }
    }

    if (s.phase === 'matchOver') {
      const w = s.matchWinner;
      if (!this.winLineSaid && s.phaseFrame > 30 && (w === 0 || w === 1)) {
        this.winLineSaid = true;
        const def = w === 0 ? this.setup.p1 : this.setup.p2;
        const lines = def.winLines.length ? def.winLines : ['Trop facile.'];
        const line = lines[(this.setup.seed + 3) % lines.length];
        this.hud.announce(this.nameOf(w) + ' GAGNE', 'small', 160);
        this.hud.subtitle(def.name, this.world!.faces[w].portraitUrl, line);
        void audio.say(line, { lang: def.voice?.lang, pitch: def.voice?.pitch, rate: def.voice?.rate, file: def.voice?.winFile });
      }
      if (!this.resultsShown && s.phaseFrame > 210) {
        this.hud.clearSubtitle();
        this.hud.clearAnnounce();
        this.showResults();
      }
    }
  }
}
