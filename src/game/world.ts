import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { SfxId } from '../audio/types';
import type { FighterDef } from '../data/roster';
import { Effects } from '../render/effects';
import { loadFace, type FaceAssets } from '../render/faceTexture';
import { FighterView } from '../render/fighterView';
import { PS1Globals } from '../render/ps1Material';
import { getStage } from '../render/stages';
import type { StageEnv } from '../render/stages/types';
import type { RetroPipeline } from '../render/pipeline';
import { INTRO_SPLIT, type GameState, type SimEvent } from '../sim/types';

export interface WorldEventHooks {
  onEvent?(ev: SimEvent, s: GameState): void;
}

function altCostume(def: FighterDef): FighterDef {
  const shift = (hex: string, dh: number, dl = 0) => {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    // greys/whites become a strong colour, colours get a hue rotation
    if (hsl.s < 0.15) return '#' + new THREE.Color().setHSL(0.0, 0.65, Math.min(0.45, Math.max(0.25, hsl.l * 0.6))).getHexString();
    return '#' + new THREE.Color().setHSL((hsl.h + dh) % 1, hsl.s, Math.min(0.9, Math.max(0.08, hsl.l + dl))).getHexString();
  };
  const o = def.outfit;
  return {
    ...def,
    outfit: { ...o, topColor: shift(o.topColor, 0.5), trimColor: shift(o.trimColor, 0.45, 0.1), pantsColor: shift(o.pantsColor, 0.35, -0.05) },
  };
}

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

/**
 * Everything visual about a match: stage, fighters, effects, cinematic camera.
 * Driven by the (deterministic) GameState, it never modifies it.
 */
export class FightWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 420);
  readonly effects = new Effects();
  readonly views: [FighterView, FighterView];
  private camPos = new THREE.Vector3(0, 2.4, 10);
  private camLook = new THREE.Vector3(0, 1, 0);
  private shake = 0;
  private superCam = 0;
  private superWho = 0;
  private time = 0;
  private stageTime = 0;
  private played = new Map<string, number>();
  sound = true;
  /** cinematic camera wobble for the attract mode */
  attract = false;

  private constructor(
    readonly stage: StageEnv,
    readonly faces: [FaceAssets, FaceAssets],
    readonly defs: [FighterDef, FighterDef],
  ) {
    this.views = [new FighterView(defs[0], faces[0]), new FighterView(defs[1], faces[1])];
    this.scene.add(stage.group, this.effects.group);
    for (const v of this.views) v.addTo(this.scene);
  }

  static async create(p1: FighterDef, p2: FighterDef, stageId: string): Promise<FightWorld> {
    // mirror match: second player gets alternate clothes colours
    if (p1.id === p2.id) p2 = altCostume(p2);
    const [f1, f2] = await Promise.all([loadFace(p1), loadFace(p2)]);
    const stage = getStage(stageId).build();
    return new FightWorld(stage, [f1, f2], [p1, p2]);
  }

  applyLighting() {
    const s = this.stage;
    PS1Globals.uLightDir.value.copy(s.lightDir).normalize();
    PS1Globals.uLightColor.value.copy(s.lightColor);
    PS1Globals.uAmbient.value.copy(s.ambient);
    PS1Globals.uFogColor.value.copy(s.fogColor);
    PS1Globals.uFogNear.value = s.fogNear;
    PS1Globals.uFogFar.value = s.fogFar;
  }

  /** Feed simulation events (deduplicated: rollbacks can replay frames). */
  handleEvents(list: { frame: number; ev: SimEvent }[], s: GameState, hooks?: WorldEventHooks) {
    for (const { frame, ev } of list) {
      const key = frame + ':' + ev.t + ':' + ('p' in ev ? ev.p : '');
      if (this.played.has(key)) continue;
      this.played.set(key, frame);
      this.onEvent(ev, s);
      hooks?.onEvent?.(ev, s);
    }
    if (this.played.size > 600) {
      for (const [k, f] of this.played) if (f < s.frame - 300) this.played.delete(k);
    }
  }

  private sfx(id: SfxId, x = 0, volume = 1) {
    if (!this.sound) return;
    audio.sfx(id, { pan: Math.max(-1, Math.min(1, (x - this.camLook.x) / 4)), volume });
  }

  private onEvent(ev: SimEvent, s: GameState) {
    switch (ev.t) {
      case 'hit': {
        this.effects.hit(ev.x, ev.y, ev.strength, ev.counter);
        this.sfx(ev.strength === 'heavy' ? 'hitHeavy' : ev.strength === 'medium' ? 'hitMedium' : 'hitLight', ev.x);
        this.views[1 - ev.p].hitFlash(ev.counter ? 0xff3030 : 0xffffff, ev.strength === 'heavy' ? 0.85 : 0.6);
        this.shake = Math.max(this.shake, ev.strength === 'heavy' ? 0.09 : ev.strength === 'medium' ? 0.04 : 0.015);
        break;
      }
      case 'block':
        this.effects.block(ev.x, ev.y);
        this.sfx('block', ev.x);
        break;
      case 'whiff':
        this.sfx(ev.heavy ? 'whiffHeavy' : 'whiff', s.fighters[ev.p].x, 0.7);
        break;
      case 'land':
        this.sfx('land', s.fighters[ev.p].x, 0.6);
        this.effects.dust(s.fighters[ev.p].x);
        break;
      case 'fall':
        this.sfx('fall', s.fighters[ev.p].x);
        this.effects.dust(s.fighters[ev.p].x - s.fighters[ev.p].facing * 0.5, true);
        this.shake = Math.max(this.shake, 0.05);
        break;
      case 'throw':
        this.sfx('throw', s.fighters[ev.p].x);
        this.shake = Math.max(this.shake, 0.1);
        break;
      case 'throwBreak':
        this.sfx('block', s.fighters[ev.p].x);
        break;
      case 'super':
        this.sfx('super', s.fighters[ev.p].x);
        this.superCam = 40;
        this.superWho = ev.p;
        break;
      case 'ko':
        this.sfx('ko', s.fighters[ev.p].x);
        this.shake = 0.15;
        break;
      default:
        break;
    }
  }

  /**
   * @param dt seconds since last render
   */
  render(pipeline: RetroPipeline, s: GameState, dt: number, aspect: number) {
    const dtFrames = Math.min(4, dt * 60);
    this.time += dt;
    this.stageTime += dt;
    this.stage.update(this.stageTime, dt);
    for (let i = 0; i < 2; i++) this.views[i].sync(s.fighters[i], s.frame, dtFrames, this.time);
    // super aura
    const sw = s.fighters[this.superWho];
    if (this.superCam > 0 || (sw.action === 'attack' && sw.moveId === 'super')) {
      this.views[this.superWho].setGlow(0.25 + 0.15 * Math.sin(this.time * 40));
      this.effects.aura(this.views[this.superWho].root.position);
    } else this.views[this.superWho].setGlow(0);
    this.effects.update(dtFrames);
    this.updateCamera(s, dt, aspect);
    this.applyLighting();
    pipeline.post.uFlash.value = Math.max(0, pipeline.post.uFlash.value - dt * 3);
    pipeline.render(this.scene, this.camera, this.stage.clearColor);
  }

  private faceShot(i: number, out: THREE.Vector3, look: THREE.Vector3, dist: number, sideAngle: number, height = 0) {
    const v = this.views[i];
    v.headWorld(look);
    const facing = v.model.body.scale.x >= 0 ? 1 : -1;
    // the stance turns the chest ~35° toward the camera side (+Z)
    const a = sideAngle;
    out.set(look.x + facing * Math.cos(a) * dist, look.y - 0.05 + height, look.z + Math.sin(a) * dist);
    look.y -= 0.04;
  }

  private updateCamera(s: GameState, dt: number, aspect: number) {
    const [a, b] = s.fighters;
    const targetPos = tmpV;
    const targetLook = tmpV2;
    let snap = 1 - Math.exp(-dt * 6);
    const pf = s.phaseFrame;

    if (this.superCam > 0) {
      this.superCam -= dt * 60;
      this.faceShot(this.superWho, targetPos, targetLook, 1.9, 0.9, 0.0);
      targetLook.y -= 0.35;
      snap = 1 - Math.exp(-dt * 10);
    } else if (s.phase === 'intro') {
      const who = pf < INTRO_SPLIT ? 0 : 1;
      const local = who === 0 ? pf : pf - INTRO_SPLIT;
      const t = Math.min(1, local / INTRO_SPLIT);
      this.faceShot(who, targetPos, targetLook, 2.1 - t * 0.55, 0.75 + t * 0.3, 0.12);
      targetLook.y -= 0.16;
      if (local < 3) {
        this.camPos.copy(targetPos);
        this.camLook.copy(targetLook);
      }
      snap = 1 - Math.exp(-dt * 4);
    } else if (s.phase === 'ko' && pf < 110) {
      const loser = a.koed ? 0 : 1;
      const lx = s.fighters[loser].x;
      const ang = 0.9 + pf * 0.012;
      targetPos.set(lx + Math.cos(ang) * 3.0 * (loser === 0 ? -1 : 1), 0.7 + pf * 0.004, Math.sin(ang) * 3.0);
      targetLook.set(lx, 0.5, 0);
      if (pf < 2) this.camPos.copy(targetPos);
      snap = 1 - Math.exp(-dt * 3);
    } else if ((s.phase === 'roundOver' && pf > 25 && s.roundWinner !== 2) || s.phase === 'matchOver') {
      const w = s.phase === 'matchOver' ? s.matchWinner : s.roundWinner;
      if (w === 0 || w === 1) {
        const tt = s.phase === 'matchOver' ? 1 + Math.sin(this.time * 0.4) * 0.25 : 1;
        this.faceShot(w, targetPos, targetLook, 1.6 * tt, 0.7 + Math.sin(this.time * 0.3) * 0.25, 0.08);
        targetLook.y -= 0.15;
      } else this.gameplayCam(s, targetPos, targetLook);
      snap = 1 - Math.exp(-dt * 3);
    } else if (s.phase === 'roundIntro' && pf < 60) {
      this.gameplayCam(s, targetPos, targetLook);
      const t = 1 - pf / 60;
      targetPos.z += t * t * 6;
      targetPos.y += t * t * 2.2;
      if (pf < 2) {
        this.camPos.copy(targetPos);
        this.camLook.copy(targetLook);
      }
      snap = 1 - Math.exp(-dt * 8);
    } else {
      this.gameplayCam(s, targetPos, targetLook);
      snap = 1 - Math.exp(-dt * 7);
    }

    if (this.attract) {
      targetPos.x += Math.sin(this.time * 0.17) * 1.4;
      targetPos.y += 0.35 + Math.sin(this.time * 0.11) * 0.3;
    }

    this.camPos.lerp(targetPos, snap);
    this.camLook.lerp(targetLook, snap);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 12);
    }
    this.camera.lookAt(this.camLook);
    this.camera.aspect = aspect;
    // keep both fighters visible on narrow (portrait) screens
    this.camera.fov = aspect < 1.2 ? 38 + (1.2 - aspect) * 30 : 38;
    this.camera.updateProjectionMatrix();
    void b;
  }

  private gameplayCam(s: GameState, pos: THREE.Vector3, look: THREE.Vector3) {
    const [a, b] = s.fighters;
    const mid = (a.x + b.x) / 2;
    const sep = Math.abs(a.x - b.x);
    const dist = Math.min(8.5, Math.max(3.7, 2.6 + sep * 0.85));
    const maxY = Math.max(a.y, b.y);
    pos.set(mid, 1.3 + sep * 0.05 + maxY * 0.25, dist);
    look.set(mid, 1.0 + maxY * 0.3, 0);
  }

  dispose() {
    for (const v of this.views) v.dispose();
    this.effects.clear();
    this.stage.dispose();
  }
}
