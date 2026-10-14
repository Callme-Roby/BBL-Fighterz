import './ui/styles.css';
import { App } from './app';
import { initKeyLabels } from './input/input';
import { roomFromUrl } from './net/peer';
import { goOnline, goTitle, initFlow } from './screens/flow';

function boot() {
  const app = new App();
  initFlow(app);
  void initKeyLabels();
  const room = roomFromUrl();
  if (room) goOnline(room);
  else goTitle();
  // handy for debugging from the console
  (window as unknown as { bbl: App }).bbl = app;
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
