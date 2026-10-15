import { checksum, cloneState, step } from '../sim/sim';
import type { GameState, SimEvent } from '../sim/types';
import type { NetMsg } from './peer';

/**
 * GGPO-style rollback session for 2 players.
 *  - local inputs are delayed by a few frames (hides small latencies); each side
 *    picks its own delay from the ping when the fight starts (see `delayForPing`)
 *  - missing remote inputs are predicted (= last known input)
 *  - when a real remote input differs from the prediction, the game state is
 *    restored to that frame and re-simulated up to the present
 *  - inputs travel on a lossy, unordered channel: every packet repeats all the
 *    inputs the other side has not acknowledged yet, so a lost packet is covered
 *    by the next one (16 ms later) instead of being re-sent after a round trip
 */

const MAX_PREDICTION = 10;
const RING = 256;
/** at most this many inputs per packet (the oldest unacknowledged first) */
const MAX_BATCH = 64;
/** time sync: frame advantages averaged over this many ticks before deciding to wait */
const SYNC_SAMPLES = 30;
/** time sync: ticks ignored after waiting (the other side sees the change one round trip later) */
const SYNC_SETTLE = 20;

/**
 * Input delay (frames) for a round-trip time: 2 frames up to ~120 ms of ping,
 * then one more per ~33 ms so rollbacks stay short (at most 5 frames).
 */
export function delayForPing(rttMs: number): number {
  if (!(rttMs > 0)) return 2;
  const oneWay = rttMs / 2 / (1000 / 60);
  return Math.max(2, Math.min(5, Math.round(oneWay) - 2));
}

/** What the session needs from the network link. */
export interface InputLink {
  /** smoothed round-trip time (ms, shown in the HUD) */
  readonly rtt: number;
  /** typical round-trip time (ms) for the input delay (default: rtt) */
  readonly rttTypical?: number;
  send(m: NetMsg): void;
  /** lossy, unordered channel for the inputs (falls back to `send`) */
  sendFast(m: NetMsg): void;
  on(l: (m: NetMsg) => void): () => void;
}

export interface TimedEvent {
  frame: number;
  ev: SimEvent;
}

export class RollbackSession {
  state: GameState;
  /** local input delay (frames), chosen at the first tick */
  delay = 0;
  private local = new Int16Array(RING).fill(-1);
  private remote = new Int16Array(RING).fill(-1);
  private usedRemote = new Int16Array(RING).fill(-1);
  private saved: (GameState | null)[] = new Array(RING).fill(null);
  /** highest frame index for which the remote input is known (contiguous) */
  private remoteConfirmed = -1;
  private remoteHighest = -1;
  /** the other side's input delay (frames) */
  private remoteDelay = 2;
  /** highest of our frames the other side has acknowledged (contiguous) */
  private remoteAck = -1;
  /** last frame of the newest input packet received (older packets arriving late are ignored for the time sync) */
  private remoteNewest = -1;
  private lastRemoteInput = 0;
  private rollbackFrom = -1;
  private remoteAdvantage = 0;
  private localAdvantage = 0;
  private stallCounter = 0;
  /** time sync: sums of the local / remote frame advantages since the last decision */
  private syncLocal = 0;
  private syncRemote = 0;
  private syncSamples = -SYNC_SETTLE;
  /** frames still to wait for the other side */
  private syncWait = 0;
  private unsub: () => void;
  private pendingSums = new Map<number, number>();
  desynced = false;
  rollbacks = 0;

  constructor(
    initial: GameState,
    readonly localPlayer: 0 | 1,
    private link: InputLink,
    /** fixed delay (tests); default: from the ping at the first tick */
    delay?: number,
  ) {
    this.state = initial;
    if (delay) this.setDelay(delay);
    this.unsub = link.on((m) => this.onMessage(m));
  }

  /** The first `delay` frames have no local input (sent as 0 like any other). */
  private setDelay(d: number) {
    this.delay = d;
    for (let f = 0; f < d; f++) this.local[f % RING] = 0;
    this.localSentUpTo = d - 1;
  }

  dispose() {
    this.unsub();
  }

  get frame() {
    return this.state.frame;
  }

  get pingMs() {
    return Math.round(this.link.rtt);
  }

  private onMessage(m: NetMsg) {
    if (m.t === 'in') {
      for (let i = 0; i < m.b.length; i++) this.receiveRemote(m.f + i, m.b[i]);
      if (m.a > this.remoteAck) this.remoteAck = m.a;
      const last = m.f + m.b.length - 1;
      if (last >= this.remoteNewest) {
        this.remoteNewest = last;
        this.remoteAdvantage = m.adv;
        this.remoteDelay = m.d;
      }
    } else if (m.t === 'sum') {
      const mine = this.pendingSums.get(m.f);
      if (mine !== undefined && mine !== m.h && !this.desynced) {
        this.desynced = true;
        console.warn('DESYNC at frame', m.f);
      }
      this.pendingSums.set(-m.f - 1, m.h);
    }
  }

  private receiveRemote(f: number, bits: number) {
    if (f <= this.remoteConfirmed) return;
    if (f > this.frame + RING / 2) return; // absurd
    this.remote[f % RING] = bits;
    if (f > this.remoteHighest) this.remoteHighest = f;
    while (this.remote[(this.remoteConfirmed + 1) % RING] !== -1 && this.remoteConfirmed + 1 <= this.remoteHighest) {
      this.remoteConfirmed++;
      this.lastRemoteInput = this.remote[this.remoteConfirmed % RING];
    }
    // a frame we already simulated with a wrong guess → rollback
    if (f < this.frame && this.usedRemote[f % RING] !== bits) {
      if (this.rollbackFrom < 0 || f < this.rollbackFrom) this.rollbackFrom = f;
    }
  }

  private inputsFor(f: number): [number, number] {
    const l = this.local[f % RING];
    let r = this.remote[f % RING];
    // use the real input whenever it already arrived (even out of order), otherwise predict
    if (r < 0) r = this.lastRemoteInput;
    this.usedRemote[f % RING] = r;
    const li = l < 0 ? 0 : l;
    return this.localPlayer === 0 ? [li, r] : [r, li];
  }

  /**
   * Called at 60 Hz with the current local input.
   * Returns the events produced (possibly including re-simulated frames).
   */
  tick(localBits: number): TimedEvent[] {
    const out: TimedEvent[] = [];
    if (!this.delay) this.setDelay(delayForPing(this.link.rttTypical || this.link.rtt));

    // 1. rollback if a misprediction was detected
    if (this.rollbackFrom >= 0 && this.rollbackFrom < this.frame) {
      const from = this.rollbackFrom;
      const snap = this.saved[from % RING];
      if (snap && snap.frame === from) {
        this.rollbacks++;
        const target = this.frame;
        this.state = cloneState(snap);
        while (this.state.frame < target) this.advanceOne(out);
      }
    }
    this.rollbackFrom = -1;

    // 2. time sync: if we run ahead of the other player, wait a frame now and then.
    // The advantages are averaged so that network jitter alone never makes both sides wait.
    this.localAdvantage = this.frame - (this.remoteHighest - this.remoteDelay);
    if (this.stallCounter > 0) this.stallCounter--;
    if (this.syncWait > 0) {
      if (this.stallCounter <= 0) {
        this.syncWait--;
        this.stallCounter = 3;
        if (this.syncWait === 0) this.syncSamples = -SYNC_SETTLE;
        this.sendLocal();
        return out;
      }
    } else if (this.remoteNewest >= 0 && ++this.syncSamples > 0) {
      this.syncLocal += this.localAdvantage;
      this.syncRemote += this.remoteAdvantage;
      if (this.syncSamples >= SYNC_SAMPLES) {
        const diff = (this.syncLocal - this.syncRemote) / this.syncSamples / 2;
        this.syncLocal = this.syncRemote = this.syncSamples = 0;
        if (diff >= 1) this.syncWait = Math.min(6, Math.round(diff));
      }
    }

    // 3. too far ahead of confirmed remote inputs: wait
    if (this.frame - this.remoteConfirmed > MAX_PREDICTION) {
      this.sendLocal();
      return out;
    }

    // 4. register local input (with delay) and advance
    const target = this.frame + this.delay;
    if (target > this.localSentUpTo) {
      this.local[target % RING] = localBits;
      this.localSentUpTo = target;
    }
    this.sendLocal();
    this.advanceOne(out);

    // 5. desync detection every 2 s on fully confirmed frames
    if (this.remoteConfirmed - 2 >= this.nextSumFrame && this.frame > this.nextSumFrame) {
      const cf = this.nextSumFrame;
      this.nextSumFrame += 120;
      const snap = this.saved[cf % RING];
      if (snap && snap.frame === cf) {
        const h = checksum(snap);
        this.pendingSums.set(cf, h);
        this.link.send({ t: 'sum', f: cf, h });
        const theirs = this.pendingSums.get(-cf - 1);
        if (theirs !== undefined && theirs !== h) {
          this.desynced = true;
          console.warn('DESYNC at frame', cf);
        }
      }
    }
    return out;
  }

  /**
   * Final inputs (both players known for sure) from frame `from` on, in player
   * order: calls `out(frame, p1, p2)` for each and returns the next frame to ask for.
   * Used to stream the match to spectators.
   */
  confirmedInputs(from: number, out: (f: number, i0: number, i1: number) => void): number {
    const upTo = Math.min(this.remoteConfirmed, this.localSentUpTo);
    let f = from;
    for (; f <= upTo; f++) {
      const l = Math.max(0, this.local[f % RING]);
      const r = Math.max(0, this.remote[f % RING]);
      if (this.localPlayer === 0) out(f, l, r);
      else out(f, r, l);
    }
    return f;
  }

  private localSentUpTo = -1;
  private nextSumFrame = 120;

  private sendLocal() {
    // every input not acknowledged yet (a lost packet is covered by the next one)
    const start = Math.max(0, this.remoteAck + 1, this.localSentUpTo - (RING / 2 - 1));
    const end = Math.min(this.localSentUpTo, start + MAX_BATCH - 1);
    const b: number[] = [];
    for (let f = start; f <= end; f++) b.push(Math.max(0, this.local[f % RING]));
    this.link.sendFast({ t: 'in', f: start, b, adv: this.localAdvantage, a: this.remoteConfirmed, d: this.delay });
  }

  private advanceOne(out: TimedEvent[]) {
    const f = this.state.frame;
    // keep a snapshot of the state before simulating frame f
    this.saved[f % RING] = cloneState(this.state);
    // clear stale input slots far behind
    const old = (f + RING / 2) % RING;
    if (f > RING / 2) {
      this.local[old] = -1;
      this.remote[old] = -1;
      this.usedRemote[old] = -1;
    }
    step(this.state, this.inputsFor(f));
    for (const ev of this.state.events) out.push({ frame: this.state.frame, ev });
  }
}
