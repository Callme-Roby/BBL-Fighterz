import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { assistOf, ASSIST_KIND_LABEL } from '../data/assists';
import { ROSTER, type FighterDef } from '../data/roster';
import { fullRoster, sanitizeDef } from '../game/settings';
import { input, keyLabel, P1_KEYS, P2_KEYS, type MenuEvent } from '../input/input';
import type { NetLink, NetMsg } from '../net/peer';
import { loadFace } from '../render/faceTexture';
import { Showroom, type ShowroomFit } from '../render/showroom';
import { backButton, gridColumns, h, isTouchUi, phoneLayout, uiRoot } from '../ui/dom';
import type { FightMode } from './fight';
import { goMenu, goStageSelect, startFight } from './flow';
import { settings } from '../game/settings';
import { profileBox } from './profile';

/** What a side is choosing: its fighter, then the friend called with the assist button. */
type Step = 'fighter' | 'assist' | 'ready';

/**
 * Character select: P1 (blue) / P2 (red) cursors over a portrait grid, 3D preview behind.
 * Each player validates a fighter, then picks an assist in the same grid (not themselves);
 * RETOUR goes back one step. The CPU's assist is drawn from the fight seed (stage select).
 */
export class SelectScreen implements Screen {
  private roster: FighterDef[];
  private cursor: [number, number] = [0, 1];
  private locked: [boolean, boolean] = [false, false];
  private picked: [FighterDef | null, FighterDef | null] = [null, null];
  /** assist step: grid cursor, validated, chosen friend */
  private acursor: [number, number] = [0, 0];
  private alocked: [boolean, boolean] = [false, false];
  private assist: [FighterDef | null, FighterDef | null] = [null, null];
  private showroom = new Showroom();
  private cells: HTMLDivElement[] = [];
  private names: HTMLDivElement[] = [];
  private status!: HTMLDivElement;
  private titleEl!: HTMLDivElement;
  private root!: HTMLDivElement;
  private grid!: HTMLDivElement;
  /** free space between the title and the grid: the 3D fighters stand there on phones */
  private arena!: HTMLDivElement;
  /** touch: confirms the highlighted fighter (a second tap on the cell does it too) */
  private okBtn!: HTMLButtonElement;
  private cols: number;
  private unsubs: (() => void)[] = [];
  /** remote player's current (unlocked) choices */
  private remoteDef: FighterDef | null = null;
  private remoteAssist: FighterDef | null = null;
  private waitingStage = false;
  private faces = new Map<string, string>();

  constructor(
    private app: App,
    private mode: FightMode,
    private link?: NetLink,
  ) {
    this.roster = fullRoster();
    this.cols = Math.min(8, this.roster.length + 1);
    if (this.roster.length > 1) this.cursor[1] = 1;
    if (mode === 'online' && link) {
      this.unsubs.push(link.on((m) => this.onNet(m)));
      this.unsubs.push(
        link.onClose((r) => {
          this.status.textContent = r;
          this.status.classList.add('err');
          setTimeout(goMenu, 2500);
        }),
      );
    }
  }

  private get me(): 0 | 1 {
    return this.link ? (this.link.isHost ? 0 : 1) : 0;
  }

  /** one player picks both sides: arcade (P2 = the CPU) and training (P2 = the dummy) */
  private get solo() {
    return this.mode === 'cpu' || this.mode === 'training';
  }

  /** the CPU of arcade mode gets a random assist, the training dummy none (no assist step) */
  private cpuSide(c: 0 | 1) {
    return this.solo && c === 1;
  }

  private step(c: 0 | 1): Step {
    if (!this.locked[c]) return 'fighter';
    return this.alocked[c] ? 'ready' : 'assist';
  }

  private ready(c: 0 | 1) {
    return this.step(c) === 'ready';
  }

  enter() {
    audio.playMusic('select');
    void audio.announcer('chooseFighter');
    const grid = h('div', { class: 'grid', style: `--cols:${this.cols}` });
    this.grid = grid;
    const all: (FighterDef | null)[] = [...this.roster, null];
    all.forEach((def, i) => {
      const cell = h('div', { class: 'cell' + (def ? '' : ' special') }, def ? h('div', { class: 'nm' }, def.name) : '?');
      if (def)
        loadFace(def).then((f) => {
          cell.style.backgroundImage = `url(${f.portraitUrl})`;
          this.faces.set(def.id, f.portraitUrl);
        });
      cell.addEventListener('click', () => this.clickCell(i));
      grid.append(cell);
      this.cells.push(cell);
    });
    this.names = [h('div', { class: 'pname p1' }), h('div', { class: 'pname p2' })];
    const modeLabel =
      this.mode === 'cpu' ? 'ARCADE — CONTRE LE CPU' : this.mode === 'versus' ? 'VERSUS — 2 JOUEURS' : this.mode === 'training' ? 'ENTRAÎNEMENT' : 'EN LIGNE';
    this.status = h('div', { class: 'title-hint sel-hint' });
    this.okBtn = h('button', { class: 'btn primary sel-ok touch-only' }, 'VALIDER');
    this.okBtn.addEventListener('click', () => this.touchConfirm());
    this.arena = h('div', { class: 'arena' });
    this.titleEl = h('div', { class: 'h1' }, 'CHOISIS TON COMBATTANT');
    this.root = h(
      'div',
      { class: `select pick-screen mode-${this.mode}` },
      h('div', { class: 'top' }, this.titleEl, h('div', { class: 'title-hint' }, modeLabel)),
      this.arena,
      h('div', { class: 'names' }, this.names[0], this.names[1]),
      h('div', { class: 'bottom' }, grid, this.status, this.okBtn),
    );
    uiRoot().append(this.root, backButton(() => this.back()));
    this.refresh();
  }

  exit() {
    for (const u of this.unsubs) u();
    this.showroom.dispose();
  }

  private defAt(i: number): FighterDef | null {
    return this.roster[i] ?? null;
  }

  /** which cursor the menu event drives */
  private activeCursor(e: MenuEvent): 0 | 1 | -1 {
    if (this.mode === 'online') return this.me;
    if (this.solo) return this.ready(0) ? 1 : 0;
    // versus: explicit side, otherwise first player still choosing
    if (e.player === 0 || e.player === 1) return e.player as 0 | 1;
    return !this.ready(0) ? 0 : !this.ready(1) ? 1 : -1;
  }

  /** cursor driven by taps / clicks: mine online, else the first player still choosing (-1 = none) */
  private tapCursor(): 0 | 1 | -1 {
    if (this.mode === 'online') return this.ready(this.me) ? -1 : this.me;
    return !this.ready(0) ? 0 : !this.ready(1) ? 1 : -1;
  }

  /** VALIDER button (touch): locks the highlighted fighter / assist */
  private touchConfirm() {
    const c = this.tapCursor();
    if (c !== -1 && !this.waitingStage) this.lock(c);
  }

  private clickCell(i: number) {
    const t = this.tapCursor();
    if (t < 0 || this.waitingStage) return;
    const c = t as 0 | 1;
    const assist = this.step(c) === 'assist';
    const cur = assist ? this.acursor : this.cursor;
    if (cur[c] === i) this.lock(c);
    else {
      cur[c] = i;
      audio.sfx('cursor');
      this.refresh();
      this.sendPick();
    }
  }

  /** grid index of side c's own fighter (an assist can't be yourself) */
  private ownIndex(c: 0 | 1): number {
    const def = this.picked[c];
    return def ? this.roster.findIndex((d) => d.id === def.id) : -1;
  }

  private move(c: 0 | 1, dx: number, dy: number) {
    const st = this.step(c);
    if (st === 'ready') return;
    const cur = st === 'assist' ? this.acursor : this.cursor;
    const own = st === 'assist' ? this.ownIndex(c) : -1;
    const n = this.roster.length + 1;
    let i = cur[c];
    if (dx) {
      i = (i + dx + n) % n;
      // left / right hop over your own face
      if (i === own) i = (i + dx + n) % n;
    }
    if (dy) {
      i += dy * gridColumns(this.cells, this.cols);
      if (i < 0 || i >= n) i = cur[c];
    }
    if (i !== cur[c]) {
      cur[c] = i;
      audio.sfx('cursor');
      this.refresh();
    }
  }

  private lock(c: 0 | 1) {
    const st = this.step(c);
    if (st === 'ready') return;
    if (st === 'fighter') {
      let def = this.defAt(this.cursor[c]);
      if (!def) {
        // random cell: the cursor shows who the dice picked
        def = this.roster[Math.floor(Math.random() * this.roster.length)];
        this.cursor[c] = this.roster.indexOf(def);
      }
      this.picked[c] = def;
      this.locked[c] = true;
      if (this.cpuSide(c)) {
        // arcade: the CPU's friend is drawn from the fight seed
        this.alocked[c] = true;
        this.assist[c] = null;
      } else {
        // assist cursor starts next to your own face
        const own = this.roster.indexOf(def);
        this.acursor[c] = own >= 0 ? (own + 1) % this.roster.length : 0;
        if (this.acursor[c] === own) this.acursor[c] = this.roster.length;
      }
      audio.sfx('confirm');
      this.showroom.play(c, 'win' + (c === 0 ? 0 : 1));
    } else {
      let def = this.defAt(this.acursor[c]);
      const self = this.picked[c];
      if (def && self && def.id === self.id) {
        // a friend can't assist themselves
        audio.sfx('cancel');
        const cell = this.cells[this.acursor[c]];
        cell?.classList.remove('nope');
        void cell?.offsetWidth;
        cell?.classList.add('nope');
        return;
      }
      if (!def) {
        const pool = this.roster.filter((d) => d.id !== self?.id);
        def = pool[Math.floor(Math.random() * pool.length)] ?? null;
        if (def) this.acursor[c] = this.roster.indexOf(def);
      }
      this.assist[c] = def;
      this.alocked[c] = true;
      audio.sfx('confirm');
    }
    this.refresh();
    this.sendPick();
    this.checkDone();
  }

  /** RETOUR for side c: back one step (assist → fighter → nothing). */
  private unlock(c: 0 | 1): boolean {
    const st = this.step(c);
    if (st === 'fighter') return false;
    if (st === 'ready' && !this.cpuSide(c)) {
      this.alocked[c] = false;
      this.assist[c] = null;
    } else {
      this.locked[c] = false;
      this.alocked[c] = false;
      this.picked[c] = null;
      this.assist[c] = null;
      this.showroom.play(c, 'showcase');
    }
    // online guest changing their mind while the host picks the arena: not ready any more
    if (this.mode === 'online' && c === this.me) this.waitingStage = false;
    audio.sfx('cancel');
    this.refresh();
    this.sendPick();
    return true;
  }

  private sendPick() {
    if (this.mode !== 'online' || !this.link) return;
    const c = this.me;
    const def = this.picked[c] ?? this.defAt(this.cursor[c]);
    const assist = this.assist[c] ?? (this.locked[c] ? this.defAt(this.acursor[c]) : null);
    this.link.send({
      t: 'pick',
      def,
      locked: this.locked[c],
      cursor: this.cursor[c],
      assist,
      assistLocked: this.alocked[c],
      assistCursor: this.acursor[c],
    });
  }

  /** A fighter definition received from the other browser (built-in ones: our local copy). */
  private remote(d: FighterDef | null | undefined): FighterDef | null {
    if (!d) return null;
    const builtIn = !d.custom ? ROSTER.find((r) => r.id === d.id) : undefined;
    return builtIn ?? sanitizeDef(d);
  }

  private indexOf(def: FighterDef | null): number {
    const idx = def ? this.roster.findIndex((r) => r.id === def.id) : -1;
    return idx >= 0 ? idx : this.roster.length;
  }

  private onNet(m: NetMsg) {
    const them = (1 - this.me) as 0 | 1;
    if (m.t === 'pick') {
      const def = this.remote(m.def);
      const assist = this.remote(m.assist);
      this.remoteDef = def;
      this.remoteAssist = assist;
      const wasLocked = this.locked[them];
      this.locked[them] = m.locked && !!def;
      this.picked[them] = this.locked[them] ? def : null;
      this.alocked[them] = this.locked[them] && !!m.assistLocked && !!assist;
      this.assist[them] = this.alocked[them] ? assist : null;
      this.cursor[them] = this.indexOf(def);
      this.acursor[them] = this.indexOf(assist);
      if (this.locked[them] && !wasLocked) this.showroom.play(them, 'win1');
      if (!this.locked[them] && wasLocked) this.showroom.play(them, 'showcase');
      this.refresh();
      this.checkDone();
    }
    if (m.t === 'toSelect') {
      // the host went back from the stage select: everybody picks again
      this.waitingStage = false;
      for (const c of [0, 1] as const) {
        this.locked[c] = false;
        this.alocked[c] = false;
        this.picked[c] = null;
        this.assist[c] = null;
        this.showroom.play(c, 'showcase');
      }
      this.refresh();
    }
    if (m.t === 'start' && !this.link!.isHost) {
      const p1 = this.remote(m.p1) ?? sanitizeDef(m.p1);
      startFight({
        mode: 'online',
        p1,
        p2: this.picked[1] ?? sanitizeDef(m.p2),
        stageId: m.stage,
        rounds: m.rounds,
        difficulty: settings.difficulty,
        seed: m.seed,
        link: this.link,
        localPlayer: 1,
        // the host's view of both sides: the two browsers create the game with the same assists
        assists: [this.remote(m.a1), this.remote(m.a2)],
      });
    }
  }

  private checkDone() {
    if (!(this.ready(0) && this.ready(1) && this.picked[0] && this.picked[1])) return;
    const [p1, p2] = this.picked as [FighterDef, FighterDef];
    const assists: [FighterDef | null, FighterDef | null] = [this.assist[0], this.assist[1]];
    if (this.mode === 'online') {
      if (this.link?.isHost) setTimeout(() => goStageSelect('online', p1, p2, this.link, assists), 700);
      else {
        this.waitingStage = true;
        this.refresh();
      }
      return;
    }
    setTimeout(() => goStageSelect(this.mode, p1, p2, undefined, assists), 700);
  }

  /** « ASSIST : ISIS » + « UPPERCUT MUSCLÉ · LANCEUR » under a player's name */
  private assistLine(c: 0 | 1, def: FighterDef | null, state: 'pick' | 'ready' | 'cpu'): HTMLElement {
    const self = this.picked[c];
    const ph = h('i', { class: 'aph' + (def ? '' : ' unknown') }, def ? '' : '?');
    if (def) {
      const url = this.faces.get(def.id);
      if (url) ph.style.backgroundImage = `url(${url})`;
      else loadFace(def).then((f) => (ph.style.backgroundImage = `url(${f.portraitUrl})`));
    }
    let name: string;
    let sub: string;
    if (state === 'cpu') {
      name = '???';
      sub = 'Au hasard';
    } else if (!def) {
      name = '???';
      sub = 'Au hasard';
    } else if (self && def.id === self.id) {
      name = def.name;
      sub = 'Pas toi-même !';
    } else {
      const a = assistOf(def);
      name = def.name;
      sub = `${a.name} · ${ASSIST_KIND_LABEL[a.kind]}`;
    }
    return h(
      'div',
      { class: 'sel-assist' + (state === 'pick' ? ' picking' : '') },
      ph,
      h('div', { class: 'atx' }, h('span', { class: 'ak' }, state === 'pick' ? 'CHOISIS TON ASSIST' : 'ASSIST'), h('b', null, name), h('small', null, sub)),
    );
  }

  private refresh() {
    const n = this.roster.length + 1;
    const cpuHidden = this.solo && !this.ready(0);
    for (let i = 0; i < n; i++) {
      const cell = this.cells[i];
      if (!cell) continue;
      const on = [false, false];
      const as = [false, false];
      const own = [false, false];
      for (const c of [0, 1] as const) {
        if (c === 1 && cpuHidden) continue;
        const st = this.step(c);
        on[c] = this.cursor[c] === i;
        // assist cursor (and the friend once chosen); your own face is greyed while you choose
        as[c] = st !== 'fighter' && !this.cpuSide(c) && this.acursor[c] === i;
        own[c] = st === 'assist' && on[c];
      }
      // the other player may still pick that fighter: don't cross it out under their cursor
      for (const c of [0, 1] as const) if (own[c] && on[1 - c] && this.step((1 - c) as 0 | 1) === 'fighter') own[c] = false;
      cell.classList.toggle('p1', on[0]);
      cell.classList.toggle('p2', on[1]);
      cell.classList.toggle('a1', as[0]);
      cell.classList.toggle('a2', as[1]);
      cell.classList.toggle('own', own[0] || own[1]);
      cell.querySelectorAll('.tag').forEach((t) => t.remove());
      if (on[0]) cell.append(h('span', { class: 'tag t1' }, '1P'));
      else if (as[0]) cell.append(h('span', { class: 'tag t1 ta' }, '★1P'));
      if (on[1]) cell.append(h('span', { class: 'tag t2' }, this.mode === 'cpu' ? 'CPU' : this.mode === 'training' ? 'CIBLE' : '2P'));
      else if (as[1]) cell.append(h('span', { class: 'tag t2 ta' }, '★2P'));
    }
    for (const c of [0, 1] as const) {
      const isRemote = this.mode === 'online' && c !== this.me;
      let def = this.picked[c] ?? (isRemote ? this.remoteDef : this.defAt(this.cursor[c]));
      const hidden = this.solo && c === 1 && !this.ready(0);
      if (hidden) def = null;
      const random = !def && !hidden && !isRemote;
      const parts: (string | HTMLElement | null)[] = [random ? '???' : def ? def.name : ''];
      if (def) parts.push(h('span', { class: 'ttl' }, def.title));
      else if (random) parts.push(h('span', { class: 'ttl' }, 'Au hasard'));
      // profile: LOURD / RAPIDE / DISTANCE / ÉQUILIBRÉ + stats
      parts.push(profileBox(def));
      const st = this.step(c);
      if (st === 'assist') parts.push(this.assistLine(c, this.assist[c] ?? (isRemote ? this.remoteAssist : this.defAt(this.acursor[c])), 'pick'));
      // the training dummy has no assist
      else if (st === 'ready' && !(this.mode === 'training' && c === 1)) parts.push(this.assistLine(c, this.assist[c], this.cpuSide(c) ? 'cpu' : 'ready'));
      if (st === 'ready') parts.push(h('div', { class: 'lock' }, 'PRÊT !'));
      this.names[c].replaceChildren(...parts.filter((x): x is string | HTMLElement => x !== null));
      void this.showroom.show(c, def);
    }
    const touch = isTouchUi();
    const focus = this.waitingStage ? -1 : this.tapCursor();
    const focusAssist = focus >= 0 && this.step(focus as 0 | 1) === 'assist';
    // versus on one keyboard: both players may be at different steps
    const anyAssist = this.mode === 'versus' && !touch ? [0, 1].some((c) => this.step(c as 0 | 1) === 'assist') && ![0, 1].some((c) => this.step(c as 0 | 1) === 'fighter') : focusAssist;
    this.titleEl.textContent = anyAssist
      ? 'CHOISIS TON ASSIST'
      : this.mode === 'cpu' && this.ready(0)
        ? 'CHOISIS TON ADVERSAIRE'
        : this.mode === 'training' && this.ready(0)
          ? 'CHOISIS TON PARTENAIRE'
          : 'CHOISIS TON COMBATTANT';
    this.root.classList.toggle('assist-step', anyAssist);
    let msg = '';
    const assistHelp = 'le pote qui vient t’aider en plein combat (pas toi-même)';
    if (this.mode === 'training') {
      const st = this.step(0);
      msg =
        st === 'fighter'
          ? touch
            ? 'Touche ton perso'
            : 'Choisis ton perso'
          : st === 'assist'
            ? (touch ? 'Touche ton assist : ' : 'Choisis ton assist : ') + assistHelp
            : touch
              ? 'Touche ton partenaire : le mannequin sur qui tu t’entraînes'
              : 'Choisis ton partenaire : le mannequin sur qui tu t’entraînes';
    } else if (this.mode === 'cpu') {
      const st = this.step(0);
      msg =
        st === 'fighter'
          ? touch
            ? 'Touche un perso'
            : 'Choisis ton perso'
          : st === 'assist'
            ? (touch ? 'Touche ton assist : ' : 'Choisis ton assist : ') + assistHelp
            : touch
              ? "Touche l'adversaire du CPU (son assist sera tiré au hasard)"
              : "Choisis l'adversaire du CPU (son assist sera tiré au hasard)";
    } else if (this.mode === 'versus') {
      if (!touch) {
        const k = (codes: string[]) => keyLabel(codes[0]);
        msg = `J1 : ZQSD/WASD + R T F G (${k(P1_KEYS.super)} = BBL MAX, ${k(P1_KEYS.assist)} = ASSIST) · J2 : flèches + I O K L (${k(P2_KEYS.super)} = BBL MAX, ${k(P2_KEYS.assist)} = ASSIST)`;
        if ([0, 1].some((c) => this.step(c as 0 | 1) === 'assist')) msg = 'Choisis ton assist : ' + assistHelp + ' · ' + msg;
      } else if (focus >= 0) msg = `J${focus + 1} : ` + (focusAssist ? 'touche ton assist, ' + assistHelp : 'touche ton perso');
    } else {
      const mine = this.step(this.me);
      msg = this.waitingStage
        ? "L'hôte choisit l'arène…"
        : mine === 'assist'
          ? 'Choisis ton assist : ' + assistHelp
          : this.ready((1 - this.me) as 0 | 1)
            ? "L'adversaire est prêt !"
            : this.locked[1 - this.me]
              ? "L'adversaire choisit son assist…"
              : "L'adversaire choisit…";
    }
    this.status.textContent = msg;
    // touch: VALIDER for the player choosing (blue = J1, red = J2)
    const c = focus;
    this.okBtn.disabled = c < 0;
    this.okBtn.classList.toggle('p2', c === 1);
    this.okBtn.classList.toggle('as', focusAssist);
    this.okBtn.textContent =
      c < 0
        ? 'PRÊT !'
        : focusAssist
          ? this.mode === 'versus'
            ? `VALIDER L'ASSIST J${c + 1}`
            : "VALIDER L'ASSIST"
          : this.mode === 'versus'
            ? `VALIDER J${c + 1}`
            : this.mode === 'cpu' && c === 1
              ? "VALIDER L'ADVERSAIRE"
              : this.mode === 'training' && c === 1
                ? 'VALIDER LE PARTENAIRE'
                : 'VALIDER';
    // two fighters on stage (side by side on phones), or one in the middle
    const them = (1 - this.me) as 0 | 1;
    const duo = this.mode === 'versus' || (this.solo && this.ready(0)) || (this.mode === 'online' && !!(this.picked[them] ?? this.remoteDef));
    this.root.classList.toggle('duo', duo);
  }

  /** Phones: the fighters stand in the free space (portrait) or beside the grid (landscape). */
  private fitFighters(): ShowroomFit | null {
    const layout = phoneLayout();
    const W = window.innerWidth;
    if (!layout && W / Math.max(1, window.innerHeight) >= 1.1) return null;
    const a = this.arena.getBoundingClientRect();
    if (a.width < 40 || a.height < 40) return null;
    const box = { left: a.left, top: a.top, width: a.width, height: a.height };
    if (layout === 'landscape') {
      const g = this.grid.getBoundingClientRect();
      return { box, worldH: 2.45, centerY: 1.06, worldW: 1, slotX: [g.left / 2, (g.right + W) / 2] };
    }
    if (this.root.classList.contains('duo')) return { box, worldH: 2.5, centerY: 1.05, worldW: 3.1, slotX: [a.left + a.width * 0.27, a.left + a.width * 0.73] };
    // one fighter in the middle (online guest: slot 1 = mine)
    const cx = a.left + a.width / 2;
    const solo = this.mode === 'online' ? this.me : 0;
    return { box, worldH: 2.5, centerY: 1.05, worldW: 1.6, slotX: solo === 0 ? [cx, cx + a.width] : [cx - a.width, cx] };
  }

  /** back button: one step back for the last player who moved on, or leave */
  private back() {
    if (this.mode === 'online') {
      if (this.unlock(this.me)) return;
    } else if (this.unlock(1) || this.unlock(0)) return;
    audio.sfx('cancel');
    this.link?.close();
    goMenu();
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      const c = this.activeCursor(e);
      if (e.action === 'back') {
        if (c >= 0 && this.unlock(c as 0 | 1)) continue;
        if (this.solo && this.unlock(0)) continue;
        if (this.mode === 'versus' && e.player === -1 && (this.unlock(1) || this.unlock(0))) continue;
        if (!this.locked[0] && !this.locked[1]) {
          audio.sfx('cancel');
          this.link?.close();
          goMenu();
          return;
        }
        continue;
      }
      if (c < 0 || this.waitingStage) continue;
      const cc = c as 0 | 1;
      if (e.action === 'left') this.move(cc, -1, 0);
      else if (e.action === 'right') this.move(cc, 1, 0);
      else if (e.action === 'up') this.move(cc, 0, -1);
      else if (e.action === 'down') this.move(cc, 0, 1);
      else if (e.action === 'confirm') this.lock(cc);
      if (this.mode === 'online' && (e.action === 'left' || e.action === 'right' || e.action === 'up' || e.action === 'down')) this.sendPick();
    }
    this.showroom.fit = this.fitFighters();
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
