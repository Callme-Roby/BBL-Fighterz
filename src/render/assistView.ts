import * as THREE from 'three';
import { assistOf } from '../data/assists';
import type { FighterDef } from '../data/roster';
import type { AssistState } from '../sim/types';
import type { Effects } from './effects';
import { loadFace } from './faceTexture';
import { FighterView } from './fighterView';
import { buildProjectile, disposeProp } from './props';
import { makeCanvasTexture } from './ps1Material';

type ShotKind = 'grenade' | 'web' | 'words';

/** height of an assist projectile above the assist's feet (sim: BEAM_Y) */
const SHOT_Y = 1.2;
/** rush assist: the dash runs from this attack frame... (sim: ASSIST_MOVES.rush startup / active) */
const RUSH_DASH_START = 6;
/** ...to this one at the latest */
const RUSH_DASH_END = 36;

/** Words thrown by a 'words' assist (one per call). */
const WORDS: Record<string, string[]> = {
  billel: ['META', 'OP', 'NERF', 'BUFF', 'GG EZ'],
  default: ['BOUM', 'PAF', 'BIM', 'CHEH'],
};

/** Symbols floating around a goofy ('stun') assist. */
const STUN_GLYPH: Record<string, 'heart' | 'note' | 'question' | 'exclaim'> = {
  alex: 'heart',
  benji: 'question',
  zia: 'note',
};

function wordTexture(word: string): THREE.Texture {
  return makeCanvasTexture(96, 32, (ctx, w, h) => {
    ctx.font = 'bold 22px Arial Black, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.strokeText(word, w / 2, h / 2 + 1);
    ctx.fillStyle = '#ffe040';
    ctx.fillText(word, w / 2, h / 2 + 1);
  });
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
  private shotObj: THREE.Object3D | null = null;
  private strand: THREE.Mesh | null = null;
  private wordMat: THREE.SpriteMaterial | null = null;
  private prevShot = false;
  private shotPos = new THREE.Vector3();
  private trailAcc = 0;
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

  /** Loads the face and builds the model (the assist stays invisible until then). */
  async load(): Promise<void> {
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
      const obj = this.ensureShot();
      const dist = Math.abs(a.shotX - a.x);
      // a small arc for the grenade, straight for the rest
      const arc = this.shotKind === 'grenade' ? Math.sin(Math.min(Math.PI, dist * 0.55)) * 0.45 : 0;
      this.shotPos.set(a.shotX, a.y + SHOT_Y + arc, 0.05);
      obj.visible = true;
      obj.position.copy(this.shotPos);
      if (this.shotKind === 'grenade') {
        obj.rotation.set(0, (a.facing * Math.PI) / 2, 0);
        obj.rotateX(time * 14);
        // smoking fuse
        this.trailAcc += dtFrames;
        if (this.trailAcc >= 3) {
          this.trailAcc = 0;
          this.effects.trail(this.shotPos);
        }
      } else if (this.shotKind === 'words' && this.wordMat) {
        this.wordMat.rotation = Math.sin(time * 9) * 0.15;
        const s = 0.75 + Math.sin(time * 14) * 0.05;
        (obj as THREE.Sprite).scale.set(s * 3, s, 1);
      } else if (this.shotKind === 'web') {
        (obj as THREE.Sprite).scale.setScalar(0.35 + Math.min(0.25, dist * 0.06));
        // the strand from the thrower's hand to the web ball
        if (this.strand && this.view) {
          const hand = this.view.model.bones.handR.getWorldPosition(new THREE.Vector3());
          if (!this.view.model.root.visible) hand.set(a.x, a.y + SHOT_Y, 0);
          const d = this.shotPos.clone().sub(hand);
          const len = d.length();
          this.strand.visible = len > 0.05;
          this.strand.position.copy(hand);
          this.strand.lookAt(this.shotPos);
          this.strand.scale.set(1, 1, len);
        }
      }
    } else {
      if (this.prevShot) this.effects.shotImpact(this.shotKind, this.shotPos);
      if (this.shotObj) this.shotObj.visible = false;
      if (this.strand) this.strand.visible = false;
    }
    // a fresh word for every throw
    if (shot && !this.prevShot && this.shotKind === 'words' && this.wordMat) {
      const list = WORDS[this.def.id] ?? WORDS.default;
      this.wordMat.map?.dispose();
      this.wordMat.map = wordTexture(list[Math.floor(Math.random() * list.length)]);
      this.wordMat.needsUpdate = true;
    }
    this.prevShot = shot;
  }

  private ensureShot(): THREE.Object3D {
    if (this.shotObj) return this.shotObj;
    let obj: THREE.Object3D;
    if (this.shotKind === 'grenade') {
      obj = buildProjectile('grenade');
      obj.scale.setScalar(2.2);
    } else if (this.shotKind === 'web') {
      const mat = new THREE.SpriteMaterial({ map: webBallTexture(), transparent: true, depthWrite: false });
      obj = new THREE.Sprite(mat);
      obj.renderOrder = 9;
      const geo = new THREE.BoxGeometry(0.014, 0.014, 1).translate(0, 0, 0.5);
      this.strand = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf4f4f4 }));
      this.strand.visible = false;
      this.scene.add(this.strand);
    } else {
      const list = WORDS[this.def.id] ?? WORDS.default;
      this.wordMat = new THREE.SpriteMaterial({ map: wordTexture(list[0]), transparent: true, depthWrite: false, depthTest: false });
      obj = new THREE.Sprite(this.wordMat);
      obj.renderOrder = 11;
    }
    this.shotObj = obj;
    this.scene.add(obj);
    return obj;
  }

  dispose() {
    this.disposed = true;
    this.view?.dispose();
    this.view = null;
    if (this.shotObj) {
      this.shotObj.removeFromParent();
      if ((this.shotObj as THREE.Sprite).isSprite) (this.shotObj as THREE.Sprite).material.dispose();
      else disposeProp(this.shotObj);
    }
    this.wordMat?.map?.dispose();
    if (this.strand) {
      this.strand.removeFromParent();
      this.strand.geometry.dispose();
      (this.strand.material as THREE.Material).dispose();
    }
  }
}
