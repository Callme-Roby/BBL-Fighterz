// Dev harness: renders roster fighters in a given clip/frame.
// /dev/model-preview.html?clip=idle&frame=0&cam=front&ids=dylan,clement&lines=270
//   ids=a,b,c        fighters (default: whole roster)
//   clip / clips     one clip for all, or one per slot (clip=bind = bind pose, no animation)
//   frame / frames   frame(s) to sample
//   cam=front|face|faces|game|back   (faces = row of head close-ups; camy = camera height offset)
//   hairs=cap,bun,...  one copy of the (first) fighter per hair style; body=fine; belly=0..1
//   spacing, mirror=1, lines, yaw=deg (extra body rotation), labels=1 (name + triangle count under each fighter)
import * as THREE from 'three';
import { ROSTER, type BodyType, type HairStyle } from '../src/data/roster';
import { loadFace } from '../src/render/faceTexture';
import { buildCharacter, countTriangles, type CharacterModel } from '../src/render/characterModel';
import { Animator } from '../src/render/animator';
import { RetroPipeline } from '../src/render/pipeline';
import { createPS1Material, PS1Globals } from '../src/render/ps1Material';

const q = new URLSearchParams(location.search);
const clip = q.get('clip') ?? 'idle';
const frame = Number(q.get('frame') ?? 0);
const cam = q.get('cam') ?? 'front';
const ids = (q.get('ids') ?? ROSTER.map((r) => r.id).join(',')).split(',');
const lines = Number(q.get('lines') ?? 270);
const mirror = q.get('mirror') === '1';
const labels = q.get('labels') === '1';
const yaw = Number(q.get('yaw') ?? 0);

const canvas = document.getElementById('c') as HTMLCanvasElement;
const pipe = new RetroPipeline(canvas);
pipe.lines = lines;
pipe.setSize(960, 540);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 960 / 540, 0.05, 200);
PS1Globals.uFogNear.value = 50;
PS1Globals.uFogFar.value = 100;

const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20, 10, 10).rotateX(-Math.PI / 2), createPS1Material({ color: 0x556070 }));
scene.add(floor);

const clips = (q.get('clips') ?? '').split(',').filter(Boolean);
const frames = (q.get('frames') ?? '').split(',').filter(Boolean).map(Number);
const defs0 = ids.map((id) => ROSTER.find((r) => r.id === id)!).filter(Boolean).map((d) => ({ ...d, face: d.face ? '../' + d.face : '' }));
let defs = clips.length ? clips.map((_, i) => defs0[i % defs0.length]) : defs0;
// overrides: hairs=a,b,c (one fighter per hair style) / body=fine / belly=0.8
const hairs = (q.get('hairs') ?? '').split(',').filter(Boolean) as HairStyle[];
if (hairs.length) defs = hairs.map((style, i) => ({ ...defs[i % defs.length], hair: { ...defs[i % defs.length].hair, style } }));
if (q.get('body')) defs = defs.map((d) => ({ ...d, body: q.get('body') as BodyType }));
if (q.get('belly')) defs = defs.map((d) => ({ ...d, belly: Number(q.get('belly')) }));
const spacing = Number(q.get('spacing') ?? (cam === 'faces' ? 0.42 : 1.1));
const stats: { id: string; tris: number; skin: string }[] = [];
(async () => {
  let i = 0;
  const models: CharacterModel[] = [];
  for (const def of defs) {
    const face = await loadFace(def);
    const m = buildCharacter(def, face);
    models.push(m);
    stats.push({ id: def.id, tris: countTriangles(m), skin: '#' + face.skin.getHexString() });
    const x = (i - (defs.length - 1) / 2) * spacing;
    m.root.position.x = x;
    if (cam === 'side' || cam === 'game') {
      // gameplay orientation: facing +X (or -X mirrored)
      const facing = mirror ? -1 : 1;
      m.body.rotation.y = facing * Math.PI / 2;
      m.body.scale.x = facing === 1 ? 1 : -1;
    }
    if (yaw) m.body.rotation.y += THREE.MathUtils.degToRad(yaw);
    scene.add(m.root);
    const c = clips[i] ?? clip;
    if (c !== 'bind') {
      const an = new Animator(m);
      an.update('k', c, frames[i] ?? frame, 100, 0);
    }
    i++;
  }
  if (cam === 'front') {
    camera.position.set(0, 1.3, 4.2 + defs.length * 0.3);
    camera.lookAt(0, 1.0, 0);
  } else if (cam === 'face') {
    camera.position.set((0 - (defs.length - 1) / 2) * spacing, 1.75, 0.9);
    camera.lookAt((0 - (defs.length - 1) / 2) * spacing, 1.72, 0);
  } else if (cam === 'faces') {
    const hy = models.reduce((a, m) => a + m.headY, 0) / Math.max(1, models.length);
    const half = Math.tan(THREE.MathUtils.degToRad(18)) * camera.aspect;
    const dist = (defs.length * spacing) / 2 / half + 0.25;
    const dy = Number(q.get('camy') ?? 0.02); // camera height offset from the eyes (negative = looking up)
    camera.position.set(0, hy + dy, dist);
    camera.lookAt(0, hy - 0.01, 0);
  } else if (cam === 'back') {
    camera.position.set(0, 1.3, -4.5);
    camera.lookAt(0, 1.0, 0);
  } else {
    camera.position.set(0, 1.35, 5.2);
    camera.lookAt(0, 1.0, 0);
  }
  pipe.render(scene, camera, new THREE.Color(0x30343c));
  if (labels) {
    camera.updateMatrixWorld();
    models.forEach((m, j) => {
      const p = new THREE.Vector3(m.root.position.x, cam === 'faces' ? m.headY - 0.2 : 0, 0).project(camera);
      const el = document.createElement('div');
      el.textContent = `${defs[j].id} ${stats[j].tris}`;
      el.style.cssText = `position:absolute;left:${((p.x + 1) / 2) * 960}px;top:${Math.min(526, ((1 - p.y) / 2) * 540)}px;transform:translateX(-50%);font:11px monospace;color:#ff0;background:#000a;padding:1px 3px`;
      document.body.append(el);
    });
  }
  console.log('TRIS ' + JSON.stringify(stats));
  (window as unknown as { __ready: boolean; __stats: unknown }).__stats = stats;
  (window as unknown as { __ready: boolean }).__ready = true;
})();
