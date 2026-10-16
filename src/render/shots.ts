import * as THREE from 'three';
import { ASSISTS } from '../data/assists';
import type { FighterDef } from '../data/roster';
import { fxTexture, type Effects, type ShotKind } from './effects';
import { buildProjectile, disposeProp } from './props';
import { makeCanvasTexture } from './ps1Material';

/**
 * Projectile visuals shared by the 'beam' assists (AssistView) and the ranged
 * profile's own projectile (FightWorld): Clément's grenade, Enola's web ball,
 * Billel's words, and a generic energy ball for any other ranged fighter.
 */

/** Words thrown by Billel (assist and projectile), one per throw. */
export const SHOT_WORDS: Record<string, string[]> = {
  billel: ['META', 'OP', 'NERF', 'BUFF', 'GG EZ'],
  default: ['BOUM', 'PAF', 'BIM', 'CHEH'],
};

export function wordsOf(id: string): string[] {
  return SHOT_WORDS[id] ?? SHOT_WORDS.default;
}

/** Look of a ranged fighter's own projectile (the friends' signature shots, else an energy ball). */
export function fighterShotKind(def: FighterDef): ShotKind {
  return ASSISTS[def.id]?.shot ?? 'energy';
}

/** word textures, built once (small, kept for the whole session) */
const wordTex = new Map<string, THREE.Texture>();
function wordTexture(word: string): THREE.Texture {
  let t = wordTex.get(word);
  if (!t) {
    t = makeCanvasTexture(96, 32, (ctx, w, h) => {
      ctx.font = 'bold 22px Arial Black, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000';
      ctx.strokeText(word, w / 2, h / 2 + 1);
      ctx.fillStyle = '#ffe040';
      ctx.fillText(word, w / 2, h / 2 + 1);
    });
    wordTex.set(word, t);
  }
  return t;
}

let webTex: THREE.Texture | null = null;
function webBallTexture(): THREE.Texture {
  if (!webTex) {
    webTex = makeCanvasTexture(32, 32, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const web = () => {
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
          ctx.stroke();
        }
        for (const r of [5, 10]) {
          ctx.beginPath();
          for (let i = 0; i <= 8; i++) ctx.lineTo(Math.cos((i * Math.PI) / 4) * r, Math.sin((i * Math.PI) / 4) * r);
          ctx.stroke();
        }
      };
      web();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.4;
      web();
    });
  }
  return webTex;
}

const tmp = new THREE.Vector3();

/**
 * One projectile on screen (hidden when not flying). Built on first use; `warmSamples`
 * gives what the VS-screen prewarm must compile / upload.
 */
export class ShotVisual {
  private obj: THREE.Object3D | null = null;
  private strand: THREE.Mesh | null = null;
  private wordMat: THREE.SpriteMaterial | null = null;
  /** energy ball: blue rim, outer glow, bright middle, spinning core */
  private rim: THREE.Sprite | null = null;
  private glow: THREE.Sprite | null = null;
  private mid: THREE.Sprite | null = null;
  private core: THREE.Sprite | null = null;
  private trailAcc = 0;
  /** last shown position (impact effects start there) */
  readonly pos = new THREE.Vector3();
  shown = false;
  private wordIdx = -1;

  constructor(
    private parent: THREE.Object3D,
    private effects: Effects,
    readonly kind: ShotKind,
    private words: string[] = SHOT_WORDS.default,
    /** grenade size (the assist's and the fighter's are the same prop) */
    private grenadeScale = 2.2,
  ) {}

  /** builds the meshes now (hidden) */
  build(): THREE.Object3D {
    if (this.obj) return this.obj;
    let obj: THREE.Object3D;
    if (this.kind === 'grenade') {
      obj = buildProjectile('grenade');
      obj.scale.setScalar(this.grenadeScale);
    } else if (this.kind === 'web') {
      const mat = new THREE.SpriteMaterial({ map: webBallTexture(), transparent: true, depthWrite: false });
      obj = new THREE.Sprite(mat);
      obj.renderOrder = 9;
      const geo = new THREE.BoxGeometry(0.014, 0.014, 1).translate(0, 0, 0.5);
      this.strand = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf4f4f4 }));
      this.strand.visible = false;
      this.parent.add(this.strand);
    } else if (this.kind === 'words') {
      this.wordMat = new THREE.SpriteMaterial({ map: wordTexture(this.words[0]), transparent: true, depthWrite: false, depthTest: false });
      obj = new THREE.Sprite(this.wordMat);
      obj.renderOrder = 11;
    } else {
      const g = new THREE.Group();
      const sprite = (tex: 'puff' | 'star' | 'ring', color: number, additive: boolean, order: number) => {
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: fxTexture(tex), color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }),
        );
        sp.renderOrder = order;
        g.add(sp);
        return sp;
      };
      this.rim = sprite('ring', 0x2060ff, false, 9);
      this.glow = sprite('puff', 0x2f7cff, true, 9);
      this.mid = sprite('puff', 0xa8e4ff, true, 10);
      this.core = sprite('star', 0xffffff, true, 10);
      obj = g;
    }
    obj.visible = false;
    this.obj = obj;
    this.parent.add(obj);
    return obj;
  }

  /** a fresh word for the next throw (words only) */
  newWord() {
    if (this.kind !== 'words') return;
    this.build();
    // never the same word twice in a row
    let i = Math.floor(Math.random() * this.words.length);
    if (i === this.wordIdx && this.words.length > 1) i = (i + 1) % this.words.length;
    this.wordIdx = i;
    this.wordMat!.map = wordTexture(this.words[i]);
    this.wordMat!.needsUpdate = true;
  }

  /**
   * Places the flying projectile.
   * @param dir   flight direction (+1 / -1)
   * @param dist  distance travelled so far (m)
   * @param hand  world position of the thrower's hand: draws the web strand (null = none)
   * @param size  0..1 growth (in the hand, just thrown), 1 = full size
   * @param held  still in the thrower's hand (no spin, no trail)
   */
  show(pos: THREE.Vector3, dir: number, dist: number, time: number, dtFrames: number, hand: THREE.Vector3 | null = null, size = 1, held = false) {
    const obj = this.build();
    this.shown = true;
    this.pos.copy(pos);
    obj.visible = true;
    obj.position.copy(pos);
    const flying = !held;
    switch (this.kind) {
      case 'grenade':
        obj.rotation.set(0, (dir * Math.PI) / 2, 0);
        if (flying) obj.rotateX(time * 14);
        obj.scale.setScalar(this.grenadeScale * (0.6 + 0.4 * size));
        break;
      case 'words': {
        this.wordMat!.rotation = Math.sin(time * 9) * 0.15;
        const s = (0.75 + Math.sin(time * 14) * 0.05) * (0.35 + 0.65 * size);
        (obj as THREE.Sprite).scale.set(s * 3, s, 1);
        break;
      }
      case 'web':
        (obj as THREE.Sprite).scale.setScalar((0.35 + Math.min(0.25, dist * 0.06)) * (0.4 + 0.6 * size));
        break;
      case 'energy': {
        const pulse = 1 + Math.sin(time * 30) * 0.08;
        const k = 0.3 + 0.7 * size;
        this.rim!.scale.setScalar(0.5 * pulse * k);
        this.glow!.scale.setScalar(0.8 * pulse * k);
        this.mid!.scale.setScalar(0.42 * k);
        this.core!.scale.setScalar(0.3 * k);
        this.core!.material.rotation = time * 8;
        break;
      }
    }
    // the strand from the thrower's hand to the web ball
    if (this.strand) {
      const len = hand ? tmp.copy(pos).sub(hand).length() : 0;
      this.strand.visible = !!hand && len > 0.05;
      if (hand && len > 0.05) {
        this.strand.position.copy(hand);
        this.strand.lookAt(pos);
        this.strand.scale.set(1, 1, len);
      }
    }
    // smoke of the fuse, sparks of the energy ball
    if (flying) {
      this.trailAcc += dtFrames;
      if (this.trailAcc >= 3) {
        this.trailAcc = 0;
        this.effects.shotTrail(this.kind, pos, dir);
      }
    } else this.trailAcc = 2;
  }

  hide() {
    if (!this.shown) return;
    this.shown = false;
    if (this.obj) this.obj.visible = false;
    if (this.strand) this.strand.visible = false;
  }

  /**
   * Shader / texture warm-up: shows the meshes and returns throw-away samples of the
   * rest (every word texture). Call `endWarm` afterwards.
   */
  warmSamples(): THREE.Object3D[] {
    const obj = this.build();
    obj.visible = true;
    if (this.strand) this.strand.visible = true;
    if (this.kind !== 'words') return [];
    return this.words.map((w) => new THREE.Sprite(new THREE.SpriteMaterial({ map: wordTexture(w), transparent: true, depthWrite: false, depthTest: false })));
  }

  /** hides what `warmSamples` showed and frees the samples */
  endWarm(samples: THREE.Object3D[]) {
    this.shown = true;
    this.hide();
    for (const o of samples) {
      o.removeFromParent();
      (o as THREE.Sprite).material.dispose();
    }
  }

  dispose() {
    if (this.obj) {
      this.obj.removeFromParent();
      if (this.kind === 'grenade') disposeProp(this.obj);
      else
        this.obj.traverse((o) => {
          if ((o as THREE.Sprite).isSprite) (o as THREE.Sprite).material.dispose();
        });
    }
    this.obj = null;
    if (this.strand) {
      this.strand.removeFromParent();
      this.strand.geometry.dispose();
      (this.strand.material as THREE.Material).dispose();
      this.strand = null;
    }
  }
}
