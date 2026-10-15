import type { AssistKind, AssistSpec } from '../sim/types';
import type { FighterDef } from './roster';

/**
 * ASSISTS — the friend you call with the assist button (chosen before the fight).
 * The simulation only needs the `kind`; the name / line / look are for the screens.
 *  rush     – dashes in and lands a heavy blow (knockdown)
 *  launcher – pops up next to the opponent and launches them (air-combo follow-up)
 *  beam     – throws a projectile across the screen (`shot` = what it looks like)
 *  stun     – a goofy distraction that freezes the opponent for a moment
 */
export interface AssistDef {
  kind: AssistKind;
  /** name of the move, shown when called */
  name: string;
  /** short shout when called */
  line: string;
  /** look of the projectile of a 'beam' assist */
  shot?: 'grenade' | 'web' | 'words';
}

export const ASSISTS: Record<string, AssistDef> = {
  dylan: { kind: 'rush', name: 'CHARGE DU BIDON', line: 'Attention, ça passe !' },
  thomas: { kind: 'rush', name: 'COUP EN TRAÎTRE', line: 'Coucou, derrière toi !' },
  rayan: { kind: 'rush', name: 'CROCHET PACIFISTE', line: 'Désolé, c’est pour la paix.' },
  isis: { kind: 'launcher', name: 'UPPERCUT MUSCLÉ', line: 'Envole-toi !' },
  elies: { kind: 'launcher', name: 'RETOUR À L’ENVOYEUR', line: 'Hop, en l’air !' },
  mihai: { kind: 'launcher', name: 'COUP DE PIED SAYAN', line: 'Trop facile.' },
  clement: { kind: 'beam', name: 'GRENADE BARBUE', line: 'Attrape !', shot: 'grenade' },
  enola: { kind: 'beam', name: 'TOILE DE POTE', line: 'Bouge pas !', shot: 'web' },
  billel: { kind: 'beam', name: 'MOT-CLÉ MÉTA', line: 'Power spike !', shot: 'words' },
  alex: { kind: 'stun', name: 'VIENS LÀ MON MIGNON', line: 'Coucou mon mignon…' },
  benji: { kind: 'stun', name: 'C’EST QUOI TA CONFIG ?', line: 'Au fait, ta config ?' },
  zia: { kind: 'stun', name: 'PUNCHLINE', line: 'T’as le flow d’un PDF !' },
};

const KINDS: AssistKind[] = ['rush', 'launcher', 'beam', 'stun'];

/** Assist of any fighter (lab creations get a kind derived from their id). */
export function assistOf(def: FighterDef): AssistDef {
  const known = ASSISTS[def.id];
  if (known) return known;
  let h = 0;
  for (const c of def.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const kind = KINDS[h % KINDS.length];
  return { kind, name: `${def.name} À LA RESCOUSSE`, line: 'J’arrive !', shot: kind === 'beam' ? 'words' : undefined };
}

/** What the simulation needs for a chosen friend. */
export function assistSpec(def: FighterDef | null | undefined): AssistSpec | null {
  return def ? { id: def.id, kind: assistOf(def).kind } : null;
}
