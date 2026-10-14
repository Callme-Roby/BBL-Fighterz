import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { ROSTER, type FighterDef } from '../data/roster';
import { fullRoster, sanitizeDef } from '../game/settings';
import { input, type MenuEvent } from '../input/input';
import type { NetLink, NetMsg } from '../net/peer';
import { loadFace } from '../render/faceTexture';
import { Showroom } from '../render/showroom';
import { backButton, h, uiRoot } from '../ui/dom';
import type { FightMode } from './fight';
import { goMenu, goStageSelect, startFight } from './flow';
import { settings } from '../game/settings';

/** Character select: P1 (blue) / P2 (red) cursors over a portrait grid, 3D preview behind. */
export class SelectScreen implements Screen {
  private roster: FighterDef[];
  private cursor: [number, number] = [0, 1];
  private locked: [boolean, boolean] = [false, false];
  private picked: [FighterDef | null, FighterDef | null] = [null, null];
  private showroom = new Showroom();
  private cells: HTMLDivElement[] = [];
  private names: HTMLDivElement[] = [];
  private status!: HTMLDivElement;
  private cols: number;
  private unsubs: (() => void)[] = [];
  /** remote player's current (unlocked) choice */
  private remoteDef: FighterDef | null = null;
  private waitingStage = false;

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

  enter() {
    audio.playMusic('select');
    void audio.announcer('chooseFighter');
    const grid = h('div', { class: 'grid', style: `--cols:${this.cols}` });
    const all: (FighterDef | null)[] = [...this.roster, null];
    all.forEach((def, i) => {
      const cell = h('div', { class: 'cell' + (def ? '' : ' special') }, def ? h('div', { class: 'nm' }, def.name) : '?');
      if (def) loadFace(def).then((f) => (cell.style.backgroundImage = `url(${f.portraitUrl})`));
      cell.addEventListener('click', () => this.clickCell(i));
      grid.append(cell);
      this.cells.push(cell);
    });
    this.names = [h('div', { class: 'pname p1' }), h('div', { class: 'pname p2' })];
    const modeLabel = this.mode === 'cpu' ? 'ARCADE — CONTRE LE CPU' : this.mode === 'versus' ? 'VERSUS — 2 JOUEURS' : 'EN LIGNE';
    this.status = h('div', { class: 'title-hint' });
    const root = h(
      'div',
      { class: 'select' },
      h('div', { class: 'top' }, h('div', { class: 'h1' }, 'CHOISIS TON COMBATTANT'), h('div', { class: 'title-hint' }, modeLabel)),
      h('div', { class: 'names' }, this.names[0], this.names[1]),
      h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:8px' }, grid, this.status),
    );
    uiRoot().append(root, backButton(() => this.back()));
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
    if (this.mode === 'cpu') return this.locked[0] ? 1 : 0;
    // versus: explicit side, otherwise first unlocked
    if (e.player === 0 || e.player === 1) return e.player as 0 | 1;
    return !this.locked[0] ? 0 : !this.locked[1] ? 1 : -1;
  }

  private clickCell(i: number) {
    const cc = this.mode === 'online' ? this.me : !this.locked[0] ? 0 : !this.locked[1] ? 1 : -1;
    if (cc < 0) return;
    const c = cc as 0 | 1;
    if (this.cursor[c] === i) this.lock(c);
    else {
      this.cursor[c] = i;
      audio.sfx('cursor');
      this.refresh();
    }
  }

  private move(c: 0 | 1, dx: number, dy: number) {
    if (this.locked[c]) return;
    const n = this.roster.length + 1;
    let i = this.cursor[c];
    if (dx) i = (i + dx + n) % n;
    if (dy) {
      i += dy * this.cols;
      if (i < 0 || i >= n) i = this.cursor[c];
    }
    if (i !== this.cursor[c]) {
      this.cursor[c] = i;
      audio.sfx('cursor');
      this.refresh();
    }
  }

  private lock(c: 0 | 1) {
    if (this.locked[c]) return;
    let def = this.defAt(this.cursor[c]);
    if (!def) def = this.roster[Math.floor(Math.random() * this.roster.length)];
    this.picked[c] = def;
    this.locked[c] = true;
    audio.sfx('confirm');
    this.showroom.play(c, 'win' + (c === 0 ? 0 : 1));
    this.refresh();
    this.sendPick();
    this.checkDone();
  }

  private unlock(c: 0 | 1): boolean {
    if (!this.locked[c]) return false;
    this.locked[c] = false;
    this.picked[c] = null;
    audio.sfx('cancel');
    this.showroom.play(c, 'showcase');
    this.refresh();
    this.sendPick();
    return true;
  }

  private sendPick() {
    if (this.mode !== 'online' || !this.link) return;
    const c = this.me;
    const def = this.picked[c] ?? this.defAt(this.cursor[c]);
    this.link.send({ t: 'pick', def, locked: this.locked[c], cursor: this.cursor[c] });
  }

  private onNet(m: NetMsg) {
    const them = (1 - this.me) as 0 | 1;
    if (m.t === 'pick') {
      let def = m.def ? sanitizeDef(m.def) : null;
      // built-in fighters: use our local definition (voice files etc.)
      const builtIn = m.def && !m.def.custom ? ROSTER.find((r) => r.id === m.def!.id) : undefined;
      if (builtIn) def = builtIn;
      this.remoteDef = def;
      this.locked[them] = m.locked && !!def;
      this.picked[them] = m.locked ? def : null;
      const idx = def ? this.roster.findIndex((r) => r.id === def!.id) : -1;
      this.cursor[them] = idx >= 0 ? idx : this.roster.length;
      if (m.locked) this.showroom.play(them, 'win1');
      this.refresh();
      this.checkDone();
    }
    if (m.t === 'toSelect') {
      // the host went back from the stage select: everybody picks again
      this.waitingStage = false;
      for (const c of [0, 1] as const) {
        this.locked[c] = false;
        this.picked[c] = null;
        this.showroom.play(c, 'showcase');
      }
      this.refresh();
    }
    if (m.t === 'start' && !this.link!.isHost) {
      const p1 = m.p1.custom ? sanitizeDef(m.p1) : (ROSTER.find((r) => r.id === m.p1.id) ?? sanitizeDef(m.p1));
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
      });
    }
  }

  private checkDone() {
    if (!(this.locked[0] && this.locked[1] && this.picked[0] && this.picked[1])) return;
    const [p1, p2] = this.picked as [FighterDef, FighterDef];
    if (this.mode === 'online') {
      if (this.link?.isHost) setTimeout(() => goStageSelect('online', p1, p2, this.link), 700);
      else {
        this.waitingStage = true;
        this.refresh();
      }
      return;
    }
    setTimeout(() => goStageSelect(this.mode, p1, p2), 700);
  }

  private refresh() {
    const n = this.roster.length + 1;
    for (let i = 0; i < n; i++) {
      const cell = this.cells[i];
      if (!cell) continue;
      const on0 = this.cursor[0] === i;
      const on1 = this.cursor[1] === i && (this.mode !== 'cpu' || this.locked[0]);
      cell.classList.toggle('p1', on0);
      cell.classList.toggle('p2', on1);
      cell.querySelectorAll('.tag').forEach((t) => t.remove());
      if (on0) cell.append(h('span', { class: 'tag t1' }, '1P'));
      if (on1) cell.append(h('span', { class: 'tag t2' }, this.mode === 'cpu' ? 'CPU' : '2P'));
    }
    for (const c of [0, 1] as const) {
      const isRemote = this.mode === 'online' && c !== this.me;
      let def = this.picked[c] ?? (isRemote ? this.remoteDef : this.defAt(this.cursor[c]));
      const hidden = this.mode === 'cpu' && c === 1 && !this.locked[0];
      if (hidden) def = null;
      const random = !def && !hidden && !isRemote;
      const parts: (string | HTMLElement)[] = [random ? '???' : def ? def.name : ''];
      if (def) parts.push(h('span', { class: 'ttl' }, def.title));
      else if (random) parts.push(h('span', { class: 'ttl' }, 'Au hasard'));
      if (this.locked[c]) parts.push(h('div', { class: 'lock' }, 'PRÊT !'));
      this.names[c].replaceChildren(...parts);
      void this.showroom.show(c, def);
    }
    let msg = '';
    if (this.mode === 'cpu') msg = this.locked[0] ? "Choisis l'adversaire du CPU" : 'Choisis ton perso';
    else if (this.mode === 'versus') msg = 'J1 : ZQSD/WASD + R T F G (E = BBL MAX) · J2 : flèches + I O K L (P = BBL MAX)';
    else msg = this.waitingStage ? "L'hôte choisit l'arène…" : this.locked[1 - this.me] ? "L'adversaire est prêt !" : "L'adversaire choisit…";
    this.status.textContent = msg;
  }

  /** back button: unlock the last locked cursor, or leave */
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
        if (this.mode === 'cpu' && this.locked[0] && this.unlock(0)) continue;
        if (this.mode === 'versus' && e.player === -1 && (this.unlock(1) || this.unlock(0))) continue;
        if (!this.locked[0] && !this.locked[1]) {
          audio.sfx('cancel');
          this.link?.close();
          goMenu();
          return;
        }
        continue;
      }
      if (c < 0) continue;
      const cc = c as 0 | 1;
      if (e.action === 'left') this.move(cc, -1, 0);
      else if (e.action === 'right') this.move(cc, 1, 0);
      else if (e.action === 'up') this.move(cc, 0, -1);
      else if (e.action === 'down') this.move(cc, 0, 1);
      else if (e.action === 'confirm') this.lock(cc);
      if (this.mode === 'online' && (e.action === 'left' || e.action === 'right' || e.action === 'up' || e.action === 'down')) this.sendPick();
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
