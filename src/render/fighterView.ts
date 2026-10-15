import * as THREE from 'three';
import type { FighterDef } from '../data/roster';
import { ARENA_HALF_WIDTH, type FighterState } from '../sim/types';
import { MOVES } from '../sim/moves';
import { Afterimage } from './afterimage';
import { Animator } from './animator';
import { buildCharacter, type CharacterModel } from './characterModel';
import type { FaceAssets } from './faceTexture';
import { CLIPS } from './poses';
import { ultimateClip } from './ultimatePoses';
import './ults';
import { cineTime, getUltimate } from '../sim/ultimates';
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

/** Short visual reactions layered on top of the clips (bounces, the destruction finish). */
export type ViewReaction = 'wall' | 'ground' | 'break';

/** hips height above the feet, pivot of the destruction-finish tumble */
const TUMBLE_PIVOT = 0.95;

/** the sim's special trajectory of an airborne victim (absent in older states) */
function flightOf(f: FighterState): string {
  return (f as { flight?: string }).flight ?? 'none';
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
  /** ghost trails (created on first use) */
  private trail: Afterimage | null = null;
  private parent: THREE.Object3D | null = null;
  /** current reaction and its age (render frames, 60 fps units) */
  private react: ViewReaction | null = null;
  private reactT = 0;
  /** destruction finish: roll angle of the tumbling body (rad) */
  private tumble = 0;
  /** speed of the simulation (K.O. slow motion < 1): scales the tumble */
  simRate = 1;
  /** edge detection of the sim's once-per-combo flags (works through rollbacks / without events) */
  private prevWallBounced = false;
  private prevGroundBounced = false;
  private prevAction = '';
  private prevActionFrame = 0;
  /** the current juggle started with a bounce (wall: thrown off a wall splat, ground: floor bounce) */
  private bounce: 'wall' | 'ground' | null = null;

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
    this.parent = scene;
    if (this.trail) scene.add(this.trail.group);
  }

  /** Starts a short visual reaction (squash on a bounce, tumble through the wall). */
  reaction(kind: ViewReaction) {
    // the destruction finish is never cut short by a smaller reaction
    if (this.react === 'break' && kind !== 'break') return;
    this.react = kind;
    this.reactT = 0;
  }

  /**
   * Ghost trail: call every frame with a tint to leave afterimages behind
   * (null = none; existing ghosts fade out). `sync` does it on its own from the state.
   */
  updateTrail(tint: THREE.ColorRepresentation | null, dtFrames: number, interval = 3, alpha = 0.5) {
    if (!this.trail) {
      if (tint === null) return;
      this.trail = new Afterimage(this.model);
      this.parent?.add(this.trail.group);
    }
    this.trail.update(tint, dtFrames, interval, alpha);
  }

  /** hide the ghosts right away */
  clearTrail() {
    this.trail?.clear();
  }

  /** show / hide the ghosts without changing them (impact frames) */
  setTrailVisible(v: boolean) {
    if (this.trail) this.trail.group.visible = v;
  }

  /** Builds the ghost trail now and compiles its shaders on the next frame (fight views). */
  prepareTrail() {
    if (!this.trail) {
      this.trail = new Afterimage(this.model);
      this.parent?.add(this.trail.group);
    }
    this.trail.prime();
  }

  /** Ghost colour for the current action (null = no trail). */
  private trailTint(f: FighterState): number | null {
    switch (f.action) {
      case 'dashF':
      case 'dashB':
        return f.actionFrame < 13 ? 0x9fdcff : null;
      case 'airDash':
        return 0x7fe8ff;
      case 'superJump':
        return 0xffe070;
      case 'attack':
      case 'airAttack': {
        const m = f.moveId ? MOVES[f.moveId] : null;
        if (!m) return null;
        if (m.id === 'super') return f.actionFrame <= m.startup + m.active ? 0xffa030 : null;
        if (m.id === 'powerPunch' || m.id === 'knee' || m.id === 'airSmash')
          return f.actionFrame >= m.startup * 0.4 && f.actionFrame <= m.startup + m.active ? 0xff7a50 : null;
        return null;
      }
      case 'throwing':
      case 'thrown':
        return f.actionFrame >= 14 && f.actionFrame <= 36 ? 0xffffff : null;
      case 'juggle':
        // destruction finish flight; spiked toward the floor (airSmash) / sent flying at the wall (heavy ender)
        if (this.react === 'break') return 0xffffff;
        return flightOf(f) === 'spike' || flightOf(f) === 'wall' ? 0xffd0a0 : null;
      default:
        return null;
    }
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

  setFacing(facing: 1 | -1, sx = 1, sy = 1, sz = 1) {
    this.model.body.rotation.y = (facing * Math.PI) / 2;
    const s = this.def.height ?? 1;
    this.model.body.scale.set(facing * s * sx, s * sy, s * sz);
  }

  /** Static presentation (menus): play a clip directly. */
  pose(clip: string, frame: number, dtFrames: number, key = clip) {
    this.animator.update(key, clip, frame, dtFrames, 6);
    this.updateMaterials(dtFrames);
  }

  sync(f: FighterState, simFrame: number, dtFrames: number, time: number) {
    this.model.root.position.set(f.x, f.y, 0);
    // reactions from the state itself (robust to rollbacks and missing events)
    if (f.action !== this.prevAction || f.actionFrame < this.prevActionFrame) this.bounce = null;
    if (f.action === 'wallSplat' && this.prevAction !== 'wallSplat') this.reaction('wall');
    if (f.action === 'juggle' && this.prevAction === 'wallSplat') this.bounce = 'wall';
    if (f.wallBounced && !this.prevWallBounced && f.action !== 'wallSplat') this.reaction('wall');
    if (f.groundBounced && !this.prevGroundBounced) {
      this.reaction('ground');
      this.bounce = 'ground';
    }
    // destruction finish: blown away (the sim's K.O. flight), or already beyond the wall
    if (f.koed && (flightOf(f) === 'ko' || (Math.abs(f.x) > ARENA_HALF_WIDTH + 0.05 && (f.action === 'juggle' || f.y > 0.2)))) this.reaction('break');
    this.prevWallBounced = f.wallBounced;
    this.prevGroundBounced = f.groundBounced;
    this.prevAction = f.action;
    this.prevActionFrame = f.actionFrame;
    if (this.react) {
      this.reactT += dtFrames * (this.react === 'break' ? 1 : this.simRate);
      const end = this.react === 'break' ? 1e9 : 24;
      if (this.reactT > end || (this.react === 'break' && !f.koed)) this.react = null;
    }
    const [sx, sy, sz] = this.squash();
    this.setFacing(f.facing, sx, sy, sz);
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
        if ((f as { dizzy?: boolean }).dizzy) {
          // stun assist: wobbling on the spot
          clip = 'dizzy';
          frame = f.actionFrame;
          blend = 6;
          break;
        }
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
        if (this.react === 'break') {
          clip = 'blownAway';
          frame = this.reactT * this.simRate;
          key = 'break';
          blend = 4;
        } else if (this.bounce === 'ground' && f.actionFrame < CLIPS.groundBounce.length) {
          clip = 'groundBounce';
          key = 'gb';
          blend = 1;
        } else if (this.bounce === 'wall' && f.actionFrame < CLIPS.wallBounce.length) {
          clip = 'wallBounce';
          key = 'wb';
          blend = 2;
        } else if (this.bounce) {
          key = 'juggle:' + this.bounce;
          blend = 4;
        }
        break;
      case 'superJump':
        clip = 'superJump';
        blend = 2;
        break;
      case 'airDash':
        clip = 'airDash';
        blend = 2;
        break;
      case 'wallSplat':
        clip = 'wallSplat';
        blend = 1;
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
        frame = cineTime(f.actionFrame);
        blend = 2;
        break;
      case 'superVictim':
        clip = ultimateClip(f.ultBy, 'v');
        frame = cineTime(f.actionFrame);
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

    // destruction finish: the body tumbles around the hips while flying through the wall,
    // then settles back upright (lying pose) once on the floor
    const root = this.model.root;
    if (this.react === 'break' && (f.action === 'juggle' || f.y > 0.05)) {
      this.tumble += dtFrames * this.simRate * 0.16 * (f.x > 0 ? 1 : -1);
    } else if (this.tumble !== 0) {
      const target = Math.round(this.tumble / (Math.PI * 2)) * Math.PI * 2;
      this.tumble += (target - this.tumble) * Math.min(1, dtFrames * 0.25);
      if (Math.abs(target - this.tumble) < 0.01) this.tumble = 0;
    }
    if (this.tumble !== 0) {
      const a = this.tumble % (Math.PI * 2);
      root.rotation.z = a;
      root.position.x += TUMBLE_PIVOT * Math.sin(a);
      root.position.y += TUMBLE_PIVOT - TUMBLE_PIVOT * Math.cos(a);
    } else if (root.rotation.z !== 0) {
      root.rotation.z = 0;
    }

    // ghost trail
    this.updateTrail(root.visible ? this.trailTint(f) : null, dtFrames);

    // blob shadow
    const s = Math.max(0.35, 1 - f.y * 0.35);
    const lying =
      f.action === 'knockdown' ||
      f.action === 'ko' ||
      f.action === 'juggle' ||
      f.action === 'thrown' ||
      (f.action === 'superVictim' && (f.y > 0.3 || cineTime(f.actionFrame) >= getUltimate(f.ultBy).fall));
    this.shadow.position.set(f.x - (lying ? f.facing * 0.5 : 0), 0.015, 0);
    this.shadow.scale.set((lying ? 1.9 : 0.95) * s, 1, 0.75 * s);
    this.updateMaterials(dtFrames);
  }

  /** squash & stretch of the body (local axes) for the current reaction */
  private squash(): [number, number, number] {
    const t = this.reactT;
    if (this.react === 'ground') {
      // flattened on the floor, stretched on the way up, settles
      if (t < 3) return [1.28, 0.62, 1.28];
      if (t < 12) {
        const k = (t - 3) / 9;
        const sy = 0.62 + (1.14 - 0.62) * Math.sin(k * Math.PI * 0.5);
        const sxz = 1.28 - 0.36 * k;
        return [sxz, sy, sxz];
      }
      if (t < 20) {
        const k = (t - 12) / 8;
        const sy = 1.14 - 0.14 * k;
        return [0.92 + 0.08 * k, sy, 0.92 + 0.08 * k];
      }
    } else if (this.react === 'wall') {
      // flattened against the wall (local Z = toward the opponent = the wall's normal)
      if (t < 4) return [1.12, 1.06, 0.62];
      if (t < 14) {
        const k = (t - 4) / 10;
        return [1.12 - 0.12 * k, 1.06 - 0.06 * k, 0.62 + 0.38 * Math.sin(k * Math.PI * 0.5)];
      }
    }
    return [1, 1, 1];
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
    this.trail?.dispose();
    this.trail = null;
    this.model.root.removeFromParent();
    this.shadow.removeFromParent();
    this.model.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }
}
