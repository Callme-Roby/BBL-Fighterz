import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { FighterDef } from '../data/roster';

/**
 * Peer-to-peer link between two browsers (WebRTC data channel via PeerJS).
 * The free public PeerJS broker is only used for the initial handshake; the
 * game traffic then goes directly between the two players.
 */

export const NET_VERSION = 'bbl-1';
const ID_PREFIX = 'bblfighterz-';

export type NetMsg =
  | { t: 'hello'; version: string; name: string }
  | { t: 'pick'; def: FighterDef | null; locked: boolean; cursor: number }
  | { t: 'stage'; id: string; locked: boolean }
  | { t: 'start'; stage: string; p1: FighterDef; p2: FighterDef; seed: number; rounds: number }
  | { t: 'in'; f: number; b: number[]; adv: number }
  | { t: 'sum'; f: number; h: number }
  | { t: 'ready' }
  | { t: 'rematch' }
  | { t: 'toSelect' }
  | { t: 'leave' }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number };

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
  ) {}

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

  static async join(code: string, onStatus?: (s: string) => void): Promise<NetLink> {
    onStatus?.('Connexion au serveur de mise en relation…');
    const peer = await openPeer();
    const link = new NetLink(peer, code, false);
    onStatus?.("Recherche de l'adversaire…");
    await new Promise<void>((resolve, reject) => {
      const c = peer.connect(ID_PREFIX + code, { reliable: true, serialization: 'json' });
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
        this.peer.destroy();
      } catch {
        /* ignore */
      }
    }, 100);
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

export function inviteUrl(code: string): string {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('room', code);
  return u.toString();
}
