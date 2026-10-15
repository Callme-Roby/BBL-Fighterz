import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { saveSettings, settings } from '../game/settings';
import { input } from '../input/input';
import { Showroom } from '../render/showroom';
import { backButton, h, syncTouchUi, uiRoot } from '../ui/dom';
import { goMenu } from './flow';
import { controlsHelp } from './help';

function chips<T extends string | number>(options: [T, string][], get: () => T, set: (v: T) => void) {
  const wrap = h('div', { class: 'chips' });
  const render = () => {
    wrap.replaceChildren(
      ...options.map(([v, label]) => {
        const b = h('button', { class: get() === v ? 'on' : '' }, label);
        b.addEventListener('click', () => {
          set(v);
          audio.sfx('cursor');
          render();
        });
        return b;
      }),
    );
  };
  render();
  return wrap;
}

export class OptionsScreen implements Screen {
  private showroom = new Showroom();

  constructor(private app: App) {}

  enter() {
    const vol = audio.getVolumes();
    const slider = (label: string, key: keyof typeof vol) => {
      const inp = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(vol[key]) });
      inp.addEventListener('input', () => {
        audio.setVolumes({ [key]: Number(inp.value) });
        if (key === 'sfx') audio.sfx('hitLight');
      });
      return h('label', { class: 'field' }, label, inp);
    };
    const apply = () => {
      saveSettings();
      this.app.applySettings();
      this.app.touch.refresh();
      syncTouchUi();
    };
    const back = h('button', { class: 'btn primary' }, 'RETOUR');
    back.addEventListener('click', () => goMenu());
    uiRoot().append(
      h(
        'div',
        { class: 'screen dim options-screen', style: 'overflow-y:auto;justify-content:flex-start;touch-action:pan-y' },
        h('div', { class: 'h1' }, 'OPTIONS'),
        h(
          'div',
          { class: 'panel options options-main' },
          h('div', { class: 'field' }, 'DIFFICULTÉ DU CPU', chips([['easy', 'FACILE'], ['normal', 'NORMAL'], ['hard', 'DUR']], () => settings.difficulty, (v) => ((settings.difficulty = v), apply()))),
          h('div', { class: 'field' }, 'ROUNDS POUR GAGNER', chips([[1, '1'], [2, '2'], [3, '3']], () => settings.rounds, (v) => ((settings.rounds = v), apply()))),
          h(
            'div',
            { class: 'field' },
            'RÉSOLUTION (PLUS BAS = PLUS RÉTRO)',
            chips([[240, '240p PS1'], [270, '270p'], [360, '360p'], [480, '480p'], [720, '720p']], () => settings.lines, (v) => ((settings.lines = v), apply())),
          ),
          h('div', { class: 'field' }, 'TRAMAGE 15 BITS', chips([[1, 'OUI'], [0, 'NON']], () => (settings.dither ? 1 : 0), (v) => ((settings.dither = v === 1), apply()))),
          h('div', { class: 'field' }, 'COMMANDES TACTILES', chips([['auto', 'AUTO'], ['on', 'TOUJOURS'], ['off', 'JAMAIS']], () => settings.touch, (v) => ((settings.touch = v), apply()))),
          slider('VOLUME GÉNÉRAL', 'master'),
          slider('MUSIQUE', 'music'),
          slider('BRUITAGES', 'sfx'),
          slider('VOIX', 'voice'),
        ),
        h(
          'div',
          { class: 'options-keys-wrap' },
          // touch screens: the on-screen controls; keyboards: the keys (the CSS follows the setting live)
          h('div', { class: 'panel options touch-only' }, controlsHelp(false, true)),
          h('div', { class: 'panel options kbd-only' }, h('div', { class: 'field' }, 'COMMANDES (1 JOUEUR)'), controlsHelp(false)),
          h('div', { class: 'panel options kbd-only' }, h('div', { class: 'field' }, 'COMMANDES (2 JOUEURS, MÊME CLAVIER)'), controlsHelp(true)),
        ),
        back,
        // scrolls away with the page (RETOUR again at the bottom)
        backButton(() => goMenu()),
      ),
    );
  }

  exit() {
    this.showroom.dispose();
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (e.action === 'back') {
        audio.sfx('cancel');
        goMenu();
        return;
      }
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
