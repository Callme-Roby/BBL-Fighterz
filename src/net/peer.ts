import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { FighterDef } from '../data/roster';
import type { Tournament } from '../game/tournament';

/**
 * Peer-to-peer link between two browsers (WebRTC data channel via PeerJS).
 * The free public PeerJS broker is only used for the initial handshake; the
 * game traffic then goes directly between the two players.
 */

/** bump when the messages or the simulation change (both browsers must run the same game) */
export const NET_VERSION = 'bbl-3';
const ID_PREFIX = 'bblfighterz-';
/** online tournaments: the organiser's peer id is ID_PREFIX + TN_TAG + code */
const TN_TAG = 't';

/** A participant as seen in the online tournament lobby. */
export interface TnEntry {
  name: string;
  cpu: boolean;
  /** chosen fighter (a built-in roster id, or a full custom definition) */
  fighterId: string;
  def?: FighterDef;
  /** chosen assist (a built-in roster id; '' = « HASARD »: drawn from the tournament seed at the start) */
  assistId: string;
  /** connected right now (CPU entries are always "online") */
  online: boolean;
}

/** Everything needed to play / watch one tournament match (identical on every browser). */
export interface TnMatch {
  /** unique per attempt: "round.match.replays" */
  key: string;
  r: number;
  m: number;
  /** participant indices (left / right) */
  a: number;
  b: number;
  p1: FighterDef;
  p2: FighterDef;
  /** each side's assist (every browser creates the game with these) */
  assists: [FighterDef | null, FighterDef | null];
  stageId: string;
  rounds: number;
  difficulty: 'easy' | 'normal' | 'hard';
  seed: number;
  title: string;
  names: [string, string];
  cpu: [boolean, boolean];
  /** participant index of the browser that runs the fight and streams it (-1 = the organiser, CPU vs CPU) */
  runner: number;
}

export type NetMsg =
  | { t: 'hello'; version: string; name: string }
  /** fighter select: my fighter (cursor or locked), then my assist (cursor or locked) */
  | { t: 'pick'; def: FighterDef | null; locked: boolean; cursor: number; assist: FighterDef | null; assistLocked: boolean; assistCursor: number }
  | { t: 'stage'; id: string; locked: boolean }
  /** host → guest: the fight starts (a1 / a2 = assists of P1 / P2, the same on both browsers) */
  | { t: 'start'; stage: string; p1: FighterDef; p2: FighterDef; a1: FighterDef | null; a2: FighterDef | null; seed: number; rounds: number }
  | { t: 'in'; f: number; b: number[]; adv: number }
  | { t: 'sum'; f: number; h: number }
  | { t: 'ready' }
  | { t: 'rematch' }
  | { t: 'toSelect' }
  | { t: 'leave' }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number }
  // ---- online tournament (organiser = hub, everybody else connects to it)
  /** guest → organiser: who I am (`token` lets a refreshed page get its slot back) */
  | { t: 'tnHello'; version: string; name: string; token: string }
  /** organiser → guest: refused (wrong version, full…) */
  | { t: 'tnError'; reason: string }
  /** organiser → guest: lobby / tournament state. `you` = participant index of the receiver (-1 = spectator) */
  | { t: 'tnLobby'; entries: TnEntry[]; you: number; started: boolean }
  /** guest → organiser: name / fighter / assist choice (assistId '' = « HASARD ») */
  | { t: 'tnMe'; name: string; fighterId: string; def?: FighterDef; assistId?: string }
  /** organiser → all: the bracket (after the start) */
  | { t: 'tnState'; tour: Tournament; live: TnMatch | null; flash: string }
  /** organiser → all: a match starts (its two players fight, the others watch) */
  | { t: 'tnMatch'; match: TnMatch }
  /** left player → organiser → right player: code of the room of their online fight */
  | { t: 'tnRoom'; key: string; code: string }
  /** runner → organiser → spectators: final inputs from frame f (pairs p1, p2 flattened) */
  | { t: 'tnTv'; key: string; f: number; b: number[] }
  /** runner → organiser: match result (2 = draw) */
  | { t: 'tnResult'; key: string; w: 0 | 1 | 2 }
  /** player → organiser: the match could not be played (disconnection...) */
  | { t: 'tnAbort'; key: string; reason: string }
  /** organiser → all: the tournament is over / cancelled */
  | { t: 'tnEnd'; reason: string };

export type NetListener = (m: NetMsg) => void;

function randomCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  for (const v of arr) s += chars[v % chars.length];
  return s;
}

export class NetLink {
  private listeners = new Set<NetListener>();
  private closeListeners = new Set<(reason: string) => void>();
  private conn: DataConnection | null = null;
  private closed = false;
  /** smoothed round-trip time in ms */
  rtt = 0;
  private pingTimer = 0;

  private constructor(
    private peer: Peer,
    readonly code: string,
    readonly isHost: boolean,
    /** false for the links of a hub: closing one must not destroy the shared peer */
    private ownsPeer = true,
  ) {}

  /** Wraps a connection accepted by a hub (the hub owns the peer). */
  static fromConnection(peer: Peer, c: DataConnection): NetLink {
    const link = new NetLink(peer, '', true, false);
    link.attach(c);
    return link;
  }

  /** Create a room. Resolves once the Peer is registered (the opponent connects later via `waitForGuest`). */
  static async host(onStatus?: (s: string) => void): Promise<NetLink> {
    const code = randomCode();
    onStatus?.('Connexion au serveur de mise en relation…');
    const peer = await openPeer(ID_PREFIX + code);
    return new NetLink(peer, code, true);
  }

  waitForGuest(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.peer.on('connection', (c) => {
        if (this.conn) {
          c.close();
          return;
        }
        this.attach(c);
        c.on('open', () => resolve());
      });
      this.peer.on('error', (e) => reject(e));
    });
  }

  static async join(code: string, onStatus?: (s: string) => void, tournament = false): Promise<NetLink> {
    onStatus?.('Connexion au serveur de mise en relation…');
    const peer = await openPeer();
    const link = new NetLink(peer, code, false);
    onStatus?.(tournament ? "Recherche du tournoi…" : "Recherche de l'adversaire…");
    await new Promise<void>((resolve, reject) => {
      const c = peer.connect(ID_PREFIX + (tournament ? TN_TAG : '') + code, { reliable: true, serialization: 'json' });
      const timer = window.setTimeout(() => reject(new Error('Délai dépassé : la partie est introuvable.')), 15000);
      c.on('open', () => {
        window.clearTimeout(timer);
        resolve();
      });
      c.on('error', (e) => {
        window.clearTimeout(timer);
        reject(e);
      });
      peer.on('error', (e) => {
        window.clearTimeout(timer);
        reject(e);
      });
      link.attach(c);
    });
    return link;
  }

  private attach(c: DataConnection) {
    this.conn = c;
    c.on('data', (d) => {
      const m = d as NetMsg;
      if (m.t === 'ping') {
        this.send({ t: 'pong', ts: m.ts });
        return;
      }
      if (m.t === 'pong') {
        const r = performance.now() - m.ts;
        this.rtt = this.rtt ? this.rtt * 0.8 + r * 0.2 : r;
        return;
      }
      // snapshot: a listener may (un)subscribe others while handling the message
      for (const l of [...this.listeners]) l(m);
    });
    c.on('close', () => this.handleClose("L'adversaire s'est déconnecté."));
    c.on('error', () => this.handleClose('Erreur de connexion.'));
    this.pingTimer = window.setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 1000);
  }

  private handleClose(reason: string) {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.pingTimer);
    for (const l of [...this.closeListeners]) l(reason);
  }

  get connected() {
    return !!this.conn && this.conn.open && !this.closed;
  }

  send(m: NetMsg) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(m);
      } catch (e) {
        console.warn('send failed', e);
      }
    }
  }

  on(l: NetListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  onClose(l: (reason: string) => void): () => void {
    this.closeListeners.add(l);
    return () => this.closeListeners.delete(l);
  }

  close() {
    if (!this.closed) this.send({ t: 'leave' });
    this.closed = true;
    window.clearInterval(this.pingTimer);
    setTimeout(() => {
      try {
        this.conn?.close();
        if (this.ownsPeer) this.peer.destroy();
      } catch {
        /* ignore */
      }
    }, 100);
  }
}

/**
 * Online tournament organiser: one peer that accepts every participant's
 * connection (star network). Each guest gets its own NetLink.
 */
export class NetHub {
  private closed = false;
  private constructor(
    private peer: Peer,
    readonly code: string,
  ) {}

  static async host(onStatus?: (s: string) => void): Promise<NetHub> {
    const code = randomCode();
    onStatus?.('Connexion au serveur de mise en relation…');
    const peer = await openPeer(ID_PREFIX + TN_TAG + code);
    return new NetHub(peer, code);
  }

  /** Called for every guest once its connection is open. */
  onGuest(cb: (link: NetLink) => void) {
    this.peer.on('connection', (c) => {
      if (this.closed) {
        c.close();
        return;
      }
      const link = NetLink.fromConnection(this.peer, c);
      c.on('open', () => cb(link));
    });
  }

  /** The broker connection dropped (guests already connected stay connected). */
  onError(cb: (e: unknown) => void) {
    this.peer.on('error', cb);
  }

  close() {
    this.closed = true;
    setTimeout(() => {
      try {
        this.peer.destroy();
      } catch {
        /* ignore */
      }
    }, 300);
  }
}

/**
 * By default the free public PeerJS cloud broker is used. To use your own
 * (e.g. `npx peerjs --port 9000`), set VITE_PEER_HOST / VITE_PEER_PORT /
 * VITE_PEER_PATH / VITE_PEER_SECURE at build time (Vercel: Environment Variables).
 */
function peerOptions(): PeerOptions {
  const env = import.meta.env;
  const opts: PeerOptions = { debug: 1 };
  if (env.VITE_PEER_HOST) {
    opts.host = env.VITE_PEER_HOST;
    opts.port = Number(env.VITE_PEER_PORT ?? 443);
    opts.path = env.VITE_PEER_PATH ?? '/';
    opts.secure = env.VITE_PEER_SECURE !== 'false';
  }
  return opts;
}

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    const timer = window.setTimeout(() => reject(new Error('Le serveur de mise en relation ne répond pas.')), 12000);
    peer.on('open', () => {
      window.clearTimeout(timer);
      resolve(peer);
    });
    peer.on('error', (e) => {
      window.clearTimeout(timer);
      reject(e);
    });
  });
}

export function roomFromUrl(): string | null {
  const q = new URLSearchParams(location.search);
  const r = q.get('room');
  return r && /^[a-z0-9]{4,12}$/.test(r) ? r : null;
}

/** `?tournoi=<code>` invitation of an online tournament */
export function tournamentFromUrl(): string | null {
  const q = new URLSearchParams(location.search);
  const r = q.get('tournoi');
  return r && /^[a-z0-9]{4,12}$/.test(r) ? r : null;
}

export function tournamentInviteUrl(code: string): string {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('tournoi', code);
  return u.toString();
}

export function inviteUrl(code: string): string {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('room', code);
  return u.toString();
}
