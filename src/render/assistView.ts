import * as THREE from 'three';
import { assistOf } from '../data/assists';
import type { FighterDef } from '../data/roster';
import type { AssistState } from '../sim/types';
import type { Effects, ShotKind } from './effects';
import { loadFace } from './faceTexture';
import { FighterView } from './fighterView';
import { ShotVisual, wordsOf } from './shots';

/** height of an assist projectile above the assist's feet (sim: BEAM_Y) */
const SHOT_Y = 1.2;
/** rush assist: the dash runs from this attack frame... (sim: ASSIST_MOVES.rush startup / active) */
const RUSH_DASH_START = 6;
/** ...to this one at the latest */
const RUSH_DASH_END = 36;

/** Symbols floating around a goofy ('stun') assist. */
const STUN_GLYPH: Record<string, 'heart' | 'note' | 'question' | 'exclaim'> = {
  alex: 'heart',
  benji: 'question',
  zia: 'note',
};

/**
 * The friend called with the assist button: a full character model posed from the
 * (rollback-safe) AssistState — enter (poof), signature attack per kind, leave (poof) —
 * plus the projectile of the 'beam' assists. Hidden while the phase is 'off'.
 */
export class AssistView {
  view: FighterView | null = null;
  readonly shotKind: ShotKind;
  private prevPhase: AssistState['phase'] = 'off';
  private lastPos = new THREE.Vector3();
  private shot: ShotVisual | null = null;
  private prevShot = false;
  private shotPos = new THREE.Vector3();
  private handPos = new THREE.Vector3();
  private glyphAcc = 0;
  /** rush: assist frame when the big punch started (-1 = still running) */
  private punchAt = -1;
  private disposed = false;
  private visible = false;

  constructor(
    private scene: THREE.Object3D,
    private effects: Effects,
    readonly def: FighterDef,
  ) {
    this.shotKind = assistOf(def).shot ?? 'words';
  }

  private loading: Promise<void> | null = null;

  /** Loads the face and builds the model (the assist stays invisible until then). */
  load(): Promise<void> {
    this.loading ??= this.build();
    return this.loading;
  }

  /** Model + projectile built ahead of the first call (both hidden). */
  async prepare(): Promise<void> {
    try {
      await this.load();
    } catch {
      /* missing photo: the projectile is still prepared */
    }
    if (!this.disposed && assistOf(this.def).kind === 'beam') this.ensureShot().build();
  }

  private async build(): Promise<void> {
    const face = await loadFace(this.def);
    if (this.disposed) return;
    this.view = new FighterView(this.def, face);
    this.view.addTo(this.scene);
    this.view.model.root.visible = false;
    this.view.shadow.visible = false;
  }

  /**
   * @param oppX x of the opponent (the rush assist throws its punch just before reaching them)
   */
  sync(a: AssistState | null, dtFrames: number, time: number, simRate = 1, oppX = 0) {
    const v = this.view;
    const phase = a?.phase ?? 'off';
    const on = !!a && phase !== 'off';
    if (a && on) this.lastPos.set(a.x, a.y, 0);
    // poofs when popping in / out (also when the model is not loaded yet)
    if (phase !== this.prevPhase) {
      if (this.prevPhase === 'off' && on) this.poof(0.75);
      else if (!on && this.prevPhase !== 'off') this.poof(0.65);
      this.prevPhase = phase;
    }
    this.syncShot(a, dtFrames, time);
    if (!v) return;
    if (!a || !on) {
      if (this.visible) {
        this.visible = false;
        v.model.root.visible = false;
        v.shadow.visible = false;
        v.clearTrail();
      }
      v.updateTrail(null, dtFrames);
      return;
    }
    this.visible = true;
    v.model.root.visible = true;
    v.shadow.visible = true;
    v.root.position.set(a.x, a.y, 0);
    v.setFacing(a.facing);
    let clip = phase === 'enter' ? 'assist:enter' : phase === 'leave' ? 'assist:leave' : 'assist:' + a.kind;
    let frame = a.frame;
    if (phase === 'attack' && a.kind === 'rush' && a.frame > RUSH_DASH_START) {
      // sprint (the sim moves it from frame 7) until close enough, then the big punch
      const dx = (oppX - a.x) * a.facing;
      if (this.punchAt < 0 && (a.hit || dx < 1.7 || a.frame >= RUSH_DASH_END)) this.punchAt = a.frame;
      if (this.punchAt >= 0) {
        clip = 'assist:rushPunch';
        frame = a.frame - this.punchAt;
      } else clip = 'assist:rushRun';
    }
    if (phase !== 'attack') this.punchAt = -1;
    v.pose(clip, frame, dtFrames, clip);
    const sh = Math.max(0.35, 1 - a.y * 0.35);
    v.shadow.position.set(a.x, 0.015, 0);
    v.shadow.scale.set(0.95 * sh, 1, 0.75 * sh);

    // afterimages: entrance, rush, launcher
    let tint: number | null = null;
    if (phase === 'enter' && a.frame < 10) tint = 0xffffff;
    else if (phase === 'attack' && a.kind === 'rush' && a.frame > RUSH_DASH_START && (this.punchAt < 0 || a.frame - this.punchAt < 8)) tint = 0xffa040;
    else if (phase === 'attack' && a.kind === 'launcher' && a.frame >= 5 && a.frame < 16) tint = 0xffe070;
    v.updateTrail(tint, dtFrames, 3, 0.45);

    // goofy assist: floating hearts / notes / question marks
    if (phase === 'attack' && a.kind === 'stun') {
      this.glyphAcc += dtFrames * simRate;
      if (this.glyphAcc >= 12) {
        this.glyphAcc = 0;
        const g = STUN_GLYPH[this.def.id] ?? 'note';
        v.headWorld(this.shotPos);
        this.shotPos.x += a.facing * (0.2 + Math.random() * 0.3);
        this.shotPos.y += 0.1 + Math.random() * 0.2;
        this.effects.glyph(g, this.shotPos, 0.9);
      }
    } else {
      this.glyphAcc = 8;
    }
  }

  private poof(scale: number) {
    const p = this.lastPos.clone();
    p.y += 0.9;
    p.z = 0.15;
    this.effects.cine('poof', p, scale);
  }

  /** the 'beam' assists' projectile (grenade, web, words) */
  private syncShot(a: AssistState | null, dtFrames: number, time: number) {
    const shot = !!a && a.shot;
    if (shot && a) {
      const sv = this.ensureShot();
      // a fresh word for every throw
      if (!this.prevShot) sv.newWord();
      const dist = Math.abs(a.shotX - a.x);
      // a small arc for the grenade, straight for the rest
      const arc = this.shotKind === 'grenade' ? Math.sin(Math.min(Math.PI, dist * 0.55)) * 0.45 : 0;
      this.shotPos.set(a.shotX, a.y + SHOT_Y + arc, 0.05);
      // the web stays tied to the thrower's hand
      let hand: THREE.Vector3 | null = null;
      if (this.shotKind === 'web') {
        hand = this.handPos;
        if (this.view?.model.root.visible) this.view.model.bones.handR.getWorldPosition(hand);
        else hand.set(a.x, a.y + SHOT_Y, 0);
      }
      sv.show(this.shotPos, a.facing, dist, time, dtFrames, hand);
    } else {
      if (this.prevShot) this.effects.shotImpact(this.shotKind, this.shotPos);
      this.shot?.hide();
    }
    this.prevShot = shot;
  }

  private ensureShot(): ShotVisual {
    this.shot ??= new ShotVisual(this.scene, this.effects, this.shotKind, wordsOf(this.def.id));
    return this.shot;
  }

  /** shader warm-up: the projectile shown for one compile (see FightWorld.prewarm) */
  warmShot(): THREE.Object3D[] {
    return assistOf(this.def).kind === 'beam' ? this.ensureShot().warmSamples() : [];
  }

  endWarmShot(samples: THREE.Object3D[]) {
    this.shot?.endWarm(samples);
  }

  dispose() {
    this.disposed = true;
    this.view?.dispose();
    this.view = null;
    this.shot?.dispose();
    this.shot = null;
  }
}
