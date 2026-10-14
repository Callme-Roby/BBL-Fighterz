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
 * Without `k` the page stops right before the cinematic; `window.__runTo(k)` then
 * advances the real simulation (frame by frame, rendering every frame so camera
 * and animation blends behave as in game) and resolves once frame k is drawn.
 */
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
  // draw twice so the post pass and the camera settle on this exact state
  world.render(pipe, s, 0, W / H);
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
else world.render(pipe, s, 0, W / H);
w.__ready = true;
