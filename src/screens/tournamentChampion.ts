/**
 * TOURNOI — champion screen: the winner's fighter celebrates in the 3D
 * studio under a rain of confetti.
 */
import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { fullRoster } from '../game/settings';
import { champion, clearTournament, fighterOf, finalist, type Tournament } from '../game/tournament';
import { input } from '../input/input';
import { Showroom } from '../render/showroom';
import { h, Menu, uiRoot } from '../ui/dom';
import { goMenu, goTournament } from './flow';
import { centerShowroom, noButtonFocus } from './tournamentShared';

const CONFETTI_COLORS = ['#ffd23a', '#ff8a1c', '#d8202a', '#29d7c4', '#7cc4ff', '#ffffff', '#c040ff'];
/** seconds between two victory poses */
const POSE_EVERY = 4.5;

export class TournamentChampionScreen implements Screen {
  private showroom = new Showroom();
  private menu: Menu | null = null;
  private poseTime = 0;
  private pose = 0;
  private ready = false;

  constructor(
    private app: App,
    private t: Tournament,
  ) {
    centerShowroom(this.showroom);
    this.showroom.cameraPos.set(0, 1.3, 3.9);
    this.showroom.cameraLook.set(0, 1.05, 0);
  }

  enter() {
    // the tournament is over: nothing left to resume
    clearTournament();
    audio.playMusic('victory', { loop: false });
    void audio.announcer('youWin');

    const t = this.t;
    const roster = fullRoster();
    const w = champion(t) ?? 0;
    const p = t.participants[w];
    const def = fighterOf(t, w, roster);
    void this.showroom.show(0, def).then(() => {
      this.ready = true;
      this.showroom.play(0, 'win0');
    });

    const loser = finalist(t);
    const confetti = h('div', { class: 'tn-confetti passthrough' });
    for (let i = 0; i < 90; i++) {
      const c = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      const style = [
        `left:${(Math.random() * 100).toFixed(1)}%`,
        `background:${c}`,
        `animation-delay:${(-Math.random() * 6).toFixed(2)}s`,
        `animation-duration:${(3.5 + Math.random() * 3).toFixed(2)}s`,
        `--drift:${(Math.random() * 160 - 80).toFixed(0)}px`,
        `--spin:${(Math.random() * 1440 - 720).toFixed(0)}deg`,
        `width:${(6 + Math.random() * 6).toFixed(0)}px`,
        `height:${(8 + Math.random() * 10).toFixed(0)}px`,
      ].join(';');
      confetti.append(h('i', { style }));
    }

    this.menu = new Menu(
      [
        { label: 'NOUVEAU TOURNOI', sub: 'Mêmes participants, nouveaux choix', action: () => (audio.sfx('confirm'), goTournament(t.participants)) },
        { label: 'MENU PRINCIPAL', action: () => (audio.sfx('confirm'), goMenu()) },
      ],
      () => audio.sfx('cursor'),
    );
    const root = h(
      'div',
      { class: 'screen tn-champ' },
      confetti,
      h(
        'div',
        { class: 'tn-champ-top' },
        h('div', { class: 'tn-champ-title' }, 'CHAMPION DU TOURNOI'),
        h('div', { class: 'tn-champ-name' }, p.name),
        h('div', { class: 'tn-champ-fighter' }, `avec ${def.name}`, p.cpu ? h('span', { class: 'tn-cpu' }, 'CPU') : null),
        loser !== null ? h('div', { class: 'title-hint' }, `vainqueur de la finale contre ${t.participants[loser].name}`) : null,
      ),
      this.menu.el,
    );
    noButtonFocus(root);
    uiRoot().append(root);
  }

  exit() {
    this.showroom.dispose();
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (!this.menu) continue;
      if (e.action === 'up') this.menu.move(-1);
      else if (e.action === 'down') this.menu.move(1);
      else if (e.action === 'confirm' || e.action === 'start') {
        this.menu.activate();
        return;
      } else if (e.action === 'back') {
        audio.sfx('cancel');
        goMenu();
        return;
      }
    }
    // cycle through the victory poses
    if (this.ready) {
      this.poseTime += dt;
      if (this.poseTime > POSE_EVERY) {
        this.poseTime = 0;
        this.pose = (this.pose + 1) % 3;
        this.showroom.play(0, 'win' + this.pose);
      }
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
