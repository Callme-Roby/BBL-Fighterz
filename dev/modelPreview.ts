// Dev harness: renders roster fighters in a given clip/frame.
// /dev/model-preview.html?clip=idle&frame=0&cam=front&ids=blaze,tacchini&lines=270
import * as THREE from 'three';
import { ROSTER } from '../src/data/roster';
import { loadFace } from '../src/render/faceTexture';
import { buildCharacter } from '../src/render/characterModel';
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
const defs = clips.length ? clips.map((_, i) => defs0[i % defs0.length]) : defs0;
const spacing = Number(q.get('spacing') ?? 1.1);
(async () => {
  let i = 0;
  for (const def of defs) {
    const face = await loadFace(def);
    const m = buildCharacter(def, face);
    const x = (i - (defs.length - 1) / 2) * spacing;
    m.root.position.x = x;
    if (cam === 'side' || cam === 'game') {
      // gameplay orientation: facing +X (or -X mirrored)
      const facing = mirror ? -1 : 1;
      m.body.rotation.y = facing * Math.PI / 2;
      m.body.scale.x = facing === 1 ? 1 : -1;
    }
    scene.add(m.root);
    const an = new Animator(m);
    an.update('k', clips[i] ?? clip, frames[i] ?? frame, 100, 0);
    i++;
  }
  if (cam === 'front') {
    camera.position.set(0, 1.3, 4.2 + defs.length * 0.3);
    camera.lookAt(0, 1.0, 0);
  } else if (cam === 'face') {
    camera.position.set((0 - (defs.length - 1) / 2) * spacing, 1.75, 0.9);
    camera.lookAt((0 - (defs.length - 1) / 2) * spacing, 1.72, 0);
  } else if (cam === 'back') {
    camera.position.set(0, 1.3, -4.5);
    camera.lookAt(0, 1.0, 0);
  } else {
    camera.position.set(0, 1.35, 5.2);
    camera.lookAt(0, 1.0, 0);
  }
  pipe.render(scene, camera, new THREE.Color(0x30343c));
  (window as unknown as { __ready: boolean }).__ready = true;
})();
