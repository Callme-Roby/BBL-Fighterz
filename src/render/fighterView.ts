import * as THREE from 'three';
import type { FighterDef } from '../data/roster';
import type { FighterState } from '../sim/types';
import { Animator } from './animator';
import { buildCharacter, type CharacterModel } from './characterModel';
import type { FaceAssets } from './faceTexture';
import { CLIPS } from './poses';
import { ultimateClip } from './ultimatePoses';
import './ults';
import { getUltimate } from '../sim/ultimates';
import { makeCanvasTexture } from './ps1Material';

let shadowTex: THREE.Texture | null = null;
function getShadowTexture() {
  if (!shadowTex) {
    shadowTex = makeCanvasTexture(32, 32, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.65)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }
  return shadowTex;
}

/** Visual representation of one fighter, driven by the simulation state. */
export class FighterView {
  readonly model: CharacterModel;
  readonly animator: Animator;
  readonly shadow: THREE.Mesh;
  private flash = 0;
  private flashColor = new THREE.Color(1, 1, 1);
  private glow = 0;
  private headPos = new THREE.Vector3();

  constructor(
    readonly def: FighterDef,
    face: FaceAssets,
  ) {
    this.model = buildCharacter(def, face);
    this.animator = new Animator(this.model);
    const mat = new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    this.shadow.renderOrder = 1;
  }

  get root() {
    return this.model.root;
  }

  addTo(scene: THREE.Object3D) {
    scene.add(this.model.root, this.shadow);
  }

  hitFlash(color: THREE.ColorRepresentation = 0xffffff, amount = 0.75) {
    this.flash = amount;
    this.flashColor.set(color);
  }

  setGlow(v: number) {
    this.glow = v;
  }

  /** world position of the head (for cameras) */
  headWorld(out = this.headPos): THREE.Vector3 {
    this.model.bones.head.getWorldPosition(out);
    out.y += 0.1;
    return out;
  }

  setFacing(facing: 1 | -1) {
    this.model.body.rotation.y = (facing * Math.PI) / 2;
    const s = this.def.height ?? 1;
    this.model.body.scale.set(facing * s, s, s);
  }

  /** Static presentation (menus): play a clip directly. */
  pose(clip: string, frame: number, dtFrames: number, key = clip) {
    this.animator.update(key, clip, frame, dtFrames, 6);
    this.updateMaterials(dtFrames);
  }

  sync(f: FighterState, simFrame: number, dtFrames: number, time: number) {
    this.model.root.position.set(f.x, f.y, 0);
    this.setFacing(f.facing);
    const start = simFrame - f.actionFrame;
    let clip = 'idle';
    let frame = f.actionFrame;
    let blend = 4;
    let key = f.action + ':' + start;
    switch (f.action) {
      case 'idle':
      case 'walkF':
      case 'walkB':
        clip = f.action;
        frame = time * 60;
        blend = 6;
        break;
      case 'crouch':
        clip = 'crouch';
        blend = 4;
        break;
      case 'guard':
        clip = f.crouching ? 'crouchGuard' : 'guard';
        key = 'guard' + (f.crouching ? 'c' : 's');
        blend = 4;
        break;
      case 'parry':
        clip = 'parry';
        blend = 2;
        break;
      case 'parried':
        clip = 'parried';
        frame = (f.actionFrame / Math.max(1, f.stunTotal)) * CLIPS.parried.length;
        blend = 2;
        break;
      case 'prejump':
      case 'jump':
      case 'land':
      case 'dashF':
      case 'dashB':
        clip = f.action;
        blend = 3;
        break;
      case 'attack':
      case 'airAttack':
        clip = 'move:' + f.moveId;
        key += f.moveId;
        // chained moves start mid-windup: blend a little longer so strings flow
        blend = f.chain > 1 ? 3 : 2;
        break;
      case 'hitstun': {
        clip = f.crouching ? 'crouchHit' : f.hitLevel === 'high' ? 'hitHigh' : f.hitLevel === 'low' ? 'hitLow' : 'hitMid';
        frame = (f.actionFrame / Math.max(1, f.stunTotal)) * CLIPS[clip].length;
        blend = 1;
        break;
      }
      case 'blockstun':
        clip = f.crouching ? 'crouchBlock' : 'block';
        frame = (f.actionFrame / Math.max(1, f.stunTotal)) * CLIPS[clip].length;
        blend = 2;
        break;
      case 'juggle':
        clip = 'juggle';
        blend = 2;
        break;
      case 'knockdown':
      case 'ko':
        clip = 'lying';
        key = 'lying';
        blend = 5;
        break;
      case 'getup':
        clip = 'getup';
        blend = 2;
        break;
      case 'throwing':
      case 'thrown':
      case 'throwBreak':
        clip = f.action;
        blend = 3;
        break;
      case 'superFlash':
        clip = 'superFlash';
        blend = 5;
        break;
      case 'superCombo':
        clip = ultimateClip(f.ult, 'a');
        blend = 2;
        break;
      case 'superVictim':
        clip = ultimateClip(f.ultBy, 'v');
        blend = 2;
        break;
      case 'intro':
        clip = 'intro' + (f.variant % 2);
        break;
      case 'win':
        clip = 'win' + (f.variant % 3);
        blend = 8;
        break;
      case 'lose':
        clip = 'lose';
        blend = 8;
        break;
    }
    this.animator.update(key, clip, frame, dtFrames, blend);

    // blob shadow
    const s = Math.max(0.35, 1 - f.y * 0.35);
    const lying =
      f.action === 'knockdown' ||
      f.action === 'ko' ||
      f.action === 'juggle' ||
      f.action === 'thrown' ||
      (f.action === 'superVictim' && (f.y > 0.3 || f.actionFrame >= getUltimate(f.ultBy).fall));
    this.shadow.position.set(f.x - (lying ? f.facing * 0.5 : 0), 0.015, 0);
    this.shadow.scale.set((lying ? 1.9 : 0.95) * s, 1, 0.75 * s);
    this.updateMaterials(dtFrames);
  }

  private updateMaterials(dtFrames: number) {
    this.flash = Math.max(0, this.flash - dtFrames * 0.12);
    for (const m of this.model.materials) {
      if (this.flash > 0) {
        m.uniforms.uFlash.value = this.flash;
        m.uniforms.uFlashColor.value.copy(this.flashColor);
      } else if (this.glow > 0) {
        m.uniforms.uFlash.value = this.glow;
        m.uniforms.uFlashColor.value.setRGB(1, 0.55, 0.1);
      } else {
        m.uniforms.uFlash.value = 0;
      }
    }
  }

  dispose() {
    this.model.root.removeFromParent();
    this.shadow.removeFromParent();
    this.model.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }
}
