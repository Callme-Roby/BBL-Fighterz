import { checksum, cloneState, step } from '../sim/sim';
import type { GameState, SimEvent } from '../sim/types';
import type { NetLink, NetMsg } from './peer';

/**
 * GGPO-style rollback session for 2 players.
 *  - local inputs are delayed by INPUT_DELAY frames (hides small latencies)
 *  - missing remote inputs are predicted (= last known input)
 *  - when a real remote input differs from the prediction, the game state is
 *    restored to that frame and re-simulated up to the present
 */

const INPUT_DELAY = 2;
const MAX_PREDICTION = 10;
const RING = 256;

export interface TimedEvent {
  frame: number;
  ev: SimEvent;
}

export class RollbackSession {
  state: GameState;
  private local = new Int16Array(RING).fill(-1);
  private remote = new Int16Array(RING).fill(-1);
  private usedRemote = new Int16Array(RING).fill(-1);
  private saved: (GameState | null)[] = new Array(RING).fill(null);
  /** highest frame index for which the remote input is known (contiguous) */
  private remoteConfirmed = -1;
  private remoteHighest = -1;
  private lastRemoteInput = 0;
  private rollbackFrom = -1;
  private remoteAdvantage = 0;
  private localAdvantage = 0;
  private stallCounter = 0;
  private unsub: () => void;
  private pendingSums = new Map<number, number>();
  desynced = false;
  rollbacks = 0;

  constructor(
    initial: GameState,
    readonly localPlayer: 0 | 1,
    private link: NetLink,
  ) {
    this.state = initial;
    for (let f = 0; f < INPUT_DELAY; f++) {
      this.local[f % RING] = 0;
      this.remote[f % RING] = 0;
    }
    this.remoteConfirmed = INPUT_DELAY - 1;
    this.unsub = link.on((m) => this.onMessage(m));
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
      this.remoteAdvantage = m.adv;
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

    // 2. time sync: if we are ahead of the other player, wait a frame now and then
    this.localAdvantage = this.frame - (this.remoteHighest - INPUT_DELAY);
    const diff = (this.localAdvantage - this.remoteAdvantage) / 2;
    if (diff >= 1.5 && this.stallCounter <= 0) {
      this.stallCounter = 4;
      this.sendLocal();
      return out;
    }
    if (this.stallCounter > 0) this.stallCounter--;

    // 3. too far ahead of confirmed remote inputs: wait
    if (this.frame - this.remoteConfirmed > MAX_PREDICTION) {
      this.sendLocal();
      return out;
    }

    // 4. register local input (with delay) and advance
    const target = this.frame + INPUT_DELAY;
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

  private localSentUpTo = INPUT_DELAY - 1;
  private nextSumFrame = 120;

  private sendLocal() {
    // reliable ordered channel: send the newest inputs (plus a small redundancy window)
    const start = Math.max(INPUT_DELAY, this.localSentUpTo - 3);
    const b: number[] = [];
    for (let f = start; f <= this.localSentUpTo; f++) b.push(Math.max(0, this.local[f % RING]));
    if (b.length) this.link.send({ t: 'in', f: start, b, adv: this.localAdvantage });
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
