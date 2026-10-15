import './ui/styles.css';
import { App } from './app';
import { initKeyLabels } from './input/input';
import { roomFromUrl, tournamentFromUrl } from './net/peer';
import { goOnline, goTitle, goTournamentHome, initFlow, startFight } from './screens/flow';
import { ROSTER } from './data/roster';
import { STAGES } from './render/stages';

function boot() {
  const app = new App();
  initFlow(app);
  void initKeyLabels();
  const room = roomFromUrl();
  const tournoi = tournamentFromUrl();
  if (room) goOnline(room);
  else if (tournoi) goTournamentHome(tournoi);
  else goTitle();
  // handy for debugging from the console
  (window as unknown as { bbl: App }).bbl = app;
  if (location.search.includes('debug')) {
    // kept when a join link cleans the address bar
    (window as unknown as { bblDebug: boolean }).bblDebug = true;
    // ?debug: start a CPU fight straight away, e.g. bblStart('zia', 'thomas')
    (window as unknown as { bblStart: unknown }).bblStart = (a: string, b: string, stage?: string) => {
      const find = (id: string) => ROSTER.find((f) => f.id === id) ?? ROSTER[0];
      startFight({
        mode: 'cpu',
        p1: find(a),
        p2: find(b),
        stageId: stage ?? STAGES[0].id,
        rounds: 1,
        difficulty: 'easy',
        seed: 1,
        skipIntro: true,
        cpuSides: [false, true],
      });
    };
  }
}

try {
  boot();
} catch (e) {
  console.error(e);
  document.getElementById('ui')!.innerHTML =
    '<div class="screen"><div class="h1">OUPS</div><div class="status err">Ton navigateur ne supporte pas WebGL ou une erreur est survenue.<br>' +
    String(e) +
    '</div></div>';
}
