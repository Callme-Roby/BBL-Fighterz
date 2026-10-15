import type { FighterDef } from './roster';
import { ULTIMATES } from '../sim/ultimates';

/**
 * Which BBL MAX each fighter uses: `script` = cinematic in src/sim/ultimates.ts,
 * `name` = big title shown during the power-up close-up.
 */
export const FIGHTER_ULTIMATES: Record<string, { script: string; name: string }> = {
  elies: { script: 'baby', name: 'RETOUR EN ENFANCE' },
  thomas: { script: 'feint', name: 'REGARDE DERRIÈRE TOI !' },
  dylan: { script: 'kneecap', name: 'JAMBES DE FEU' },
  mihai: { script: 'saiyan', name: 'SUPER SAYAN BBL' },
  benji: { script: 'config', name: "C'EST QUOI TA CONFIG ?" },
  alex: { script: 'mignon', name: 'VIENS LÀ MON MIGNON' },
  isis: { script: 'buff', name: 'MUSCLES XXL' },
  zia: { script: 'rap', name: 'RAP CONTENDERS' },
  clement: { script: 'arsenal', name: 'ARSENAL BARBU' },
  enola: { script: 'spider', name: 'SPIDER-POTE' },
  rayan: { script: 'pacifist', name: 'PACIFISTE… OU PAS' },
  billel: { script: 'meta', name: 'LA MÉTA' },
};

export function ultimateOf(def: FighterDef): { script: string; name: string } {
  const custom = def.ultimate && ULTIMATES[def.ultimate] ? { script: def.ultimate, name: def.ultimateName || 'BBL MAX' } : null;
  return custom ?? FIGHTER_ULTIMATES[def.id] ?? { script: 'rush', name: 'BBL MAX' };
}
