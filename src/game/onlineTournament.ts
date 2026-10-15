/**
 * TOURNOI EN LIGNE — the session shared by every screen of an online tournament.
 *
 * Star network: the organiser's browser is the hub (NetHub). Every participant
 * opens the invitation link, connects to it, types a name and picks a fighter
 * in the lobby. The organiser owns the bracket (the same pure logic as the
 * local tournament, src/game/tournament.ts) and launches the matches one by one:
 *  - two human players fight each other online in a direct room of their own
 *    (the left player creates it, the code is relayed by the organiser);
 *  - a human against a CPU plays it on their own browser;
 *  - CPU against CPU is simulated, or played on the organiser's browser.
 * The browser that runs a match streams its final inputs (tnTv) through the
 * organiser to everybody else, who watch it live: the simulation is
 * deterministic, so replaying the inputs reproduces the fight exactly.
 *
 * This object lives across screen changes (lobby → fight → bracket...).
 */
import { audio } from '../audio/audio';
import type { FighterDef } from '../data/roster';
import { NET_VERSION, NetHub, NetLink, type NetMsg, type TnEntry, type TnMatch } from '../net/peer';
import { STAGES } from '../render/stages';
import type { FightSetup, SpectatorFeed } from '../screens/fight';
import { goMenuWithMessage, goTournamentChampionOnline, goTournamentOnline, startFight } from '../screens/flow';
import { fullRoster, sanitizeDef, settings } from './settings';
import {
  assistOfParticipant,
  champion,
  cleanName,
  createTournament,
  fighterOf,
  fightSeed,
  matchTitle,
  MAX_PARTICIPANTS,
  recordResult,
  refresh,
  shuffle,
  simulateCpuMatch,
  stageFor,
  type Tournament,
} from './tournament';
import { ROSTER } from '../data/roster';

const NAME_KEY = 'bbl.playerName';
/** inputs sent per tnTv packet (≈ 10 packets / s) */
const TV_BATCH = 6;
/** after a result, the players / spectators go back to the bracket after this delay (ms) */
const BACK_DELAY = 4000;

export function savedPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
}

function randomToken(): string {
  const a = new Uint32Array(3);
  crypto.getRandomValues(a);
  return [...a].map((v) => v.toString(36)).join('');
}

/** Per-tab token: a refreshed page gets its tournament slot back. */
function tabToken(code: string): string {
  const k = 'bbl.tn.' + code;
  try {
    let t = sessionStorage.getItem(k);
    if (!t) {
      t = randomToken();
      sessionStorage.setItem(k, t);
    }
    return t;
  } catch {
    return randomToken();
  }
}

/** Fighter definition from a lobby entry (built-in id or custom definition). */
export function entryFighter(e: TnEntry, roster: FighterDef[] = fullRoster()): FighterDef | null {
  if (e.def) return e.def;
  if (!e.fighterId) return null;
  return roster.find((d) => d.id === e.fighterId) ?? null;
}

interface Slot {
  /** reconnection key ('host' for the organiser, 'cpu-…' for CPU entries) */
  token: string;
  link: NetLink | null;
}

type ScreenKind = 'tournament' | 'fight' | 'champion' | 'none';

export class OnlineTournament {
  /** the running online tournament of this tab (null = none) */
  static current: OnlineTournament | null = null;

  // ---- state shared with every browser
  entries: TnEntry[] = [];
  started = false;
  tour: Tournament | null = null;
  live: TnMatch | null = null;
  flash = '';
  /** my participant index (-1 = spectator only) */
  me = -1;
  /** last error / connection message (lobby) */
  status = '';

  // ---- organiser only
  private hub: NetHub | null = null;
  private slots: Slot[] = [];
  /** connected browsers without a participant slot (late visitors) */
  private watchers: NetLink[] = [];
  /** every input of the live match (for spectators who arrive late) */
  private tvLog: number[] = [];
  private recorded = new Set<string>();

  // ---- guests only
  private link: NetLink | null = null;

  // ---- everybody
  /** inputs of the match being watched (flat pairs) */
  private tvKey = '';
  private tvFrames: number[] = [];
  /** my fight: streaming of the inputs when this browser runs the match */
  private tvBatch: number[] = [];
  private tvBatchStart = 0;
  private tvLastSend = 0;
  /** direct room of my current online fight */
  private matchLink: NetLink | null = null;
  /** code of the room sent by the left player, waited for by the right player */
  private roomWaiters = new Map<string, (code: string) => void>();
  private roomCodes = new Map<string, string>();
  private listeners = new Set<() => void>();
  private screen: ScreenKind = 'none';
  /** key of the match my fight / spectator screen shows */
  private screenKey = '';
  private backTimer = 0;
  private closed = false;

  private constructor(
    readonly role: 'host' | 'guest',
    readonly code: string,
  ) {}

  get isHost() {
    return this.role === 'host';
  }

  // ------------------------------------------------------------------ creation
  static async create(name: string, onStatus?: (s: string) => void): Promise<OnlineTournament> {
    OnlineTournament.current?.close();
    const hub = await NetHub.host(onStatus);
    const ot = new OnlineTournament('host', hub.code);
    ot.hub = hub;
    const n = cleanName(name, 'ORGA');
    saveName(n);
    ot.entries = [{ name: n, cpu: false, fighterId: '', assistId: '', online: true }];
    ot.slots = [{ token: 'host', link: null }];
    ot.me = 0;
    hub.onGuest((link) => ot.onGuestLink(link));
    hub.onError((e) => console.warn('[tournoi] broker', e));
    // closing the organiser's page ends the tournament for everybody
    window.addEventListener('beforeunload', ot.unloadGuard);
    OnlineTournament.current = ot;
    return ot;
  }

  static async join(code: string, name: string, onStatus?: (s: string) => void): Promise<OnlineTournament> {
    OnlineTournament.current?.close();
    const link = await NetLink.join(code, onStatus, true);
    const ot = new OnlineTournament('guest', code);
    ot.link = link;
    const n = cleanName(name, 'JOUEUR');
    saveName(n);
    link.on((m) => ot.onHostMsg(m));
    link.onClose(() => ot.lost("L'organisateur a quitté le tournoi (ou la connexion a coupé)."));
    link.send({ t: 'tnHello', version: NET_VERSION, name: n, token: tabToken(code) });
    OnlineTournament.current = ot;
    return ot;
  }

  // ------------------------------------------------------------------ UI hooks
  /** Screens subscribe to re-render on every change. */
  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private changed() {
    for (const l of [...this.listeners]) l();
  }

  /** The lobby / bracket screen is shown (called by the screen). */
  shown(kind: ScreenKind) {
    this.screen = kind;
    if (kind !== 'fight') this.screenKey = '';
  }

  // ------------------------------------------------------------------ lobby (everybody)
  /**
   * My name / fighter / assist. `assistId` = a built-in fighter id ('' = « HASARD »,
   * omitted = keep the current one); never my own fighter.
   */
  setMe(name: string, fighter: FighterDef | null, assistId?: string) {
    const n = cleanName(name, this.isHost ? 'ORGA' : 'JOUEUR');
    saveName(n);
    const builtIn = fighter ? ROSTER.some((d) => d.id === fighter.id) : true;
    const fighterId = fighter?.id ?? '';
    const def = fighter && !builtIn ? fighter : undefined;
    let aid = assistId ?? this.entries[this.me]?.assistId ?? '';
    if (aid === fighterId || !ROSTER.some((d) => d.id === aid)) aid = '';
    if (this.isHost) {
      if (this.started || this.me < 0) return;
      Object.assign(this.entries[this.me], { name: n, fighterId, def, assistId: aid });
      this.broadcastLobby();
      this.changed();
    } else {
      this.link?.send({ t: 'tnMe', name: n, fighterId, def, assistId: aid });
    }
  }

  /** Can the organiser start? (≥ 2 participants, every fighter chosen) */
  canStart(): boolean {
    return !this.started && this.entries.length >= 2 && this.entries.every((e) => !!e.fighterId);
  }

  // ------------------------------------------------------------------ organiser actions
  addCpu() {
    if (!this.isHost || this.started || this.entries.length >= MAX_PARTICIPANTS) return;
    const roster = fullRoster();
    const used = new Set(this.entries.map((e) => e.fighterId));
    const free = roster.filter((d) => !used.has(d.id));
    const pick = (free.length ? free : roster)[Math.floor(Math.random() * (free.length || roster.length))];
    const nb = this.entries.filter((e) => e.cpu).length + 1;
    const builtIn = ROSTER.some((d) => d.id === pick.id);
    // the CPU's assist is drawn from the tournament seed at the start (« HASARD »)
    this.entries.push({ name: `CPU ${nb}`, cpu: true, fighterId: pick.id, def: builtIn ? undefined : pick, assistId: '', online: true });
    this.slots.push({ token: 'cpu-' + randomToken(), link: null });
    this.broadcastLobby();
    this.changed();
  }

  /** Removes participant i (a guest stays connected as a spectator). */
  remove(i: number) {
    if (!this.isHost || this.started || i === this.me || !this.entries[i]) return;
    const slot = this.slots[i];
    this.entries.splice(i, 1);
    this.slots.splice(i, 1);
    if (slot.link) this.watchers.push(slot.link);
    this.me = this.slots.findIndex((s) => s.token === 'host');
    this.broadcastLobby();
    this.changed();
  }

  shuffleOrder() {
    if (!this.isHost || this.started) return;
    const pairs = this.entries.map((e, i) => ({ e, s: this.slots[i] }));
    shuffle(pairs);
    this.entries = pairs.map((p) => p.e);
    this.slots = pairs.map((p) => p.s);
    this.me = this.slots.findIndex((s) => s.token === 'host');
    this.broadcastLobby();
    this.changed();
  }

  start() {
    if (!this.isHost || !this.canStart()) return;
    const t = createTournament(
      this.entries.map((e) => ({ name: e.name, cpu: e.cpu, fighterId: e.fighterId, def: e.def, assistId: e.assistId || undefined })),
    );
    // « HASARD » assists are drawn now from the tournament seed, among the built-in fighters
    // (known by every browser): from here on every participant has a fixed friend
    t.participants.forEach((p, i) => (p.assistId = assistOfParticipant(t, i, ROSTER)?.id));
    t.phase = 'bracket';
    refresh(t);
    this.tour = t;
    this.started = true;
    this.flash = 'Le tournoi commence !';
    this.broadcastLobby();
    this.broadcastState();
    this.changed();
  }

  /** Launches the next match (organiser). `watch` = play a CPU vs CPU match instead of simulating it. */
  launch() {
    const t = this.tour;
    if (!this.isHost || !t || this.live || !t.current) return;
    const { r, m } = t.current;
    const x = t.rounds[r][m];
    const a = x.a as number;
    const b = x.b as number;
    const pa = t.participants[a];
    const pb = t.participants[b];
    if (!this.entries[a]?.online || !this.entries[b]?.online) return;
    const roster = fullRoster();
    const runner = !pa.cpu ? a : !pb.cpu ? b : -1;
    const match: TnMatch = {
      key: `${r}.${m}.${t.replays}.${t.played}`,
      r,
      m,
      a,
      b,
      p1: fighterOf(t, a, roster),
      p2: fighterOf(t, b, roster),
      assists: [assistOfParticipant(t, a, roster), assistOfParticipant(t, b, roster)],
      stageId: stageFor(t, STAGES.map((s) => s.id)),
      rounds: settings.rounds,
      difficulty: settings.difficulty,
      seed: fightSeed(t),
      title: matchTitle(t, r, m),
      names: [pa.name, pb.name],
      cpu: [pa.cpu, pb.cpu],
      runner,
    };
    this.live = match;
    this.tvLog = [];
    this.flash = '';
    this.broadcastState();
    this.sendAll({ t: 'tnMatch', match });
    this.onMatch(match);
  }

  /** CPU vs CPU: instant result (organiser). */
  simulate() {
    const t = this.tour;
    if (!this.isHost || !t || this.live || !t.current) return;
    const { r, m } = t.current;
    const x = t.rounds[r][m];
    if (!t.participants[x.a as number].cpu || !t.participants[x.b as number].cpu) return;
    this.record(r, m, simulateCpuMatch(settings.rounds, settings.difficulty), ' (SIMULATION)');
  }

  /** Gives the current match to one side (the other player is gone). */
  forfeit(winner: 0 | 1) {
    const t = this.tour;
    if (!this.isHost || !t || !t.current) return;
    if (this.live) this.stopLive();
    const { r, m } = t.current;
    this.record(r, m, winner, ' (FORFAIT)');
  }

  /** A disconnected participant is played by the CPU from now on. */
  replaceByCpu(i: number) {
    const t = this.tour;
    if (!this.isHost || !t || !t.participants[i] || this.entries[i]?.online) return;
    t.participants[i].cpu = true;
    this.entries[i].cpu = true;
    this.entries[i].online = true;
    this.slots[i].token = 'cpu-' + randomToken();
    this.flash = `${t.participants[i].name} est remplacé par le CPU`;
    this.broadcastLobby();
    this.broadcastState();
    this.changed();
  }

  /** Cancels the live match (it will be played again). */
  cancelLive() {
    if (!this.isHost || !this.live) return;
    this.stopLive();
    this.flash = 'Combat annulé : il sera rejoué';
    this.broadcastState();
    this.changed();
    this.backToBracketSoon(0);
  }

  private stopLive() {
    this.live = null;
    this.tvLog = [];
  }

  // ------------------------------------------------------------------ organiser: guests
  private onGuestLink(link: NetLink) {
    let hello = false;
    const offHello = link.on((m) => {
      if (hello || m.t !== 'tnHello') return;
      hello = true;
      offHello();
      this.welcome(link, m);
    });
    link.onClose(() => this.onGuestClosed(link));
    // no hello within 10 s: drop
    window.setTimeout(() => {
      if (!hello) link.close();
    }, 10000);
  }

  private welcome(link: NetLink, m: Extract<NetMsg, { t: 'tnHello' }>) {
    if (m.version !== NET_VERSION) {
      link.send({ t: 'tnError', reason: 'Versions du jeu différentes : rafraîchissez la page (Ctrl+F5) tous les deux.' });
      window.setTimeout(() => link.close(), 500);
      return;
    }
    let back = this.slots.findIndex((s) => s.token === m.token && !s.token.startsWith('cpu-') && s.token !== 'host');
    // same name as a disconnected participant (link reopened in another tab): that's them
    if (back < 0 && this.started) {
      const name = cleanName(m.name, '');
      back = this.entries.findIndex((e, i) => !e.online && !e.cpu && e.name === name && this.slots[i].token !== 'host');
      if (back >= 0) this.slots[back].token = m.token;
    }
    if (back >= 0) {
      // same tab again (refresh, network hiccup): gets its slot back
      this.slots[back].link?.close();
      this.slots[back].link = link;
      this.entries[back].online = true;
      if (this.tour) this.flash = `${this.entries[back].name} est de retour`;
    } else if (!this.started && this.entries.length < MAX_PARTICIPANTS) {
      this.entries.push({ name: cleanName(m.name, `JOUEUR ${this.entries.length + 1}`), cpu: false, fighterId: '', assistId: '', online: true });
      this.slots.push({ token: m.token, link });
    } else {
      this.watchers.push(link);
    }
    link.on((msg) => this.onGuestMsg(link, msg));
    audio.sfx('confirm');
    this.broadcastLobby();
    if (this.tour) {
      this.broadcastState();
      if (this.live) {
        link.send({ t: 'tnMatch', match: this.live });
        if (this.tvLog.length) link.send({ t: 'tnTv', key: this.live.key, f: 0, b: this.tvLog });
      }
    }
    this.changed();
  }

  private slotOf(link: NetLink): number {
    return this.slots.findIndex((s) => s.link === link);
  }

  private onGuestMsg(link: NetLink, m: NetMsg) {
    const i = this.slotOf(link);
    switch (m.t) {
      case 'tnMe': {
        if (i < 0 || this.started) return;
        const e = this.entries[i];
        e.name = cleanName(String(m.name ?? ''), e.name);
        const roster = fullRoster();
        if (m.def) {
          const def = sanitizeDef(m.def);
          e.def = def;
          e.fighterId = def.id;
        } else {
          e.def = undefined;
          e.fighterId = roster.some((d) => d.id === m.fighterId) ? m.fighterId : '';
        }
        // assist: a built-in fighter (every browser knows it), never yourself; '' = « HASARD »
        if (typeof m.assistId === 'string') e.assistId = m.assistId !== e.fighterId && ROSTER.some((d) => d.id === m.assistId) ? m.assistId : '';
        if (e.assistId === e.fighterId) e.assistId = '';
        this.broadcastLobby();
        this.changed();
        break;
      }
      case 'tnRoom':
        if (this.live && this.live.key === m.key) this.relayRoom(m.key, m.code);
        break;
      case 'tnTv':
        if (this.live && this.live.key === m.key) {
          this.appendTv(this.tvLog, m.f, m.b);
          this.feedTv(m.key, m.f, m.b);
          for (const l of this.allLinks()) if (l !== link) l.send(m);
        }
        break;
      case 'tnResult':
        this.result(m.key, m.w);
        break;
      case 'tnAbort':
        this.aborted(m.key, m.reason);
        break;
      default:
        break;
    }
  }

  private onGuestClosed(link: NetLink) {
    if (this.closed) return;
    const i = this.slotOf(link);
    this.watchers = this.watchers.filter((l) => l !== link);
    if (i < 0) return;
    this.slots[i].link = null;
    this.entries[i].online = false;
    if (!this.started) {
      // in the lobby, a guest who leaves just disappears
      this.entries.splice(i, 1);
      this.slots.splice(i, 1);
      this.me = this.slots.findIndex((s) => s.token === 'host');
    } else {
      this.flash = `${this.entries[i].name} s'est déconnecté`;
    }
    this.broadcastLobby();
    if (this.tour) this.broadcastState();
    this.changed();
  }

  private allLinks(): NetLink[] {
    return [...this.slots.map((s) => s.link).filter((l): l is NetLink => !!l), ...this.watchers];
  }

  private sendAll(m: NetMsg) {
    for (const l of this.allLinks()) l.send(m);
  }

  private broadcastLobby() {
    if (!this.isHost) return;
    this.slots.forEach((s, i) => s.link?.send({ t: 'tnLobby', entries: this.entries, you: i, started: this.started }));
    for (const l of this.watchers) l.send({ t: 'tnLobby', entries: this.entries, you: -1, started: this.started });
  }

  private broadcastState() {
    if (!this.isHost || !this.tour) return;
    this.sendAll({ t: 'tnState', tour: this.tour, live: this.live, flash: this.flash });
  }

  /** The left player's room code goes to the right player. */
  private relayRoom(key: string, code: string) {
    const live = this.live;
    if (!live || live.key !== key) return;
    if (live.b === this.me) this.gotRoom(key, code);
    else this.slots[live.b]?.link?.send({ t: 'tnRoom', key, code });
  }

  private result(key: string, w: 0 | 1 | 2) {
    const live = this.live;
    if (!this.isHost || !live || live.key !== key || this.recorded.has(key)) return;
    this.recorded.add(key);
    this.stopLive();
    this.record(live.r, live.m, w, '');
  }

  private aborted(key: string, reason: string) {
    if (!this.isHost || !this.live || this.live.key !== key) return;
    this.stopLive();
    this.flash = reason || 'Le combat a été interrompu : il sera rejoué';
    this.broadcastState();
    this.changed();
  }

  private record(r: number, m: number, w: 0 | 1 | 2, suffix: string) {
    const t = this.tour!;
    const x = t.rounds[r][m];
    const title = matchTitle(t, r, m);
    if (!recordResult(t, r, m, w)) return;
    if (w === 2) this.flash = `MATCH NUL : ${title} À REJOUER !`;
    else {
      const winner = t.participants[w === 0 ? (x.a as number) : (x.b as number)];
      this.flash = `${winner.name} REMPORTE ${/^(FINALE|DEMI)/.test(title) ? 'LA' : 'LE'} ${title.replace(/ \d+\/\d+$/, '')}${suffix} !`;
    }
    this.broadcastState();
    this.afterState();
    this.changed();
  }

  // ------------------------------------------------------------------ guests: messages from the organiser
  private onHostMsg(m: NetMsg) {
    switch (m.t) {
      case 'tnError':
        this.lost(m.reason);
        break;
      case 'tnLobby':
        this.entries = m.entries;
        this.me = m.you;
        this.started = m.started;
        this.changed();
        break;
      case 'tnState': {
        const wasLive = this.live?.key;
        this.tour = m.tour;
        this.live = m.live;
        this.flash = m.flash;
        if (wasLive && (!this.live || this.live.key !== wasLive)) this.roomWaiters.delete(wasLive);
        this.afterState();
        this.changed();
        break;
      }
      case 'tnMatch':
        this.live = m.match;
        this.onMatch(m.match);
        this.changed();
        break;
      case 'tnRoom':
        this.gotRoom(m.key, m.code);
        break;
      case 'tnTv':
        this.feedTv(m.key, m.f, m.b);
        break;
      case 'tnEnd':
        this.lost(m.reason);
        break;
      default:
        break;
    }
  }

  /** Where to go after a new bracket state. */
  private afterState() {
    const t = this.tour;
    if (!t) return;
    if (champion(t) !== null) {
      // let the final's result screen show a moment
      window.clearTimeout(this.backTimer);
      this.backTimer = window.setTimeout(() => {
        if (this.closed) return;
        this.screen = 'champion';
        goTournamentChampionOnline(t);
      }, this.screen === 'fight' ? BACK_DELAY : 300);
      return;
    }
    // the match I was playing / watching is over or cancelled
    if (this.screen === 'fight' && (!this.live || this.live.key !== this.screenKey)) this.backToBracketSoon(BACK_DELAY);
  }

  private backToBracketSoon(ms: number) {
    window.clearTimeout(this.backTimer);
    const key = this.screenKey;
    this.backTimer = window.setTimeout(() => {
      if (this.closed || this.screen !== 'fight' || this.screenKey !== key) return;
      this.backToBracket();
    }, ms);
  }

  backToBracket() {
    window.clearTimeout(this.backTimer);
    this.closeMatchLink();
    this.screenKey = '';
    if (this.tour && champion(this.tour) !== null) {
      this.screen = 'champion';
      goTournamentChampionOnline(this.tour);
    } else goTournamentOnline();
  }

  // ------------------------------------------------------------------ matches (everybody)
  private onMatch(match: TnMatch) {
    window.clearTimeout(this.backTimer);
    this.tvKey = match.key;
    this.tvFrames = [];
    this.tvBatch = [];
    this.tvBatchStart = 0;
    this.closeMatchLink();
    const side = match.a === this.me ? 0 : match.b === this.me ? 1 : -1;
    const humans = (match.cpu[0] ? 0 : 1) + (match.cpu[1] ? 0 : 1);
    const runsIt = match.runner === this.me || (match.runner === -1 && this.isHost);
    if (side >= 0 && humans === 2) void this.playOnline(match, side as 0 | 1);
    else if (runsIt) this.playLocal(match);
    else this.watch(match);
  }

  private baseSetup(match: TnMatch): Omit<FightSetup, 'mode'> {
    return {
      p1: match.p1,
      p2: match.p2,
      assists: match.assists ?? [null, null],
      stageId: match.stageId,
      rounds: match.rounds,
      difficulty: match.difficulty,
      seed: match.seed,
      names: match.names,
      cpuSides: match.cpu,
    };
  }

  private hooks(match: TnMatch, player: boolean): FightSetup['tournament'] {
    return {
      title: match.title,
      online: true,
      onMatchEnd: player
        ? (w) => {
            this.flushTv();
            this.reportResult(match.key, w);
          }
        : undefined,
      onResult: () => this.backToBracket(),
      onAbort: () => {
        if (player && this.live?.key === match.key) this.reportAbort(match.key, `${this.myName()} a quitté le combat : il sera rejoué`);
        this.backToBracket();
      },
    };
  }

  private enterFight(setup: FightSetup, key: string) {
    this.screen = 'fight';
    this.screenKey = key;
    startFight(setup);
  }

  /** Human vs CPU (or CPU vs CPU on the organiser's browser): played here and streamed. */
  private playLocal(match: TnMatch) {
    this.enterFight(
      {
        ...this.baseSetup(match),
        mode: 'cpu',
        tournament: this.hooks(match, true),
        tv: (f, i0, i1) => this.pushTv(match.key, f, i0, i1),
      },
      match.key,
    );
  }

  /** Two humans: a direct room between them (the left one creates it). */
  private async playOnline(match: TnMatch, side: 0 | 1) {
    // show the fight's loading screen right away? no: wait until connected, the bracket shows the status
    this.status = 'Connexion à ton adversaire…';
    this.changed();
    try {
      let link: NetLink;
      if (side === 0) {
        link = await NetLink.host();
        this.matchLink = link;
        if (this.isHost) this.relayRoom(match.key, link.code);
        else this.link?.send({ t: 'tnRoom', key: match.key, code: link.code });
        await Promise.race([
          link.waitForGuest(),
          new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error("Ton adversaire n'a pas rejoint le combat.")), 30000)),
        ]);
      } else {
        const code = await this.waitRoom(match.key);
        link = await NetLink.join(code);
        this.matchLink = link;
      }
      if (this.live?.key !== match.key || this.closed) {
        link.close();
        return;
      }
      this.status = '';
      this.enterFight(
        {
          ...this.baseSetup(match),
          cpuSides: [false, false],
          mode: 'online',
          link,
          localPlayer: side,
          tournament: this.hooks(match, true),
          tv: side === 0 ? (f, i0, i1) => this.pushTv(match.key, f, i0, i1) : undefined,
        },
        match.key,
      );
    } catch (e) {
      console.warn('[tournoi] match room', e);
      this.status = '';
      this.closeMatchLink();
      if (this.live?.key === match.key) this.reportAbort(match.key, 'Connexion impossible entre les deux joueurs : le combat sera relancé');
      this.changed();
    }
  }

  private waitRoom(key: string): Promise<string> {
    const known = this.roomCodes.get(key);
    if (known) return Promise.resolve(known);
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.roomWaiters.delete(key);
        reject(new Error('Pas de salle de combat reçue.'));
      }, 30000);
      this.roomWaiters.set(key, (code) => {
        window.clearTimeout(timer);
        resolve(code);
      });
    });
  }

  private gotRoom(key: string, code: string) {
    this.roomCodes.set(key, code);
    const w = this.roomWaiters.get(key);
    if (w) {
      this.roomWaiters.delete(key);
      w(code);
    }
  }

  /** Watch the live match (spectator). */
  watch(match: TnMatch = this.live!) {
    if (!match) return;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const feed: SpectatorFeed = {
      get(f) {
        if (self.tvKey !== match.key || f * 2 + 1 >= self.tvFrames.length) return null;
        return [self.tvFrames[f * 2], self.tvFrames[f * 2 + 1]];
      },
      get length() {
        return self.tvKey === match.key ? self.tvFrames.length >> 1 : 0;
      },
    };
    this.enterFight({ ...this.baseSetup(match), mode: 'spectate', feed, tournament: this.hooks(match, false) }, match.key);
  }

  /** Is the live match something I can watch (I'm not playing it)? */
  canWatch(): boolean {
    const l = this.live;
    return !!l && l.a !== this.me && l.b !== this.me;
  }

  private appendTv(arr: number[], f: number, b: number[]) {
    const have = arr.length >> 1;
    if (f > have) return; // gap: should not happen on an ordered channel
    const skip = (have - f) * 2;
    for (let i = skip; i < b.length; i++) arr.push(b[i] | 0);
  }

  private feedTv(key: string, f: number, b: number[]) {
    if (key !== this.tvKey) return;
    this.appendTv(this.tvFrames, f, b);
  }

  private pushTv(key: string, f: number, i0: number, i1: number) {
    if (!this.tvBatch.length) this.tvBatchStart = f;
    this.tvBatch.push(i0, i1);
    const now = performance.now();
    if (this.tvBatch.length >= TV_BATCH * 2 || now - this.tvLastSend > 150) this.flushTv(key);
  }

  private flushTv(key = this.tvKey) {
    if (!this.tvBatch.length) return;
    const msg: NetMsg = { t: 'tnTv', key, f: this.tvBatchStart, b: this.tvBatch };
    this.tvBatch = [];
    this.tvLastSend = performance.now();
    if (this.isHost) {
      if (this.live?.key === key) {
        this.appendTv(this.tvLog, msg.f, msg.b);
        this.sendAll(msg);
      }
    } else this.link?.send(msg);
  }

  private reportResult(key: string, w: 0 | 1 | 2) {
    if (this.isHost) this.result(key, w);
    else this.link?.send({ t: 'tnResult', key, w });
  }

  private reportAbort(key: string, reason: string) {
    if (this.isHost) this.aborted(key, reason);
    else this.link?.send({ t: 'tnAbort', key, reason });
  }

  private myName(): string {
    return this.entries[this.me]?.name ?? 'Un joueur';
  }

  private closeMatchLink() {
    this.matchLink?.close();
    this.matchLink = null;
  }

  // ------------------------------------------------------------------ end
  /** Connection to the tournament lost (guest) or refused. */
  private lost(reason: string) {
    if (this.closed) return;
    this.close();
    goMenuWithMessage('TOURNOI TERMINÉ', reason);
  }

  /** Organiser: stops the tournament for everybody. */
  endForAll() {
    if (this.isHost) this.sendAll({ t: 'tnEnd', reason: "L'organisateur a arrêté le tournoi." });
    window.setTimeout(() => this.close(), 200);
  }

  private unloadGuard = (e: BeforeUnloadEvent) => {
    if (this.closed || !this.isHost) return;
    e.preventDefault();
    e.returnValue = '';
  };

  close() {
    if (this.closed) return;
    this.closed = true;
    window.removeEventListener('beforeunload', this.unloadGuard);
    window.clearTimeout(this.backTimer);
    this.closeMatchLink();
    if (this.isHost) {
      for (const l of this.allLinks()) l.close();
      this.hub?.close();
    } else this.link?.close();
    if (OnlineTournament.current === this) OnlineTournament.current = null;
    this.listeners.clear();
    // forget the invitation link of a finished tournament
    if (location.search.includes('tournoi=')) history.replaceState(null, '', location.pathname);
  }
}
