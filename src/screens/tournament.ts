/**
 * TOURNOI — setup screen: resume prompt (when a tournament is saved), number
 * of participants, names, HUMAIN / CPU toggles and seeding order.
 */
import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { fullRoster } from '../game/settings';
import {
  bracketSize,
  cleanName,
  createTournament,
  DEFAULT_PARTICIPANTS,
  defaultName,
  loadTournament,
  MAX_PARTICIPANTS,
  NAME_MAX,
  PARTICIPANT_CHOICES,
  saveTournament,
  shuffle,
  totalMatches,
  type Participant,
  type Tournament,
} from '../game/tournament';
import { input } from '../input/input';
import { Showroom } from '../render/showroom';
import { backButton, h, Menu, uiRoot } from '../ui/dom';
import { goMenu, goTournamentBracket, goTournamentPick } from './flow';
import { noButtonFocus } from './tournamentShared';

interface Entry {
  name: string;
  cpu: boolean;
}

export class TournamentSetupScreen implements Screen {
  /** empty studio rendered behind the menus */
  private showroom = new Showroom();
  private root!: HTMLElement;
  /** resume prompt (null while the form is shown) */
  private menu: Menu | null = null;
  private count = DEFAULT_PARTICIPANTS;
  /** always 16 entries, so changing the count keeps what was typed */
  private entries: Entry[];
  private listEl!: HTMLDivElement;
  private infoEl!: HTMLDivElement;
  private chipsEl!: HTMLDivElement;
  private nextBtn!: HTMLButtonElement;

  /** `prefill`: participants of a previous tournament (skips the resume prompt) */
  constructor(
    private app: App,
    private prefill?: Participant[],
  ) {
    const roster = fullRoster();
    this.entries = Array.from({ length: MAX_PARTICIPANTS }, (_, i) => ({ name: defaultName(i, roster), cpu: false }));
    if (prefill?.length) {
      prefill.slice(0, MAX_PARTICIPANTS).forEach((p, i) => (this.entries[i] = { name: p.name, cpu: p.cpu }));
      this.count = prefill.length;
    }
  }

  enter() {
    audio.playMusic('select');
    this.root = h('div', { class: 'screen dim tn-setup' });
    noButtonFocus(this.root);
    // Enter on a focused button is handled by frame() (menu "confirm"), not natively: no double press
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'BUTTON') e.preventDefault();
    });
    uiRoot().append(this.root);
    const saved = this.prefill ? null : loadTournament();
    if (saved) this.showResume(saved);
    else this.showForm();
  }

  exit() {
    this.showroom.dispose();
  }

  // ------------------------------------------------------------ resume prompt
  private showResume(t: Tournament) {
    const played = t.played;
    const total = totalMatches(t);
    const resume = () => {
      audio.sfx('confirm');
      if (t.phase === 'pick') goTournamentPick(t);
      else goTournamentBracket(t);
    };
    this.menu = new Menu(
      [
        {
          label: `REPRENDRE LE TOURNOI (${played} combat${played > 1 ? 's' : ''} joué${played > 1 ? 's' : ''} / ${total})`,
          sub: `${t.participants.length} participants · ${t.phase === 'pick' ? 'choix des persos en cours' : 'tableau en cours'}`,
          action: resume,
        },
        { label: 'NOUVEAU TOURNOI', sub: 'Le tournoi sauvegardé sera remplacé', action: () => (audio.sfx('confirm'), this.showForm()) },
        { label: 'RETOUR', action: () => this.back() },
      ],
      () => audio.sfx('cursor'),
    );
    this.root.classList.add('tn-center');
    this.root.replaceChildren(
      h('div', { class: 'h1' }, 'TOURNOI'),
      h('div', { class: 'status' }, 'Un tournoi est en cours sur cet appareil.'),
      this.menu.el,
    );
  }

  // ------------------------------------------------------------ form
  private showForm() {
    this.menu = null;
    this.root.classList.remove('tn-center');
    const chips = h('div', { class: 'chips tn-count' });
    this.chipsEl = chips;
    for (const n of PARTICIPANT_CHOICES) {
      const b = h('button', { 'data-n': String(n) }, String(n));
      b.addEventListener('click', () => this.setCount(n));
      chips.append(b);
    }
    this.listEl = h('div', { class: 'tn-plist' });
    this.infoEl = h('div', { class: 'title-hint tn-setup-info' });
    const shuffleBtn = h('button', { class: 'btn' }, "MÉLANGER L'ORDRE");
    shuffleBtn.addEventListener('click', () => this.shuffle());
    this.nextBtn = h('button', { class: 'btn primary' }, 'SUIVANT : CHOIX DES PERSOS');
    this.nextBtn.addEventListener('click', () => this.next());
    const backBtn = h('button', { class: 'btn' }, 'RETOUR');
    backBtn.addEventListener('click', () => this.back());
    this.root.replaceChildren(
      h('div', { class: 'h1' }, 'TOURNOI'),
      h('div', { class: 'title-hint' }, 'Élimination directe · un perdant est éliminé · le dernier debout est champion'),
      h(
        'div',
        { class: 'panel tn-setup-panel' },
        h('div', { class: 'field' }, 'NOMBRE DE PARTICIPANTS', chips),
        h('div', { class: 'field' }, "PARTICIPANTS (DANS L'ORDRE DES TÊTES DE SÉRIE)", this.listEl),
        this.infoEl,
      ),
      h('div', { class: 'tn-actions' }, shuffleBtn, this.nextBtn, backBtn),
    );
    this.root.append(backButton(() => this.back()));
    this.setCount(this.count, false);
  }

  private setCount(n: number, sound = true) {
    this.count = n;
    if (sound) audio.sfx('cursor');
    this.chipsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.n === String(n)));
    this.renderList();
  }

  private renderList() {
    const rows = this.entries.slice(0, this.count).map((e, i) => {
      const inp = h('input', { value: e.name, maxLength: NAME_MAX, spellcheck: 'false', autocomplete: 'off', 'aria-label': `Nom du participant ${i + 1}` });
      inp.addEventListener('input', () => (e.name = inp.value));
      inp.addEventListener('keydown', (ev) => {
        // Enter jumps to the next name, Escape leaves the field (then Escape = back)
        if (ev.key === 'Enter') {
          ev.preventDefault();
          const all = [...this.listEl.querySelectorAll('input')];
          const nxt = all[all.indexOf(inp) + 1];
          if (nxt) nxt.focus();
          else this.nextBtn.focus();
        } else if (ev.key === 'Escape') inp.blur();
      });
      inp.addEventListener('blur', () => {
        e.name = cleanName(inp.value, '');
        inp.value = e.name;
      });
      const toggle = h('button', { class: 'tn-toggle' + (e.cpu ? ' cpu' : '') }, e.cpu ? 'CPU' : 'HUMAIN');
      toggle.addEventListener('click', () => {
        e.cpu = !e.cpu;
        toggle.classList.toggle('cpu', e.cpu);
        toggle.textContent = e.cpu ? 'CPU' : 'HUMAIN';
        audio.sfx('cursor');
        this.updateInfo();
      });
      return h('div', { class: 'tn-prow' }, h('span', { class: 'tn-seed' }, String(i + 1)), inp, toggle);
    });
    this.listEl.replaceChildren(...rows);
    // two columns filled top to bottom (seeds 1..8 on the left)
    this.listEl.style.setProperty('--rows', String(Math.ceil(this.count / 2)));
    this.updateInfo();
  }

  private updateInfo() {
    const n = this.count;
    const byes = bracketSize(n) - n;
    const humans = this.entries.slice(0, n).filter((e) => !e.cpu).length;
    const parts = [`${n - 1} combats`, `${humans} humain${humans > 1 ? 's' : ''}, ${n - humans} CPU`];
    if (byes) parts.push(`${byes} exempté${byes > 1 ? 's' : ''} du 1er tour (les premiers de la liste)`);
    this.infoEl.textContent = parts.join(' · ');
  }

  private shuffle() {
    shuffle(this.entries.slice(0, this.count)).forEach((e, i) => (this.entries[i] = e));
    audio.sfx('confirm');
    this.renderList();
  }

  private next() {
    const roster = fullRoster();
    const participants: Participant[] = this.entries.slice(0, this.count).map((e, i) => ({
      name: cleanName(e.name, defaultName(i, roster)),
      cpu: e.cpu,
      fighterId: '',
    }));
    const t = createTournament(participants);
    saveTournament(t);
    audio.sfx('confirm');
    goTournamentPick(t);
  }

  private back() {
    audio.sfx('cancel');
    goMenu();
  }

  /** Keyboard / gamepad: arrows move the focus through the form, confirm presses the focused button. */
  private moveFocus(d: number) {
    const els = [...this.root.querySelectorAll<HTMLElement>('.tn-setup-panel button, .tn-setup-panel input, .tn-actions button')];
    if (!els.length) return;
    const cur = els.indexOf(document.activeElement as HTMLElement);
    const next = cur < 0 ? (d > 0 ? 0 : els.length - 1) : Math.max(0, Math.min(els.length - 1, cur + d));
    els[next].focus();
    audio.sfx('cursor');
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (this.menu) {
        // resume prompt
        if (e.action === 'up') this.menu.move(-1);
        else if (e.action === 'down') this.menu.move(1);
        else if (e.action === 'confirm' || e.action === 'start') this.menu.activate();
        else if (e.action === 'back') this.back();
        if (e.action === 'confirm' || e.action === 'start' || e.action === 'back') return;
        continue;
      }
      if (e.action === 'back') {
        this.back();
        return;
      }
      if (e.action === 'up' || e.action === 'left') this.moveFocus(-1);
      else if (e.action === 'down' || e.action === 'right') this.moveFocus(1);
      else if (e.action === 'confirm' || e.action === 'start') {
        const el = document.activeElement as HTMLElement | null;
        if (el && el.tagName === 'BUTTON' && this.root.contains(el)) el.click();
        else if (!el || el === document.body) this.nextBtn.focus();
      }
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
