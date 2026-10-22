import * as THREE from 'three';
import type { MusicId, SfxId } from '../audio/types';
import { CAST } from '../data/cast';
import { ROSTER, type FighterDef } from '../data/roster';
import type { Effects } from '../render/effects';
import { loadFace, type FaceAssets } from '../render/faceTexture';
import { FighterView } from '../render/fighterView';
import { CLIPS } from '../render/poses';
import { ALL_PROJECTILES, ALL_PROPS, buildProjectile, buildProp, disposeProp } from '../render/props';
import type { FighterState, GameState } from '../sim/types';
import { CINE_SPEED, cineTime, curve, getUltimate, type CineEvent, type CineRef, type CineSwap, type PropBone, type UltimateScript } from '../sim/ultimates';

/** Somebody who talks in a cinematic (subtitle + voice). */
export interface CineSpeaker {
  name: string;
  portrait: string;
  voice?: FighterDef['voice'];
}

/** What the director needs from the screen around it (HUD, audio, post effects). */
export interface CineHooks {
  say(speaker: CineSpeaker, text: string, opts: { pitch?: number; rate?: number; dur: number }): void;
  text(text: string, style: 'boom' | 'punch' | 'caption', dur: number, color?: string): void;
  music(id: MusicId | null): void;
  sfx(id: SfxId, x: number, volume?: number, pitch?: number): void;
  flash(color: string, amount: number): void;
  shake(amount: number): void;
  /** HUD name of fighter i (null = the normal one) */
  rename(i: number, name: string | null): void;
  /** hide / show the arena (a backdrop replaces it) */
  scenery(visible: boolean): void;
}

/** A look usable in a cinematic: a CAST entry or a roster fighter. */
function castDef(id: string): FighterDef | undefined {
  return CAST[id] ?? ROSTER.find((d) => d.id === id);
}

/**
 * Psychedelic tunnel (the inside of a long open cylinder along X), drawn unlit.
 * Rings rush toward the viewer, a spiral turns, the far end glows.
 */
function makeTunnel(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(2.6, 2.6, 30, 32, 1, true);
  geo.rotateZ(Math.PI / 2); // axis along X
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDir: { value: 1 } },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uDir;
      varying vec2 vUv;
      void main() {
        // depth along the tunnel: 0 near the attacker, 1 far away
        float d = uDir > 0.0 ? vUv.y : 1.0 - vUv.y;
        float a = vUv.x * 6.2831853;
        float z = d * 30.0;
        float rings = smoothstep(0.35, 0.5, abs(fract(z * 0.9 - uTime * 2.2) - 0.5) * 2.0);
        float spiral = smoothstep(0.55, 0.9, sin(a * 6.0 + z * 1.4 - uTime * 3.0) * 0.5 + 0.5);
        vec3 c1 = vec3(0.35, 0.08, 0.75);
        vec3 c2 = vec3(0.05, 0.85, 1.0);
        vec3 c3 = vec3(1.0, 0.35, 0.85);
        vec3 col = mix(c1, c2, rings);
        col = mix(col, c3, spiral * 0.65);
        // darker near the viewer, glowing at the vanishing point
        float glow = smoothstep(0.35, 1.0, d);
        col = mix(col * 0.55, vec3(1.0, 0.95, 1.0), glow * glow * 0.8);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}

interface CastView {
  def: FighterDef;
  face: FaceAssets;
  view: FighterView;
}

interface Flying {
  obj: THREE.Object3D;
  kind: string;
  from: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
  dur: number;
  arc: number;
  boom: boolean;
  /** frames the object stays visible after arrival (web strands) */
  linger: number;
  /** script time of the last smoke puff (rocket trail) */
  trailAt: number;
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** Every CAST id used by a script (swaps and extra actors; 'self' swaps reuse the fighter's own photo). */
function castIds(u: UltimateScript): string[] {
  const c = u.cine;
  if (!c) return [];
  return [...(c.swaps ?? []).filter((s) => s.cast !== 'self').map((s) => s.cast), ...(c.actors ?? []).map((a) => a.cast)];
}

/** Key of a swap look: a cast look is shared, a 'self' restyle belongs to fighter `i`. */
function swapKey(sw: CineSwap, i: number): string {
  return sw.cast === 'self' ? `${sw.who}:self:${i}:${JSON.stringify(sw.outfit ?? {})}` : `${sw.who}:${sw.cast}`;
}

/**
 * Plays the presentation timeline (`cine`) of the BBL MAX cinematics: extra
 * characters, model swaps, props, projectiles, effects, fades, dialogue, music.
 *
 * Everything persistent (who is visible, where, which prop) is a pure function of
 * the attacker's cinematic frame, so rollbacks and frame skips can't desync it;
 * one-shot events fire once when their frame is crossed.
 */
export class CineDirector {
  /** swap views keyed "a:<cast>" / "v:<cast>", actor views keyed by actor id */
  private swapViews = new Map<string, CastView>();
  private actorViews = new Map<string, CastView>();
  private props = new Map<number, { obj: THREE.Object3D; holder: string }>();
  /** scene objects (cine.objects) keyed "<script id>:<index>", and their current world positions by id */
  private objects = new Map<string, THREE.Object3D>();
  private objectPos = new Map<string, THREE.Vector3>();
  /** attacker's start point / facing / script time of the last update (scripted cameras) */
  private origin = 0;
  private facing: 1 | -1 = 1;
  private nowK = 0;
  private flying: Flying[] = [];
  private active = -1;
  private script: UltimateScript | null = null;
  private lastK = 0;
  private musicChanged = false;
  private renamed = false;
  private tunnel: THREE.Mesh | null = null;
  private sceneryHidden = false;
  /** a script moved / hid the fighters' models (cine.place): restored at the end */
  private placed = false;
  /** per fighter: the view currently shown (base or swap) */
  private shownViews: [FighterView, FighterView];
  fade = 0;
  /** stage light multiplier requested by the script (null = default) */
  light: number | null = null;
  hooks: CineHooks | null = null;

  private constructor(
    private scene: THREE.Object3D,
    private effects: Effects,
    private views: [FighterView, FighterView],
    private defs: [FighterDef, FighterDef],
    private faces: [FaceAssets, FaceAssets],
    private scripts: [UltimateScript, UltimateScript],
  ) {
    this.shownViews = [views[0], views[1]];
  }

  /** Loads the faces and builds the models of every extra character both scripts need. */
  static async create(
    scene: THREE.Object3D,
    effects: Effects,
    views: [FighterView, FighterView],
    defs: [FighterDef, FighterDef],
    faces: [FaceAssets, FaceAssets],
    scripts: [UltimateScript, UltimateScript],
  ): Promise<CineDirector> {
    const d = new CineDirector(scene, effects, views, defs, faces, scripts);
    const ids = [...new Set(scripts.flatMap(castIds))].filter((id) => castDef(id));
    const loaded = new Map<string, FaceAssets>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          loaded.set(id, await loadFace(castDef(id)!));
        } catch {
          // missing photo: the cast member is skipped
        }
      }),
    );
    const make = (cast: string): CastView | null => {
      const def = castDef(cast);
      const face = loaded.get(cast);
      if (!def || !face) return null;
      const view = new FighterView(def, face);
      view.addTo(scene);
      view.model.root.visible = false;
      view.shadow.visible = false;
      return { def, face, view };
    };
    scripts.forEach((u, j) => {
      for (const sw of u.cine?.swaps ?? []) {
        // script j is played by fighter j: its victim is fighter 1 - j
        const i = sw.who === 'a' ? j : 1 - j;
        const key = swapKey(sw, i);
        if (d.swapViews.has(key)) continue;
        if (sw.cast === 'self') {
          // the fighter's own look (same photo) in other clothes
          const def: FighterDef = { ...defs[i], outfit: { ...defs[i].outfit, ...sw.outfit } };
          const view = new FighterView(def, faces[i]);
          view.addTo(scene);
          view.model.root.visible = false;
          view.shadow.visible = false;
          d.swapViews.set(key, { def, face: faces[i], view });
        } else {
          const cv = make(sw.cast);
          if (cv) d.swapViews.set(key, cv);
        }
      }
    });
    for (const u of scripts) {
      for (const a of u.cine?.actors ?? []) {
        if (!d.actorViews.has(a.id)) {
          const cv = make(a.cast);
          if (cv) d.actorViews.set(a.id, cv);
        }
      }
    }
    return d;
  }

  /**
   * Builds now what the cinematics build on the fly: the tunnel backdrop (kept,
   * hidden) and a sample of every prop / projectile, returned for a shader warm-up
   * (dispose them with `disposeProp`: their materials are shared and stay).
   */
  warmUp(): THREE.Object3D[] {
    if (!this.tunnel && this.scripts.some((u) => u.cine?.backdrop?.length)) {
      this.tunnel = makeTunnel();
      this.tunnel.visible = false;
      this.scene.add(this.tunnel);
    }
    // scene objects (a goal, a ball...): built now, kept hidden until their cinematic
    for (const u of this.scripts) (u.cine?.objects ?? []).forEach((o, idx) => this.object(u.id, idx, o.prop));
    return [...ALL_PROPS.map((id) => buildProp(id)), ...ALL_PROJECTILES.map((k) => buildProjectile(k))];
  }

  /** The model currently showing fighter i (a swap look during a cinematic). */
  shown(i: number): FighterView {
    return this.shownViews[i];
  }

  /** first extra actor currently on screen */
  firstActor(): FighterView | null {
    for (const cv of this.actorViews.values()) if (cv.view.model.root.visible) return cv.view;
    return null;
  }

  /** world position of a bone of the model showing fighter i */
  bonePos(i: number, bone: PropBone, out: THREE.Vector3): THREE.Vector3 {
    this.shownViews[i].model.bones[bone].getWorldPosition(out);
    return out;
  }

  update(s: GameState, dtFrames: number, time: number) {
    const sc = s.fighters.findIndex((f) => f.action === 'superCombo');
    if (sc < 0) {
      if (this.active >= 0) this.stop();
      this.updateFlying(this.lastK, true);
      return;
    }
    const A = s.fighters[sc];
    const u = getUltimate(A.ult);
    // script time (the cinematic plays slower than the game clock)
    const k = cineTime(A.actionFrame);
    if (this.active !== sc || this.script !== u || k < this.lastK - 30) {
      if (this.active >= 0) this.stop();
      this.active = sc;
      this.script = u;
      this.lastK = 0;
    }
    const c = u.cine;
    this.fade = c?.fade ? Math.min(1, Math.max(0, curve(c.fade, k))) : 0;
    this.light = c?.light ? curve(c.light, k) : null;
    if (!c) {
      this.lastK = k;
      return;
    }
    const V = s.fighters[1 - sc];

    // ---- swaps (pure function of k) ----
    for (const who of ['a', 'v'] as const) {
      const i = who === 'a' ? sc : 1 - sc;
      const f = s.fighters[i];
      const sw = c.swaps?.find((w) => w.who === who && k >= w.from && k < w.to);
      const cv = sw ? this.swapViews.get(swapKey(sw, i)) : undefined;
      // keep every swap look of this fighter animated so it pops in already posed
      for (const w of c.swaps ?? []) {
        if (w.who !== who) continue;
        const v = this.swapViews.get(swapKey(w, i));
        if (v) {
          v.view.sync(f, s.frame, dtFrames, time);
          v.view.model.root.visible = v === cv;
        }
      }
      this.views[i].model.root.visible = !cv;
      this.shownViews[i] = cv ? cv.view : this.views[i];
    }

    // ---- extra actors ----
    for (const a of c.actors ?? []) {
      const cv = this.actorViews.get(a.id);
      if (!cv) continue;
      const on = k >= a.from && k < a.to;
      cv.view.model.root.visible = on;
      cv.view.shadow.visible = on;
      if (!on) continue;
      // stay inside the arena walls
      const x = Math.max(-7.1, Math.min(7.1, A.ultOrigin + A.facing * curve(a.x, k)));
      const y = curve(a.y, k);
      let face = (a.facing ?? 1) * A.facing;
      if (a.turn) for (const [t0, t1] of a.turn) if (k >= t0 && k < t1) face = -face;
      cv.view.root.position.set(x, y, 0);
      cv.view.setFacing(face >= 0 ? 1 : -1);
      const clip = `ult:${u.id}:${a.id}`;
      cv.view.pose(CLIPS[clip] ? clip : 'idle', k, dtFrames, clip);
      const sh = Math.max(0.35, 1 - y * 0.35);
      cv.view.shadow.position.set(x, 0.015, 0);
      cv.view.shadow.scale.set(0.95 * sh, 1, 0.75 * sh);
    }

    // ---- backdrop (the arena is replaced) ----
    const bd = c.backdrop?.find((b) => k >= b.from && k < b.to);
    if (bd) {
      if (!this.tunnel) {
        this.tunnel = makeTunnel();
        this.scene.add(this.tunnel);
      }
      const av = this.shownViews[sc];
      av.headWorld(tmp);
      // the tunnel starts at the attacker and goes away behind them
      this.tunnel.visible = true;
      this.tunnel.position.set(tmp.x - A.facing * 15.2, tmp.y - 0.15, 0);
      const u2 = (this.tunnel.material as THREE.ShaderMaterial).uniforms;
      u2.uTime.value = time;
      // cylinder uv.y runs along +X after the rotation: tell the shader which end is far
      u2.uDir.value = A.facing > 0 ? 1 : -1;
      if (!this.sceneryHidden) {
        this.sceneryHidden = true;
        this.hooks?.scenery(false);
      }
      for (const v of this.views) v.shadow.visible = false;
    } else if (this.tunnel?.visible || this.sceneryHidden) {
      if (this.tunnel) this.tunnel.visible = false;
      this.restoreScenery();
    }

    // ---- placement: sideways offsets, vanished fighters (pure function of k) ----
    for (const pl of c.place ?? []) {
      const i = pl.who === 'a' ? sc : 1 - sc;
      const z = curve(pl.z, k);
      const hidden = (pl.hidden ?? []).some(([t0, t1]) => k >= t0 && k < t1);
      const view = this.shownViews[i];
      view.root.position.z = z;
      this.views[i].shadow.position.z = z;
      if (hidden) view.model.root.visible = false;
      this.views[i].shadow.visible = !hidden && !bd;
      this.placed = true;
    }

    // ---- props ----
    (c.props ?? []).forEach((p, idx) => {
      const on = k >= p.from && k < p.to;
      const holder = this.holderView(p.on, sc);
      let entry = this.props.get(idx);
      if (!on || !holder) {
        if (entry) entry.obj.visible = false;
        return;
      }
      if (!entry) {
        const obj = buildProp(p.prop, holder.def.headScale ?? 1.15);
        entry = { obj, holder: '' };
        this.props.set(idx, entry);
      }
      const bone = holder.model.bones[p.bone];
      if (entry.obj.parent !== bone) {
        bone.add(entry.obj);
        const [px, py, pz] = p.pos ?? [0, 0, 0];
        const [rx, ry, rz] = p.rot ?? [0, 0, 0];
        entry.obj.position.set(px, py, pz);
        entry.obj.rotation.set(rx * THREE.MathUtils.DEG2RAD, ry * THREE.MathUtils.DEG2RAD, rz * THREE.MathUtils.DEG2RAD);
        entry.obj.scale.setScalar(p.scale ?? 1);
      }
      entry.obj.visible = true;
    });

    // ---- scene objects (a ball on its path, a goal...) ----
    this.origin = A.ultOrigin;
    this.facing = A.facing;
    this.nowK = k;
    (c.objects ?? []).forEach((o, idx) => {
      const on = k >= o.from && k < o.to;
      if (!on) {
        const old = this.objects.get(u.id + ':' + idx);
        if (old) old.visible = false;
        this.objectPos.delete(o.id);
        return;
      }
      const obj = this.object(u.id, idx, o.prop);
      obj.visible = true;
      obj.position.set(A.ultOrigin + A.facing * curve(o.x, k), curve(o.y, k), curve(o.z, k));
      obj.rotation.set(0, A.facing * (Math.PI / 2 + (o.yaw ?? 0) * THREE.MathUtils.DEG2RAD), 0);
      if (o.spin) obj.rotateX(curve(o.spin, k) * THREE.MathUtils.DEG2RAD);
      obj.scale.setScalar(o.scale ?? 1);
      let p = this.objectPos.get(o.id);
      if (!p) this.objectPos.set(o.id, (p = new THREE.Vector3()));
      p.copy(obj.position);
    });

    // ---- one-shot events crossed since the last update ----
    if (k > this.lastK) {
      const from = this.lastK;
      const crossed = (f: number) => f > from && f <= k;
      for (const sw of c.swaps ?? []) {
        const fx = sw.fx ?? 'poof';
        if (fx === 'none') continue;
        const i = sw.who === 'a' ? sc : 1 - sc;
        for (const f of [sw.from, sw.to]) {
          if (!crossed(f) || f >= u.length) continue;
          this.chest(this.views[i], tmp);
          if (fx === 'power' && f === sw.from) {
            this.effects.cine('powerAura', tmp, 1.3, A.facing);
            this.hooks?.sfx('powerUp', tmp.x);
            this.hooks?.flash('#fff2a0', 0.6);
          } else {
            this.effects.cine('poof', tmp, 1.1, A.facing);
            this.hooks?.sfx('poof', tmp.x);
          }
        }
      }
      for (const a of c.actors ?? []) {
        if (!a.poof) continue;
        for (const f of [a.from, a.to]) {
          if (!crossed(f) || f >= u.length) continue;
          tmp.set(A.ultOrigin + A.facing * curve(a.x, f), curve(a.y, f) + 0.9, 0.1);
          this.effects.cine('poof', tmp, 1.1, A.facing);
          this.hooks?.sfx('poof', tmp.x);
        }
      }
      for (const pl of c.place ?? []) {
        if (pl.poof === false) continue;
        const F = s.fighters[pl.who === 'a' ? sc : 1 - sc];
        for (const [t0, t1] of pl.hidden ?? []) {
          for (const f of [t0, t1]) {
            if (!crossed(f) || f >= u.length) continue;
            tmp.set(F.x, F.y + 0.9, curve(pl.z, f) + 0.1);
            this.effects.cine('poof', tmp, 1.1, A.facing);
            this.hooks?.sfx('poof', tmp.x);
          }
        }
      }
      for (const o of c.objects ?? []) {
        if (!o.poof || !crossed(o.from) || o.from >= u.length) continue;
        tmp.set(A.ultOrigin + A.facing * curve(o.x, o.from), curve(o.y, o.from) + 0.6, curve(o.z, o.from) + 0.1);
        this.effects.cine('poof', tmp, 1.4, A.facing);
        this.hooks?.sfx('poof', tmp.x);
      }
      for (const e of c.events ?? []) if (crossed(e.f)) this.fire(e, sc, A, V);
    }
    this.lastK = Math.max(this.lastK, k);
    this.updateFlying(k, false);
  }

  /** Scene object `idx` of script `id` (built on first use, then kept hidden between cinematics). */
  private object(id: string, idx: number, prop: Parameters<typeof buildProp>[0]): THREE.Object3D {
    const key = id + ':' + idx;
    let obj = this.objects.get(key);
    if (!obj) {
      obj = buildProp(prop);
      obj.visible = false;
      this.scene.add(obj);
      this.objects.set(key, obj);
    }
    return obj;
  }

  /**
   * Scripted camera (the 'path' shot): position and look-at point of the `cine.cams` move
   * active now. False when none is.
   */
  camPath(pos: THREE.Vector3, look: THREE.Vector3): boolean {
    const c = this.script?.cine;
    if (this.active < 0 || !c?.cams) return false;
    const k = this.nowK;
    const cam = c.cams.find((m) => k >= m.from && k < m.to);
    if (!cam) return false;
    const X = (x: number) => this.origin + this.facing * x;
    pos.set(X(curve(cam.x, k)), curve(cam.y, k), curve(cam.z, k));
    const L = cam.look;
    if ('at' in L) {
      const op = L.at.startsWith('obj:') ? this.objectPos.get(L.at.slice(4)) : undefined;
      if (op) look.copy(op);
      else {
        const v = this.refView(L.at, this.active);
        if (v) v.headWorld(look);
        else look.set(X(0), 1.2, 0);
      }
      look.y += L.dy ?? 0;
    } else {
      look.set(X(curve(L.x, k)), curve(L.y, k), curve(L.z, k));
    }
    return true;
  }

  /** Display names usable in lines: {a} = attacker, {v} = victim. */
  private sub(text: string, sc: number): string {
    // "CLÉMENT" -> "Clément" (names are written in capitals in the roster)
    const nice = (n: string) => n.charAt(0) + n.slice(1).toLocaleLowerCase('fr');
    return text.replace(/\{a\}/g, nice(this.defs[sc].name)).replace(/\{v\}/g, nice(this.defs[1 - sc].name));
  }

  private holderView(ref: CineRef, sc: number): { model: FighterView['model']; def: FighterDef } | null {
    if (ref === 'a' || ref === 'v') {
      const i = ref === 'a' ? sc : 1 - sc;
      const v = this.shownViews[i];
      return { model: v.model, def: v.def };
    }
    const cv = this.actorViews.get(ref);
    return cv ? { model: cv.view.model, def: cv.def } : null;
  }

  private refView(ref: CineRef, sc: number): FighterView | null {
    if (ref === 'a') return this.shownViews[sc];
    if (ref === 'v') return this.shownViews[1 - sc];
    return this.actorViews.get(ref)?.view ?? null;
  }

  private speaker(ref: CineRef, sc: number): CineSpeaker | null {
    if (ref === 'a' || ref === 'v') {
      const i = ref === 'a' ? sc : 1 - sc;
      const shown = this.shownViews[i];
      if (shown !== this.views[i]) {
        for (const cv of this.swapViews.values()) if (cv.view === shown) return { name: cv.def.name, portrait: cv.face.portraitUrl, voice: cv.def.voice };
      }
      return { name: this.defs[i].name, portrait: this.faces[i].portraitUrl, voice: this.defs[i].voice };
    }
    const cv = this.actorViews.get(ref);
    return cv ? { name: cv.def.name, portrait: cv.face.portraitUrl, voice: cv.def.voice } : null;
  }

  private chest(v: FighterView, out: THREE.Vector3): THREE.Vector3 {
    v.model.bones.chest.getWorldPosition(out);
    out.z = Math.max(out.z, 0) + 0.12;
    return out;
  }

  private head(v: FighterView, out: THREE.Vector3): THREE.Vector3 {
    v.headWorld(out);
    out.z = Math.max(out.z, 0) + 0.1;
    return out;
  }

  private fire(e: CineEvent, sc: number, A: FighterState, V: FighterState) {
    const h = this.hooks;
    switch (e.t) {
      case 'say': {
        const sp = this.speaker(e.who, sc);
        if (sp) h?.say(sp, this.sub(e.text, sc), { pitch: e.pitch, rate: e.rate, dur: (e.dur ?? 100) / CINE_SPEED });
        break;
      }
      case 'text':
        h?.text(this.sub(e.text, sc), e.style ?? 'boom', (e.dur ?? 50) / CINE_SPEED, e.color);
        break;
      case 'sfx':
        h?.sfx(e.id, A.x, e.vol, e.pitch);
        break;
      case 'music':
        h?.music(e.id);
        this.musicChanged = e.id !== null;
        break;
      case 'shake':
        h?.shake(e.amt);
        break;
      case 'flash':
        h?.flash(e.color ?? '#ffffff', e.amt ?? 0.6);
        break;
      case 'rename':
        h?.rename(e.who === 'a' ? sc : 1 - sc, e.name);
        this.renamed = true;
        break;
      case 'fx': {
        const v = this.refView(e.at, sc);
        if (!v) break;
        const pos = tmp;
        const glyph = e.fx === 'question' || e.fx === 'exclaim' || e.fx === 'stars' || e.fx === 'sweat' || e.fx === 'veins';
        if (e.bone) {
          v.model.bones[e.bone].getWorldPosition(pos);
          pos.z = Math.max(pos.z, 0) + 0.1;
        } else if (e.y !== undefined) {
          pos.set(v.root.position.x, v.root.position.y + e.y, 0.15);
        } else if (glyph) {
          this.head(v, pos);
          if (e.fx === 'question' || e.fx === 'exclaim') pos.y += 0.38;
          else if (e.fx === 'stars') pos.y += 0.22;
        } else if (e.fx === 'speed') {
          pos.set(v.root.position.x, v.root.position.y + 0.9, 0.1);
        } else {
          this.chest(v, pos);
        }
        if (e.dx) pos.x += A.facing * e.dx;
        this.effects.cine(e.fx, pos.clone(), e.scale ?? 1, A.facing);
        break;
      }
      case 'projectile': {
        const fv = this.refView(e.from, sc);
        const tv = this.refView(e.to, sc);
        if (!fv || !tv) break;
        const from = new THREE.Vector3();
        fv.model.bones[e.fromBone ?? 'handR'].getWorldPosition(from);
        from.z = Math.max(0, from.z);
        const to = this.chest(tv, new THREE.Vector3());
        to.z = 0.05;
        if (e.toY !== undefined) to.y = tv.root.position.y + e.toY;
        // a 'boom' blow landing on arrival already explodes: don't explode twice
        const arrival = e.f + Math.max(1, e.dur);
        const hitBoom = (this.script?.hits ?? []).some((hh) => hh.kind === 'boom' && Math.abs(hh.f - arrival) <= 3);
        const obj = buildProjectile(e.kind);
        this.scene.add(obj);
        this.flying.push({
          obj,
          kind: e.kind,
          from,
          to,
          start: e.f,
          dur: Math.max(1, e.dur),
          arc: e.arc ?? (e.kind === 'grenade' ? 0.8 : 0),
          boom: !!e.boom && !hitBoom,
          linger: e.kind === 'web' ? 8 : 0,
          trailAt: e.f,
        });
        if (e.kind === 'rocket') h?.sfx('rocket', from.x);
        else if (e.kind === 'web') h?.sfx('thwip', from.x);
        break;
      }
    }
    void V;
  }

  private updateFlying(k: number, ending: boolean) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const p = this.flying[i];
      if (ending) {
        this.removeFlying(i);
        continue;
      }
      const t = (k - p.start) / p.dur;
      if (t >= 1 && p.boom) {
        this.explode(p);
        p.boom = false;
      }
      if (k - p.start >= p.dur + p.linger) {
        this.removeFlying(i);
        continue;
      }
      const tt = Math.min(1, Math.max(0, t));
      const pos = tmp.lerpVectors(p.from, p.to, tt);
      pos.y += p.arc * 4 * tt * (1 - tt);
      if (p.kind === 'web') {
        // strand from the shooter to the tip
        p.obj.position.copy(p.from);
        p.obj.lookAt(pos);
        p.obj.scale.set(1, 1, Math.max(0.01, pos.distanceTo(p.from)));
        continue;
      }
      p.obj.visible = t < 1;
      // look along the velocity
      const t2 = Math.min(1, tt + 0.02);
      const ahead = tmp2.lerpVectors(p.from, p.to, t2);
      ahead.y += p.arc * 4 * t2 * (1 - t2);
      p.obj.position.copy(pos);
      if (ahead.distanceToSquared(pos) > 1e-8) p.obj.lookAt(ahead);
      if (p.kind === 'grenade') p.obj.rotateX(k * 0.5);
      if (p.kind === 'rocket' && k - p.trailAt >= 1.2) {
        p.trailAt = k;
        this.effects.trail(pos);
      }
    }
  }

  private explode(p: Flying) {
    this.effects.cine('explosion', p.to.clone(), p.kind === 'rocket' ? 1.5 : 1.1);
    this.hooks?.sfx('explosion', p.to.x, p.kind === 'rocket' ? 1 : 0.8);
    this.hooks?.shake(p.kind === 'rocket' ? 0.22 : 0.14);
    this.hooks?.flash('#ffd080', p.kind === 'rocket' ? 0.5 : 0.3);
  }

  private removeFlying(i: number) {
    const p = this.flying[i];
    p.obj.removeFromParent();
    disposeProp(p.obj);
    this.flying.splice(i, 1);
  }

  /** End of a cinematic: everybody back to normal. */
  private stop() {
    for (const cv of this.swapViews.values()) cv.view.model.root.visible = false;
    for (const cv of this.actorViews.values()) {
      cv.view.model.root.visible = false;
      cv.view.shadow.visible = false;
    }
    for (const p of this.props.values()) {
      p.obj.removeFromParent();
      disposeProp(p.obj);
    }
    this.props.clear();
    for (const o of this.objects.values()) o.visible = false;
    this.objectPos.clear();
    this.views[0].model.root.visible = true;
    this.views[1].model.root.visible = true;
    if (this.placed) {
      this.placed = false;
      for (const v of this.views) {
        v.root.position.z = 0;
        v.shadow.position.z = 0;
        v.shadow.visible = true;
      }
    }
    this.shownViews = [this.views[0], this.views[1]];
    if (this.musicChanged) this.hooks?.music(null);
    this.musicChanged = false;
    if (this.renamed) {
      this.hooks?.rename(0, null);
      this.hooks?.rename(1, null);
    }
    this.renamed = false;
    if (this.tunnel) this.tunnel.visible = false;
    this.restoreScenery();
    this.active = -1;
    this.script = null;
    this.fade = 0;
    this.light = null;
    void this.scripts;
  }

  private restoreScenery() {
    if (!this.sceneryHidden) return;
    this.sceneryHidden = false;
    this.hooks?.scenery(true);
    for (const v of this.views) v.shadow.visible = true;
  }

  dispose() {
    this.stop();
    if (this.tunnel) {
      this.tunnel.removeFromParent();
      this.tunnel.geometry.dispose();
      (this.tunnel.material as THREE.Material).dispose();
    }
    for (const p of [...this.flying]) {
      p.obj.removeFromParent();
      disposeProp(p.obj);
    }
    this.flying.length = 0;
    for (const o of this.objects.values()) {
      o.removeFromParent();
      disposeProp(o);
    }
    this.objects.clear();
    for (const cv of [...this.swapViews.values(), ...this.actorViews.values()]) cv.view.dispose();
    this.swapViews.clear();
    this.actorViews.clear();
  }
}
