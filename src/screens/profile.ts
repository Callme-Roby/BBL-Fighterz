import { archetypeInfo, STAT_LABELS, type ArchetypeInfo } from '../data/archetypes';
import type { FighterDef } from '../data/roster';
import { h } from '../ui/dom';

/** « LOURD » badge in the profile's colour. */
export function profileBadge(info: ArchetypeInfo, cls = ''): HTMLElement {
  return h('span', { class: 'pf-badge ' + cls, style: `--pc:${info.color}` }, info.label);
}

/**
 * Fighter profile shown under the name / title on the select screens:
 * badge + « Fort mais lent · façon Zangief, Jack » + 4 stat bars (1–5) + the special command (ranged).
 * Nothing for the random cell (null).
 */
export function profileBox(def: FighterDef | null): HTMLElement | null {
  if (!def) return null;
  const info = archetypeInfo(def);
  const stats = STAT_LABELS.map(([k, label]) =>
    h(
      'div',
      { class: 'pf-stat' },
      h('span', { class: 'pf-k' }, label),
      h('span', { class: 'pf-bar', 'aria-label': `${label} ${info.stats[k]}/5` }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < info.stats[k] ? 'on' : '' }))),
    ),
  );
  return h(
    'div',
    { class: 'profile', style: `--pc:${info.color}` },
    h('div', { class: 'pf-head' }, profileBadge(info), h('span', { class: 'pf-line' }, info.line, h('small', { class: 'pf-model' }, `façon ${info.model}`))),
    h('div', { class: 'pf-stats' }, ...stats),
    info.command ? h('div', { class: 'pf-cmd' }, info.command) : null,
  );
}
