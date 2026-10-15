/**
 * Helpers shared by the tournament screens (setup, picks, bracket, champion).
 * Importing this module also loads the tournament stylesheet.
 */
import '../ui/tournament.css';
import * as THREE from 'three';
import type { FighterDef } from '../data/roster';
import { BYE, fighterOf, roundName, type Match, type Side, type Tournament } from '../game/tournament';
import { loadFace } from '../render/faceTexture';
import type { Showroom } from '../render/showroom';
import { h, type Menu } from '../ui/dom';

/**
 * Turns the two-slot showroom into a one-fighter studio: slot 0 (and its
 * glowing floor disc) goes to x = 0, the second disc is hidden.
 */
export function centerShowroom(sr: Showroom) {
  sr.positions = [0, 40];
  const discs = sr.scene.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh && Math.abs(o.position.y - 0.01) < 1e-4);
  discs.forEach((d, i) => {
    if (i === 0) d.position.x = 0;
    else d.visible = false;
  });
}

/** Small pixelated face of a fighter (« ? » when unknown). */
export function portrait(def: FighterDef | null, cls = 'tn-ph'): HTMLDivElement {
  const el = h('div', { class: cls });
  if (!def) {
    el.classList.add('unknown');
    el.textContent = '?';
    return el;
  }
  loadFace(def)
    .then((f) => (el.style.backgroundImage = `url(${f.portraitUrl})`))
    .catch(() => el.classList.add('unknown'));
  return el;
}

/**
 * The buttons of the tournament screens are driven by the screen's own menu
 * events (input.menuEvents(): Enter, gamepad A…). So a mouse click must not
 * leave a button focused, and Enter / Space must not also "click" a focused
 * button natively: the action would run twice.
 */
export function guardButtons(root: HTMLElement) {
  root.addEventListener('mousedown', (e) => {
    if ((e.target as Element | null)?.closest?.('button')) e.preventDefault();
  });
  const block = (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement | null)?.tagName === 'BUTTON') e.preventDefault();
  };
  root.addEventListener('keydown', block);
  root.addEventListener('keyup', block);
}

/** Keeps a Menu's selection on the button focused with Tab (Enter then activates that one). */
export function syncMenuFocus(menu: Menu) {
  menu.el.addEventListener('focusin', (e) => {
    const i = [...menu.el.children].indexOf(e.target as Element);
    if (i >= 0) menu.select(i, false);
  });
}

/**
 * Controls reminder for a match, depending on how many humans play it.
 * Chunks never break inside, lines wrap between them.
 */
export function controlsEl(humans: number): HTMLElement {
  const lines: { who?: string; side?: 'l' | 'r'; chunks: string[] }[] =
    humans >= 2
      ? [
          { who: 'GAUCHE :', side: 'l', chunks: ['ZQSD/WASD + R T F G', 'E = BBL MAX'] },
          { who: 'DROITE :', side: 'r', chunks: ['flèches + I O K L', 'P = BBL MAX'] },
          { chunks: ['ou une manette chacun'] },
        ]
      : humans === 1
        ? [{ chunks: ['ZQSD/WASD ou flèches', 'U I J K = poings/pieds', 'E = BBL MAX'] }, { chunks: ['ou la manette'] }]
        : [{ chunks: ['Match entre CPU'] }];
  return h(
    'div',
    // keyboard / gamepad reminder: hidden on touch screens (on-screen controls)
    { class: 'tn-controls kbd-only' },
    ...lines.map((l) =>
      h(
        'div',
        null,
        l.who ? h('span', { class: 'tn-chunk tn-who ' + (l.side ?? '') }, l.who) : null,
        ...l.chunks.flatMap((c, i) => [i ? ' · ' : l.who ? ' ' : '', h('span', { class: 'tn-chunk' }, c)]),
      ),
    ),
  );
}

export interface BracketOptions {
  /** participant index of this browser (online: "TOI") */
  me?: number;
  /** participants currently disconnected (online) */
  offline?: boolean[];
  /** match being played right now (online) */
  live?: { r: number; m: number } | null;
}

/** The whole single-elimination tree (columns of rounds joined by connectors). */
export function bracketTree(t: Tournament, roster: FighterDef[], o: BracketOptions = {}): HTMLElement {
  const sideEl = (s: Side, m: Match): HTMLElement => {
    if (s === BYE) return h('div', { class: 'tn-side byeside' }, h('span', { class: 'tn-name' }, '—'));
    if (s === null) return h('div', { class: 'tn-side tbd' }, h('div', { class: 'tn-ph unknown' }, '?'), h('span', { class: 'tn-name' }, '…'));
    const p = t.participants[s];
    const def = fighterOf(t, s, roster);
    const cls = ['tn-side'];
    if (m.winner !== null) cls.push(m.winner === s ? (m.bye ? 'adv' : 'win') : 'lose');
    if (o.me === s) cls.push('me');
    if (o.offline?.[s]) cls.push('off');
    return h(
      'div',
      { class: cls.join(' '), title: `${p.name} (${def.name})` },
      portrait(def),
      h('div', { class: 'tn-info' }, h('span', { class: 'tn-name' }, p.name), h('span', { class: 'tn-fighter' }, def.name)),
      p.cpu ? h('span', { class: 'tn-cpu' }, 'CPU') : null,
      o.me === s ? h('span', { class: 'tn-you' }, 'TOI') : null,
    );
  };
  const matchEl = (m: Match, r: number, i: number): HTMLElement => {
    const cur = t.current;
    const cls = ['tn-match'];
    if (cur && cur.r === r && cur.m === i) cls.push('next');
    if (o.live && o.live.r === r && o.live.m === i) cls.push('live');
    if (m.bye) cls.push('bye');
    else if (m.winner !== null) cls.push('done');
    return h('div', { class: cls.join(' ') }, sideEl(m.a, m), sideEl(m.b, m));
  };
  const bracket = h('div', { class: 'tn-bracket', style: `--rounds:${t.rounds.length}` });
  t.rounds.forEach((round, r) => {
    const body = h('div', { class: 'tn-round-body' });
    round.forEach((m, i) => body.append(h('div', { class: 'tn-slot' + (i % 2 ? ' odd' : ' even') }, matchEl(m, r, i))));
    bracket.append(
      h(
        'div',
        { class: 'tn-round' + (r === t.rounds.length - 1 ? ' last' : '') + (r === 0 ? ' first' : '') },
        h('div', { class: 'tn-round-title' }, roundName(t, r)),
        body,
      ),
    );
  });
  return bracket;
}
