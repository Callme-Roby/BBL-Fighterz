import { MOVES } from './moves';
import {
  IN_ASSIST,
  IN_DOWN,
  IN_GRAB,
  IN_GUARD,
  IN_LEFT,
  IN_LK,
  IN_LP,
  IN_RIGHT,
  IN_RK,
  IN_RP,
  IN_SUPER,
  IN_UP,
  MAX_METER,
  type FighterState,
  type GameState,
} from './types';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Tuning {
  reaction: number; // frames before reacting to an attack
  blockChance: number;
  aggression: number; // 0..1
  comboSkill: number; // 0..1
  antiAirChance: number;
  /** chance to try a parry instead of a plain block */
  parryChance: number;
  /** chance to go for the mash-LP auto-combo when attacking up close */
  autoCombo: number;
  /** chance to follow its launchers with a super jump + air string */
  airCombo: number;
  /** assist usage (chance per decision when an opportunity shows up) */
  assistUse: number;
  /** chance to air dash during a forward jump */
  airDash: number;
  /** how long it keeps mashing LP (easy gives up before the launcher) */
  mashFrames: number;
}

const TUNING: Record<Difficulty, Tuning> = {
  easy: {
    reaction: 24, blockChance: 0.2, aggression: 0.28, comboSkill: 0.15, antiAirChance: 0.1, parryChance: 0,
    autoCombo: 0.12, airCombo: 0.05, assistUse: 0.001, airDash: 0, mashFrames: 32,
  },
  normal: {
    reaction: 14, blockChance: 0.55, aggression: 0.55, comboSkill: 0.55, antiAirChance: 0.35, parryChance: 0.12,
    autoCombo: 0.35, airCombo: 0.55, assistUse: 0.006, airDash: 0.15, mashFrames: 90,
  },
  hard: {
    reaction: 8, blockChance: 0.72, aggression: 0.8, comboSkill: 0.9, antiAirChance: 0.7, parryChance: 0.3,
    autoCombo: 0.25, airCombo: 0.9, assistUse: 0.012, airDash: 0.35, mashFrames: 90,
  },
};

const STUNNED = new Set(['hitstun', 'blockstun', 'juggle', 'knockdown', 'getup', 'thrown', 'throwing', 'throwBreak', 'wallSplat', 'parried']);

/**
 * CPU opponent. Produces raw input bits each frame, exactly like a human pad,
 * so it plays by the same rules. Not deterministic (local games only).
 */
export class CpuBrain {
  private t: Tuning;
  private queue: number[] = [];
  private hold = 0;
  private holdFrames = 0;
  private seenAttackFrame = -1;
  private blocking = 0;
  private cooldown = 0;
  /** frames left of LP mashing (auto-combo) */
  private mash = 0;
  /** super jump decision taken for the current launcher */
  private sjRolled = false;
  /** following up with an air string after a super jump */
  private airPlan = false;
  /** the opponent's assist call already reacted to (frame of the call) */
  private assistSeen = -1;
  private assistBlock = false;
  /** our own assist call being followed up (kind) */
  private follow: 'stun' | 'beam' | null = null;
  private followT = 0;

  constructor(public difficulty: Difficulty = 'normal') {
    this.t = TUNING[difficulty];
  }

  private reset() {
    this.queue.length = 0;
    this.blocking = 0;
    this.mash = 0;
    this.sjRolled = false;
    this.airPlan = false;
    this.follow = null;
    this.assistBlock = false;
  }

  think(s: GameState, me: 0 | 1): number {
    if (s.phase !== 'fight') {
      this.reset();
      return 0;
    }
    const f = s.fighters[me];
    const o = s.fighters[1 - me];
    const fwd = o.x > f.x ? IN_RIGHT : IN_LEFT;
    const back = o.x > f.x ? IN_LEFT : IN_RIGHT;
    const dist = Math.abs(o.x - f.x);
    const r = Math.random;
    const tap = (bits: number) => (s.frame % 2 === 0 ? bits : 0);

    // throw escape
    if (f.action === 'thrown' && f.actionFrame < 8 && r() < this.t.blockChance * 0.08) return IN_LP;
    // wake up
    if (f.action === 'knockdown') return f.actionFrame > 30 && r() < 0.1 ? IN_UP : 0;
    if (STUNNED.has(f.action)) {
      this.mash = 0;
      this.airPlan = false;
      this.queue.length = 0;
    }

    // ---- air combos: super jump after a launcher, then jumpPunch > jumpKick > airSmash ----
    if (f.sjWindow > 0 && o.action === 'juggle' && f.autoStep === 0) {
      if (!this.sjRolled) {
        this.sjRolled = true;
        this.airPlan = r() < this.t.airCombo;
      }
      if (this.airPlan) {
        this.queue.length = 0;
        return IN_UP;
      }
    } else if (f.sjWindow === 0 && f.action !== 'superJump') this.sjRolled = false;
    if (this.airPlan) {
      if (f.action === 'superJump') return f.actionFrame >= 5 ? tap(IN_LP) : 0;
      if (f.action === 'airAttack' && f.moveId) {
        if (!f.moveHit) return 0;
        if (f.moveId === 'jumpPunch') return tap(IN_LK);
        if (f.moveId === 'jumpKick') return tap(IN_DOWN | IN_LK);
        return 0;
      }
      if (f.action === 'jump') return 0;
      this.airPlan = false;
    }

    // ---- auto-combo: mash LP while the route keeps connecting ----
    if (this.mash > 0) {
      this.mash--;
      const busy = f.action === 'attack' || f.action === 'airAttack' || f.action === 'superJump' || f.action === 'jump' || f.action === 'land';
      if (!busy && f.autoStep === 0 && this.mash < this.t.mashFrames - 12) this.mash = 0;
      else return this.mash % 5 === 0 ? IN_LP : 0;
    }

    // scripted sequences (combos, motions)
    if (this.queue.length) return this.queue.shift()!;

    // ---- the opponent's assist: guard against it (decided once per call) ----
    const theirs = s.assists[1 - me];
    if (theirs && (theirs.phase === 'enter' || theirs.phase === 'attack' || theirs.shot)) {
      const callAt = s.frame - theirs.frame;
      if (theirs.phase === 'enter' && this.assistSeen !== callAt) {
        this.assistSeen = callAt;
        this.assistBlock = r() < this.t.blockChance * 0.8;
      }
      if (this.assistBlock && !STUNNED.has(f.action) && o.action !== 'attack') return back;
    } else this.assistBlock = false;

    // defence: react to an incoming attack after the reaction delay
    const oAttacking = (o.action === 'attack' || o.action === 'airAttack') && o.moveId;
    if (oAttacking) {
      const m = MOVES[o.moveId!];
      const startedAt = s.frame - o.actionFrame;
      if (this.seenAttackFrame !== startedAt) {
        this.seenAttackFrame = startedAt;
        const willBlock = r() < this.t.blockChance;
        const canSee = m.startup > this.t.reaction * 0.6 || r() < 0.3;
        if (willBlock && canSee && dist < m.reach + 1.0) {
          this.blocking = m.startup + m.active + 4;
          this.hold = m.level === 'low' ? back | IN_DOWN : back;
          // sometimes go for the parry: tap guard a few frames before the impact
          const until = m.startup - o.actionFrame - 3;
          if (until >= 0 && r() < this.t.parryChance) {
            const low = m.level === 'low' ? IN_DOWN : 0;
            this.queue.length = 0;
            for (let i = 0; i < until; i++) this.queue.push(low);
            this.queue.push(IN_GUARD | low, IN_GUARD | low, IN_GUARD | low, low, low, low);
            this.blocking = 0;
          }
        }
      }
    }
    if (this.blocking > 0) {
      this.blocking--;
      // keep holding guard through blockstun
      return this.hold;
    }

    // ---- our own assist ----
    const mine = s.assists[me];
    const assistReady = !!mine && mine.phase === 'off' && mine.cooldown === 0 && !mine.shot && !STUNNED.has(f.action);
    const call = this.assistCall(s, f, o, dist, assistReady, mine?.kind);
    if (call) return call;
    const fu = this.assistFollowUp(f, o, dist, fwd);
    if (fu !== null) return fu;

    if (this.cooldown > 0) {
      this.cooldown--;
      return this.holdFrames-- > 0 ? this.hold : 0;
    }

    const myTurn = f.action === 'idle' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'crouch';
    if (!myTurn) {
      // chain follow-ups on hit
      if (f.action === 'attack' && f.moveHit && f.meter >= MAX_METER && o.action === 'hitstun' && r() < this.t.comboSkill * 0.3) {
        return IN_SUPER;
      }
      if (f.action === 'attack' && f.moveHit && f.moveId && r() < this.t.comboSkill * 0.25) {
        const next = MOVES[f.moveId].cancels?.[0];
        if (next === 'cross') return IN_RP;
        if (next === 'roundhouse') return IN_RK;
        if (next === 'powerPunch') return fwd | IN_RP;
        if (next === 'crouchJab') return IN_DOWN | IN_LP;
        if (next === 'sweep') return IN_DOWN | IN_RK;
      }
      // air dash during a forward jump toward a far opponent
      if (f.action === 'jump' && !f.airDashUsed && f.y > 0.6 && dist > 2 && r() < this.t.airDash * 0.08) {
        this.queue.push(fwd, 0, fwd);
        return 0;
      }
      return 0;
    }

    // juggle the opponent (bounces: relaunch with an uppercut)
    if (o.action === 'juggle' && !o.koed && dist < 1.4 && r() < this.t.comboSkill) {
      if (o.flight === 'bounce' && o.y < 1.2 && r() < this.t.comboSkill) {
        this.queue.push(IN_DOWN | fwd, IN_DOWN | IN_RP);
        return 0;
      }
      const options = [
        [IN_LP, 0, 0, 0, 0, 0, 0, 0, 0, 0, IN_RP],
        [fwd | IN_LP],
        [IN_RK],
        [fwd | IN_RP],
      ];
      this.queue.push(...options[Math.floor(r() * options.length)]);
      return 0;
    }

    // punish an opponent stuck in recovery / getting up
    const oRecovering = o.action === 'parried' || (o.action === 'attack' && o.moveId && o.actionFrame > MOVES[o.moveId].startup + MOVES[o.moveId].active && !o.moveHit);
    if (oRecovering && dist < 1.2 && r() < this.t.comboSkill) {
      this.queue.push(IN_DOWN | fwd, IN_DOWN | fwd | IN_RP); // uppercut launcher
      return 0;
    }

    // anti-air
    if ((o.action === 'jump' || o.action === 'airAttack') && dist < 1.6 && r() < this.t.antiAirChance * 0.2) {
      this.queue.push(IN_DOWN | fwd, IN_DOWN | fwd | IN_RP);
      return 0;
    }

    // BBL MAX when the gauge is full and the opponent is close
    if (f.meter >= MAX_METER && dist < 2.2 && r() < 0.04 * this.t.aggression) {
      this.queue.push(IN_SUPER, 0);
      return 0;
    }

    if (dist > 1.25) {
      // approach
      const roll = r();
      if (roll < 0.012 * this.t.aggression) {
        this.queue.push(fwd, 0, fwd, fwd, fwd); // dash
        return 0;
      }
      if (roll < 0.016 * this.t.aggression + 0.004) {
        const jump = [IN_UP | fwd, IN_UP | fwd, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, IN_RK];
        // sometimes air dash in (double tap forward at the top of the jump), then attack
        if (dist > 2.4 && r() < this.t.airDash) jump.splice(10, 7, fwd, 0, fwd, 0, 0, 0, 0);
        this.queue.push(...jump);
        return 0;
      }
      if (r() < 0.6 + this.t.aggression * 0.4) {
        this.hold = fwd;
        this.holdFrames = 6 + Math.floor(r() * 12);
        this.cooldown = this.holdFrames;
        return fwd;
      }
      this.hold = r() < 0.3 ? back : 0;
      this.holdFrames = 10;
      this.cooldown = 10;
      return this.hold;
    }

    // in range: pick an attack
    if (r() < 0.1 + this.t.aggression * 0.18) {
      // auto-combo: just mash LP up close (the route ends in a launcher + air combo)
      if (dist < 0.95 && r() < this.t.autoCombo) {
        this.mash = this.t.mashFrames;
        return IN_LP;
      }
      const pick = r();
      const moves: number[][] = [
        [IN_LP, 0, 0, 0, 0, 0, 0, 0, 0, IN_RP],
        [IN_RP, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, IN_RK],
        [IN_DOWN, IN_DOWN | IN_LK],
        [IN_DOWN, IN_DOWN | IN_RK],
        [fwd | IN_RP],
        [IN_LK],
        [IN_GRAB],
        [fwd | IN_LP],
        [IN_DOWN, IN_DOWN | IN_RP],
        [fwd | IN_LK],
      ];
      // skilled CPUs also know the low string into the launcher
      if (r() < this.t.comboSkill * 0.4) moves.push([IN_DOWN | IN_LP, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN | IN_LP, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN | IN_RP]);
      const idx = Math.floor(pick * moves.length);
      this.queue.push(...moves[idx]);
      this.cooldown = 8 + Math.floor((1 - this.t.aggression) * 30 * r());
      return 0;
    }
    // footsies
    const roll = r();
    if (roll < 0.3) {
      this.hold = back;
      this.holdFrames = 8 + Math.floor(r() * 10);
      this.cooldown = this.holdFrames;
    } else if (roll < 0.4) {
      this.hold = back | IN_DOWN;
      this.holdFrames = 10;
      this.cooldown = 10;
    } else {
      this.hold = 0;
      this.holdFrames = 4;
      this.cooldown = 4;
    }
    return this.hold;
  }

  /** When to press the assist button (extend a combo, punish, or from neutral at the right range). */
  private assistCall(s: GameState, f: FighterState, o: FighterState, dist: number, ready: boolean, kind: string | undefined): number {
    if (!ready || !kind) return 0;
    const r = Math.random;
    const use = this.t.assistUse;
    let p = 0;
    // extend a combo: our blow just landed
    if ((o.action === 'hitstun' || o.action === 'juggle') && o.comboCount >= 1 && kind !== 'stun') p = use * 10;
    // punish a whiffed move / a parried opponent
    else if (o.action === 'parried' || (o.action === 'attack' && o.moveId && !o.moveHit && o.actionFrame > MOVES[o.moveId].startup)) p = use * 6;
    // neutral: projectile / rush from a distance, the others up close
    else if (f.action === 'idle' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'crouch') {
      if ((kind === 'beam' || kind === 'rush') && dist > 1.6 && dist < 4.5) p = use;
      else if ((kind === 'launcher' || kind === 'stun') && dist < 1.6) p = use;
    }
    if (p <= 0 || r() >= p) return 0;
    this.follow = kind === 'stun' || kind === 'beam' ? kind : null;
    this.followT = 150;
    void s;
    return IN_ASSIST;
  }

  /** Follow-ups after our stun / beam assist connected. */
  private assistFollowUp(f: FighterState, o: FighterState, dist: number, fwd: number): number | null {
    if (!this.follow) return null;
    if (--this.followT <= 0 || (STUNNED.has(f.action) && f.action !== 'blockstun')) {
      this.follow = null;
      return null;
    }
    if (this.follow === 'stun') {
      if (o.dizzy) {
        // walk in, then open with a combo
        if (dist > 0.85) return fwd;
        this.follow = null;
        if (Math.random() < 0.5 + this.t.autoCombo) {
          this.mash = this.t.mashFrames;
          return IN_LP;
        }
        this.queue.push(IN_DOWN | IN_LP, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN | IN_LP, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN, IN_DOWN | IN_RP);
        return 0;
      }
      return null;
    }
    // beam: dash in during the long hitstun, then a heavy blow
    if (o.action === 'hitstun' && o.stun > 18 && Math.random() < this.t.comboSkill) {
      this.follow = null;
      if (dist > 1.4) this.queue.push(fwd, 0, fwd, fwd, fwd, fwd, fwd, fwd, fwd, fwd, fwd, fwd, fwd | IN_RP);
      else this.queue.push(fwd | IN_RP);
      return 0;
    }
    return null;
  }
}
