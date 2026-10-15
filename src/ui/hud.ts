import { MAX_HP, MAX_METER, type GameState } from '../sim/types';
import { h } from './dom';

/** HUD info about a side's assist (the friend chosen before the fight). */
export interface AssistHud {
  /** friend's name */
  name: string;
  /** key that calls them, shown when ready ('' = CPU / remote / touch) */
  key: string;
}

interface AssistWidget {
  box: HTMLDivElement;
  face: HTMLDivElement;
  fill: HTMLDivElement;
  lbl: HTMLDivElement;
  key: string;
  /** longest cooldown seen since the last call (the gauge's full scale) */
  max: number;
  text: string;
  mode: string;
}

/** Tekken-3-style DOM HUD driven by the game state. */
export class Hud {
  readonly el: HTMLDivElement;
  private hp: { box: HTMLDivElement; fill: HTMLDivElement; trail: HTMLDivElement }[] = [];
  private trail = [MAX_HP, MAX_HP];
  private trailDelay = [0, 0];
  private wins: HTMLDivElement[] = [];
  private meters: { box: HTMLDivElement; fill: HTMLDivElement }[] = [];
  private timer: HTMLDivElement;
  private announceEl: HTMLDivElement | null = null;
  private announceTimer = 0;
  private comboEls: (HTMLDivElement | null)[] = [null, null];
  private comboTimers = [0, 0];
  private lastCombo = [0, 0];
  private subtitleEl: HTMLDivElement | null = null;
  private comics: { el: HTMLDivElement; t: number }[] = [];
  private comicSeq = 0;
  private netEl: HTMLDivElement;
  private plates: HTMLDivElement[] = [];
  private names: [string, string];
  private tags: [string, string];
  private bars: HTMLDivElement;
  private meterRow: HTMLDivElement;
  private meterText = ['', ''];
  private assistW: (AssistWidget | null)[] = [null, null];
  private callEls: ({ el: HTMLDivElement; t: number } | null)[] = [null, null];
  /** the attacker's current combo went through the auto-combo route */
  private autoCombo = [false, false];

  /**
   * @param names names shown on the nameplates (player or fighter names)
   * @param superKeys key shown next to "BBL MAX !" for each side ('' = CPU / remote / touch)
   * @param tags fighter played, shown after the name when it differs ('' = none; hidden on small screens)
   * @param assists each side's assist (null = none): small face + recharge gauge next to the BBL gauge
   */
  constructor(
    names: [string, string],
    private superKeys: [string, string] = ['E', 'P'],
    tags: [string, string] = ['', ''],
    assists: [AssistHud | null, AssistHud | null] = [null, null],
  ) {
    this.names = [names[0], names[1]];
    this.tags = [tags[0], tags[1]];
    const side = (i: number) => {
      const fill = h('div', { class: 'fill' });
      const trail = h('div', { class: 'trail' });
      const box = h('div', { class: 'hp' + (i === 1 ? ' right' : '') }, trail, fill);
      this.hp.push({ box, fill, trail });
      const wins = h('div', { class: 'wins' });
      this.wins.push(wins);
      const plate = h('div', { class: 'nameplate' });
      this.plates.push(plate);
      this.fillPlate(i, null);
      return h('div', null, box, h('div', { class: 'label' + (i === 1 ? ' right' : '') }, plate, wins));
    };
    this.timer = h('div', { class: 'timer' }, '60');
    this.bars = h('div', { class: 'bars' }, side(0), this.timer, side(1));
    const meter = (i: number) => {
      const fill = h('div', { class: 'mfill' });
      const box = h('div', { class: 'meter' + (i === 1 ? ' right' : '') }, h('div', { class: 'mlbl' }, 'BBL'), h('div', { class: 'mbar' }, fill));
      this.meters.push({ box, fill });
      const a = assists[i];
      if (a) {
        const face = h('div', { class: 'aface' });
        const afill = h('div', { class: 'afill' });
        const lbl = h('div', { class: 'albl' }, 'ASSIST');
        const abox = h('div', { class: 'assistw' + (i === 1 ? ' right' : ''), title: `Assist : ${a.name}` }, face, h('div', { class: 'acol' }, lbl, h('div', { class: 'abar' }, afill)));
        box.append(abox);
        this.assistW[i] = { box: abox, face, fill: afill, lbl, key: a.key, max: 0, text: 'ASSIST', mode: '' };
      }
      return box;
    };
    this.meterRow = h('div', { class: 'meters' }, meter(0), meter(1));
    this.netEl = h('div', { class: 'netinfo' });
    this.el = h('div', { class: 'hud passthrough' }, this.bars, this.meterRow, this.netEl);
  }

  setVisible(bars: boolean) {
    this.bars.style.visibility = bars ? 'visible' : 'hidden';
    this.meterRow.style.visibility = bars ? 'visible' : 'hidden';
  }

  private fillPlate(i: number, name: string | null) {
    const el = this.plates[i];
    const tag = name === null ? this.tags[i] : '';
    el.replaceChildren(h('span', null, name ?? this.names[i]));
    if (tag) el.append(h('small', null, ` (${tag})`));
    el.title = (name ?? this.names[i]) + (tag ? ` (${tag})` : '');
  }

  /** Temporary name on a nameplate (BBL MAX gags); null = the real one. */
  setName(i: number, name: string | null) {
    const el = this.plates[i];
    if (!el) return;
    this.fillPlate(i, name);
    el.classList.toggle('renamed', name !== null);
  }

  /** Face of side i's assist (loaded after the HUD is built). */
  setAssistPortrait(i: number, url: string) {
    const w = this.assistW[i];
    if (w) w.face.style.backgroundImage = `url(${url})`;
  }

  /**
   * Side i called their assist: « ISIS : UPPERCUT MUSCLÉ ! » slides in from that side,
   * with the friend's shout under it.
   */
  assistCall(i: number, who: string, move: string, line: string, portrait: string | null) {
    this.callEls[i]?.el.remove();
    const el = h(
      'div',
      { class: 'assist-call ' + (i === 0 ? 'left' : 'right') },
      h('div', { class: 'ph', style: portrait ? `background-image:url(${portrait})` : '' }),
      h('div', { class: 'txt' }, h('div', { class: 'mv' }, h('b', null, who), ' : ', move, ' !'), h('div', { class: 'shout' }, '« ' + line + ' »')),
    );
    this.el.append(el);
    this.el.classList.add(i === 0 ? 'calling-l' : 'calling-r');
    this.callEls[i] = { el, t: 110 };
  }

  setNetInfo(text: string) {
    this.netEl.textContent = text;
  }

  announce(text: string, cls = '', duration = 90) {
    this.announceEl?.remove();
    this.announceEl = h('div', { class: 'announce ' + cls }, text);
    this.el.append(this.announceEl);
    this.announceTimer = duration;
  }

  clearAnnounce() {
    this.announceEl?.remove();
    this.announceEl = null;
  }

  subtitle(name: string, portrait: string, line: string) {
    this.subtitleEl?.remove();
    const lineEl = h('div', { class: 'line' });
    this.subtitleEl = h(
      'div',
      { class: 'subtitle' },
      h('div', { class: 'ph', style: `background-image:url(${portrait})` }),
      h('div', null, h('div', { class: 'who' }, name), lineEl),
    );
    this.el.append(this.subtitleEl);
    // typewriter
    let i = 0;
    const full = '« ' + line + ' »';
    const tick = () => {
      if (!lineEl.isConnected) return;
      lineEl.textContent = full.slice(0, ++i);
      if (i < full.length) setTimeout(tick, 28);
    };
    tick();
  }

  clearSubtitle() {
    this.subtitleEl?.remove();
    this.subtitleEl = null;
  }

  /**
   * Big comic-book text over the picture (BBL MAX cinematics):
   * 'boom' = onomatopoeia at a random-ish spot, 'punch' = rap punchline, 'caption' = small caption.
   */
  comic(text: string, style: 'boom' | 'punch' | 'caption', frames: number, color?: string) {
    const n = this.comicSeq++;
    const el = h('div', { class: 'comic ' + style }, text);
    let spot: number[] | null = null;
    if (style === 'boom') {
      // scatter successive onomatopoeias around the centre
      const spots = [
        [30, 34, -8],
        [66, 46, 7],
        [40, 62, -4],
        [62, 28, 10],
        [50, 50, -10],
      ];
      spot = spots[n % spots.length];
      el.style.left = spot[0] + '%';
      el.style.top = spot[1] + '%';
      el.style.setProperty('--rot', spot[2] + 'deg');
    }
    if (color) el.style.setProperty('--comic', color);
    if (style !== 'boom') for (const c of this.comics) if (c.el.classList.contains(style)) c.t = Math.min(c.t, 1);
    this.el.append(el);
    if (spot) {
      // narrow screens: keep the whole word inside the picture
      const W = this.el.clientWidth;
      const w = el.offsetWidth;
      if (W > 0 && w > 0) {
        const m = Math.min(12, W * 0.03);
        const x = (spot[0] / 100) * W;
        const cx = w + 2 * m >= W ? W / 2 : Math.min(W - m - w / 2, Math.max(m + w / 2, x));
        if (Math.abs(cx - x) > 0.5) el.style.left = cx + 'px';
      }
    }
    this.comics.push({ el, t: frames });
  }

  clearComics() {
    for (const c of this.comics) c.el.remove();
    this.comics.length = 0;
  }

  update(s: GameState, dtFrames: number) {
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      const pct = Math.max(0, f.hp / MAX_HP) * 100;
      this.hp[i].fill.style.width = pct + '%';
      this.hp[i].box.classList.toggle('low', pct < 25 && pct > 0);
      // red damage trail drains after a short delay (Tekken style)
      if (f.hp < this.trail[i]) {
        if (f.comboCount > 0 && f.action !== 'idle') this.trailDelay[i] = 30;
        else this.trailDelay[i] -= dtFrames;
        if (this.trailDelay[i] <= 0) this.trail[i] = Math.max(f.hp, this.trail[i] - 1.6 * dtFrames);
      } else {
        this.trail[i] = f.hp;
      }
      this.hp[i].trail.style.width = (this.trail[i] / MAX_HP) * 100 + '%';

      const need = s.roundsToWin;
      if (this.wins[i].childElementCount !== need) this.wins[i].replaceChildren(...Array.from({ length: need }, () => h('i')));
      Array.from(this.wins[i].children).forEach((el, k) => el.classList.toggle('on', k < f.wins));

      const m = f.meter / MAX_METER;
      this.meters[i].fill.style.width = m * 100 + '%';
      this.meters[i].box.classList.toggle('full', f.meter >= MAX_METER);
      const key = this.superKeys[i];
      const txt = f.meter >= MAX_METER ? (key ? `BBL MAX ! APPUIE SUR ${key}` : 'BBL MAX !') : 'BBL';
      if (txt !== this.meterText[i]) {
        this.meterText[i] = txt;
        (this.meters[i].box.firstChild as HTMLElement).textContent = txt;
      }

      this.updateAssist(i, s);

      // combo counter shows on the attacker's side
      const victim = s.fighters[1 - i];
      if (victim.comboCount === 0) this.autoCombo[i] = false;
      else if ((f.autoStep ?? 0) >= 2) this.autoCombo[i] = true;
      if (victim.comboCount >= 2 && victim.comboCount !== this.lastCombo[i]) {
        this.comboEls[i]?.remove();
        const el = h(
          'div',
          { class: 'combo ' + (i === 0 ? 'left' : 'right') },
          h('b', null, `${victim.comboCount} HITS`),
          h('span', null, `${victim.comboDamage} DÉGÂTS`),
          this.autoCombo[i] ? h('em', null, 'AUTO-COMBO') : null,
        );
        this.comboEls[i] = el;
        this.el.append(el);
        this.comboTimers[i] = 80;
      }
      if (victim.counterHit && victim.comboCount === 1 && this.lastCombo[i] === 0) {
        this.comboEls[i]?.remove();
        const el = h('div', { class: 'combo ' + (i === 0 ? 'left' : 'right') }, h('span', { class: 'ch' }, 'COUNTER HIT!'));
        this.comboEls[i] = el;
        this.el.append(el);
        this.comboTimers[i] = 50;
      }
      this.lastCombo[i] = victim.comboCount;
      if (this.comboTimers[i] > 0) {
        this.comboTimers[i] -= dtFrames;
        if (this.comboTimers[i] <= 0) {
          this.comboEls[i]?.remove();
          this.comboEls[i] = null;
        }
      }
    }
    const secs = Math.ceil(s.timer / 60);
    this.timer.textContent = String(secs);
    this.timer.classList.toggle('warn', secs <= 10 && s.phase === 'fight');

    for (let i = 0; i < 2; i++) {
      const c = this.callEls[i];
      if (!c) continue;
      c.t -= dtFrames;
      if (c.t <= 0) {
        c.el.remove();
        this.callEls[i] = null;
        this.el.classList.remove(i === 0 ? 'calling-l' : 'calling-r');
      } else if (c.t <= 14) c.el.classList.add('out');
    }

    for (let i = this.comics.length - 1; i >= 0; i--) {
      const c = this.comics[i];
      c.t -= dtFrames;
      if (c.t <= 0) {
        c.el.remove();
        this.comics.splice(i, 1);
      }
    }

    if (this.announceTimer > 0) {
      this.announceTimer -= dtFrames;
      if (this.announceTimer <= 0) this.clearAnnounce();
    }
  }

  /** Assist face + recharge gauge: lit « ASSIST ! » when ready, empty while the friend is on screen. */
  private updateAssist(i: number, s: GameState) {
    const w = this.assistW[i];
    const a = s.assists?.[i];
    if (!w || !a) return;
    const busy = a.phase !== 'off';
    const cd = Math.max(0, a.cooldown);
    if (cd > w.max) w.max = cd;
    const ready = !busy && cd <= 0;
    if (ready) w.max = 0;
    const frac = ready ? 1 : w.max > 0 ? 1 - cd / w.max : 0;
    w.fill.style.width = (busy ? 0 : frac * 100) + '%';
    const mode = ready ? 'ready' : busy ? 'busy' : 'cool';
    if (mode !== w.mode) {
      w.mode = mode;
      w.box.classList.toggle('ready', ready);
      w.box.classList.toggle('busy', busy);
    }
    const text = ready ? (w.key ? `ASSIST ! ${w.key}` : 'ASSIST !') : busy ? 'EN PISTE' : 'ASSIST';
    if (text !== w.text) {
      w.text = text;
      w.lbl.textContent = text;
    }
  }
}
