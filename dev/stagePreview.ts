/**
 * Stage preview harness (dev only).
 *   npx vite --port 5199  →  http://localhost:5199/dev/stage-preview.html?stage=hood&cam=0
 * Query params:
 *   stage = hood | dojo | parking
 *   cam   = 0 gameplay | 1 side orbit | 2 reverse | 3 wide high | orbit (auto-rotating)
 *           | px,py,pz,tx,ty,tz (custom position + target)
 *   t     = freeze the animation clock at this time (seconds)
 *   hud=0 hides the info overlay
 */
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

const { getStage } = await import('../src/render/stages/index');
const { PS1Globals, createPS1Material } = await import('../src/render/ps1Material');

const params = new URLSearchParams(location.search);
const stageId = params.get('stage') ?? 'hood';
const camParam = params.get('cam') ?? '0';
const fixedT = params.has('t') ? Number(params.get('t')) : null;
const W = 480;
const H = 270;

const canvas = document.getElementById('c') as HTMLCanvasElement;
const info = document.getElementById('info') as HTMLDivElement;
if (params.get('hud') === '0') info.style.display = 'none';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 400);

const def = getStage(stageId);
const env = def.build();
scene.add(env.group);

// two 1.8 m placeholder fighters
const fighterMats = [createPS1Material({ color: 0xd04848 }), createPS1Material({ color: 0x4870d8 })];
const fighterGeo = new THREE.BoxGeometry(0.6, 1.8, 0.4);
fighterGeo.translate(0, 0.9, 0);
[-1.2, 1.2].forEach((x, i) => {
  const m = new THREE.Mesh(fighterGeo, fighterMats[i]);
  m.position.set(x, 0, 0);
  scene.add(m);
});

const CAMS: [number, number, number][] = [
  [0, 1.4, 5.5],
  [5, 1.6, 1],
  [0, 1.5, -4.5],
  [0, 4, 12],
];
const target = new THREE.Vector3(0, 1, 0);

function placeCamera(t: number): void {
  if (camParam.includes(',')) {
    // custom: cam=px,py,pz,tx,ty,tz
    const v = camParam.split(',').map(Number);
    camera.position.set(v[0], v[1], v[2]);
    camera.lookAt(v[3] ?? 0, v[4] ?? 1, v[5] ?? 0);
    return;
  }
  if (camParam === 'orbit') {
    const a = t * 0.3;
    camera.position.set(Math.sin(a) * 4.5, 1.6, Math.cos(a) * 4.5);
  } else {
    const c = CAMS[Number(camParam)] ?? CAMS[0];
    camera.position.set(c[0], c[1], c[2]);
  }
  camera.lookAt(target);
}

function applyEnv(): void {
  PS1Globals.uLightDir.value.copy(env.lightDir).normalize();
  PS1Globals.uLightColor.value.copy(env.lightColor);
  PS1Globals.uAmbient.value.copy(env.ambient);
  PS1Globals.uFogColor.value.copy(env.fogColor);
  PS1Globals.uFogNear.value = env.fogNear;
  PS1Globals.uFogFar.value = env.fogFar;
  PS1Globals.uSnapRes.value.set(W / 2, H / 2);
  renderer.setClearColor(env.clearColor, 1);
}

let groupTris = 0;
const perMesh: Record<string, number> = {};
env.group.traverse((o) => {
  const mesh = o as THREE.Mesh;
  if (!mesh.isMesh) return;
  const g = mesh.geometry;
  const n = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
  const inst = (mesh as unknown as THREE.InstancedMesh).isInstancedMesh ? (mesh as unknown as THREE.InstancedMesh).count : 1;
  groupTris += n * inst;
  perMesh[mesh.name || '?'] = (perMesh[mesh.name || '?'] ?? 0) + n * inst;
});
let drawables = 0;
env.group.traverse((o) => {
  if ((o as THREE.Mesh).isMesh || (o as THREE.Line).isLine) drawables++;
});

const start = performance.now();
let last = start;
let frames = 0;
const w = window as unknown as { __stats?: unknown };

function frame(now: number): void {
  const t = fixedT ?? (now - start) / 1000;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  env.update(t, dt);
  applyEnv();
  placeCamera(t);
  renderer.render(scene, camera);
  frames++;
  const ri = renderer.info.render;
  const stats = {
    ready: frames > 3,
    stage: def.id,
    calls: ri.calls,
    triangles: ri.triangles,
    stageTriangles: Math.round(groupTris),
    drawables,
    perMesh,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  };
  w.__stats = stats;
  info.textContent = `${def.name} — ${def.subtitle}\ncalls ${stats.calls}  tris ${stats.triangles}  (stage total ${stats.stageTriangles})`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// dispose/rebuild round-trip check: ?leak=1 builds and disposes the stage 5 times
if (params.get('leak') === '1') {
  const before = { ...renderer.info.memory };
  for (let i = 0; i < 5; i++) {
    const e = def.build();
    const s = new THREE.Scene();
    s.add(e.group);
    renderer.render(s, camera);
    e.dispose();
  }
  console.log('leak-check', JSON.stringify(before), JSON.stringify(renderer.info.memory));
}
