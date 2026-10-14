import * as THREE from 'three';
import type { FighterDef } from '../data/roster';
import { loadFace } from './faceTexture';
import { FighterView } from './fighterView';
import type { RetroPipeline } from './pipeline';
import { createPS1Material, makeCanvasTexture, PS1Globals } from './ps1Material';

/**
 * Small studio scene used by menus (select screen, lab): fighters face the
 * camera on a lit platform in front of a gradient backdrop.
 */
export class Showroom {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 100);
  private views = new Map<string, Promise<FighterView>>();
  private slots: (FighterView | null)[] = [null, null];
  private slotKeys: (string | null)[] = [null, null];
  private slotClip: string[] = ['showcase', 'showcase'];
  private slotClipStart: number[] = [0, 0];
  private time = 0;
  private disposables: { dispose(): void }[] = [];
  readonly clear = new THREE.Color(0x0d0a1c);
  /** x positions of the two slots */
  positions: [number, number] = [-1.15, 1.15];
  cameraPos = new THREE.Vector3(0, 1.42, 4.6);
  cameraLook = new THREE.Vector3(0, 1.08, 0);

  constructor() {
    // backdrop: big curved gradient wall
    const wallGeo = new THREE.CylinderGeometry(9, 9, 10, 24, 6, true, Math.PI * 0.6, Math.PI * 0.8);
    const col: number[] = [];
    const pos = wallGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + 5) / 10;
      const c = new THREE.Color().setRGB(0.05 + t * 0.25, 0.04 + t * 0.06, 0.15 + t * 0.2);
      col.push(c.r, c.g, c.b);
    }
    wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const wallMat = createPS1Material({ vertexColors: true, unlit: 1, fog: false, side: THREE.BackSide });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 4, 2);
    this.scene.add(wall);

    // floor with grid texture
    const floorTex = makeCanvasTexture(
      32,
      32,
      (ctx, w, hh) => {
        ctx.fillStyle = '#1c1830';
        ctx.fillRect(0, 0, w, hh);
        ctx.fillStyle = '#2c2650';
        ctx.fillRect(0, 0, w, 2);
        ctx.fillRect(0, 0, 2, hh);
      },
      true,
    );
    const floorMat = createPS1Material({ map: floorTex, uvScale: [10, 10] });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20, 8, 8).rotateX(-Math.PI / 2), floorMat);
    this.scene.add(floor);
    // glowing discs under the slots
    const discTex = makeCanvasTexture(32, 32, (ctx, w, hh) => {
      const g = ctx.createRadialGradient(w / 2, hh / 2, 2, w / 2, hh / 2, w / 2);
      g.addColorStop(0, 'rgba(255,170,60,0.9)');
      g.addColorStop(0.6, 'rgba(255,90,30,0.35)');
      g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, hh);
    });
    for (const x of this.positions) {
      const m = createPS1Material({ map: discTex, unlit: 1, transparent: true, depthWrite: false, fog: false });
      m.blending = THREE.AdditiveBlending;
      const disc = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), m);
      disc.position.set(x, 0.01, 0);
      this.scene.add(disc);
      this.disposables.push(m);
    }
    this.disposables.push(wallGeo, wallMat, floorTex, floorMat, discTex, floor.geometry);
  }

  private getView(def: FighterDef): Promise<FighterView> {
    const key = def.id + '|' + def.face.length + '|' + JSON.stringify(def.outfit) + JSON.stringify(def.hair) + def.build + def.headScale + def.skin;
    let p = this.views.get(key);
    if (!p) {
      p = loadFace(def).then((face) => new FighterView(def, face));
      this.views.set(key, p);
    }
    return p;
  }

  /** Show `def` in slot 0 (left) or 1 (right). null hides the slot. */
  async show(slot: 0 | 1, def: FighterDef | null) {
    const key = def ? def.id + '|' + def.face.length + '|' + JSON.stringify(def.outfit) + JSON.stringify(def.hair) + def.build + def.headScale + def.skin : null;
    this.slotKeys[slot] = key;
    if (!def) {
      this.slots[slot]?.root.removeFromParent();
      this.slots[slot]?.shadow.removeFromParent();
      this.slots[slot] = null;
      return;
    }
    const v = await this.getView(def);
    if (this.slotKeys[slot] !== key) return; // changed meanwhile
    const old = this.slots[slot];
    if (old && old !== v) {
      old.root.removeFromParent();
      old.shadow.removeFromParent();
    }
    this.slots[slot] = v;
    v.addTo(this.scene);
    v.root.position.set(this.positions[slot], 0, 0);
    v.shadow.position.set(this.positions[slot], 0.015, 0);
    v.shadow.scale.set(0.9, 1, 0.7);
    // face the camera, slightly turned toward the centre
    v.model.body.rotation.y = slot === 0 ? 0.55 : -0.55;
    v.model.body.scale.set(slot === 0 ? 1 : -1, 1, 1).multiplyScalar(def.height ?? 1);
    this.slotClip[slot] = 'showcase';
  }

  /** Forget cached views of this definition (lab edits). */
  invalidate() {
    for (const p of this.views.values()) p.then((v) => v.dispose());
    this.views.clear();
    this.slots = [null, null];
  }

  play(slot: 0 | 1, clip: string) {
    this.slotClip[slot] = clip;
    this.slotClipStart[slot] = this.time;
  }

  render(pipeline: RetroPipeline, dt: number, aspect: number) {
    this.time += dt;
    for (let i = 0; i < 2; i++) {
      const v = this.slots[i];
      if (!v) continue;
      const clip = this.slotClip[i];
      const frame = clip === 'showcase' ? (this.time + i * 0.7) * 60 : (this.time - this.slotClipStart[i]) * 60;
      v.pose(clip, frame, dt * 60, clip + this.slotClipStart[i]);
    }
    PS1Globals.uLightDir.value.set(0.3, 0.7, 0.9).normalize();
    PS1Globals.uLightColor.value.setRGB(0.85, 0.8, 0.75);
    PS1Globals.uAmbient.value.setRGB(0.4, 0.36, 0.5);
    PS1Globals.uFogColor.value.copy(this.clear);
    PS1Globals.uFogNear.value = 12;
    PS1Globals.uFogFar.value = 30;
    this.camera.aspect = aspect;
    const narrow = aspect < 1.1;
    this.camera.fov = narrow ? 50 : 32;
    this.camera.position.copy(this.cameraPos);
    if (narrow) this.camera.position.z += 1.5;
    this.camera.lookAt(this.cameraLook);
    this.camera.updateProjectionMatrix();
    pipeline.render(this.scene, this.camera, this.clear);
  }

  dispose() {
    for (const p of this.views.values()) p.then((v) => v.dispose());
    this.views.clear();
    for (const d of this.disposables) d.dispose();
  }
}
