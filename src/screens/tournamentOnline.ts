/**
 * TOURNOI — entry (on this browser / online) and the online tournament screen:
 * lobby (link to share, participants, name + fighter of this player) then the
 * live bracket (next match, who is fighting, organiser's controls).
 * The network side lives in src/game/onlineTournament.ts.
 */
import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { assistOf, ASSIST_KIND_LABEL } from '../data/assists';
import { ROSTER, type FighterDef } from '../data/roster';
import { entryFighter, OnlineTournament, savedPlayerName } from '../game/onlineTournament';
import { fullRoster, settings } from '../game/settings';
import { assistOfParticipant, fighterOf, humansIn, matchTitle, MAX_PARTICIPANTS, NAME_MAX, totalMatches } from '../game/tournament';
import { input } from '../input/input';
import { tournamentInviteUrl } from '../net/peer';
import { loadFace } from '../render/faceTexture';
import { Showroom } from '../render/showroom';
import { backButton, h, Menu, uiRoot, type MenuItem } from '../ui/dom';
import { goMenu, goTournament, goTournamentOnline } from './flow';
import { assistTag, bracketTree, centerShowroom, controlsEl, guardButtons, portrait, syncMenuFocus } from './tournamentShared';

const DIFF_LABEL = { easy: 'FACILE', normal: 'NORMAL', hard: 'DIFFICILE' } as const;

function niceError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/unavailable-id|could not connect|peer-unavailable/i.test(msg)) return 'Tournoi introuvable : le lien a peut-être expiré, ou l’organisateur a fermé sa page.';
  return msg;
}

/** Share field: the link + COPIER (+ PARTAGER on phones). */
function shareBox(url: string): HTMLElement {
  const field = h('input', { value: url, readOnly: true });
  const copy = h('button', { class: 'btn primary' }, 'COPIER LE LIEN');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      field.select();
      document.execCommand?.('copy');
    }
    copy.textContent = 'COPIÉ !';
    audio.sfx('confirm');
  });
  const share = h('button', { class: 'btn' }, 'PARTAGER');
  share.addEventListener('click', () => {
    void navigator.share?.({ title: 'BBL FIGHTERZ — TOURNOI', text: 'Rejoins le tournoi BBL FIGHTERZ !', url }).catch(() => undefined);
  });
  return h('div', { class: 'share' }, field, copy, typeof navigator.share === 'function' ? share : null);
}

// ===========================================================================
// entry: on this browser / create online / join online
// ===========================================================================
export class TournamentHomeScreen implements Screen {
  private showroom = new Showroom();
  private root!: HTMLElement;
  private menu: Menu | null = null;
  private busy = false;

  constructor(
    private app: App,
    /** invitation code from a ?tournoi= link: straight to "join" */
    private joinCode?: string,
  ) {}

  enter() {
    audio.playMusic('select');
    this.root = h('div', { class: 'screen dim tn-center' });
    guardButtons(this.root);
    uiRoot().append(this.root);
    if (this.joinCode) this.askName('join', this.joinCode);
    else this.home();
  }

  exit() {
    this.showroom.dispose();
  }

  private home() {
    this.menu = new Menu(
      [
        { label: 'SUR CE NAVIGATEUR', sub: 'Tout le monde joue sur cet écran (clavier / manettes)', action: () => (audio.sfx('confirm'), goTournament()) },
        { label: 'EN LIGNE : CRÉER UN TOURNOI', sub: 'Tu envoies un lien, chacun joue depuis chez soi', action: () => this.askName('create') },
        { label: 'EN LIGNE : REJOINDRE', sub: 'Colle le lien ou le code reçu', action: () => this.askCode() },
        { label: 'RETOUR', action: () => (audio.sfx('cancel'), goMenu()) },
      ],
      () => audio.sfx('cursor'),
    );
    syncMenuFocus(this.menu);
    this.root.replaceChildren(h('div', { class: 'h1' }, 'TOURNOI'), h('div', { class: 'title-hint' }, "Élimination directe, jusqu'à 16 participants"), this.menu.el);
  }

  private askCode() {
    this.menu = null;
    audio.sfx('confirm');
    const field = h('input', { placeholder: 'Lien ou code (ex : k7m2pq)', autocomplete: 'off', spellcheck: false });
    const go = h('button', { class: 'btn primary' }, 'SUIVANT');
    const status = h('div', { class: 'status' }, '');
    const submit = () => {
      const v = field.value.trim();
      const m = v.match(/[?&]tournoi=([a-z0-9]+)/i);
      const code = (m ? m[1] : v).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (code.length >= 4) this.askName('join', code);
      else {
        status.textContent = 'Code invalide.';
        status.classList.add('err');
      }
    };
    go.addEventListener('click', submit);
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') this.home();
    });
    const back = h('button', { class: 'btn' }, 'RETOUR');
    back.addEventListener('click', () => this.home());
    this.root.replaceChildren(h('div', { class: 'h1' }, 'REJOINDRE UN TOURNOI'), h('div', { class: 'share' }, field, go), status, back);
    setTimeout(() => field.focus(), 50);
  }

  private askName(kind: 'create' | 'join', code = '') {
    this.menu = null;
    audio.sfx('confirm');
    const field = h('input', { value: savedPlayerName(), placeholder: 'Ton nom', maxLength: NAME_MAX, autocomplete: 'off', spellcheck: false });
    const go = h('button', { class: 'btn primary' }, kind === 'create' ? 'CRÉER LE TOURNOI' : 'REJOINDRE');
    const submit = () => {
      if (this.busy) return;
      const name = field.value.trim();
      if (!name) {
        field.focus();
        return;
      }
      void (kind === 'create' ? this.create(name) : this.join(code, name));
    };
    go.addEventListener('click', submit);
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') this.home();
    });
    const back = h('button', { class: 'btn' }, 'RETOUR');
    back.addEventListener('click', () => (this.joinCode ? goMenu() : this.home()));
    this.root.replaceChildren(
      h('div', { class: 'h1' }, kind === 'create' ? 'CRÉER UN TOURNOI EN LIGNE' : 'REJOINDRE LE TOURNOI'),
      h('div', { class: 'title-hint' }, kind === 'create' ? 'Tu seras l’organisateur : garde cette page ouverte pendant tout le tournoi.' : `Code : ${code.toUpperCase()}`),
      h('div', { class: 'share' }, field, go),
      h('div', { class: 'status' }, ''),
      back,
    );
    setTimeout(() => {
      field.focus();
      field.select();
    }, 50);
  }

  private setStatus(text: string, err = false) {
    const el = this.root.querySelector('.status');
    if (el) {
      el.textContent = text;
      el.classList.toggle('err', err);
      el.classList.toggle('blink', !err && !!text);
    }
  }

  private async create(name: string) {
    this.busy = true;
    this.setStatus('Connexion…');
    try {
      await OnlineTournament.create(name, (s) => this.setStatus(s));
      audio.sfx('confirm');
      goTournamentOnline();
    } catch (e) {
      console.warn(e);
      this.setStatus(niceError(e), true);
    } finally {
      this.busy = false;
    }
  }

  private async join(code: string, name: string) {
    this.busy = true;
    this.setStatus('Connexion…');
    try {
      await OnlineTournament.join(code, name, (s) => this.setStatus(s));
      // the ?tournoi= link stays in the address bar: reloading the page rejoins (same slot)
      audio.sfx('confirm');
      goTournamentOnline();
    } catch (e) {
      console.warn(e);
      this.setStatus(niceError(e), true);
    } finally {
      this.busy = false;
    }
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (!this.menu) {
        if (e.action === 'back' && !document.activeElement?.matches('input')) {
          if (this.joinCode) goMenu();
          else this.home();
          return;
        }
        continue;
      }
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
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}

// ===========================================================================
// online: lobby + live bracket
// ===========================================================================
export class TournamentOnlineScreen implements Screen {
  private showroom = new Showroom();
  private roster: FighterDef[] = fullRoster();
  private root!: HTMLElement;
  private ot: OnlineTournament | null = OnlineTournament.current;
  private unsub: (() => void) | null = null;
  private menu: Menu | null = null;
  private confirmEl: HTMLElement | null = null;
  private confirmMenu: Menu | null = null;
  /** lobby: grid cursor (keyboard) */
  private cursor = 0;
  private cols = 6;
  private nameField: HTMLInputElement | null = null;
  private shownFighter = '';
  /** players mashing buttons at the end of a fight must not launch the next one by accident */
  private enteredAt = performance.now();

  constructor(private app: App) {
    centerShowroom(this.showroom);
    this.showroom.cameraPos.set(0, 1.4, 4.4);
    this.showroom.cameraLook.set(0, 1.12, 0);
  }

  enter() {
    audio.playMusic('select');
    this.root = h('div', { class: 'tn-online' });
    guardButtons(this.root);
    uiRoot().append(this.root);
    const ot = this.ot;
    if (!ot) {
      goMenu();
      return;
    }
    ot.shown('tournament');
    this.unsub = ot.subscribe(() => this.render());
    this.render();
  }

  exit() {
    this.unsub?.();
    this.confirmEl?.remove();
    this.showroom.dispose();
  }

  private render() {
    const ot = this.ot!;
    if (ot.started && ot.tour) this.renderBracket();
    else this.renderLobby();
  }

  // ------------------------------------------------------------------ lobby
  private renderLobby() {
    const ot = this.ot!;
    // keep what is being typed
    const typing = this.nameField && document.activeElement === this.nameField ? this.nameField.value : null;
    const mine = ot.me >= 0 ? ot.entries[ot.me] : null;
    const myDef = mine ? entryFighter(mine, this.roster) : null;
    this.updateShowroom(myDef);

    const rows = ot.entries.map((e, i) => {
      const def = entryFighter(e, this.roster);
      const friend = e.assistId ? (ROSTER.find((d) => d.id === e.assistId) ?? null) : null;
      const tag = e.cpu ? 'CPU' : !e.online ? 'HORS LIGNE' : e.fighterId ? 'PRÊT' : 'CHOISIT…';
      const del = ot.isHost && i !== ot.me ? h('button', { class: 'tn-del', title: 'Retirer' }, '✕') : null;
      del?.addEventListener('click', () => (audio.sfx('cancel'), ot.remove(i)));
      return h(
        'div',
        { class: 'tn-lrow' + (i === ot.me ? ' me' : '') + (e.fighterId ? ' ready' : '') },
        h('span', { class: 'tn-seed' }, String(i + 1)),
        portrait(def),
        h(
          'div',
          { class: 'tn-info' },
          h('span', { class: 'tn-name' }, e.name, i === 0 && !e.cpu ? h('span', { class: 'tn-org' }, ' ★ ORGA') : null),
          h('span', { class: 'tn-fighter' }, def ? def.name : '—', h('span', { class: 'tn-lassist' }, ' + ', friend ? friend.name : '?')),
        ),
        i === ot.me ? h('span', { class: 'tn-you' }, 'TOI') : null,
        h('span', { class: 'tn-ltag' + (e.cpu ? ' cpu' : e.fighterId ? ' ok' : '') }, tag),
        del,
      );
    });

    // my name + fighter grid
    let me: HTMLElement;
    if (mine) {
      const field = h('input', { value: typing ?? mine.name, maxLength: NAME_MAX, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Ton nom' });
      this.nameField = field;
      const commit = () => ot.setMe(field.value, myDef);
      field.addEventListener('change', commit);
      field.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === 'Escape') {
          ev.preventDefault();
          commit();
          field.blur();
        }
      });
      const all = this.roster;
      this.cols = Math.min(6, all.length);
      const grid = h('div', { class: 'grid tn-lgrid', style: `--cols:${this.cols}` });
      all.forEach((def, i) => {
        const cell = h('div', { class: 'cell' + (myDef?.id === def.id ? ' p1' : '') + (i === this.cursor ? ' cur' : '') }, h('div', { class: 'nm' }, def.name));
        loadFace(def).then((f) => (cell.style.backgroundImage = `url(${f.portraitUrl})`));
        cell.addEventListener('click', () => this.pick(i));
        grid.append(cell);
      });
      // assist: the built-in fighters (every browser knows them) except mine, « ? » = au hasard
      const myAssist = mine.assistId ? (ROSTER.find((d) => d.id === mine.assistId) ?? null) : null;
      const agrid = h('div', { class: 'grid tn-lgrid tn-agrid', style: `--cols:${this.cols}` });
      [...ROSTER, null].forEach((def) => {
        const own = !!def && def.id === myDef?.id;
        const on = def ? myAssist?.id === def.id : !myAssist;
        const cell = h(
          'div',
          { class: 'cell' + (def ? '' : ' special') + (on ? ' a1' : '') + (own ? ' own' : ''), title: def ? `${def.name} : ${assistOf(def).name}` : 'Au hasard' },
          def ? h('div', { class: 'nm' }, def.name) : '?',
        );
        if (def) loadFace(def).then((f) => (cell.style.backgroundImage = `url(${f.portraitUrl})`));
        cell.addEventListener('click', () => {
          if (own) {
            audio.sfx('cancel');
            return;
          }
          audio.sfx('confirm');
          ot.setMe(this.nameField?.value ?? mine.name, myDef, def?.id ?? '');
        });
        agrid.append(cell);
      });
      const a = myAssist ? assistOf(myAssist) : null;
      me = h(
        'div',
        { class: 'panel tn-lme' },
        h('div', { class: 'field' }, 'TON NOM', field),
        h('div', { class: 'field' }, myDef ? `TON PERSO : ${myDef.name}` : 'CHOISIS TON PERSO', grid),
        h(
          'div',
          { class: 'field' },
          myAssist && a ? `TON ASSIST : ${myAssist.name} — ${a.name} (${ASSIST_KIND_LABEL[a.kind]})` : 'TON ASSIST : AU HASARD',
          agrid,
        ),
      );
    } else {
      this.nameField = null;
      me = h('div', { class: 'panel tn-lme' }, h('div', { class: 'status' }, ot.entries.length >= MAX_PARTICIPANTS ? 'Le tournoi est complet : tu le regardes en spectateur.' : 'Tu regardes ce tournoi en spectateur.'));
    }

    const items: MenuItem[] = [];
    // keyboard / gamepad: Entrée changes the assist (mouse / touch: tap a face)
    const assistItem: MenuItem | null = mine
      ? {
          label: 'CHANGER D’ASSIST',
          sub: mine.assistId ? `Assist : ${ROSTER.find((d) => d.id === mine.assistId)?.name ?? '?'}` : 'Assist : au hasard',
          action: () => this.cycleAssist(),
        }
      : null;
    if (ot.isHost) {
      items.push({
        label: 'LANCER LE TOURNOI',
        sub: ot.canStart() ? `${ot.entries.length} participants · ${ot.entries.length - 1} combats` : ot.entries.length < 2 ? 'Il faut au moins 2 participants' : 'Tout le monde doit choisir son perso',
        disabled: !ot.canStart(),
        action: () => (audio.sfx('confirm'), ot.start()),
      });
      if (assistItem) items.push(assistItem);
      items.push({ label: '+ AJOUTER UN CPU', disabled: ot.entries.length >= MAX_PARTICIPANTS, action: () => (audio.sfx('confirm'), ot.addCpu()) });
      items.push({ label: "MÉLANGER L'ORDRE", sub: 'Ordre des têtes de série', action: () => (audio.sfx('confirm'), ot.shuffleOrder()) });
      items.push({ label: 'ANNULER LE TOURNOI', action: () => this.askLeave() });
    } else {
      if (assistItem) items.push(assistItem);
      items.push({ label: 'QUITTER', action: () => this.askLeave() });
    }
    this.setMenu(items);

    const url = tournamentInviteUrl(ot.code);
    this.root.className = 'tn-online lobby';
    this.root.replaceChildren(
      h('div', { class: 'tn-ltop' }, h('div', { class: 'h1' }, 'TOURNOI EN LIGNE'), h('div', { class: 'title-hint' }, 'CODE : ', h('b', { class: 'tn-code' }, ot.code.toUpperCase()))),
      shareBox(url),
      h(
        'div',
        { class: 'tn-lbody' },
        h(
          'div',
          { class: 'panel tn-llist' },
          h('div', { class: 'field' }, `PARTICIPANTS (${ot.entries.length}/${MAX_PARTICIPANTS})`),
          h('div', { class: 'tn-lrows' }, rows),
          ot.isHost
            ? h(
                'div',
                { class: 'title-hint' },
                `Règles : ${settings.rounds} manche${settings.rounds > 1 ? 's' : ''} gagnante${settings.rounds > 1 ? 's' : ''} · CPU ${DIFF_LABEL[settings.difficulty]} (menu OPTIONS)`,
              )
            : null,
        ),
        me,
      ),
      h('div', { class: 'tn-lactions' }, this.menu!.el),
      ...(ot.status ? [h('div', { class: 'status' }, ot.status)] : []),
    );
    this.root.append(backButton(() => this.askLeave()));
  }

  private pick(i: number) {
    const ot = this.ot!;
    const def = this.roster[i];
    if (!def || ot.me < 0) return;
    this.cursor = i;
    audio.sfx('confirm');
    ot.setMe(this.nameField?.value ?? ot.entries[ot.me].name, def);
  }

  /** Next assist in the roster order (« HASARD » after the last one), skipping my own fighter. */
  private cycleAssist() {
    const ot = this.ot!;
    const mine = ot.me >= 0 ? ot.entries[ot.me] : null;
    if (!mine) return;
    const ids = ['', ...ROSTER.map((d) => d.id).filter((id) => id !== mine.fighterId)];
    const k = ids.indexOf(mine.assistId);
    audio.sfx('cursor');
    ot.setMe(this.nameField?.value ?? mine.name, entryFighter(mine, this.roster), ids[(k + 1) % ids.length]);
  }

  private updateShowroom(def: FighterDef | null) {
    const id = def?.id ?? '';
    if (id === this.shownFighter) return;
    this.shownFighter = id;
    void this.showroom.show(0, def).then(() => def && this.showroom.play(0, 'win0'));
  }

  // ------------------------------------------------------------------ bracket
  private renderBracket() {
    const ot = this.ot!;
    const t = ot.tour!;
    this.updateShowroom(null);
    const offline = ot.entries.map((e) => !e.online);
    const head = h(
      'div',
      { class: 'tn-head' },
      h('div', { class: 'h1' }, 'TOURNOI'),
      h('div', { class: 'tn-progress' }, `EN LIGNE · ${t.played} / ${totalMatches(t)} COMBATS · ${t.participants.length} PARTICIPANTS · CODE ${ot.code.toUpperCase()}`),
    );
    const live = ot.live ? { r: ot.live.r, m: ot.live.m } : null;
    const wrap = h('div', { class: 'tn-bracket-wrap' }, head, bracketTree(t, this.roster, { me: ot.me, offline, live }));
    this.root.className = 'tn-online tn-bracket-screen';
    this.root.replaceChildren(wrap, this.panel(), backButton(() => this.askLeave()));
    const next = this.root.querySelector('.tn-match.live, .tn-match.next') as HTMLElement | null;
    requestAnimationFrame(() => next?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
  }

  private vsCard(a: number, b: number): HTMLElement {
    const ot = this.ot!;
    const t = ot.tour!;
    const side = (i: number, cls: 'l' | 'r') => {
      const p = t.participants[i];
      const def = fighterOf(t, i, this.roster);
      const tag = p.cpu ? 'CPU' : !ot.entries[i]?.online ? 'HORS LIGNE' : i === ot.me ? 'TOI' : 'EN LIGNE';
      return h(
        'div',
        { class: 'tn-vs-side ' + cls },
        portrait(def, 'tn-vs-ph'),
        h('div', { class: 'tn-vs-name' }, p.name),
        h('div', { class: 'tn-vs-fighter' }, def.name),
        assistTag(assistOfParticipant(t, i, this.roster)),
        h('div', { class: 'tn-vs-tag' + (p.cpu ? ' cpu' : !ot.entries[i]?.online ? ' off' : '') }, tag),
      );
    };
    return h('div', { class: 'tn-vs' }, side(a, 'l'), h('div', { class: 'tn-vs-word' }, 'VS'), side(b, 'r'));
  }

  private panel(): HTMLElement {
    const ot = this.ot!;
    const t = ot.tour!;
    const panel = h('div', { class: 'panel tn-panel' });
    if (ot.flash) panel.append(h('div', { class: 'tn-flash' }, ot.flash));
    if (ot.status) panel.append(h('div', { class: 'status blink' }, ot.status));
    const items: MenuItem[] = [];
    const live = ot.live;
    const cur = t.current;
    if (live) {
      const inIt = live.a === ot.me || live.b === ot.me;
      panel.append(
        h('div', { class: 'tn-next-k tn-live-k' }, '● COMBAT EN COURS'),
        h('div', { class: 'tn-next-title' }, live.title),
        this.vsCard(live.a, live.b),
      );
      if (ot.canWatch()) items.push({ label: 'REGARDER LE COMBAT', sub: 'En direct', action: () => (audio.sfx('confirm'), ot.watch()) });
      else if (inIt) panel.append(h('div', { class: 'status' }, 'Connexion au combat…'));
      if (ot.isHost) {
        const offA = !ot.entries[live.a]?.online;
        const offB = !ot.entries[live.b]?.online;
        if (offA || offB) {
          const winner = offA ? 1 : 0;
          const wName = t.participants[offA ? live.b : live.a].name;
          if (!(offA && offB)) items.push({ label: `VICTOIRE À ${wName}`, sub: 'Par forfait', action: () => (audio.sfx('confirm'), ot.forfeit(winner as 0 | 1)) });
        }
        items.push({ label: 'ANNULER CE COMBAT', sub: 'Il sera rejoué', action: () => (audio.sfx('cancel'), ot.cancelLive()) });
      }
    } else if (cur) {
      const m = t.rounds[cur.r][cur.m];
      const a = m.a as number;
      const b = m.b as number;
      const humans = humansIn(t, m);
      const inIt = a === ot.me || b === ot.me;
      panel.append(
        h('div', { class: 'tn-next-k' }, inIt ? "C'EST TON TOUR !" : 'PROCHAIN COMBAT'),
        h('div', { class: 'tn-next-title' }, matchTitle(t, cur.r, cur.m)),
        this.vsCard(a, b),
      );
      if (inIt) panel.append(controlsEl(1));
      const offA = !t.participants[a].cpu && !ot.entries[a]?.online;
      const offB = !t.participants[b].cpu && !ot.entries[b]?.online;
      if (ot.isHost) {
        if (offA || offB) {
          panel.append(h('div', { class: 'status err' }, `${t.participants[offA ? a : b].name} est hors ligne.`));
          if (!(offA && offB)) items.push({ label: `VICTOIRE À ${t.participants[offA ? b : a].name}`, sub: 'Par forfait', action: () => (audio.sfx('confirm'), ot.forfeit(offA ? 1 : 0)) });
          items.push({ label: `REMPLACER ${t.participants[offA ? a : b].name} PAR LE CPU`, action: () => (audio.sfx('confirm'), ot.replaceByCpu(offA ? a : b)) });
        } else {
          items.push({
            label: humans ? 'LANCER LE COMBAT !' : 'REGARDER LE COMBAT (CPU)',
            sub: humans === 2 ? 'Les deux joueurs s’affrontent, les autres regardent' : humans === 1 ? 'Le joueur affronte le CPU, les autres regardent' : 'Joué sur ton écran, diffusé à tous',
            action: () => (audio.sfx('confirm'), ot.launch()),
          });
          if (!humans) items.push({ label: 'SIMULER', sub: 'Résultat instantané', action: () => (audio.sfx('confirm'), ot.simulate()) });
        }
      } else {
        panel.append(h('div', { class: 'status blink' }, offA || offB ? "En attente d'un joueur…" : "L'organisateur va lancer le combat…"));
      }
    } else {
      panel.append(h('div', { class: 'status' }, 'Tournoi terminé !'));
    }
    items.push(ot.isHost ? { label: 'ARRÊTER LE TOURNOI', sub: 'Pour tout le monde', action: () => this.askLeave() } : { label: 'QUITTER LE TOURNOI', action: () => this.askLeave() });
    this.setMenu(items);
    panel.append(this.menu!.el);
    panel.append(h('div', { class: 'tn-saved' }, ot.isHost ? 'Tu es l’organisateur : garde cette page ouverte' : 'Les combats se lancent tout seuls quand c’est ton tour'));
    return panel;
  }

  private setMenu(items: MenuItem[]) {
    const prev = this.menu?.index ?? 0;
    this.menu = new Menu(items, () => audio.sfx('cursor'));
    syncMenuFocus(this.menu);
    const first = items.findIndex((it) => !it.disabled);
    this.menu.select(Math.min(Math.max(prev, first < 0 ? 0 : first), items.length - 1), false);
  }

  // ------------------------------------------------------------------ leaving
  private askLeave() {
    const ot = this.ot!;
    audio.sfx('confirm');
    this.confirmMenu = new Menu(
      [
        { label: 'NON, RESTER', action: () => this.closeConfirm() },
        {
          label: ot.isHost ? 'OUI, ARRÊTER LE TOURNOI' : 'OUI, QUITTER',
          sub: ot.isHost ? 'Tous les participants seront déconnectés' : ot.started ? 'Ta place sera gardée si tu reviens avec le lien' : undefined,
          action: () => {
            audio.sfx('cancel');
            if (ot.isHost) ot.endForAll();
            else ot.close();
            goMenu();
          },
        },
      ],
      () => audio.sfx('cursor'),
    );
    syncMenuFocus(this.confirmMenu);
    this.confirmEl = h(
      'div',
      { class: 'overlay tn-confirm' },
      h('div', { class: 'h1' }, ot.isHost ? 'ARRÊTER LE TOURNOI ?' : 'QUITTER LE TOURNOI ?'),
      this.confirmMenu.el,
    );
    guardButtons(this.confirmEl);
    uiRoot().append(this.confirmEl);
  }

  private closeConfirm() {
    audio.sfx('cancel');
    this.confirmEl?.remove();
    this.confirmEl = null;
    this.confirmMenu = null;
  }

  // ------------------------------------------------------------------ loop
  frame(dt: number) {
    const typing = document.activeElement?.matches('input') ?? false;
    for (const e of input.menuEvents()) {
      if (typing) continue;
      const menu = this.confirmMenu ?? this.menu;
      if (e.action === 'back') {
        if (this.confirmMenu) this.closeConfirm();
        else this.askLeave();
        continue;
      }
      const ot = this.ot;
      // lobby: arrows move in the fighter grid, the menu is reached with up/down at its edges
      if (!this.confirmMenu && ot && !ot.started && ot.me >= 0 && (e.action === 'left' || e.action === 'right')) {
        const n = this.roster.length;
        this.cursor = (this.cursor + (e.action === 'left' ? -1 : 1) + n) % n;
        audio.sfx('cursor');
        this.markCursor();
        continue;
      }
      if (!menu) continue;
      if (e.action === 'up') menu.move(-1);
      else if (e.action === 'down') menu.move(1);
      else if (e.action === 'confirm' || e.action === 'start') {
        if (performance.now() - this.enteredAt < 1500) continue;
        menu.activate();
      }
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }

  /** Keyboard / gamepad in the lobby: ← → browse the fighters (the highlighted one is chosen). */
  private markCursor() {
    this.root.querySelectorAll('.tn-lgrid .cell').forEach((c, i) => c.classList.toggle('cur', i === this.cursor));
    const ot = this.ot;
    if (ot && ot.me >= 0) this.pick(this.cursor);
  }
}

// ===========================================================================
// simple message screen (tournament ended, connection lost...)
// ===========================================================================
export class MessageScreen implements Screen {
  private showroom = new Showroom();
  private menu!: Menu;

  constructor(
    private app: App,
    private title: string,
    private message: string,
  ) {}

  enter() {
    audio.playMusic('select');
    this.menu = new Menu([{ label: 'MENU PRINCIPAL', action: () => goMenu() }], () => audio.sfx('cursor'));
    const root = h('div', { class: 'screen dim tn-center' }, h('div', { class: 'h1' }, this.title), h('div', { class: 'status' }, this.message), this.menu.el);
    guardButtons(root);
    uiRoot().append(root);
  }

  exit() {
    this.showroom.dispose();
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (e.action === 'confirm' || e.action === 'start' || e.action === 'back') {
        goMenu();
        return;
      }
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
