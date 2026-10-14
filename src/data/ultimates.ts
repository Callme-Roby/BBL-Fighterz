import type { FighterDef } from './roster';
import { ULTIMATES } from '../sim/ultimates';

/**
 * Which BBL MAX each fighter uses: `script` = cinematic in src/sim/ultimates.ts,
 * `name` = big title shown during the power-up close-up.
 */
export const FIGHTER_ULTIMATES: Record<string, { script: string; name: string }> = {};

export function ultimateOf(def: FighterDef): { script: string; name: string } {
  const custom = def.ultimate && ULTIMATES[def.ultimate] ? { script: def.ultimate, name: def.ultimateName || 'BBL MAX' } : null;
  return custom ?? FIGHTER_ULTIMATES[def.id] ?? { script: 'rush', name: 'BBL MAX' };
}
