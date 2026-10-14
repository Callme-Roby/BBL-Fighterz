/**
 * Helpers shared by the tournament screens (setup, picks, bracket, champion).
 * Importing this module also loads the tournament stylesheet.
 */
import '../ui/tournament.css';
import * as THREE from 'three';
import type { FighterDef } from '../data/roster';
import { loadFace } from '../render/faceTexture';
import type { Showroom } from '../render/showroom';
import { h } from '../ui/dom';

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
 * Mouse / touch clicks must not leave buttons focused: a later Enter would
 * then both "click" the focused button natively and fire the screen's own
 * confirm action.
 */
export function noButtonFocus(root: HTMLElement) {
  root.addEventListener('mousedown', (e) => {
    if ((e.target as Element | null)?.closest?.('button')) e.preventDefault();
  });
}

/** Controls reminder for a match, depending on how many humans play it. */
export function controlsText(humans: number): string[] {
  if (humans >= 2)
    return [
      'GAUCHE : ZQSD/WASD + R T F G · E = BBL MAX',
      'DROITE : flèches + I O K L · P = BBL MAX',
      'ou une manette chacun',
    ];
  if (humans === 1) return ['ZQSD/WASD ou flèches · U I J K = poings/pieds · E = BBL MAX', 'ou la manette'];
  return ['Match entre CPU'];
}
