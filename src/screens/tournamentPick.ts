/**
 * TOURNOI — fighter picks: the participants choose their fighter one after
 * another (portrait grid + « ? » random cell, one fighter in the 3D studio),
 * then their assist in the same grid (« ? » = au hasard, never themselves).
 */
import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { assistOf, ASSIST_KIND_LABEL } from '../data/assists';
import type { FighterDef } from '../data/roster';
import { fullRoster } from '../game/settings';
import { assistOfParticipant, fighterIndexByName, saveTournament, type Tournament } from '../game/tournament';
import { input } from '../input/input';
import { loadFace } from '../render/faceTexture';
import { Showroom, type ShowroomFit } from '../render/showroom';
import { backButton, gridColumns, h, phoneLayout, uiRoot } from '../ui/dom';
import { goTournament, goTournamentBracket } from './flow';
import { profileBox } from './profile';
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
  /** choosing the fighter, then the assist (same grid) */
  private step: 'fighter' | 'assist' = 'fighter';
  private acursor = 0;
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
        h('div', { class: 'title-hint kbd-only' }, '← → ↑ ↓ / ZQSD · Entrée = valider (le perso, puis son assist) · Échap = retour'),
        h('div', { class: 'title-hint touch-only' }, 'Touche un perso, puis son assist · RETOUR = étape précédente'),
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
  private load(i: number, step: 'fighter' | 'assist' = 'fighter') {
    this.index = i;
    this.busy = false;
    const p = this.t.participants[i];
    let idx = p.fighterId ? this.roster.findIndex((d) => d.id === p.fighterId) : -1;
    if (idx < 0) idx = fighterIndexByName(p.name, this.roster);
    if (idx < 0) idx = this.roster.length;
    this.cursor = idx;
    this.setStep(p.fighterId ? step : 'fighter');
    this.renderStrip();
    this.refresh();
  }

  /** Fighter step, or assist step (cursor on the previous friend, else next to your own face). */
  private setStep(step: 'fighter' | 'assist') {
    const i = this.index;
    const p = this.t.participants[i];
    this.step = step;
    if (step === 'assist') {
      const own = this.ownIndex();
      const prev = p.assistId && p.assistId !== p.fighterId ? this.roster.findIndex((d) => d.id === p.assistId) : -1;
      this.acursor = prev >= 0 ? prev : own >= 0 ? (own + 1) % this.roster.length : this.roster.length;
      if (this.acursor === own) this.acursor = this.roster.length;
    }
    const n = this.t.participants.length;
    const what = step === 'assist' ? 'ASSIST' : 'COMBATTANT';
    this.titleEl.textContent = `PARTICIPANT ${i + 1}/${n} — ${p.name}, ${p.cpu ? 'CHOISIS SON' : 'CHOISIS TON'} ${what}`;
    this.subEl.replaceChildren(
      p.cpu ? h('span', { class: 'tn-cpu' }, 'CPU') : h('span', { class: 'tn-human' }, 'HUMAIN'),
      step === 'assist'
        ? ' Le pote appelé avec le bouton ASSIST en plein combat (pas soi-même) — le « ? » choisit au hasard'
        : p.cpu
          ? ' Ce participant est joué par l’ordinateur — le « ? » choisit au hasard'
          : ' Plusieurs participants peuvent prendre le même perso',
    );
  }

  /** grid index of the current participant's fighter */
  private ownIndex(): number {
    const id = this.t.participants[this.index]?.fighterId;
    return id ? this.roster.findIndex((d) => d.id === id) : -1;
  }

  /** Participant list with the fighters already chosen. */
  private renderStrip() {
    const items = this.t.participants.map((p, i) => {
      const done = i < this.index;
      const def = done ? (this.roster.find((d) => d.id === p.fighterId) ?? null) : null;
      const friend = done ? assistOfParticipant(this.t, i, this.roster) : null;
      return h(
        'div',
        { class: 'tn-strip-it' + (i === this.index ? ' cur' : '') + (done ? ' done' : '') },
        portrait(def, 'tn-ph'),
        friend ? portrait(friend, 'tn-ph tn-strip-as') : null,
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
    const assist = this.step === 'assist';
    this.cells.forEach((cell, i) => {
      const on = i === this.cursor;
      const as = assist && i === this.acursor;
      cell.classList.toggle('p1', on);
      cell.classList.toggle('a1', as);
      cell.classList.toggle('own', assist && on);
      cell.querySelectorAll('.tag').forEach((t) => t.remove());
      if (as) cell.append(h('span', { class: 'tag t1 ta' }, '★' + p.name.slice(0, 6)));
      else if (on) cell.append(h('span', { class: 'tag t1' }, p.name.slice(0, 7)));
    });
    const def = this.defAt(this.cursor);
    const parts: (string | HTMLElement)[] = [def ? def.name : '???', h('span', { class: 'ttl' }, def ? def.title : 'Au hasard')];
    // profile: LOURD / RAPIDE / DISTANCE / ÉQUILIBRÉ + stats
    const prof = profileBox(def);
    if (prof) parts.push(prof);
    if (assist) {
      // « ASSIST : ISIS » + « UPPERCUT MUSCLÉ · LANCEUR »
      const friend = this.defAt(this.acursor);
      const self = friend && def && friend.id === def.id;
      const a = friend ? assistOf(friend) : null;
      parts.push(
        h(
          'div',
          { class: 'sel-assist' + (this.busy ? '' : ' picking') },
          portrait(friend, 'aph'),
          h(
            'div',
            { class: 'atx' },
            h('span', { class: 'ak' }, this.busy ? 'ASSIST' : p.cpu ? 'CHOISIS SON ASSIST' : 'CHOISIS TON ASSIST'),
            h('b', null, friend ? friend.name : '???'),
            h('small', null, self ? 'Pas soi-même !' : a ? `${a.name} · ${ASSIST_KIND_LABEL[a.kind]}` : 'Au hasard'),
          ),
        ),
      );
    }
    if (this.busy) parts.push(h('div', { class: 'lock' }, 'PRÊT !'));
    this.nameEl.replaceChildren(...parts);
    void this.showroom.show(0, def);
  }

  private clickCell(i: number) {
    if (this.busy) return;
    const cur = this.step === 'assist' ? this.acursor : this.cursor;
    if (cur === i) this.confirm();
    else {
      if (this.step === 'assist') this.acursor = i;
      else this.cursor = i;
      audio.sfx('cursor');
      this.refresh();
    }
  }

  private move(dx: number, dy: number) {
    if (this.busy) return;
    const assist = this.step === 'assist';
    const cur = assist ? this.acursor : this.cursor;
    const own = assist ? this.ownIndex() : -1;
    const n = this.roster.length + 1;
    let i = cur;
    if (dx) {
      i = (i + dx + n) % n;
      if (i === own) i = (i + dx + n) % n;
    }
    if (dy) {
      i += dy * gridColumns(this.cells, this.cols);
      if (i < 0 || i >= n) i = cur;
    }
    if (i !== cur) {
      if (assist) this.acursor = i;
      else this.cursor = i;
      audio.sfx('cursor');
      this.refresh();
    }
  }

  private confirm() {
    if (this.busy) return;
    if (this.step === 'fighter') {
      let def = this.defAt(this.cursor);
      if (!def) {
        // random cell: show who the dice picked
        def = this.roster[Math.floor(Math.random() * this.roster.length)];
        this.cursor = this.roster.indexOf(def);
      }
      this.t.participants[this.index].fighterId = def.id;
      saveTournament(this.t);
      audio.sfx('confirm');
      void this.showroom.show(0, def).then(() => this.showroom.play(0, 'win' + (this.index % 3)));
      // then the assist, in the same grid
      this.setStep('assist');
      this.refresh();
      return;
    }
    const own = this.ownIndex();
    if (this.acursor === own) {
      // a friend can't assist themselves
      audio.sfx('cancel');
      const cell = this.cells[own];
      cell?.classList.remove('nope');
      void cell?.offsetWidth;
      cell?.classList.add('nope');
      return;
    }
    let friend = this.defAt(this.acursor);
    if (!friend) {
      const pool = this.roster.filter((_, k) => k !== own);
      friend = pool[Math.floor(Math.random() * pool.length)] ?? null;
      if (friend) this.acursor = this.roster.indexOf(friend);
    }
    const def = this.defAt(this.cursor);
    if (!def) return;
    const i = this.index;
    this.t.participants[i].assistId = friend?.id;
    const last = i + 1 >= this.t.participants.length;
    this.t.pickIndex = last ? i : i + 1;
    if (last) this.t.phase = 'bracket';
    saveTournament(this.t);
    this.busy = true;
    audio.sfx('confirm');
    this.refresh();
    this.timer = window.setTimeout(() => {
      if (this.disposed) return;
      if (last) goTournamentBracket(this.t);
      else this.load(i + 1);
    }, NEXT_DELAY);
  }

  /** Back one step: assist → fighter → previous participant's assist → … → setup screen. */
  private back() {
    if (this.busy) return;
    audio.sfx('cancel');
    if (this.step === 'assist') {
      this.setStep('fighter');
      this.showroom.play(0, 'showcase');
      this.refresh();
    } else if (this.index > 0) {
      this.t.pickIndex = this.index - 1;
      saveTournament(this.t);
      this.load(this.index - 1, 'assist');
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
