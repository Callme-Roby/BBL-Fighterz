/**
 * TOURNOI — fighter picks: the participants choose their fighter one after
 * another (portrait grid + « ? » random cell, one fighter in the 3D studio).
 */
import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import type { FighterDef } from '../data/roster';
import { fullRoster } from '../game/settings';
import { fighterIndexByName, saveTournament, type Tournament } from '../game/tournament';
import { input } from '../input/input';
import { loadFace } from '../render/faceTexture';
import { Showroom, type ShowroomFit } from '../render/showroom';
import { backButton, gridColumns, h, phoneLayout, uiRoot } from '../ui/dom';
import { goTournament, goTournamentBracket } from './flow';
import { centerShowroom, guardButtons, portrait } from './tournamentShared';

/** delay between a confirmed pick and the next participant (win pose time) */
const NEXT_DELAY = 750;

export class TournamentPickScreen implements Screen {
  private roster: FighterDef[] = fullRoster();
  private showroom = new Showroom();
  private cols: number;
  /** index of the participant choosing */
  private index = 0;
  /** grid cursor; roster.length = the « ? » random cell */
  private cursor = 0;
  /** true during the short pause after a confirmed pick */
  private busy = false;
  private disposed = false;
  private timer = 0;
  private cells: HTMLDivElement[] = [];
  private titleEl!: HTMLDivElement;
  private subEl!: HTMLDivElement;
  private nameEl!: HTMLDivElement;
  private stripEl!: HTMLDivElement;
  private midEl!: HTMLDivElement;

  constructor(
    private app: App,
    private t: Tournament,
  ) {
    this.cols = Math.min(8, this.roster.length + 1);
    centerShowroom(this.showroom);
    // one fighter in the middle, a bit to the left of the participant list on wide screens
    this.showroom.cameraPos.set(0, 1.4, 4.4);
    this.showroom.cameraLook.set(0, 1.12, 0);
  }

  enter() {
    audio.playMusic('select');
    const grid = h('div', { class: 'grid', style: `--cols:${this.cols}` });
    const all: (FighterDef | null)[] = [...this.roster, null];
    all.forEach((def, i) => {
      const cell = h('div', { class: 'cell' + (def ? '' : ' special') }, def ? h('div', { class: 'nm' }, def.name) : '?');
      if (def) loadFace(def).then((f) => (cell.style.backgroundImage = `url(${f.portraitUrl})`));
      cell.addEventListener('click', () => this.clickCell(i));
      grid.append(cell);
      this.cells.push(cell);
    });
    this.titleEl = h('div', { class: 'h1 tn-pick-title' });
    this.subEl = h('div', { class: 'title-hint' });
    this.nameEl = h('div', { class: 'pname p1' });
    this.stripEl = h('div', { class: 'tn-strip' });
    this.midEl = h('div', { class: 'tn-pick-mid' }, this.nameEl, this.stripEl);
    // touch: tap a fighter then VALIDER (or tap it again)
    const ok = h('button', { class: 'btn primary tn-pick-ok touch-only' }, 'VALIDER');
    ok.addEventListener('click', () => this.confirm());
    const root = h(
      'div',
      { class: 'select tn-pick' },
      h('div', { class: 'top' }, this.titleEl, this.subEl),
      this.midEl,
      h(
        'div',
        { class: 'tn-pick-bottom' },
        grid,
        h('div', { class: 'title-hint kbd-only' }, '← → ↑ ↓ / ZQSD pour choisir · Entrée pour valider · Échap = participant précédent'),
        h('div', { class: 'title-hint touch-only' }, 'Touche un perso · RETOUR = participant précédent'),
        ok,
      ),
    );
    guardButtons(root);
    const back = backButton(() => this.back());
    guardButtons(back);
    uiRoot().append(root, back);
    this.load(Math.min(this.t.pickIndex, this.t.participants.length - 1));
  }

  exit() {
    this.disposed = true;
    window.clearTimeout(this.timer);
    this.showroom.dispose();
  }

  /** Shows participant i, with the cursor on their previous pick, else on the fighter with their name. */
  private load(i: number) {
    this.index = i;
    this.busy = false;
    const p = this.t.participants[i];
    let idx = p.fighterId ? this.roster.findIndex((d) => d.id === p.fighterId) : -1;
    if (idx < 0) idx = fighterIndexByName(p.name, this.roster);
    if (idx < 0) idx = this.roster.length;
    this.cursor = idx;
    const n = this.t.participants.length;
    this.titleEl.textContent = `PARTICIPANT ${i + 1}/${n} — ${p.name}, ${p.cpu ? 'CHOISIS SON' : 'CHOISIS TON'} COMBATTANT`;
    this.subEl.replaceChildren(
      p.cpu ? h('span', { class: 'tn-cpu' }, 'CPU') : h('span', { class: 'tn-human' }, 'HUMAIN'),
      p.cpu ? ' Ce participant est joué par l’ordinateur — le « ? » choisit au hasard' : ' Plusieurs participants peuvent prendre le même perso',
    );
    this.renderStrip();
    this.refresh();
  }

  /** Participant list with the fighters already chosen. */
  private renderStrip() {
    const items = this.t.participants.map((p, i) => {
      const done = i < this.index;
      const def = done ? (this.roster.find((d) => d.id === p.fighterId) ?? null) : null;
      return h(
        'div',
        { class: 'tn-strip-it' + (i === this.index ? ' cur' : '') + (done ? ' done' : '') },
        portrait(def, 'tn-ph'),
        h('span', { class: 'tn-strip-nm' }, p.name, p.cpu ? h('i', { class: 'tn-cpu' }, 'CPU') : null),
      );
    });
    this.stripEl.replaceChildren(...items);
    const cur = this.stripEl.children[this.index] as HTMLElement | undefined;
    cur?.scrollIntoView?.({ block: 'nearest' });
  }

  private defAt(i: number): FighterDef | null {
    return this.roster[i] ?? null;
  }

  private refresh() {
    const p = this.t.participants[this.index];
    this.cells.forEach((cell, i) => {
      const on = i === this.cursor;
      cell.classList.toggle('p1', on);
      cell.querySelectorAll('.tag').forEach((t) => t.remove());
      if (on) cell.append(h('span', { class: 'tag t1' }, p.name.slice(0, 7)));
    });
    const def = this.defAt(this.cursor);
    const parts: (string | HTMLElement)[] = [def ? def.name : '???', h('span', { class: 'ttl' }, def ? def.title : 'Au hasard')];
    if (this.busy) parts.push(h('div', { class: 'lock' }, 'PRÊT !'));
    this.nameEl.replaceChildren(...parts);
    void this.showroom.show(0, def);
  }

  private clickCell(i: number) {
    if (this.busy) return;
    if (this.cursor === i) this.confirm();
    else {
      this.cursor = i;
      audio.sfx('cursor');
      this.refresh();
    }
  }

  private move(dx: number, dy: number) {
    if (this.busy) return;
    const n = this.roster.length + 1;
    let i = this.cursor;
    if (dx) i = (i + dx + n) % n;
    if (dy) {
      i += dy * gridColumns(this.cells, this.cols);
      if (i < 0 || i >= n) i = this.cursor;
    }
    if (i !== this.cursor) {
      this.cursor = i;
      audio.sfx('cursor');
      this.refresh();
    }
  }

  private confirm() {
    if (this.busy) return;
    let def = this.defAt(this.cursor);
    if (!def) {
      // random cell: show who the dice picked
      def = this.roster[Math.floor(Math.random() * this.roster.length)];
      this.cursor = this.roster.indexOf(def);
    }
    const i = this.index;
    this.t.participants[i].fighterId = def.id;
    const last = i + 1 >= this.t.participants.length;
    this.t.pickIndex = last ? i : i + 1;
    if (last) this.t.phase = 'bracket';
    saveTournament(this.t);
    this.busy = true;
    audio.sfx('confirm');
    this.refresh();
    void this.showroom.show(0, def).then(() => this.showroom.play(0, 'win' + (i % 3)));
    this.timer = window.setTimeout(() => {
      if (this.disposed) return;
      if (last) goTournamentBracket(this.t);
      else this.load(i + 1);
    }, NEXT_DELAY);
  }

  /** Previous participant, or back to the setup screen from the first one. */
  private back() {
    if (this.busy) return;
    audio.sfx('cancel');
    if (this.index > 0) {
      this.t.pickIndex = this.index - 1;
      saveTournament(this.t);
      this.load(this.index - 1);
    } else goTournament(this.t.participants);
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (e.action === 'left') this.move(-1, 0);
      else if (e.action === 'right') this.move(1, 0);
      else if (e.action === 'up') this.move(0, -1);
      else if (e.action === 'down') this.move(0, 1);
      else if (e.action === 'confirm') this.confirm();
      else if (e.action === 'back') {
        this.back();
        if (this.disposed) return;
      }
    }
    this.showroom.fit = this.fitFighter();
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }

  /** Phones: the fighter stands in the free space (portrait: under the participant strip, landscape: under the name, left of the grid). */
  private fitFighter(): ShowroomFit | null {
    const layout = phoneLayout();
    if (!layout) return null;
    const mid = this.midEl.getBoundingClientRect();
    const name = this.nameEl.getBoundingClientRect();
    const strip = this.stripEl.getBoundingClientRect();
    let box: ShowroomFit['box'];
    if (layout === 'portrait') box = { left: mid.left, top: strip.bottom + 4, width: mid.width, height: name.top - strip.bottom - 8 };
    // landscape: the name column (left of the grid), under the name
    else box = { left: name.left, top: name.bottom + 4, width: name.width, height: window.innerHeight - name.bottom - 10 };
    if (box.width < 40 || box.height < 40) return null;
    const cx = box.left + box.width / 2;
    return { box, worldH: 2.45, centerY: 1.06, worldW: 1.4, slotX: [cx, cx + box.width] };
  }
}
