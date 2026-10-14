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
import { cineTime, getUltimate } from '../sim/ultimates';
import { ultimateOf } from '../data/ultimates';
import { CineDirector, type CineSpeaker } from './cinematic';
import type { MusicId } from '../audio/types';

export interface WorldEventHooks {
  onEvent?(ev: SimEvent, s: GameState): void;
}

/** What the BBL MAX cinematics need from the fight screen (HUD + music). */
export interface WorldCineHooks {
  say(speaker: CineSpeaker, text: string, opts: { pitch?: number; rate?: number; dur: number }): void;
  text(text: string, style: 'boom' | 'punch' | 'caption', dur: number, color?: string): void;
  music(id: MusicId | null): void;
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
  /** current camera segment of the BBL MAX cinematic (-1 = none) */
  private superSeg = -1;
  /** 1 = normal lighting, lower = darkened stage (BBL MAX) */
  private dim = 1;
  private time = 0;
  private stageTime = 0;
  private played = new Map<string, number>();
  sound = true;
  /** cinematic camera wobble for the attract mode */
  attract = false;
  /** BBL MAX cinematics: extra characters, props, dialogue... */
  cine!: CineDirector;
  private pendingFlash: { color: THREE.Color; amount: number } | null = null;
  private fadeSet = false;

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
    const w = new FightWorld(stage, [f1, f2], [p1, p2]);
    w.cine = await CineDirector.create(w.scene, w.effects, w.views, w.defs, w.faces, [
      getUltimate(ultimateOf(p1).script),
      getUltimate(ultimateOf(p2).script),
    ]);
    w.setCineHooks(null);
    return w;
  }

  /** Connects the cinematics' dialogue / big text / music to the screen (null = silent). */
  setCineHooks(h: WorldCineHooks | null) {
    this.cine.hooks = {
      say: (sp, text, o) => h?.say(sp, text, o),
      text: (t, style, dur, color) => h?.text(t, style, dur, color),
      music: (id) => h?.music(id),
      sfx: (id, x, vol, pitch) => this.sfx(id, x, vol ?? 1, pitch ?? 1),
      flash: (color, amount) => {
        this.pendingFlash = { color: new THREE.Color(color), amount };
      },
      shake: (amt) => {
        this.shake = Math.max(this.shake, amt);
      },
    };
  }

  applyLighting() {
    const s = this.stage;
    PS1Globals.uLightDir.value.copy(s.lightDir).normalize();
    PS1Globals.uLightColor.value.copy(s.lightColor).multiplyScalar(this.dim);
    PS1Globals.uAmbient.value.copy(s.ambient).multiplyScalar(0.25 + 0.75 * this.dim);
    PS1Globals.uFogColor.value.copy(s.fogColor).multiplyScalar(this.dim);
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

  private sfx(id: SfxId, x = 0, volume = 1, pitch = 1) {
    if (!this.sound) return;
    audio.sfx(id, { pan: Math.max(-1, Math.min(1, (x - this.camLook.x) / 4)), volume, pitch });
  }

  private onEvent(ev: SimEvent, s: GameState) {
    switch (ev.t) {
      case 'hit': {
        // close-up cinematic cameras: smaller sparks, centred between the fighters
        const cine = s.fighters.some((f) => f.action === 'superCombo');
        const target = this.cine.shown(1 - ev.p);
        const kind = ev.kind ?? 'hit';
        if (kind === 'shot') {
          // bullet: muzzle flash at the shooter's hand, small impact
          const hand = this.cine.bonePos(ev.p, 'handR', tmpV);
          hand.z = Math.max(0, hand.z) + 0.05;
          this.effects.cine('muzzle', hand.clone(), 1);
          this.effects.hit(ev.x, ev.y, 'light', false, 0.3, 0.05);
          this.sfx('gunshot', ev.x, 0.9);
          target.hitFlash(0xffffff, 0.45);
          this.shake = Math.max(this.shake, 0.02);
        } else if (kind === 'boom') {
          this.effects.cine('explosion', new THREE.Vector3(ev.x, ev.y, 0.1), ev.counter ? 1.5 : 1.1);
          this.sfx('explosion', ev.x, ev.counter ? 1 : 0.8);
          target.hitFlash(0xffa040, 0.9);
          this.shake = Math.max(this.shake, ev.counter ? 0.22 : 0.14);
        } else if (kind === 'word') {
          target.hitFlash(ev.counter ? 0xff3030 : 0xffffff, ev.counter ? 0.7 : 0.4);
          this.shake = Math.max(this.shake, ev.counter ? 0.08 : 0.025);
        } else if (kind === 'none') {
          // off screen (blackout): the script plays its own sounds
        } else {
          this.effects.hit(ev.x, ev.y, ev.strength, ev.counter, cine ? 0.45 : 1, cine ? 0.05 : 0.35);
          this.sfx(ev.strength === 'heavy' ? 'hitHeavy' : ev.strength === 'medium' ? 'hitMedium' : 'hitLight', ev.x);
          target.hitFlash(ev.counter ? 0xff3030 : 0xffffff, ev.strength === 'heavy' ? 0.85 : 0.6);
          this.shake = Math.max(this.shake, ev.strength === 'heavy' ? 0.09 : ev.strength === 'medium' ? 0.04 : 0.015);
        }
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
      case 'parry':
        this.effects.parry(ev.x, ev.y);
        this.sfx('block', ev.x, 1, 1.5);
        this.sfx('confirm', ev.x, 0.8, 1.2);
        this.views[ev.p].hitFlash(0x60d8ff, 0.7);
        this.shake = Math.max(this.shake, 0.04);
        break;
      case 'grab':
        this.sfx('whiffHeavy', s.fighters[ev.p].x, 0.8, 0.8);
        break;
      case 'super':
        this.sfx('super', s.fighters[ev.p].x);
        break;
      case 'superCombo':
        this.sfx('super', s.fighters[ev.p].x, 0.8);
        this.shake = 0.12;
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
    this.cine.update(s, dtFrames, this.time);
    // BBL MAX: glowing aura on the fighter, darkened stage
    const sup = s.fighters.findIndex(
      (f) => f.action === 'superFlash' || f.action === 'superCombo' || (f.action === 'attack' && f.moveId === 'super'),
    );
    const glowing = sup >= 0 && (s.fighters[sup].action !== 'superCombo' || cineTime(s.fighters[sup].actionFrame) < 16);
    for (let i = 0; i < 2; i++) this.cine.shown(i).setGlow(i === sup && glowing ? 0.22 + 0.14 * Math.sin(this.time * 40) : 0);
    // aura while powering up / dashing, fading out early in the cinematic so close-ups stay readable
    if (glowing) {
      this.effects.aura(this.views[sup].root.position);
      if (s.fighters[sup].action === 'superFlash') this.effects.aura(this.views[sup].root.position);
    }
    let dimTarget = sup >= 0 ? 0.4 : 1;
    if (sup >= 0 && s.fighters[sup].action === 'superCombo') {
      const u = getUltimate(s.fighters[sup].ult);
      const k = cineTime(s.fighters[sup].actionFrame);
      // story cinematics (dialogue, close-ups) stay brighter after the power-up
      const base = u.cine && k > 20 ? 0.72 : 0.4;
      dimTarget = this.cine.light ?? (k > u.length - 20 ? 1 : base);
    }
    this.dim += (dimTarget - this.dim) * (1 - Math.exp(-dt * 8));
    this.effects.update(dtFrames);
    this.updateCamera(s, dt, aspect);
    this.applyLighting();
    pipeline.post.uFlash.value = Math.max(0, pipeline.post.uFlash.value - dt * 3);
    if (this.pendingFlash) {
      pipeline.post.uFlash.value = Math.max(pipeline.post.uFlash.value, this.pendingFlash.amount);
      pipeline.post.uFlashColor.value.copy(this.pendingFlash.color);
      this.pendingFlash = null;
    } else if (pipeline.post.uFlash.value <= 0) {
      pipeline.post.uFlashColor.value.setRGB(1, 1, 1);
    }
    // cinematic blackouts
    if (this.cine.fade > 0 || this.fadeSet) {
      pipeline.post.uFade.value = this.cine.fade;
      this.fadeSet = this.cine.fade > 0;
    }
    pipeline.render(this.scene, this.camera, this.stage.clearColor);
  }

  private faceShot(i: number | FighterView, out: THREE.Vector3, look: THREE.Vector3, dist: number, sideAngle: number, height = 0) {
    const v = typeof i === 'number' ? this.cine.shown(i) : i;
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

    const sf = s.fighters.findIndex((f) => f.action === 'superFlash');
    const sc = s.fighters.findIndex((f) => f.action === 'superCombo');
    if (sc < 0) this.superSeg = -1;

    if (sf >= 0 && s.fighters[sf].actionFrame < 80) {
      // BBL MAX power-up: slow push-in on the face
      const k = s.fighters[sf].actionFrame;
      const t = Math.min(1, k / 45);
      this.faceShot(sf, targetPos, targetLook, 2.3 - t * t * 1.35, 0.8 + k * 0.005, 0.03);
      targetLook.y -= 0.06 * (1 - t);
      if (k < 2) {
        this.camPos.copy(targetPos);
        this.camLook.copy(targetLook);
      }
      snap = 1 - Math.exp(-dt * 7);
    } else if (sc >= 0) {
      // BBL MAX cinematic combo: hard camera cuts scripted per ultimate
      const A = s.fighters[sc];
      const V = s.fighters[1 - sc];
      const k = cineTime(A.actionFrame);
      const fa = A.facing;
      const mid = (A.x + V.x) / 2;
      const cams = getUltimate(A.ult).cams;
      let seg = 0;
      for (let i = 0; i < cams.length; i++) if (k >= cams[i][0]) seg = i;
      switch (cams[seg]?.[1] ?? 'side') {
        case 'over':
          targetPos.set(A.x - fa * 0.95, A.y + 1.55, 1.5);
          targetLook.set(V.x, V.y + 1.35, 0);
          break;
        case 'front':
          targetPos.set(V.x + fa * 1.45, 0.8, 1.8);
          targetLook.set(A.x, A.y + 1.25, 0);
          break;
        case 'low':
          targetPos.set(mid - fa * 0.4, 0.35, 3.3);
          targetLook.set(mid, 1.4 + Math.max(A.y, V.y) * 0.45, 0);
          break;
        case 'high':
          targetPos.set(mid + fa * 0.6, 2.9, 4.8);
          targetLook.set(V.x, V.y * 0.5 + 0.45, 0);
          break;
        case 'side':
          targetPos.set(mid, 1.25 + Math.max(A.y, V.y) * 0.4, 3.4);
          targetLook.set(mid, 1.05 + Math.max(A.y, V.y) * 0.5, 0);
          break;
        case 'close':
          // from the side rather than over the victim's head (big hair, props)
          this.faceShot(sc, targetPos, targetLook, 1.25, 1.18, 0.02);
          break;
        case 'victim':
          targetPos.set(V.x + fa * 0.35, V.y + 1.45, 1.55);
          targetLook.set(V.x, V.y + 1.2, 0);
          break;
        case 'wide': {
          const sep = Math.abs(A.x - V.x);
          targetPos.set(mid, 2.1, Math.max(7.5, 3 + sep * 0.95));
          targetLook.set(mid, 1.0 + Math.max(A.y, V.y) * 0.4, 0);
          break;
        }
        case 'two':
          targetPos.set(mid - fa * 0.15, 1.45 + Math.max(A.y, V.y) * 0.3, 2.6 + Math.abs(A.x - V.x) * 0.55);
          targetLook.set(mid, 1.3 + Math.max(A.y, V.y) * 0.4, 0);
          break;
        case 'vface':
          this.faceShot(1 - sc, targetPos, targetLook, 1.15, 1.15, 0.02);
          break;
        case 'actor': {
          const act = this.cine.firstActor();
          if (act) this.faceShot(act, targetPos, targetLook, 1.35, 0.95, 0.04);
          else this.faceShot(sc, targetPos, targetLook, 1.25, 0.95, 0.02);
          break;
        }
        case 'hero': {
          // slow low-angle orbit around the attacker
          const t = (k - (cams[seg]?.[0] ?? 0)) * 0.006;
          const hv = this.cine.shown(sc);
          hv.headWorld(targetLook);
          const ang = 1.05 + t;
          targetPos.set(A.x + fa * Math.cos(ang) * 2.1, 0.45, Math.sin(ang) * 2.1);
          targetLook.y -= 0.35;
          break;
        }
      }
      if (seg !== this.superSeg) {
        this.superSeg = seg;
        this.camPos.copy(targetPos);
        this.camLook.copy(targetLook);
      }
      snap = 1 - Math.exp(-dt * 5);
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
    this.cine?.dispose();
    for (const v of this.views) v.dispose();
    this.effects.clear();
    this.stage.dispose();
  }
}
