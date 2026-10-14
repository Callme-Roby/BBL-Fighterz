import { keyLabel, P1_KEYS, P2_KEYS, SOLO_KEYS } from '../input/input';
import { h } from '../ui/dom';

const k = (codes: string[]) => codes.map((c) => h('kbd', null, keyLabel(c)));

/** Controls + move list, as a DOM table. */
export function controlsHelp(versus: boolean): HTMLElement {
  const rows: [string, (HTMLElement | string)[]][] = [];
  if (versus) {
    rows.push(['J1 bouger', k([...P1_KEYS.up, ...P1_KEYS.left, ...P1_KEYS.down, ...P1_KEYS.right])]);
    rows.push(['J1 poings / pieds', [...k(P1_KEYS.lp), ' ', ...k(P1_KEYS.rp), ' / ', ...k(P1_KEYS.lk), ' ', ...k(P1_KEYS.rk)]]);
    rows.push(['J1 BBL MAX (jauge pleine)', k(P1_KEYS.super)]);
    rows.push(['J1 garde-parade / saisie', [...k(P1_KEYS.guard), ' / ', ...k(P1_KEYS.grab)]]);
    rows.push(['J2 bouger', k([...P2_KEYS.up, ...P2_KEYS.left, ...P2_KEYS.down, ...P2_KEYS.right])]);
    rows.push(['J2 poings / pieds', [...k([P2_KEYS.lp[0]]), ' ', ...k([P2_KEYS.rp[0]]), ' / ', ...k([P2_KEYS.lk[0]]), ' ', ...k([P2_KEYS.rk[0]])]]);
    rows.push(['J2 BBL MAX (jauge pleine)', k([P2_KEYS.super[0]])]);
    rows.push(['J2 garde-parade / saisie', [...k([P2_KEYS.guard[0]]), ' / ', ...k([P2_KEYS.grab[0]])]]);
  } else {
    rows.push(['Bouger', [...k(['KeyW', 'KeyA', 'KeyS', 'KeyD']), ' ou flèches']]);
    rows.push(['Poing gauche / droit', [...k([SOLO_KEYS.lp[0]]), ' ', ...k([SOLO_KEYS.rp[0]])]]);
    rows.push(['Pied gauche / droit', [...k([SOLO_KEYS.lk[0]]), ' ', ...k([SOLO_KEYS.rk[0]])]]);
    rows.push(['BBL MAX (jauge pleine)', [...k([SOLO_KEYS.super[0]]), ' ou ', ...k([SOLO_KEYS.super[1]])]]);
    rows.push(['Garde / parade', [...k([SOLO_KEYS.guard[0]]), ' ou ', ...k([SOLO_KEYS.guard[1]])]]);
    rows.push(['Saisie', [...k([SOLO_KEYS.grab[0]]), ' ou ', ...k([SOLO_KEYS.grab[1]])]]);
  }
  rows.push(['Manette', ['□ △ = poings · ✕ ○ = pieds · L1 = saisie · L2 = garde/parade · R1 / R2 = BBL MAX']]);
  rows.push(['Garde', ['maintenir GARDE ou ARRIÈRE (debout : hauts et moyens) · + BAS (accroupi : coups bas)']]);
  rows.push(['PARADE', ['taper GARDE juste avant l’impact : l’adversaire est déséquilibré, punis-le !']]);
  rows.push(['Dash', ['avant-avant / arrière-arrière']]);
  rows.push(['Saisie (passe la garde)', ['touche SAISIE ou Poing G + Pied G · se libérer : SAISIE ou poing aussitôt']]);
  rows.push(['Uppercut (lance en l’air)', ['bas + Poing D']]);
  rows.push(['Genou (lance en l’air)', ['avant + Pied G']]);
  rows.push(['Balayette', ['bas + Pied D']]);
  rows.push(['Grosse patate', ['avant + Poing D']]);
  rows.push(['Combos', ['tout coup qui touche s’enchaîne avec le suivant (jusqu’à 6)']]);
  rows.push(['BBL MAX', ['jauge pleine + touche BBL MAX, même en plein combo']]);
  rows.push(['Pause', [...k(['Escape']), ' / Start']]);
  return h(
    'table',
    { class: 'controls-table' },
    ...rows.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, ...b))),
  );
}
