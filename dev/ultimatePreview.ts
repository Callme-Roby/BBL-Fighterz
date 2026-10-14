/**
 * BBL MAX cinematic preview harness (dev only).
 *   npx vite --port 5203  →  http://localhost:5203/dev/ultimate-preview.html?ult=tornado&p1=dylan&p2=clement&k=40&stage=dojo
 * Query params:
 *   p1, p2   fighter ids (ROSTER)
 *   ult      script id for P1 (default: P1's own BBL MAX, see src/data/ultimates.ts)
 *   k        cinematic frame to show (k > script length = after the cinematic)
 *   stage    hood | dojo | parking
 *   x        P1 start position (P2 starts 1.2 m in front); flip=1 puts P1 on the right
 *   hud=0    hides the info line
 *   cam      game (default: the real cinematic camera) | side | back | top (fixed debug views)
 *   camd     debug camera distance override (metres); clean=1 hides the BBL MAX aura / glow / sparks (any cam)
 * Without `k` the page stops right before the cinematic; `window.__runTo(k)` then
 * advances the real simulation (frame by frame, rendering every frame so camera
 * and animation blends behave as in game) and resolves once frame k is drawn.
 */
import * as THREE from 'three';
import { ROSTER } from '../src/data/roster';
import { ultimateOf } from '../src/data/ultimates';
import { FightWorld } from '../src/game/world';
import { RetroPipeline } from '../src/render/pipeline';
import { createGame, step } from '../src/sim/sim';
import { IN_SUPER, type GameState } from '../src/sim/types';
import { getUltimate } from '../src/sim/ultimates';

const q = new URLSearchParams(location.search);
const W = 960;
const H = 540;
const find = (id: string) => {
  const d = ROSTER.find((r) => r.id === id) ?? ROSTER[0];
  return { ...d, face: d.face ? '../' + d.face : '' };
};
const d1 = find(q.get('p1') ?? 'dylan');
const d2 = find(q.get('p2') ?? 'clement');
const ult = q.get('ult') ?? ultimateOf(d1).script;
const stage = q.get('stage') ?? 'dojo';
const flip = q.get('flip') === '1';
const x0 = Number(q.get('x') ?? (flip ? 0.6 : -0.6));
const camMode = q.get('cam') ?? 'game';
const camDist = q.has('camd') ? Number(q.get('camd')) : 0;
const clean = q.get('clean') === '1';
const hud = document.getElementById('hud') as HTMLDivElement;
if (q.get('hud') === '0') hud.style.display = 'none';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const pipe = new RetroPipeline(canvas);
pipe.setSize(W, H);
// intermediate frames update the world (camera, blends, effects) without drawing
const nullPipe = { post: pipe.post, render() {} } as unknown as RetroPipeline;

const world = await FightWorld.create(d1, d2, stage);
world.sound = false;
const s: GameState = createGame({ skipIntro: true, ultimates: [ult, 'rush'] });
const script = getUltimate(ult);

function tick(input: number, draw: boolean) {
  step(s, [input, 0]);
  world.handleEvents(
    s.events.map((ev) => ({ frame: s.frame, ev })),
    s,
  );
  world.render(draw ? pipe : nullPipe, s, 1 / 60, W / H);
}

let guard = 0;
while (s.phase !== 'fight' && guard++ < 2000) tick(0, false);
const [a, b] = s.fighters;
a.x = x0;
b.x = x0 + (flip ? -1.2 : 1.2);
a.facing = flip ? -1 : 1;
b.facing = flip ? 1 : -1;
a.meter = 100;
tick(IN_SUPER, false);
guard = 0;
while (a.action !== 'superCombo' && guard++ < 400) tick(0, false);
let ended = 0;

const dbgCam = new THREE.PerspectiveCamera(38, W / H, 0.05, 420);
function draw() {
  world.render(nullPipe, s, 0, W / H);
  if (clean) {
    world.effects.clear();
    for (const v of world.views) for (const m of v.model.materials) m.uniforms.uFlash.value = 0;
  }
  if (camMode === 'game') {
    pipe.render(world.scene, world.camera, world.stage.clearColor);
    return;
  }
  const mid = (a.x + b.x) / 2;
  const top = Math.max(a.y, b.y);
  const back = camDist || Math.max(4.4, Math.abs(b.x - a.x) * 1.2 + 2.6) + top * 0.5;
  if (camMode === 'back') dbgCam.position.set(mid, 1.3 + top * 0.4, -back);
  else if (camMode === 'top') dbgCam.position.set(mid, 5.5, 2.2);
  else dbgCam.position.set(mid, 1.3 + top * 0.4, back);
  dbgCam.lookAt(mid, camMode === 'top' ? 0.3 : 0.95 + top * 0.45, 0);
  pipe.render(world.scene, dbgCam, world.stage.clearColor);
}

function cineFrame(): number {
  if (a.action === 'superCombo') return a.actionFrame;
  return script.length + ended;
}

function info() {
  const v = b;
  return {
    k: cineFrame(),
    a: { action: a.action, x: +a.x.toFixed(3), y: +a.y.toFixed(3) },
    v: { action: v.action, x: +v.x.toFixed(3), y: +v.y.toFixed(3), hp: v.hp },
  };
}

async function runTo(k: number) {
  let n = 0;
  while (cineFrame() < k && n++ < 1000) {
    const was = a.action === 'superCombo';
    tick(0, false);
    if (!was || a.action !== 'superCombo') ended++;
  }
  draw();
  hud.textContent = `${ult}  k=${k}  ${a.action}/${b.action}  vy=${b.y.toFixed(2)} ay=${a.y.toFixed(2)} d=${Math.abs(b.x - a.x).toFixed(2)}`;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  return info();
}

const w = window as unknown as Record<string, unknown>;
w.__runTo = runTo;
w.__info = info;
w.__length = script.length;
w.__hits = script.hits.map((h) => h.f);
if (q.has('k')) await runTo(Number(q.get('k')));
else draw();
w.__ready = true;
