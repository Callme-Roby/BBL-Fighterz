/**
 * TOURNOI — bracket screen: the whole single-elimination tree, the next match
 * (with the controls reminder) and the buttons to fight / simulate / abandon.
 */
import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import type { FighterDef } from '../data/roster';
import { fullRoster, settings } from '../game/settings';
import {
  BYE,
  champion,
  clearTournament,
  fighterOf,
  fightSeed,
  humansIn,
  matchTitle,
  recordResult,
  roundName,
  saveTournament,
  simulateCpuMatch,
  stageFor,
  totalMatches,
  type Match,
  type Side,
  type Tournament,
} from '../game/tournament';
import { input } from '../input/input';
import { Showroom } from '../render/showroom';
import { STAGES } from '../render/stages';
import { backButton, h, Menu, uiRoot } from '../ui/dom';
import { goMenu, goTournamentBracket, goTournamentChampion, startFight } from './flow';
import { controlsText, noButtonFocus, portrait } from './tournamentShared';

/**
 * Records the result of match (r, m) and saves. Returns the message to flash
 * on the bracket, or null when the tournament is over (champion crowned).
 */
function applyResult(t: Tournament, r: number, m: number, w: 0 | 1 | 2, simulated: boolean): string | null {
  const x = t.rounds[r]?.[m];
  if (!x || x.a === null || x.b === null || x.a < 0 || x.b < 0) return '';
  const title = matchTitle(t, r, m);
  if (!recordResult(t, r, m, w)) return '';
  saveTournament(t);
  if (champion(t) !== null) return null;
  if (w === 2) return `MATCH NUL : ${title} À REJOUER !`;
  const winner = t.participants[w === 0 ? x.a : x.b];
  const article = /^(FINALE|DEMI)/.test(title) ? 'LA' : 'LE';
  return `${winner.name} REMPORTE ${article} ${title.replace(/ \d+\/\d+$/, '')}${simulated ? ' (SIMULATION)' : ''} !`;
}

export class TournamentBracketScreen implements Screen {
  /** empty studio rendered behind the bracket */
  private showroom = new Showroom();
  private roster: FighterDef[] = fullRoster();
  private root!: HTMLElement;
  private menu: Menu | null = null;
  /** "abandon?" confirmation overlay */
  private confirmEl: HTMLElement | null = null;
  private confirmMenu: Menu | null = null;
  private leaving = false;

  constructor(
    private app: App,
    private t: Tournament,
    private flash?: string,
  ) {}

  enter() {
    audio.playMusic('select');
    this.root = h('div', { class: 'tn-bracket-screen' });
    noButtonFocus(this.root);
    uiRoot().append(this.root);
    if (champion(this.t) !== null) {
      // nothing left to play (should not happen: finished tournaments go to the champion screen)
      goTournamentChampion(this.t);
      return;
    }
    this.render();
  }

  exit() {
    this.leaving = true;
    this.showroom.dispose();
  }

  // ------------------------------------------------------------ rendering
  private render() {
    const t = this.t;
    const head = h(
      'div',
      { class: 'tn-head' },
      h('div', { class: 'h1' }, 'TOURNOI'),
      h('div', { class: 'tn-progress' }, `${t.played} / ${totalMatches(t)} COMBATS · ${t.participants.length} PARTICIPANTS`),
    );
    const bracket = h('div', { class: 'tn-bracket', style: `--rounds:${t.rounds.length}` });
    t.rounds.forEach((round, r) => {
      const body = h('div', { class: 'tn-round-body' });
      round.forEach((m, i) => body.append(h('div', { class: 'tn-slot' + (i % 2 ? ' odd' : ' even') }, this.matchEl(m, r, i))));
      bracket.append(h('div', { class: 'tn-round' + (r === t.rounds.length - 1 ? ' last' : '') + (r === 0 ? ' first' : '') }, h('div', { class: 'tn-round-title' }, roundName(t, r)), body));
    });
    const wrap = h('div', { class: 'tn-bracket-wrap' }, head, bracket);
    this.root.replaceChildren(wrap, this.panel(), backButton(() => this.leave()));
    // keep the next match visible on small screens
    const next = this.root.querySelector('.tn-match.next') as HTMLElement | null;
    requestAnimationFrame(() => next?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
  }

  private matchEl(m: Match, r: number, i: number): HTMLElement {
    const cur = this.t.current;
    const isNext = !!cur && cur.r === r && cur.m === i;
    const cls = ['tn-match'];
    if (isNext) cls.push('next');
    if (m.bye) cls.push('bye');
    else if (m.winner !== null) cls.push('done');
    return h('div', { class: cls.join(' ') }, this.sideEl(m.a, m), this.sideEl(m.b, m));
  }

  private sideEl(s: Side, m: Match): HTMLElement {
    if (s === BYE) return h('div', { class: 'tn-side byeside' }, h('span', { class: 'tn-name' }, '—'));
    if (s === null) return h('div', { class: 'tn-side tbd' }, h('div', { class: 'tn-ph unknown' }, '?'), h('span', { class: 'tn-name' }, '…'));
    const p = this.t.participants[s];
    const def = fighterOf(this.t, s, this.roster);
    const cls = ['tn-side'];
    if (m.winner !== null) cls.push(m.winner === s ? (m.bye ? 'adv' : 'win') : 'lose');
    return h(
      'div',
      { class: cls.join(' '), title: `${p.name} (${def.name})` },
      portrait(def),
      h('div', { class: 'tn-info' }, h('span', { class: 'tn-name' }, p.name), h('span', { class: 'tn-fighter' }, def.name)),
      p.cpu ? h('span', { class: 'tn-cpu' }, 'CPU') : null,
    );
  }

  /** Side panel: flash message, next match, controls, buttons. */
  private panel(): HTMLElement {
    const t = this.t;
    const panel = h('div', { class: 'panel tn-panel' });
    if (this.flash) panel.append(h('div', { class: 'tn-flash' }, this.flash));
    const cur = t.current;
    if (!cur) {
      panel.append(h('div', { class: 'status' }, 'Aucun combat à jouer.'));
      return panel;
    }
    const m = t.rounds[cur.r][cur.m];
    const a = m.a as number;
    const b = m.b as number;
    const pa = t.participants[a];
    const pb = t.participants[b];
    const humans = humansIn(t, m);
    const vsSide = (i: number, side: 'l' | 'r') => {
      const p = t.participants[i];
      const def = fighterOf(t, i, this.roster);
      const tag = p.cpu ? 'CPU' : humans === 2 ? (side === 'l' ? 'J1 · GAUCHE' : 'J2 · DROITE') : 'HUMAIN';
      return h(
        'div',
        { class: 'tn-vs-side ' + side },
        portrait(def, 'tn-vs-ph'),
        h('div', { class: 'tn-vs-name' }, p.name),
        h('div', { class: 'tn-vs-fighter' }, def.name),
        h('div', { class: 'tn-vs-tag' + (p.cpu ? ' cpu' : '') }, tag),
      );
    };
    panel.append(
      h('div', { class: 'tn-next-k' }, `PROCHAIN COMBAT : ${pa.name} vs ${pb.name}`),
      h('div', { class: 'tn-next-title' }, matchTitle(t, cur.r, cur.m)),
      h('div', { class: 'tn-vs' }, vsSide(a, 'l'), h('div', { class: 'tn-vs-word' }, 'VS'), vsSide(b, 'r')),
      h('div', { class: 'tn-controls' }, ...controlsText(humans).map((l) => h('div', null, l))),
    );
    const items = [{ label: 'COMBATTRE !', sub: humans ? 'Entrée pour lancer le match' : 'Regarder le match', action: () => this.fight() }];
    if (humans === 0) items.push({ label: 'SIMULER', sub: 'Résultat instantané', action: () => this.simulate() });
    items.push({ label: 'ABANDONNER LE TOURNOI', sub: 'Le tournoi sera effacé', action: () => this.askAbandon() });
    this.menu = new Menu(items, () => audio.sfx('cursor'));
    panel.append(this.menu.el, h('div', { class: 'tn-saved' }, 'Sauvegarde automatique · Échap = menu principal'));
    return panel;
  }

  // ------------------------------------------------------------ actions
  private fight() {
    const t = this.t;
    const cur = t.current;
    if (!cur || this.leaving) return;
    const { r, m } = cur;
    const x = t.rounds[r][m];
    const a = x.a as number;
    const b = x.b as number;
    const pa = t.participants[a];
    const pb = t.participants[b];
    audio.sfx('confirm');
    startFight({
      mode: pa.cpu || pb.cpu ? 'cpu' : 'versus',
      p1: fighterOf(t, a, this.roster),
      p2: fighterOf(t, b, this.roster),
      stageId: stageFor(t, STAGES.map((s) => s.id)),
      rounds: settings.rounds,
      difficulty: settings.difficulty,
      seed: fightSeed(t),
      cpuSides: [pa.cpu, pb.cpu],
      tournament: {
        title: matchTitle(t, r, m),
        onResult: (w) => {
          const msg = applyResult(t, r, m, w, false);
          if (msg === null) goTournamentChampion(t);
          else goTournamentBracket(t, msg || undefined);
        },
        onAbort: () => goTournamentBracket(t),
      },
    });
  }

  private simulate() {
    const t = this.t;
    const cur = t.current;
    if (!cur) return;
    const w = simulateCpuMatch(settings.rounds, settings.difficulty);
    audio.sfx('confirm');
    const msg = applyResult(t, cur.r, cur.m, w, true);
    if (msg === null) goTournamentChampion(t);
    else {
      this.flash = msg || undefined;
      this.render();
    }
  }

  private askAbandon() {
    audio.sfx('confirm');
    this.confirmMenu = new Menu(
      [
        { label: 'NON, CONTINUER', action: () => this.closeConfirm() },
        {
          label: 'OUI, ABANDONNER',
          sub: 'Tous les résultats seront perdus',
          action: () => {
            clearTournament();
            audio.sfx('cancel');
            goMenu();
          },
        },
      ],
      () => audio.sfx('cursor'),
    );
    this.confirmEl = h(
      'div',
      { class: 'overlay tn-confirm' },
      h('div', { class: 'h1' }, 'ABANDONNER LE TOURNOI ?'),
      h('div', { class: 'status' }, `${this.t.played} combat${this.t.played > 1 ? 's' : ''} déjà joué${this.t.played > 1 ? 's' : ''}.`),
      this.confirmMenu.el,
    );
    noButtonFocus(this.confirmEl);
    uiRoot().append(this.confirmEl);
  }

  private closeConfirm() {
    audio.sfx('cancel');
    this.confirmEl?.remove();
    this.confirmEl = null;
    this.confirmMenu = null;
  }

  /** Back to the main menu: the tournament stays saved and can be resumed. */
  private leave() {
    audio.sfx('cancel');
    goMenu();
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      const menu = this.confirmMenu ?? this.menu;
      if (e.action === 'back') {
        if (this.confirmMenu) this.closeConfirm();
        else {
          this.leave();
          return;
        }
        continue;
      }
      if (!menu) continue;
      if (e.action === 'up') menu.move(-1);
      else if (e.action === 'down') menu.move(1);
      else if (e.action === 'confirm' || e.action === 'start') {
        menu.activate();
        if (this.leaving) return;
      }
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
