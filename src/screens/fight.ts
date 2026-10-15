import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { assistOf, assistSpec, ASSIST_KIND_LABEL } from '../data/assists';
import type { FighterDef } from '../data/roster';
import { ultimateOf } from '../data/ultimates';
import { FightWorld } from '../game/world';
import { input, keyLabel, P1_KEYS, P2_KEYS } from '../input/input';
import type { NetLink, NetMsg } from '../net/peer';
import { RollbackSession, type TimedEvent } from '../net/rollback';
import { loadFace } from '../render/faceTexture';
import { getStage } from '../render/stages';
import { CpuBrain, type Difficulty } from '../sim/ai';
import { createGame, step } from '../sim/sim';
import { INTRO_SPLIT, type GameState, type SimEvent } from '../sim/types';
import { h, Menu, uiRoot } from '../ui/dom';
import { Hud, type AssistHud } from '../ui/hud';
import { controlsHelp } from './help';
import { goMenu, goSelect, startFight } from './flow';

export type FightMode = 'cpu' | 'versus' | 'online' | 'spectate';

/** Input stream of a match watched as a spectator (online tournament). */
export interface SpectatorFeed {
  /** inputs [p1, p2] of frame f, or null while they have not arrived */
  get(f: number): [number, number] | null;
  /** number of frames received so far */
  readonly length: number;
}

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
  /** called with the final inputs of every frame, in order (streams the match to spectators) */
  tv?: (frame: number, i0: number, i1: number) => void;
  /** spectator mode: where the inputs come from */
  feed?: SpectatorFeed;
  /**
   * friend called with the assist button, per side (null = none). Chosen on the select
   * screens (the CPU's is drawn from the seed); online, both browsers get the same pair.
   */
  assists?: [FighterDef | null, FighterDef | null];
}

export interface TournamentHooks {
  /** short label shown on the VS screen / HUD, e.g. "DEMI-FINALE" */
  title: string;
  /** called when the match is over and the players continue (2 = draw) */
  onResult(winner: 0 | 1 | 2): void;
  /** called when the players leave the match without a result (pause menu) */
  onAbort(): void;
  /** online tournament: called once, as soon as the match is decided (before any click) */
  onMatchEnd?(winner: 0 | 1 | 2): void;
  /** online tournament: no restart / rematch, the result screen leads back to the bracket */
  online?: boolean;
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
  /** next frame whose final inputs are streamed (online runner) */
  private tvNext = 0;
  private endReported = false;
  /** spectator: playback started (a small buffer is filled first) */
  private spectating = false;
  /** the first frame after loading has been presented (HUD shown, round announced) */
  private started = false;
  /** faces of the assists (banner when called) */
  private assistFaces: [string | null, string | null] = [null, null];
  /** full scale of the touch ASSIST button's recharge sweep */
  private touchCdMax = 0;

  constructor(
    private app: App,
    private setup: FightSetup,
  ) {
    this.state = createGame({
      roundsToWin: setup.rounds,
      skipIntro: setup.skipIntro,
      ultimates: [ultimateOf(setup.p1).script, ultimateOf(setup.p2).script],
      assists: [assistSpec(setup.assists?.[0]), assistSpec(setup.assists?.[1])],
    });
    // deterministic variant choices for intro animations (same on both peers)
    this.state.fighters[0].variant = setup.seed % 2;
    this.state.fighters[1].variant = (setup.seed >> 1) % 2;
    if (setup.mode !== 'online' && setup.mode !== 'spectate') {
      const cpuSides = setup.cpuSides ?? (setup.mode === 'cpu' ? [false, true] : [false, false]);
      for (const i of [0, 1] as const) if (cpuSides[i]) this.cpu[i] = new CpuBrain(setup.difficulty);
    }
    if (setup.mode === 'online' && setup.link) {
      // created right away so no early input packet is lost
      this.session = new RollbackSession(this.state, setup.localPlayer ?? 0, setup.link);
      this.unsubs.push(setup.link.on((m) => this.onNet(m)));
      this.unsubs.push(setup.link.onClose((reason) => this.disconnected(reason)));
    }
    const [names, tags] = this.labels();
    const akeys = this.assistKeys();
    const ahud = (i: 0 | 1): AssistHud | null => {
      const def = setup.assists?.[i];
      return def ? { name: def.name, key: akeys[i] } : null;
    };
    this.hud = new Hud(names, this.superKeys(), tags, [ahud(0), ahud(1)]);
    for (const i of [0, 1] as const) {
      const def = setup.assists?.[i];
      if (!def) continue;
      loadFace(def)
        .then((f) => {
          if (this.disposed) return;
          this.assistFaces[i] = f.portraitUrl;
          this.hud.setAssistPortrait(i, f.portraitUrl);
          if (this.localSide === i) this.app.touch.setAssistFace(f.portraitUrl);
        })
        .catch(() => undefined);
    }
    // console access for testing: open the game with ?debug
    if (location.search.includes('debug') || (window as unknown as { bblDebug?: boolean }).bblDebug) (window as unknown as { bblFight: unknown }).bblFight = this;
    FightWorld.create(setup.p1, setup.p2, setup.stageId).then(async (w) => {
      if (this.disposed) {
        w.dispose();
        return;
      }
      // the friends' look (lab creations received online are not in the local roster)
      w.setAssistDefs([setup.assists?.[0] ?? null, setup.assists?.[1] ?? null]);
      w.setCineHooks({
        say: (sp, text, o) => {
          this.showLine(sp.name, sp.portrait, text, (o.dur / 60) * 1000);
          const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
          void audio.say(text, {
            lang: sp.voice?.lang,
            pitch: clamp((sp.voice?.pitch ?? 1) * (o.pitch ?? 1), 0, 2),
            rate: clamp((sp.voice?.rate ?? 1) * (o.rate ?? 1) * 1.05, 0.1, 2),
          });
        },
        text: (t, style, dur, color) => this.hud.comic(t, style, dur, color),
        music: (id) => audio.playMusic(id ?? getStage(this.setup.stageId).music, { fade: id ? 0.25 : 0.8 }),
        rename: (i, name) => this.hud.setName(i, name),
      });
      // while the VS screen is up: everything the fight may show is built and its shaders compiled
      try {
        await w.prewarm(this.app.pipeline);
      } catch (e) {
        console.warn('prewarm', e);
      }
      if (this.disposed) {
        w.dispose();
        return;
      }
      this.world = w;
    });
  }

  private lineToken = 0;
  /** Subtitle (with ducking) that clears itself unless a newer line replaced it. */
  private showLine(name: string, portrait: string, line: string, ms: number) {
    const token = ++this.lineToken;
    this.hud.subtitle(name, portrait, line);
    audio.duck(true);
    setTimeout(() => {
      if (this.disposed || token !== this.lineToken) return;
      this.hud.clearSubtitle();
      audio.duck(false);
    }, ms);
  }

  enter() {
    uiRoot().append(this.hud.el);
    this.hud.setVisible(false);
    if (!this.setup.skipIntro) this.showVs();
    this.loadingEl = h('div', { class: 'screen passthrough fight-loading' }, h('div', { class: 'title-hint blink' }, 'CHARGEMENT…'));
    uiRoot().append(this.loadingEl);
    audio.playMusic(getStage(this.setup.stageId).music, { fade: 1 });
    this.app.touch.setGameplay(true);
    this.app.touch.onPause = () => this.togglePause();
    // ASSIST button: shown when the side played here has a friend (face filled in when loaded)
    const side = this.localSide;
    const mine = side === 0 || side === 1 ? this.setup.assists?.[side] : null;
    this.app.touch.setAssistFace(mine ? (this.assistFaces[side as 0 | 1] ?? '') : null);
  }

  exit() {
    this.disposed = true;
    for (const u of this.unsubs) u();
    this.session?.dispose();
    this.world?.dispose();
    this.app.touch.onPause = null;
    this.app.touch.setCovered(false);
    this.app.touch.setIdle(false);
    audio.duck(false);
  }

  /** "P1 VS P2" splash shown while the match loads. */
  private showVs() {
    const names = this.setup.names;
    const face = (def: FighterDef, el: HTMLElement) => {
      loadFace(def)
        .then((f) => (el.style.backgroundImage = `url(${f.portraitUrl})`))
        .catch(() => undefined);
      return el;
    };
    const side = (def: FighterDef, cls: string) => {
      const i = cls === 'l' ? 0 : 1;
      const who = names ? names[i] : null;
      const ph = face(def, h('div', { class: 'portrait' }));
      const sub = who && who.toUpperCase() !== def.name.toUpperCase() ? `avec ${def.name} — ${def.title}` : def.title;
      const shown = who ? who.toUpperCase() : def.name;
      const long = shown.length > 9 ? ' long' : '';
      // the friend on call: small portrait + name + move under the fighter
      const ad = this.setup.assists?.[i];
      const a = ad ? assistOf(ad) : null;
      const assist =
        ad && a
          ? h(
              'div',
              { class: 'vs-assist' },
              face(ad, h('div', { class: 'aph' })),
              h('div', { class: 'atx' }, h('span', { class: 'ak' }, 'ASSIST'), h('b', null, ad.name), h('small', null, `${a.name} · ${ASSIST_KIND_LABEL[a.kind]}`)),
            )
          : null;
      return h(
        'div',
        { class: 'side ' + cls },
        ph,
        h('div', { class: 'pname ' + (cls === 'l' ? 'p1' : 'p2') + long }, h('span', { class: 'nm' }, shown), h('span', { class: 'ttl' }, sub), assist),
      );
    };
    const mid = h('div', { class: 'mid' });
    if (this.setup.tournament) mid.append(h('div', { class: 'title-hint vstitle' }, this.setup.tournament.title));
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
      // rematch: same fighters and assists (the host's message carries them too)
      startFight({ ...this.setup, stageId: m.stage, seed: m.seed, skipIntro: true });
    }
    if (m.t === 'toSelect') goSelect('online', this.setup.link);
    if (m.t === 'leave') this.disconnected("L'adversaire a quitté la partie.");
  }

  private disconnected(reason: string) {
    if (this.disposed) return;
    // online tournament: the opponent going back to the bracket after the result is not a problem
    if (this.setup.tournament?.online && this.state.phase === 'matchOver') return;
    this.paused = true;
    this.closeOverlay();
    const t = this.setup.tournament;
    this.menu = new Menu(
      [t ? { label: 'RETOUR AU TABLEAU', action: () => this.quitToMenu() } : { label: 'RETOUR AU MENU', action: () => this.quitToMenu() }],
      () => audio.sfx('cursor'),
    );
    this.openOverlay(h('div', { class: 'overlay' }, h('div', { class: 'h1' }, 'DÉCONNEXION'), h('div', { class: 'status err' }, reason), this.menu.el));
  }

  private quitToMenu() {
    this.setup.link?.close();
    if (this.setup.tournament) this.setup.tournament.onAbort();
    else goMenu();
  }

  /** HUD labels: participant names when given (+ the fighter played), otherwise fighter names */
  private labels(): [[string, string], [string, string]] {
    const [n1, n2] = this.setup.names ?? [this.setup.p1.name, this.setup.p2.name];
    const same = (n: string, def: FighterDef) => n.toUpperCase() === def.name.toUpperCase();
    const name = (n: string, def: FighterDef) => (same(n, def) ? def.name : n.toUpperCase());
    const tag = (n: string, def: FighterDef) => (same(n, def) ? '' : def.name);
    return [
      [name(n1, this.setup.p1), name(n2, this.setup.p2)],
      [tag(n1, this.setup.p1), tag(n2, this.setup.p2)],
    ];
  }

  // ---------------------------------------------------------------- input
  private get humans(): number {
    if (this.setup.mode === 'spectate') return 0;
    return (this.cpu[0] ? 0 : 1) + (this.cpu[1] ? 0 : 1);
  }

  private localBits(player: 0 | 1): number {
    // two humans share the keyboard; a single human gets every key
    if (this.setup.mode !== 'online' && this.humans >= 2) return input.bits(player, 'versus');
    return input.bits(0, 'solo');
  }

  /** key shown in the HUD next to "BBL MAX !" for each side */
  private superKeys(): [string, string] {
    const keys = this.superKeysRaw();
    // the side played with the touch controls has its BBL button right there: no key to press
    const side = this.localSide;
    if (this.app.touch.enabled && (side === 0 || side === 1)) keys[side] = '';
    return keys;
  }

  /** key shown in the HUD next to "ASSIST !" for each side ('' = CPU / remote / touch) */
  private assistKeys(): [string, string] {
    const k1 = keyLabel(P1_KEYS.assist[0]);
    const k2 = keyLabel(P2_KEYS.assist[0]);
    let keys: [string, string];
    if (this.setup.mode === 'spectate') keys = ['', ''];
    else if (this.setup.mode === 'online') keys = this.setup.localPlayer === 1 ? ['', k1] : [k1, ''];
    else if (this.humans >= 2) keys = [k1, k2];
    else keys = [this.cpu[0] ? '' : k1, this.cpu[1] ? '' : k1];
    const side = this.localSide;
    if (this.app.touch.enabled && (side === 0 || side === 1)) keys[side] = '';
    return keys;
  }

  private superKeysRaw(): [string, string] {
    if (this.setup.mode === 'spectate') return ['', ''];
    if (this.setup.mode === 'online') return this.setup.localPlayer === 1 ? ['', 'E'] : ['E', ''];
    if (this.humans >= 2) return ['E', 'P'];
    return [this.cpu[0] ? '' : 'E', this.cpu[1] ? '' : 'E'];
  }

  /** side played by the human using the touch controls / solo keys (-1 = none) */
  private get localSide(): number {
    if (this.setup.mode === 'spectate') return -1;
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
    if (this.setup.mode === 'spectate') {
      if (this.overlay) this.closeOverlay();
      else {
        this.menu = new Menu(
          [
            { label: 'CONTINUER À REGARDER', action: () => this.closeOverlay() },
            { label: 'RETOUR AU TABLEAU', action: () => this.setup.tournament?.onAbort() },
          ],
          () => audio.sfx('cursor'),
        );
        this.openOverlay(h('div', { class: 'overlay' }, h('div', { class: 'h1' }, 'SPECTATEUR'), this.menu.el));
      }
      return;
    }
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
        this.openOverlay(
          h('div', { class: 'overlay' }, h('div', { class: 'h1' }, 'EN LIGNE'), h('div', { class: 'status' }, 'Le match continue pendant ce menu !'), this.menu.el),
        );
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
      t?.online
        ? [
            { label: 'REPRENDRE', sub: 'Les spectateurs attendent !', action: () => this.togglePause() },
            { label: 'COMMANDES', action: () => this.showHelp() },
            { label: 'ABANDONNER LE COMBAT', sub: 'Il sera rejoué plus tard', action: () => t.onAbort() },
          ]
        : t
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
    this.openOverlay(h('div', { class: 'overlay' }, h('div', { class: 'h1' }, 'PAUSE'), this.menu.el));
  }

  private showHelp() {
    this.closeOverlay();
    this.menu = new Menu([{ label: 'RETOUR', action: () => (this.togglePause(), this.togglePause()) }], () => audio.sfx('cursor'));
    const touch = this.app.touch.enabled && this.setup.mode !== 'spectate';
    const help = controlsHelp(this.humans >= 2 && this.setup.mode !== 'online', touch);
    this.openOverlay(h('div', { class: 'overlay help' }, h('div', { class: 'panel helppanel' }, help), this.menu.el));
  }

  private openOverlay(el: HTMLElement) {
    this.overlay = el;
    uiRoot().append(el);
    this.app.touch.setCovered(true);
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
    this.menu = null;
    this.app.touch.setCovered(false);
  }

  private restart(skipIntro: boolean) {
    startFight({ ...this.setup, seed: (this.setup.seed * 1103515245 + 12345) >>> 0, skipIntro });
  }

  private checkRematch() {
    if (this.rematchMine && this.rematchTheirs && this.setup.link?.isHost) {
      const seed = (Math.random() * 1e9) >>> 0;
      const [a1, a2] = this.setup.assists ?? [null, null];
      this.setup.link.send({ t: 'start', stage: this.setup.stageId, p1: this.setup.p1, p2: this.setup.p2, a1, a2, seed, rounds: this.setup.rounds });
      startFight({ ...this.setup, seed, skipIntro: true });
    }
  }

  private showResults() {
    this.resultsShown = true;
    this.closeOverlay();
    const online = this.setup.mode === 'online';
    const tn = this.setup.tournament;
    const items = tn?.online
      ? [
          {
            label: this.state.matchWinner === 2 ? 'MATCH NUL : RETOUR AU TABLEAU' : 'RETOUR AU TABLEAU',
            action: () => tn.onResult(this.state.matchWinner as 0 | 1 | 2),
          },
        ]
      : online
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
    this.openOverlay(h('div', { class: 'overlay results' }, h('div', { class: 'h1' }, title), this.menu.el));
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
    if (!this.started) {
      this.started = true;
      // rematch / tournament replay / debug start: the match begins straight at the round intro,
      // whose phase event (HUD + "ROUND 1") is never emitted
      if (this.state.phase === 'roundIntro' && this.state.frame === 0) this.roundIntro();
    }
    let maxSteps = 5;
    const feed = this.setup.mode === 'spectate' ? this.setup.feed : undefined;
    if (feed) {
      // play a little behind the stream so network hiccups don't freeze the picture
      const ahead = feed.length - this.state.frame;
      if (!this.spectating && (ahead >= 30 || (ahead > 0 && this.state.phase === 'matchOver'))) this.spectating = true;
      const over = this.state.phase === 'matchOver';
      this.hud.setNetInfo(over ? 'SPECTATEUR' : this.spectating && ahead > 0 ? 'SPECTATEUR · EN DIRECT' : 'SPECTATEUR · EN ATTENTE DU DIRECT…');
      if (!this.spectating) {
        this.world.render(this.app.pipeline, this.state, dt, this.app.aspect);
        return;
      }
      // far behind (joined late, tab in the background): catch up faster
      if (ahead > 120) maxSteps = 12;
    }

    if (!this.paused || online || feed) {
      this.acc += dt;
      let steps = 0;
      if (feed && maxSteps > 5) this.acc = Math.max(this.acc, STEP * maxSteps);
      while (this.acc >= STEP && steps < maxSteps) {
        this.acc -= STEP;
        steps++;
        this.tick();
      }
      if (steps >= maxSteps) this.acc = 0;
    }

    this.world.render(this.app.pipeline, this.state, dt, this.app.aspect);
    this.hud.update(this.state, dt * 60);
    const side = this.localSide;
    this.app.touch.setSuperReady(side >= 0 && this.state.fighters[side].meter >= 100);
    const as = side >= 0 ? this.state.assists?.[side] : null;
    if (as) {
      // gauge scale: the longest cooldown seen since the last call
      if (as.cooldown > this.touchCdMax) this.touchCdMax = as.cooldown;
      const ready = as.phase === 'off' && as.cooldown <= 0;
      if (ready) this.touchCdMax = 0;
      this.app.touch.setAssistState(ready ? 'ready' : as.phase !== 'off' ? 'busy' : 'cool', this.touchCdMax > 0 ? 1 - as.cooldown / this.touchCdMax : 0);
    }
    // spectators / CPU vs CPU: the controls do nothing (only the pause button matters)
    this.app.touch.setIdle(side < 0 || !this.interactive());
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
      if (this.setup.tv) this.tvNext = this.session.confirmedInputs(this.tvNext, this.setup.tv);
      this.world!.handleEvents(evs, this.state, { onEvent: (e) => this.onEvent(e) });
      return;
    }
    const s = this.state;
    if (this.setup.mode === 'spectate') {
      const inp = this.setup.feed?.get(s.frame);
      if (!inp) return; // waiting for the stream
      step(s, inp);
      const evs: TimedEvent[] = s.events.map((ev) => ({ frame: s.frame, ev }));
      this.world!.handleEvents(evs, s, { onEvent: (e) => this.onEvent(e) });
      return;
    }
    const i0 = this.cpu[0] ? this.cpu[0].think(s, 0) : this.localBits(0);
    const i1 = this.cpu[1] ? this.cpu[1].think(s, 1) : this.localBits(1);
    this.setup.tv?.(s.frame, i0, i1);
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

  /** false while the controls do nothing: intros, BBL MAX cinematics, K.O., results */
  private interactive(): boolean {
    const s = this.state;
    if (s.phase !== 'fight') return false;
    return !s.fighters.some((f) => f.action === 'superFlash' || f.action === 'superCombo');
  }

  private roundIntro() {
    const s = this.state;
    this.hud.clearSubtitle();
    this.hud.setVisible(true);
    audio.duck(false);
    const last = s.fighters[0].wins === s.roundsToWin - 1 && s.fighters[1].wins === s.roundsToWin - 1;
    const label = last && s.round > 1 ? 'FINAL ROUND' : `ROUND ${s.round}`;
    this.hud.announce(label, 'small', 60);
    void audio.announcer(last && s.round > 1 ? 'finalRound' : s.round === 1 ? 'round1' : s.round === 2 ? 'round2' : 'round3');
  }

  private onEvent(ev: SimEvent) {
    const s = this.state;
    switch (ev.t) {
      case 'phase':
        if (ev.phase === 'roundIntro') this.roundIntro();
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
        this.hud.announce(ultimateOf(def).name, 'small super', 80);
        this.showLine(def.name, this.world!.faces[ev.p].portraitUrl, line, 2600);
        void audio.say(line, { lang: def.voice?.lang, pitch: def.voice?.pitch, rate: (def.voice?.rate ?? 1) * 1.05 });
        break;
      }
      case 'superCombo':
        this.app.pipeline.post.uFlash.value = 0.55;
        break;
      case 'assist': {
        // « ISIS : UPPERCUT MUSCLÉ ! » + the friend's shout
        const def = this.setup.assists?.[ev.p];
        if (!def) break;
        const a = assistOf(def);
        this.hud.assistCall(ev.p, def.name, a.name, a.line, this.assistFaces[ev.p]);
        void audio.say(a.line, { lang: def.voice?.lang, pitch: def.voice?.pitch, rate: Math.min(2, (def.voice?.rate ?? 1) * 1.15) });
        break;
      }
      case 'wallBreak':
        // destruction finish: the K.O.'d fighter goes through the scenery
        this.hud.announce('DESTRUCTION !', 'destroy', 130);
        break;
      case 'throwBreak':
        this.hud.announce('ÉCHAPPÉ !', 'small', 40);
        break;
      case 'parry':
        this.hud.announce('PARADE !', 'small', 45);
        break;
      case 'grab':
        this.hud.announce('SAISIE !', 'small', 35);
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

    // online tournament: report as soon as the result is certain (no rollback can change it by then)
    if (s.phase === 'matchOver' && s.phaseFrame > 30 && !this.endReported && this.setup.mode !== 'spectate') {
      this.endReported = true;
      this.setup.tournament?.onMatchEnd?.(s.matchWinner as 0 | 1 | 2);
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
