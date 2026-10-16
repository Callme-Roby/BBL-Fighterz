import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { SfxId } from '../audio/types';
import type { FighterDef } from '../data/roster';
import { Effects, type ShotKind } from '../render/effects';
import { loadFace, type FaceAssets } from '../render/faceTexture';
import { FighterView } from '../render/fighterView';
import { PS1Globals } from '../render/ps1Material';
import { getStage } from '../render/stages';
import type { StageEnv } from '../render/stages/types';
import type { RetroPipeline } from '../render/pipeline';
import { AssistView } from '../render/assistView';
import { disposeProp } from '../render/props';
import { ROSTER, archetypeOf } from '../data/roster';
import { ShotVisual, fighterShotKind, wordsOf } from '../render/shots';
import { moveFor } from '../sim/archetypes';
import { ARENA_HALF_WIDTH, INTRO_SPLIT, type FighterState, type GameState, type SimEvent } from '../sim/types';
import { fullRoster } from './settings';
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
  /** HUD name of fighter i (null = the normal one) */
  rename(i: number, name: string | null): void;
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
const tmpV3 = new THREE.Vector3();
const tmpHand = new THREE.Vector3();
const tmpShot = new THREE.Vector3();

/** cameras stay within the floor every stage keeps clear of props (see stages/types.ts) */
const CLEAR_X = 10.8;
/** x of the (invisible) arena wall surface on a side */
const WALL_X = ARENA_HALF_WIDTH + 0.3;
/** a ranged fighter's projectile: frames it takes to leave the hand (visual blend hand -> sim position) */
const SHOT_LEAVE = 5;
/** the grenade's lob: peak height above the sim's straight line (m), reached halfway to the opponent */
const LOB_HEIGHT = 0.36;
/** web strand from Enola's hand to her web ball during the first frames of the flight */
const WEB_STRAND_FRAMES = 14;
/** min rendered frames (60 fps units) between two impact frames (special / plain heavy hits) */
const IMPACT_GAP = 20;
const IMPACT_GAP_HEAVY = 40;
/** a special impact may follow a plain heavy one sooner (air smash -> ground bounce) */
const IMPACT_GAP_AFTER_HEAVY = 16;

function inCinematic(s: GameState): boolean {
  return s.fighters.some((f) => f.action === 'superFlash' || f.action === 'superCombo' || f.action === 'superVictim');
}

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

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

  // ---- hit feel (render only) ----
  /** rendered frames since the match started (60 fps units) */
  private frames = 0;
  private reducedMotion = prefersReducedMotion();
  /** impact frame in progress: frames elapsed (-1 = none), ink / total length */
  private impactT = -1;
  private impactInk = 0;
  private impactLen = 0;
  private impactAt = -1e9;
  private impactTier = 0;
  private impactTint = new THREE.Color();
  private impactPoint = new THREE.Vector3();
  private impactSeed = 0;
  /** radial speed lines: frames left / total, strength, point */
  private linesT = 0;
  private linesMax = 1;
  private linesAmt = 0;
  private linesPoint = new THREE.Vector3();
  /** camera punch-in toward an impact */
  private punchT = 1e9;
  private punchAmt = 0;
  private punchPoint = new THREE.Vector3();
  /** destruction finish: side of the broken wall (0 = none this round) */
  private breakSide = 0;
  /** hard camera cut on the next frame (hidden by the impact frame) */
  private cut = false;
  /** destruction shot: x of the flying fighter last frame (the camera moves along with it) */
  private trackX: number | null = null;
  /** per fighter: dizzy (stun assist) last frame */
  private dizzy = [false, false];
  // ---- assists ----
  private assistViews: [AssistView | null, AssistView | null] = [null, null];
  /** one of every effect, never drawn: keeps their shaders compiled (see prewarm) */
  private warmFx: Effects | null = null;
  /** explicit friend look per side (else resolved from the roster by the state's id) */
  private assistDefs: [FighterDef | null, FighterDef | null] = [null, null];
  // ---- ranged profile: each fighter's own projectile ----
  private shotViews: [ShotVisual | null, ShotVisual | null] = [null, null];
  /** per side: projectile seen last frame, its spawn x, frame, lob length */
  private shotTrack = [
    { on: false, x0: 0, frame: 0, lob: 3, spawnFx: false },
    { on: false, x0: 0, frame: 0, lob: 3, spawnFx: false },
  ];
  /** render frame of the last projectile clash (one shared pop for the two projectiles) */
  private clashAt = -1;

  private constructor(
    readonly stage: StageEnv,
    readonly faces: [FaceAssets, FaceAssets],
    readonly defs: [FighterDef, FighterDef],
    readonly stageId = '',
  ) {
    this.views = [new FighterView(defs[0], faces[0]), new FighterView(defs[1], faces[1])];
    this.scene.add(stage.group, this.effects.group);
    for (const v of this.views) {
      v.addTo(this.scene);
      v.prepareTrail();
    }
  }

  static async create(p1: FighterDef, p2: FighterDef, stageId: string): Promise<FightWorld> {
    // mirror match: second player gets alternate clothes colours
    if (p1.id === p2.id) p2 = altCostume(p2);
    const [f1, f2] = await Promise.all([loadFace(p1), loadFace(p2)]);
    const stage = getStage(stageId).build();
    const w = new FightWorld(stage, [f1, f2], [p1, p2], stageId);
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
      rename: (i, name) => h?.rename(i, name),
      scenery: (visible) => {
        this.stage.group.visible = visible;
      },
    };
  }

  /**
   * Optional: the look of each side's assist friend (e.g. a lab creation received
   * online). Without it the friend is found in the roster by `state.assists[i].id`.
   */
  setAssistDefs(defs: [FighterDef | null, FighterDef | null]) {
    this.assistDefs = defs;
  }

  /** Friend look for side i, built on demand when the state first shows an assist. */
  private assistView(i: number, id: string): AssistView | null {
    const cur = this.assistViews[i];
    if (cur && cur.def.id === id) return cur;
    if (cur && this.assistDefs[i]?.id === id && cur.def === this.assistDefs[i]) return cur;
    cur?.dispose();
    let def = this.assistDefs[i]?.id === id ? this.assistDefs[i]! : fullRoster().find((d) => d.id === id);
    if (!def) {
      // unknown friend (custom fighter of a remote player): any roster look, picked from the id
      let h = 0;
      for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      def = { ...ROSTER[h % ROSTER.length], id };
    }
    // never the exact look of a fighter on screen
    if (def.id === this.defs[0].id || def.id === this.defs[1].id) def = altCostume(def);
    const v = new AssistView(this.scene, this.effects, def);
    v.load().catch(() => {
      /* missing photo: no model, the poofs and projectiles still show */
    });
    this.assistViews[i] = v;
    return v;
  }

  /**
   * Builds now everything the fight may show later (the friends on call, every
   * effect, the cinematics' props) and compiles their shaders / uploads their
   * textures, so that nothing freezes the game the first time it shows up.
   * Called while the VS screen is up (call `setAssistDefs` first).
   */
  async prewarm(pipeline: RetroPipeline): Promise<void> {
    await Promise.all(
      [0, 1].map(async (i) => {
        const def = this.assistDefs[i];
        if (def) await this.assistView(i, def.id)?.prepare();
      }),
    );
    this.warmFx ??= new Effects();
    this.warmFx.sampleAll(this.stageId);
    const samples = this.cine.warmUp();
    const temp = new THREE.Group();
    temp.add(this.warmFx.group, ...samples);
    // projectiles: the ranged fighters' own and the 'beam' friends' (shown for the compile)
    const shotSamples: THREE.Object3D[][] = [];
    for (let i = 0; i < 2; i++) {
      const sv = archetypeOf(this.defs[i]) === 'ranged' ? this.shotView(i) : null;
      shotSamples.push(sv ? sv.warmSamples() : []);
      for (const o of shotSamples[i]) temp.add(o);
    }
    const assistSamples = this.assistViews.map((a) => a?.warmShot() ?? []);
    for (const a of assistSamples) for (const o of a) temp.add(o);
    this.scene.add(temp);
    this.applyLighting();
    try {
      await pipeline.prewarm(this.scene, this.camera);
    } finally {
      this.scene.remove(temp);
      temp.remove(this.warmFx.group);
      for (const o of samples) disposeProp(o);
      for (let i = 0; i < 2; i++) {
        this.shotViews[i]?.endWarm(shotSamples[i]);
        this.assistViews[i]?.endWarmShot(assistSamples[i]);
      }
    }
  }

  /** Look of fighter i's projectile (ranged profile). */
  private shotKind(i: number): ShotKind {
    return fighterShotKind(this.defs[i]);
  }

  /** Fighter i's projectile visual, built on first use (prewarm builds the ranged ones). */
  private shotView(i: number): ShotVisual {
    let sv = this.shotViews[i];
    if (!sv) {
      sv = new ShotVisual(this.scene, this.effects, this.shotKind(i), wordsOf(this.defs[i].id));
      sv.build();
      this.shotViews[i] = sv;
    }
    return sv;
  }

  /** World position of the fist of fighter i's throwing (right) hand. */
  private throwHand(i: number, out: THREE.Vector3): THREE.Vector3 {
    const hand = this.views[i].model.bones.handR;
    hand.updateWorldMatrix(true, false);
    return hand.localToWorld(out.set(0, -0.07, 0.02));
  }

  /**
   * The ranged fighters' projectiles (GameState.projectiles): in the hand during the
   * throw's wind-up, leaving the hand on the release, then following the sim (the grenade
   * lobs over its straight line and comes back down on the opponent).
   */
  private syncShots(s: GameState, dtFrames: number) {
    for (let i = 0; i < 2; i++) {
      const p = s.projectiles?.[i] ?? null;
      const f = s.fighters[i];
      const throwAt = moveFor(f.archetype ?? 'balanced', 'projectile').startup;
      const tr = this.shotTrack[i];
      const winding = !p && f.action === 'attack' && f.moveId === 'projectile' && f.actionFrame >= 2 && f.actionFrame < throwAt;
      if (!p && !winding) {
        tr.on = false;
        tr.spawnFx = false;
        this.shotViews[i]?.hide();
        continue;
      }
      const sv = this.shotView(i);
      const hand = this.throwHand(i, tmpHand);
      if (!p) {
        // held in the hand, growing (energy ball charging, web forming, grenade in the fist)
        tr.on = false;
        const k = Math.min(1, (f.actionFrame - 2) / Math.max(1, throwAt - 4));
        sv.show(hand, f.facing, 0, this.time, dtFrames, null, 0.25 + 0.6 * k, true);
        continue;
      }
      if (!tr.on || p.frame < tr.frame) {
        // a new throw (also after a rollback that moved the spawn)
        tr.on = true;
        tr.x0 = p.x - p.vx * p.frame;
        tr.lob = Math.max(1.6, Math.abs(s.fighters[1 - i].x - tr.x0));
        sv.newWord();
      }
      tr.frame = p.frame;
      const dir = Math.sign(p.vx) || f.facing;
      const dist = Math.abs(p.x - tr.x0);
      const pos = tmpShot.set(p.x, p.y, 0.05);
      if (sv.kind === 'grenade') pos.y += LOB_HEIGHT * Math.sin(Math.PI * Math.min(1, dist / tr.lob));
      // leaves from the hand: blends from the fist to the sim's position over the first frames
      const k = Math.min(1, (p.frame + 1) / SHOT_LEAVE);
      if (k < 1) pos.lerpVectors(hand, pos, k * (2 - k));
      const strand = sv.kind === 'web' && p.frame < WEB_STRAND_FRAMES && f.action === 'attack' ? hand : null;
      // grows to full size over the first frames (the word does not cover the thrower)
      sv.show(pos, dir, dist, this.time, dtFrames, strand, 0.3 + 0.7 * Math.min(1, (p.frame + 1) / 8));
      // the release flash / gust, from the hand as posed on the release
      if (tr.spawnFx) {
        tr.spawnFx = false;
        this.effects.shotSpawn(sv.kind, pos, dir);
      }
    }
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
          // heavy hits get the big burst on top (hitFeel): smaller core spark so they don't blow out
          const layered = !cine && !ev.self && ev.strength === 'heavy';
          this.effects.hit(ev.x, ev.y, ev.strength, ev.counter, cine ? 0.45 : layered ? 0.72 : 1, cine ? 0.05 : 0.35);
          this.sfx(ev.strength === 'heavy' ? 'hitHeavy' : ev.strength === 'medium' ? 'hitMedium' : 'hitLight', ev.x);
          target.hitFlash(ev.counter ? 0xff3030 : 0xffffff, ev.strength === 'heavy' ? 0.85 : 0.6);
          this.shake = Math.max(this.shake, ev.strength === 'heavy' ? 0.09 : ev.strength === 'medium' ? 0.04 : 0.015);
          // hit feel outside the BBL MAX cinematics (they direct their own)
          if (!inCinematic(s) && !ev.self) this.hitFeel(ev, s);
        }
        break;
      }
      case 'wallBounce': {
        const v = s.fighters[ev.p];
        const side = Math.sign(ev.x) || Math.sign(v.x) || 1;
        const y = v.y + 1.0;
        this.effects.wallCrack(side * WALL_X, y, side);
        this.bigHit(side * WALL_X, y, 2, side, false, tmpV2.set(v.x - side * 0.3, y, 0));
        this.sfx('crash', ev.x, 0.55, 0.8);
        this.sfx('bounce', ev.x, 0.9);
        this.views[ev.p].reaction('wall');
        break;
      }
      case 'groundBounce': {
        // the camera was following the air combo: re-frame down on the floor at once
        // (the cut is hidden by the impact frame)
        if (!inCinematic(s) && s.phase === 'fight') {
          const dy = Math.max(0, this.camLook.y - 1.05);
          this.camLook.y -= dy;
          this.camPos.y -= dy;
        }
        this.effects.groundSlam(ev.x);
        this.bigHit(ev.x, 0.35, 2, s.fighters[1 - ev.p].facing, false, tmpV2.set(ev.x, 0.8, 0));
        this.sfx('fall', ev.x, 1, 0.9);
        this.sfx('bounce', ev.x, 1, 0.8);
        this.views[ev.p].reaction('ground');
        break;
      }
      case 'wallBreak': {
        // destruction finish: the K.O.'d fighter crashes through the arena wall
        const v = s.fighters[ev.p];
        const side = Math.sign(ev.x) || Math.sign(v.x) || 1;
        const y = Math.max(0.7, v.y + 0.9);
        this.breakSide = side;
        this.cut = true;
        this.effects.wallBreak(side * WALL_X, y, side, this.stageId);
        this.impactAt = -1e9; // always gets its impact frame
        this.bigHit(side * WALL_X, y, 3, side, false);
        this.sfx('wallBreak', side * WALL_X, 1);
        this.sfx('explosion', side * WALL_X, 0.75, 0.8);
        this.sfx('crash', side * WALL_X, 0.8);
        this.shake = Math.max(this.shake, 0.32);
        this.pendingFlash = { color: new THREE.Color(1, 1, 1), amount: 0.55 };
        this.views[ev.p].reaction('break');
        break;
      }
      case 'superJump': {
        const f = s.fighters[ev.p];
        this.effects.burst(f.x, 0, f.facing, 'superJump');
        this.sfx('superJump', f.x, 0.9);
        break;
      }
      case 'airDash': {
        const f = s.fighters[ev.p];
        this.effects.burst(f.x, f.y, f.facing, 'airDash');
        this.sfx('airDash', f.x, 0.9);
        break;
      }
      case 'assist': {
        const a = s.assists?.[ev.p];
        const x = a ? a.x : s.fighters[ev.p].x;
        this.sfx('poof', x, 0.9);
        this.sfx('dash', x, 0.6, 1.2);
        break;
      }
      case 'assistLeave': {
        const a = s.assists?.[ev.p];
        this.sfx('poof', a ? a.x : s.fighters[ev.p].x, 0.7, 1.15);
        break;
      }
      case 'block': {
        // the sparks turn orange then red as the defender's guard gauge empties
        const d = s.fighters[ev.p];
        const wear = d.action === 'guardCrush' ? 1 : d.guardMax > 0 ? 1 - Math.max(0, d.guard) / d.guardMax : 0;
        this.effects.block(ev.x, ev.y, wear);
        this.sfx('block', ev.x, 1, 1 - 0.18 * wear);
        break;
      }
      case 'guardBreak':
        this.guardBreak(ev, s);
        break;
      case 'projectile': {
        const kind = this.shotKind(ev.p);
        // the release effect waits for the throwing pose (see syncShots)
        this.shotTrack[ev.p].spawnFx = true;
        if (kind === 'grenade') {
          this.sfx('pin', ev.x, 0.7);
          this.sfx('toss', ev.x, 0.9, 0.9);
        } else if (kind === 'web') this.sfx('thwip', ev.x, 1);
        else if (kind === 'words') this.sfx('toss', ev.x, 0.9, 1.2);
        else this.sfx('zap', ev.x, 0.9);
        break;
      }
      case 'projectileEnd':
        this.projectileEnd(ev, s);
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

  /** A ranged fighter's projectile is gone: its own impact (explosion, splat, burst) + sound. */
  private projectileEnd(ev: Extract<SimEvent, { t: 'projectileEnd' }>, s: GameState) {
    const kind = this.shotKind(ev.p);
    const sv = this.shotViews[ev.p];
    // from where it was last drawn (the grenade's lob) when that is close to the sim's point;
    // a clash pops at the meeting point of the two
    const pos = ev.how !== 'clash' && sv?.shown && Math.abs(sv.pos.x - ev.x) < 0.8 ? tmpV.copy(sv.pos) : tmpV.set(ev.x, ev.y, 0.05);
    sv?.hide();
    const how = ev.how;
    // a BBL MAX starting sends the projectiles away: no pop over its close-up
    if (how === 'out' && s.fighters.some((f) => f.action === 'superFlash' || f.action === 'superCombo')) return;
    this.effects.shotImpact(kind, pos, how);
    const vol = how === 'hit' ? 1 : how === 'out' ? 0.45 : 0.75;
    switch (kind) {
      case 'grenade':
        this.sfx('explosion', pos.x, 0.8 * vol);
        this.shake = Math.max(this.shake, how === 'out' ? 0.04 : 0.12);
        if (how === 'hit') this.views[1 - ev.p].hitFlash(0xffa040, 0.8);
        break;
      case 'web':
        if (how !== 'out') this.sfx('splat', pos.x, vol);
        if (how === 'hit') this.views[1 - ev.p].hitFlash(0xffffff, 0.5);
        break;
      case 'words':
        this.sfx(how === 'out' ? 'poof' : 'bonk', pos.x, 0.8 * vol, how === 'block' ? 1.3 : 1.1);
        break;
      case 'energy':
        this.sfx('zap', pos.x, 0.8 * vol, 0.6);
        if (how === 'hit') this.views[1 - ev.p].hitFlash(0x80d8ff, 0.7);
        break;
    }
    if (how === 'clash' && this.clashAt !== this.frames) {
      // both projectiles pop: one shared flash between them
      this.clashAt = this.frames;
      this.effects.shotClash(pos);
      this.sfx('impact', pos.x, 0.55, 1.2);
      this.sfx('block', pos.x, 0.9, 0.8);
      this.shake = Math.max(this.shake, 0.08);
    }
  }

  /** Guard crush: the guard shatters like glass, flash, impact frame, the defender staggers. */
  private guardBreak(ev: Extract<SimEvent, { t: 'guardBreak' }>, s: GameState) {
    const v = s.fighters[ev.p];
    const a = s.fighters[1 - ev.p];
    const dir = Math.sign(v.x - a.x) || -v.facing;
    // in front of the defender's chest, where the guard was
    const x = v.x - dir * 0.3;
    const y = v.y + 1.25;
    this.effects.guardShatter(x, y, dir);
    this.sfx('guardBreak', x, 1);
    this.views[ev.p].hitFlash(0xbfe8ff, 0.95);
    this.pendingFlash = { color: new THREE.Color(0.75, 0.9, 1), amount: 0.32 };
    this.shake = Math.max(this.shake, 0.16);
    if (inCinematic(s)) return;
    this.linesPoint.set(x, y, 0);
    this.linesMax = 16;
    this.linesT = 16;
    this.linesAmt = 0.9;
    // (a light punch-in: the stagger that follows must stay readable)
    this.punch(tmpV2.set(v.x, v.y + 1.1, 0), 0.07);
    this.impactAt = -1e9; // always gets its impact frame
    this.startImpact(tmpV3.set(x, y, 0), 2, tmpV.set(0.35, 0.75, 1));
  }

  /** Impact frames, speed lines, camera punch for a hit, by how big it is. */
  private hitFeel(ev: Extract<SimEvent, { t: 'hit' }>, s: GameState) {
    const victim = s.fighters[1 - ev.p];
    const att = s.fighters[ev.p];
    const dir = Math.sign(victim.x - att.x) || att.facing;
    if (victim.hp <= 0 && victim.koed) {
      this.impactAt = -1e9;
      this.bigHit(ev.x, ev.y, 3, dir, ev.counter);
    } else if (ev.strength === 'heavy') {
      // launcher: the victim leaves the ground fast
      const launched = victim.action === 'juggle' && victim.vy > 0.11 && victim.y < 0.8;
      // spiked to the floor (air smash): the ground bounce right after gets the impact frame
      const spiked = (victim as { flight?: string }).flight === 'spike';
      this.bigHit(ev.x, ev.y, ev.counter || launched ? 2 : 1, dir, ev.counter, undefined, spiked);
    } else if (ev.strength === 'medium') {
      this.punch(tmpV.set(ev.x, ev.y, 0), 0.035);
    }
  }

  /**
   * Big hit: bigger sparks, speed lines, camera punch-in and (rate-limited) an impact frame.
   * tier 1 = heavy hit, 2 = counter / launcher / bounce, 3 = K.O. blow / destruction.
   */
  private bigHit(x: number, y: number, tier: 1 | 2 | 3, dir: number, counter: boolean, focus?: THREE.Vector3, noFrame = false) {
    const p = tmpV3.set(x, y, 0);
    this.effects.impactBurst(x, y, tier, dir, counter);
    this.linesPoint.copy(p);
    this.linesMax = tier === 1 ? 10 : tier === 2 ? 16 : 28;
    this.linesT = this.linesMax;
    this.linesAmt = tier === 1 ? 0.55 : 1;
    // the camera pushes toward the victim's body (`focus`) rather than a wall / the floor
    this.punch(focus ?? p, tier === 1 ? 0.08 : tier === 2 ? 0.15 : 0.22);
    this.shake = Math.max(this.shake, tier === 1 ? 0.1 : tier === 2 ? 0.14 : 0.2);
    if (tier >= 2) this.sfx('impact', x, tier === 3 ? 1 : 0.75);
    if (noFrame) return;
    this.startImpact(p, tier, counter ? tmpV2.set(1, 0.16, 0.1) : tier === 3 ? tmpV2.set(1, 0.62, 0.08) : tmpV2.set(1, 0.36, 0.12));
  }

  /** Impact frame (rate-limited: readable, not a strobe), `tint` as r, g, b. */
  private startImpact(p: THREE.Vector3, tier: 1 | 2 | 3, tint: THREE.Vector3) {
    if (this.reducedMotion) return;
    const gap = tier === 1 ? IMPACT_GAP_HEAVY : this.impactTier <= 1 ? IMPACT_GAP_AFTER_HEAVY : IMPACT_GAP;
    if (this.frames - this.impactAt < gap) return;
    this.impactAt = this.frames;
    this.impactTier = tier;
    this.impactT = 0;
    this.impactInk = 2;
    this.impactLen = tier === 1 ? 2 : tier === 2 ? 4 : 5;
    this.impactPoint.copy(p);
    this.impactSeed = Math.random() * 10;
    this.impactTint.setRGB(tint.x, tint.y, tint.z);
  }

  private punch(p: THREE.Vector3, amount: number) {
    const amt = this.reducedMotion ? amount * 0.4 : amount;
    // a running bigger punch is not replaced by a smaller one
    const cur = this.punchT < 14 ? this.punchAmt * this.punchEnvelope() : 0;
    if (amt < cur) return;
    this.punchAmt = amt;
    this.punchT = 0;
    this.punchPoint.copy(p);
  }

  private punchEnvelope(): number {
    const t = this.punchT;
    return t < 2 ? t / 2 : Math.exp(-(t - 2) / 7);
  }

  /** Post-pass state for the impact frame / speed lines (after the camera moved). */
  private updatePost(pipeline: RetroPipeline, s: GameState, dtFrames: number) {
    const pp = pipeline.post;
    const step = Math.min(1, dtFrames);
    const cine = inCinematic(s);
    this.camera.updateMatrixWorld();
    const toUv = (p: THREE.Vector3, out: THREE.Vector2) => {
      tmpV.copy(p).project(this.camera);
      out.set(Math.min(1.2, Math.max(-0.2, tmpV.x * 0.5 + 0.5)), Math.min(1.2, Math.max(-0.2, tmpV.y * 0.5 + 0.5)));
    };
    const impact = this.impactT >= 0 && !cine && this.impactT < this.impactLen;
    // ghost trails would turn into rows of silhouettes in the impact frame
    for (const v of this.views) v.setTrailVisible(!impact);
    for (const a of this.assistViews) a?.view?.setTrailVisible(!impact);
    if (impact) {
      pp.uImpactMode.value = this.impactT < this.impactInk ? 1 : 2;
      pp.uImpactTint.value.copy(this.impactTint);
      pp.uImpactSeed.value = this.impactSeed + Math.floor(this.impactT / 2) * 1.7;
      toUv(this.impactPoint, pp.uImpactCenter.value);
      this.impactT += step;
    } else {
      this.impactT = -1;
      pp.uImpactMode.value = 0;
    }
    if (this.linesT > 0 && !cine) {
      pp.uLines.value = this.linesAmt * Math.min(1, (this.linesT / this.linesMax) * 1.6);
      pp.uLinesSeed.value = Math.floor(this.frames / 2) % 97;
      toUv(this.linesPoint, pp.uLinesCenter.value);
      this.linesT -= step;
    } else {
      this.linesT = 0;
      pp.uLines.value = 0;
    }
  }

  /**
   * @param dt seconds since last render
   */
  render(pipeline: RetroPipeline, s: GameState, dt: number, aspect: number) {
    const dtFrames = Math.min(4, dt * 60);
    this.time += dt;
    this.stageTime += dt;
    this.frames += dtFrames;
    this.stage.update(this.stageTime, dt);
    // K.O. slow motion (the sim advances every 3rd frame): effects and tumbles follow
    const slow = s.phase === 'ko' && s.phaseFrame < 54;
    this.effects.timeScale = slow ? 0.4 : 1;
    if (s.phase !== 'ko' && s.phase !== 'roundOver') this.breakSide = 0;
    for (let i = 0; i < 2; i++) {
      this.views[i].simRate = slow ? 1 / 3 : 1;
      this.views[i].sync(s.fighters[i], s.frame, dtFrames, this.time);
      // the BBL MAX cinematic cuts away: no ghosts of the dash strike in its shots
      const act = s.fighters[i].action;
      if (act === 'superCombo' || act === 'superVictim') this.views[i].clearTrail();
    }
    // the ranged fighters' projectiles (after the fighters: thrown from the posed hand)
    this.syncShots(s, dtFrames);
    // assists (built the first time the state shows one)
    const assists = s.assists ?? [null, null];
    for (let i = 0; i < 2; i++) {
      const a = assists[i];
      const av = a ? this.assistView(i, a.id) : this.assistViews[i];
      av?.sync(a ?? null, dtFrames, this.time, slow ? 1 / 3 : 1, s.fighters[1 - i].x);
    }
    // stun assist: stars over the dizzy fighter's head
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      const dizzy = f.action === 'hitstun' && !!(f as { dizzy?: boolean }).dizzy;
      if (dizzy && !this.dizzy[i]) {
        const head = this.views[i].headWorld(tmpV).clone();
        head.y += 0.25;
        this.effects.dizzyStars(head, Math.max(0, f.stun) * (slow ? 3 : 1));
      }
      this.dizzy[i] = dizzy;
    }
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
    this.updatePost(pipeline, s, dtFrames);
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
    // narrow (portrait) views get a wider vertical field so the horizontal one does not collapse
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1.2 ? 38 + (1.2 - aspect) * 30 : 38;
    const targetPos = tmpV;
    const targetLook = tmpV2;
    let snap = 1 - Math.exp(-dt * 6);
    const pf = s.phaseFrame;

    const sf = s.fighters.findIndex((f) => f.action === 'superFlash');
    const sc = s.fighters.findIndex((f) => f.action === 'superCombo');
    if (sc < 0) this.superSeg = -1;
    if (s.phase !== 'ko' && s.phase !== 'roundOver') this.trackX = null;

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
          // (portrait views: pulled back just enough to keep both fighters)
          targetPos.set(mid, 1.25 + Math.max(A.y, V.y) * 0.4, Math.max(3.4, this.fitDist(Math.abs(A.x - V.x) / 2 + 0.6)));
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
          targetPos.set(mid, 2.1, Math.max(7.5, 3 + sep * 0.95, this.fitDist(sep / 2 + 0.9)));
          targetLook.set(mid, 1.0 + Math.max(A.y, V.y) * 0.4, 0);
          break;
        }
        case 'two':
          targetPos.set(mid - fa * 0.15, 1.45 + Math.max(A.y, V.y) * 0.3, Math.max(2.6 + Math.abs(A.x - V.x) * 0.55, this.fitDist(Math.abs(A.x - V.x) / 2 + 0.6)));
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
        case 'face':
          // face to face with the attacker (the victim has to stand back)
          this.faceShot(sc, targetPos, targetLook, 1.65, 0.3, -0.02);
          targetLook.y -= 0.12;
          break;
        case 'floor': {
          // looking down at the victim lying on the floor
          const bx = V.x - V.facing * 0.45;
          targetPos.set(bx + fa * 0.35, 2.7, 1.35);
          targetLook.set(bx, 0.12, 0);
          break;
        }
        case 'amid': {
          // full body of the attacker at the scale of the model shown (toddler included)
          const hv = this.cine.shown(sc);
          const hy = hv.headWorld(tmpV3).y;
          const sz = Math.max(0.5, hy / 1.75);
          targetPos.set(A.x + fa * 0.95 * sz, Math.max(0.3, hy * 0.62), 1.05 + 1.25 * sz);
          targetLook.set(A.x + fa * 0.2 * sz, hy * 0.55, 0);
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
      const shot = cams[seg]?.[1];
      if (seg !== this.superSeg) {
        this.superSeg = seg;
        // 'floor' tilts down smoothly from the previous shot instead of cutting
        if (shot !== 'floor') {
          this.camPos.copy(targetPos);
          this.camLook.copy(targetLook);
        }
      }
      snap = 1 - Math.exp(-dt * (shot === 'floor' ? 1.8 : 5));
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
    } else if ((s.phase === 'ko' || (s.phase === 'roundOver' && pf <= 25)) && this.destructionShot(s.fighters[a.koed ? 0 : 1])) {
      // (the whole K.O. phase: the fighters can end up 16 m apart, the normal framing can't follow)
      const L = s.fighters[a.koed ? 0 : 1];
      const side = this.breakSide || Math.sign(L.vx) || Math.sign(L.x) || 1;
      // feed-forward: the camera travels with the fighter (up to ~0.36 m/frame), the lerp only frames
      if (this.trackX !== null) {
        const dx = L.x - this.trackX;
        this.camPos.x += dx;
        this.camLook.x += dx;
      }
      this.trackX = L.x;
      if (this.breakSide === 0) {
        // flying at the wall: side view that keeps the wall ahead of the fighter
        targetPos.set(Math.max(-CLEAR_X, Math.min(CLEAR_X, L.x - side * 1.6)), 1.25 + L.y * 0.4, 4.6);
        targetLook.set(L.x + side * 0.7, 0.95 + L.y * 0.5, 0);
        snap = 1 - Math.exp(-dt * 5);
      } else {
        // through the wall: cut to a low camera ahead of the fighter, who flies at us in
        // slow motion with the debris, the broken arena behind
        // (stages only guarantee a clear floor for |x| <= 11: past it, the camera moves to the front instead)
        const want = L.x + side * 2.5;
        const camX = Math.max(-CLEAR_X, Math.min(CLEAR_X, want));
        targetPos.set(camX, 0.75 + L.y * 0.3, 2.9 + Math.abs(want - camX) * 1.2);
        targetLook.set(L.x - side * 0.2, 0.85 + L.y * 0.55, 0);
        if (this.cut) {
          this.cut = false;
          this.camPos.copy(targetPos);
          this.camLook.copy(targetLook);
        }
        snap = 1 - Math.exp(-dt * 4);
      }
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
      // super jumps rise very fast: catch up quicker when the framing has to move a lot
      const far = Math.abs(targetLook.y - this.camLook.y) + Math.max(0, targetPos.z - this.camPos.z) * 0.5;
      snap = 1 - Math.exp(-dt * (far > 0.35 ? 13 : 7));
    }

    if (this.attract) {
      targetPos.x += Math.sin(this.time * 0.17) * 1.4;
      targetPos.y += 0.35 + Math.sin(this.time * 0.11) * 0.3;
    }

    this.camPos.lerp(targetPos, snap);
    this.camLook.lerp(targetLook, snap);
    this.camera.position.copy(this.camPos);
    // punch-in toward the last big impact (not during the BBL MAX cinematics)
    let look = this.camLook;
    this.punchT += dt * 60;
    if (this.punchT < 40 && sf < 0 && sc < 0) {
      const e = this.punchAmt * this.punchEnvelope();
      this.camera.position.lerp(this.punchPoint, e);
      look = tmpV3.copy(this.camLook).lerp(this.punchPoint, e * 0.4);
    }
    const shakeAmt = this.reducedMotion ? this.shake * 0.4 : this.shake;
    if (shakeAmt > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
    }
    this.shake *= Math.exp(-dt * 12);
    this.camera.lookAt(look);
    this.camera.updateProjectionMatrix();
    void b;
  }

  /** K.O.: is this a destruction finish (through the wall, or about to)? */
  private destructionShot(L: FighterState): boolean {
    if (this.breakSide !== 0) return true;
    if (Math.abs(L.x) > ARENA_HALF_WIDTH + 0.05) return true;
    if ((L as { flight?: string }).flight === 'ko') return true;
    // flying fast toward a nearby wall
    return L.action === 'juggle' && Math.abs(L.x) > ARENA_HALF_WIDTH - 2.2 && Math.sign(L.vx) === Math.sign(L.x) && Math.abs(L.vx) > 0.04;
  }

  /** Distance at which a width of 2 * halfW metres (centred) fills the current horizontal field of view. */
  private fitDist(halfW: number) {
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    return halfW / Math.max(0.05, tanH);
  }

  private gameplayCam(s: GameState, pos: THREE.Vector3, look: THREE.Vector3) {
    const [a, b] = s.fighters;
    // an assist on screen (often behind its caller) stays in the frame too
    let lo = Math.min(a.x, b.x);
    let hi = Math.max(a.x, b.x);
    for (const as of s.assists ?? []) {
      if (as && (as.phase === 'enter' || as.phase === 'attack')) {
        lo = Math.min(lo, as.x);
        hi = Math.max(hi, as.x);
      }
    }
    const mid = (lo + hi) / 2;
    const sep = hi - lo;
    let dist = Math.min(8.5, Math.max(3.7, 2.6 + sep * 0.85));
    // narrow views (portrait phones, 4:3): pull back until both fighters fit, with a margin
    // (half a body + a stretched limb on each side); never changes 16:9 and wider framing
    const fit = this.fitDist(sep / 2 + 0.95);
    if (fit > dist) dist = Math.min(16, fit);
    const maxY = Math.max(a.y, b.y);
    // keep both bodies (feet of the lowest to the head of the highest) in the vertical field:
    // the view rises with jumps, and pulls back for air combos (super jumps go much higher)
    const lowY = Math.min(a.y, b.y);
    const topY = maxY + 2.05;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    if (maxY > 1.2) dist = Math.max(dist, Math.min(14, ((topY - lowY) / 2 + 0.3) / tanV));
    let lookY = Math.max(1.0 + maxY * 0.3, (lowY + topY) / 2 - 0.05);
    // ...but never lose the feet of the lowest one (e.g. the victim bouncing on the floor)
    lookY = Math.max(1.0, Math.min(lookY, lowY + dist * tanV - 0.15));
    pos.set(mid, lookY + 0.3 + sep * 0.05, dist);
    look.set(mid, lookY, 0);
  }

  dispose() {
    this.cine?.dispose();
    for (const v of this.views) v.dispose();
    for (const a of this.assistViews) a?.dispose();
    this.assistViews = [null, null];
    for (const sv of this.shotViews) sv?.dispose();
    this.shotViews = [null, null];
    this.effects.dispose();
    this.warmFx?.dispose();
    this.warmFx = null;
    this.stage.dispose();
  }
}
