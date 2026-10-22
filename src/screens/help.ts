import { ARCHETYPE_INFO, ARCHETYPE_ORDER } from '../data/archetypes';
import { archetypeOf, ROSTER } from '../data/roster';
import { catalogueOf } from './rosterPages';
import { keyLabel, P1_KEYS, P2_KEYS, SOLO_KEYS } from '../input/input';
import { h } from '../ui/dom';

const k = (codes: string[]) => codes.map((c) => h('kbd', null, keyLabel(c)));

/** Little copy of an on-screen touch button (see #touch in mobile-game.css). */
const tb = (label: string, cls = '') => h('i', { class: 'tbtn ' + cls }, label);

/** Move list shared by every control scheme (directions + attack names). */
function moveRows(touch: boolean): [string, (HTMLElement | string)[]][] {
  const back = touch ? 'stick vers l’arrière' : 'ARRIÈRE';
  return [
    ['Garde', touch ? ['maintenir ', tb('GARDE', 'pill'), ' ou le ', back, ' (debout : hauts et moyens) · + bas (accroupi : coups bas)'] : ['maintenir GARDE ou ARRIÈRE (debout : hauts et moyens) · + BAS (accroupi : coups bas)']],
    ['PARADE', touch ? ['taper ', tb('GARDE', 'pill'), ' juste avant l’impact : l’adversaire est déséquilibré, punis-le !'] : ['taper GARDE juste avant l’impact : l’adversaire est déséquilibré, punis-le !']],
    ['Jauge de garde', ['sous la vie : chaque coup bloqué l’use (les gros plus), elle remonte quand tu ne bloques plus · vide = GARDE BRISÉE : sonné, grand ouvert']],
    ['Dash', [touch ? 'stick avant-avant / arrière-arrière' : 'avant-avant / arrière-arrière']],
    [
      'Saisie (passe la garde)',
      touch
        ? [tb('SAISIE', 'pill'), ' ou ', tb('LP'), ' + ', tb('LK'), ' · + stick arrière = projection arrière · ratée = punissable']
        : ['touche SAISIE ou Poing G + Pied G · + ARRIÈRE = projection arrière · ratée = punissable'],
    ],
    ['Se libérer', ['saisi ? appuie vite (0,2 s) sur SAISIE ou n’importe quelle attaque · impossible de saisir quelqu’un en garde ou qui se relève']],
    ['Uppercut (lance en l’air)', touch ? ['bas + ', tb('RP')] : ['bas + Poing D']],
    ['Genou (lance en l’air)', touch ? ['avant + ', tb('LK')] : ['avant + Pied G']],
    ['Balayette', touch ? ['bas + ', tb('RK')] : ['bas + Pied D']],
    ['Grosse patate', touch ? ['avant + ', tb('RP')] : ['avant + Poing D']],
    ['Projectile (profil DISTANCE)', touch ? ['avant + ', tb('RP'), ' au lieu de la grosse patate · un seul à l’écran'] : ['avant + Poing D au lieu de la grosse patate · un seul à l’écran']],
    ['Combos', ['tout coup qui touche s’enchaîne avec le suivant (jusqu’à 6)']],
    [
      'Enchaînements',
      touch
        ? ['martèle UN bouton sans toucher au stick : ', tb('LP'), ' poings → super saut · ', tb('RP'), ' gros poings → mur · ', tb('LK'), ' pieds rapides → décolle · ', tb('RK'), ' gros pieds → au sol']
        : ['martèle UN bouton sans direction : Poing G = poings → super saut · Poing D = gros poings → mur · Pied G = pieds rapides → décolle · Pied D = gros pieds → au sol'],
    ],
    ['Combinaisons', ['en plein enchaînement, change de bouton : poing → poing = MARTEAU · poing → pied = HACHE (rebond) · pied → poing = UPPERCUT SAUTÉ · pied → pied = TORNADE (mur)']],
    [
      'Combo aérien',
      touch
        ? ['après un lanceur : stick vers le haut = super saut · en l’air : poings / pieds, avant-avant = dash aérien, bas + ', tb('LK'), ' = smash au sol']
        : ['après un lanceur : HAUT = super saut · en l’air : poings / pieds, avant-avant = dash aérien, bas + pied = smash au sol'],
    ],
    [
      'ASSIST',
      touch
        ? [tb('ASSIST', 'pill teal'), ' ton pote débarque, place son attaque et repart · il faut attendre la recharge (bouton grisé)']
        : ['touche ASSIST : ton pote débarque, place son attaque et repart · il faut attendre la recharge'],
    ],
    ['BBL MAX', touch ? ['jauge pleine (le bouton clignote) + ', tb('BBL MAX', 'pill gold'), ', même en plein combo'] : ['jauge pleine + touche BBL MAX, même en plein combo']],
  ];
}

/** The four profiles and who is what (lab creations are balanced), then the training mode. */
function profileRows(): [string, (HTMLElement | string)[]][] {
  const nice = (n: string) => n.charAt(0) + n.slice(1).toLowerCase();
  const rows: [string, (HTMLElement | string)[]][] = ARCHETYPE_ORDER.map((a) => {
    const info = ARCHETYPE_INFO[a];
    const who = ROSTER.filter((d) => archetypeOf(d) === a).map((d) => nice(d.name));
    if (a === 'balanced') who.push('les persos du LABO');
    const what: Record<string, string> = {
      heavy: 'plus de vie, de dégâts et de garde, grosses saisies · lent',
      fast: 'vif, enchaînements plus longs · moins de vie et de dégâts',
      ranged: 'projectile (avant + Poing D) et longs coups · se déplace moins vite',
      balanced: 'bon partout, la référence',
    };
    return [`${info.label} (façon ${info.model.split(',')[0]})`, [`${who.join(', ')} : ${what[a]}`]];
  });
  // second character catalogue (FighterDef.page)
  const pages = Math.max(1, ...catalogueOf(ROSTER).map((p) => p + 1));
  if (pages > 1)
    rows.push([
      'Catalogues de persos',
      [
        `${pages} catalogues à la sélection : flèches ◀ ▶ (ou ${keyLabel('KeyQ')} / ${keyLabel('KeyE')}, Page↑ / Page↓, L1 / R1 à la manette, ou continue au-delà du bord de la grille) · J2 au clavier : ${keyLabel('Slash')} / ${keyLabel('KeyP')} · le « ? » tire au sort parmi tout le monde · les persos du LABO sont dans le dernier`,
      ],
    ]);
  rows.push(['Entraînement', ['menu ENTRAÎNEMENT : mannequin réglable (garde, saut, CPU, enregistrement), vie qui remonte, historique des touches, avantage en frames · Pause = réglages']]);
  return rows;
}

const table = (rows: [string, (HTMLElement | string)[]][], cls = '') =>
  h('table', { class: 'controls-table ' + cls }, ...rows.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, ...b))));

/** The touch controls explained (phones / tablets). */
export function touchControlsHelp(): HTMLElement {
  const rows: [string, (HTMLElement | string)[]][] = [
    ['Stick (à gauche)', ['bouger · haut = sauter · bas = s’accroupir · arrière = se protéger']],
    ['Poings', [tb('LP'), ' poing gauche · ', tb('RP'), ' poing droit']],
    ['Pieds', [tb('LK'), ' pied gauche · ', tb('RK'), ' pied droit']],
    ['BBL MAX', [tb('BBL MAX', 'pill gold'), ' quand la jauge BBL est pleine']],
    ['Assist', [tb('ASSIST', 'pill teal'), ' appelle ton pote (son visage est sur le bouton) · grisé = en recharge']],
    ['Garde / parade', [tb('GARDE', 'pill'), ' maintenir pour se protéger, taper au bon moment pour parer']],
    ['Saisie', [tb('SAISIE', 'pill'), ' attrape l’adversaire, même s’il se protège']],
    ['Pause', [tb('II', 'pill'), ' met le combat en pause']],
  ];
  return h(
    'div',
    { class: 'touch-help' },
    h('div', { class: 'help-h' }, 'COMMANDES TACTILES'),
    table(rows, 'touch'),
    h('div', { class: 'help-h' }, 'TECHNIQUES'),
    table(moveRows(true), 'touch'),
    h('div', { class: 'help-h' }, 'PROFILS'),
    table(profileRows(), 'touch'),
  );
}

/** Controls + move list, as a DOM table (touch = explain the on-screen controls instead of the keys). */
export function controlsHelp(versus: boolean, touch = false): HTMLElement {
  if (touch && !versus) return touchControlsHelp();
  const rows: [string, (HTMLElement | string)[]][] = [];
  if (touch)
    rows.push([
      'J1 (écran tactile)',
      ['stick + boutons à l’écran : ', tb('LP'), ' ', tb('RP'), ' ', tb('LK'), ' ', tb('RK'), ' ', tb('BBL MAX', 'pill gold'), ' ', tb('ASSIST', 'pill teal'), ' ', tb('GARDE', 'pill'), ' ', tb('SAISIE', 'pill')],
    ]);
  if (versus) {
    rows.push(['J1 bouger', k([...P1_KEYS.up, ...P1_KEYS.left, ...P1_KEYS.down, ...P1_KEYS.right])]);
    rows.push(['J1 poings / pieds', [...k(P1_KEYS.lp), ' ', ...k(P1_KEYS.rp), ' / ', ...k(P1_KEYS.lk), ' ', ...k(P1_KEYS.rk)]]);
    rows.push(['J1 BBL MAX (jauge pleine) / assist', [...k(P1_KEYS.super), ' / ', ...k(P1_KEYS.assist)]]);
    rows.push(['J1 garde-parade / saisie', [...k(P1_KEYS.guard), ' / ', ...k(P1_KEYS.grab)]]);
    rows.push(['J2 bouger', k([...P2_KEYS.up, ...P2_KEYS.left, ...P2_KEYS.down, ...P2_KEYS.right])]);
    rows.push(['J2 poings / pieds', [...k([P2_KEYS.lp[0]]), ' ', ...k([P2_KEYS.rp[0]]), ' / ', ...k([P2_KEYS.lk[0]]), ' ', ...k([P2_KEYS.rk[0]])]]);
    rows.push(['J2 BBL MAX (jauge pleine) / assist', [...k([P2_KEYS.super[0]]), ' / ', ...k([P2_KEYS.assist[0]])]]);
    rows.push(['J2 garde-parade / saisie', [...k([P2_KEYS.guard[0]]), ' / ', ...k([P2_KEYS.grab[0]])]]);
  } else {
    rows.push(['Bouger', [...k(['KeyW', 'KeyA', 'KeyS', 'KeyD']), ' ou flèches']]);
    rows.push(['Poing gauche / droit', [...k([SOLO_KEYS.lp[0]]), ' ', ...k([SOLO_KEYS.rp[0]])]]);
    rows.push(['Pied gauche / droit', [...k([SOLO_KEYS.lk[0]]), ' ', ...k([SOLO_KEYS.rk[0]])]]);
    rows.push(['BBL MAX (jauge pleine)', [...k([SOLO_KEYS.super[0]]), ' ou ', ...k([SOLO_KEYS.super[1]])]]);
    rows.push(['Garde / parade', [...k([SOLO_KEYS.guard[0]]), ' ou ', ...k([SOLO_KEYS.guard[1]])]]);
    rows.push(['Saisie', [...k([SOLO_KEYS.grab[0]]), ' ou ', ...k([SOLO_KEYS.grab[1]])]]);
    rows.push(['Assist (ton pote)', [...k([SOLO_KEYS.assist[0]]), ' ou ', ...k([SOLO_KEYS.assist[1]])]]);
  }
  rows.push(['Manette', ['□ △ = poings · ✕ ○ = pieds · L1 = saisie · L2 = garde/parade · R1 = BBL MAX · R2 (ou R3) = ASSIST · stick arcade ou manette non reconnue : OPTIONS → MANETTES & STICKS']]);
  rows.push(...moveRows(false));
  rows.push(['Pause', [...k(['Escape']), ' / Start']]);
  rows.push(...profileRows());
  return table(rows);
}
