import { CLIPS, superCombo, superVictim, type Clip } from './poses';

/**
 * Animations of the BBL MAX cinematic combos (one pair per script of
 * `src/sim/ultimates.ts`): `ult:<id>:a` for the attacker, `ult:<id>:v` for the
 * victim. Keys must line up with the script's hit frames.
 *
 * Building blocks (STANCE, CROUCH, AIR, LYING, HIT_HIGH, HIT_MID, ATTACKS,
 * merge…) are exported by `./poses`.
 */

export function registerUltimate(id: string, attacker: Clip, victim: Clip) {
  CLIPS[`ult:${id}:a`] = attacker;
  CLIPS[`ult:${id}:v`] = victim;
}

/** Clip names for a fighter in a cinematic (falls back to the generic rush). */
export function ultimateClip(id: string, role: 'a' | 'v'): string {
  const name = `ult:${id}:${role}`;
  return CLIPS[name] ? name : `ult:rush:${role}`;
}

registerUltimate('rush', superCombo(), superVictim());
