import type { Archetype } from '../sim/types';
import { archetypeOf, type FighterDef } from './roster';

/**
 * Character profiles as the screens show them (select screens, help, README).
 * The real numbers live in src/sim/archetypes.ts; the 1–5 ratings below sum them up.
 * Who is what: `archetype` in src/data/roster.ts (lab creations are balanced).
 */
export interface ArchetypeInfo {
  id: Archetype;
  /** badge, e.g. « LOURD » */
  label: string;
  /** one-line summary, e.g. « Fort mais lent » */
  line: string;
  /** the classic characters it is modelled on */
  model: string;
  /** 1–5 ratings */
  stats: { power: number; speed: number; reach: number; defense: number };
  /** badge colour */
  color: string;
  /** special command of the profile (ranged: the projectile) */
  command?: string;
}

export const ARCHETYPE_INFO: Record<Archetype, ArchetypeInfo> = {
  heavy: {
    id: 'heavy',
    label: 'LOURD',
    line: 'Fort mais lent',
    model: 'Zangief, Jack',
    stats: { power: 5, speed: 1, reach: 3, defense: 5 },
    color: '#ff7a3a',
  },
  fast: {
    id: 'fast',
    label: 'RAPIDE',
    line: 'Vif mais fragile',
    model: 'Chun-Li, Cammy',
    stats: { power: 2, speed: 5, reach: 2, defense: 2 },
    color: '#4ae0ff',
  },
  ranged: {
    id: 'ranged',
    label: 'DISTANCE',
    line: 'Te tient à distance',
    model: 'Guile, Dhalsim',
    stats: { power: 3, speed: 2, reach: 5, defense: 3 },
    color: '#c27aff',
    command: 'PROJECTILE : AVANT + POING D',
  },
  balanced: {
    id: 'balanced',
    label: 'ÉQUILIBRÉ',
    line: 'Bon partout',
    model: 'Ryu, Ken',
    stats: { power: 3, speed: 3, reach: 3, defense: 3 },
    color: '#7ee07a',
  },
};

/** Stat names in display order. */
export const STAT_LABELS: [keyof ArchetypeInfo['stats'], string][] = [
  ['power', 'PUISSANCE'],
  ['speed', 'VITESSE'],
  ['reach', 'PORTÉE'],
  ['defense', 'DÉFENSE'],
];

/** Order used by the help screen / README. */
export const ARCHETYPE_ORDER: Archetype[] = ['heavy', 'fast', 'ranged', 'balanced'];

export function archetypeInfo(def: FighterDef): ArchetypeInfo {
  return ARCHETYPE_INFO[archetypeOf(def)];
}
