import type { FighterDef } from './roster';
import { ULTIMATES } from '../sim/ultimates';

/**
 * Which BBL MAX each fighter uses: `script` = cinematic in src/sim/ultimates.ts,
 * `name` = big title shown during the power-up close-up.
 */
export const FIGHTER_ULTIMATES: Record<string, { script: string; name: string }> = {
  // the crew
  dylan: { script: 'tornado', name: 'TORNADE ROUSSE' },
  clement: { script: 'headbutt', name: 'COUP DE BOULE BARBU' },
  alex: { script: 'curls', name: 'BOUCLES INFERNALES' },
  benji: { script: 'palm', name: 'COUP DU PALMIER' },
  isis: { script: 'afro', name: 'AFRO XXL' },
  enola: { script: 'cold', name: 'SANG-FROID' },
  zia: { script: 'dreads', name: 'REINE DES DREADS' },
  // the neighbourhood
  jacky: { script: 'bbq', name: 'BARBECUE PARTY' },
  secu: { script: 'bouncer', name: 'VIDÉ DU CLUB' },
  papy: { script: 'boxer', name: '40 ANS DE RING' },
  mcgrove: { script: 'micdrop', name: 'MIC DROP' },
  kevin: { script: 'express', name: 'LIVRAISON EXPRESS' },
  bruno: { script: 'burpees', name: 'SÉRIE DE BURPEES' },
  bigmo: { script: 'grove', name: 'GROVE STREET 4 LIFE' },
  mamie: { script: 'handbag', name: 'LE COUP DU SAC À MAIN' },
};

export function ultimateOf(def: FighterDef): { script: string; name: string } {
  const custom = def.ultimate && ULTIMATES[def.ultimate] ? { script: def.ultimate, name: def.ultimateName || 'BBL MAX' } : null;
  return custom ?? FIGHTER_ULTIMATES[def.id] ?? { script: 'rush', name: 'BBL MAX' };
}
