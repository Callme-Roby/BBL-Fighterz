import { MOVES } from './moves';
import { IN_DOWN, IN_LEFT, IN_LK, IN_LP, IN_RIGHT, IN_RK, IN_RP, IN_UP, MAX_METER, type GameState } from './types';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Tuning {
  reaction: number; // frames before reacting to an attack
  blockChance: number;
  aggression: number; // 0..1
  comboSkill: number; // 0..1
  antiAirChance: number;
}

const TUNING: Record<Difficulty, Tuning> = {
  easy: { reaction: 24, blockChance: 0.2, aggression: 0.28, comboSkill: 0.15, antiAirChance: 0.1 },
  normal: { reaction: 14, blockChance: 0.55, aggression: 0.55, comboSkill: 0.55, antiAirChance: 0.35 },
  hard: { reaction: 8, blockChance: 0.72, aggression: 0.8, comboSkill: 0.9, antiAirChance: 0.7 },
};

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

  constructor(public difficulty: Difficulty = 'normal') {
    this.t = TUNING[difficulty];
  }

  think(s: GameState, me: 0 | 1): number {
    if (s.phase !== 'fight') {
      this.queue.length = 0;
      this.blocking = 0;
      return s.phase === 'intro' ? 0 : 0;
    }
    const f = s.fighters[me];
    const o = s.fighters[1 - me];
    const fwd = o.x > f.x ? IN_RIGHT : IN_LEFT;
    const back = o.x > f.x ? IN_LEFT : IN_RIGHT;
    const dist = Math.abs(o.x - f.x);
    const r = Math.random;

    // throw escape
    if (f.action === 'thrown' && f.actionFrame < 8 && r() < this.t.blockChance * 0.08) return IN_LP;
    // wake up
    if (f.action === 'knockdown') return f.actionFrame > 30 && r() < 0.1 ? IN_UP : 0;

    // scripted sequences (combos, motions)
    if (this.queue.length) return this.queue.shift()!;

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
        }
      }
    }
    if (this.blocking > 0) {
      this.blocking--;
      // keep holding guard through blockstun
      return this.hold;
    }

    if (this.cooldown > 0) {
      this.cooldown--;
      return this.holdFrames-- > 0 ? this.hold : 0;
    }

    const myTurn = f.action === 'idle' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'crouch';
    if (!myTurn) {
      // chain follow-ups on hit
      if (f.action === 'attack' && f.moveHit && f.moveId && r() < this.t.comboSkill * 0.25) {
        const next = MOVES[f.moveId].cancels?.[0];
        if (next === 'cross') return IN_RP;
        if (next === 'roundhouse') return IN_RK;
        if (next === 'powerPunch') return fwd | IN_RP;
        if (next === 'crouchJab') return IN_DOWN | IN_LP;
        if (next === 'sweep') return IN_DOWN | IN_RK;
      }
      return 0;
    }

    // juggle the opponent
    if (o.action === 'juggle' && dist < 1.4 && r() < this.t.comboSkill) {
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
    const oRecovering = o.action === 'attack' && o.moveId && o.actionFrame > MOVES[o.moveId].startup + MOVES[o.moveId].active && !o.moveHit;
    if (oRecovering && dist < 1.2 && r() < this.t.comboSkill) {
      this.queue.push(IN_DOWN | fwd, IN_DOWN | fwd | IN_RP); // uppercut launcher
      return 0;
    }

    // anti-air
    if ((o.action === 'jump' || o.action === 'airAttack') && dist < 1.6 && r() < this.t.antiAirChance * 0.2) {
      this.queue.push(IN_DOWN | fwd, IN_DOWN | fwd | IN_RP);
      return 0;
    }

    // super when full meter and close
    if (f.meter >= MAX_METER && dist < 1.8 && r() < 0.03 * this.t.aggression) {
      this.queue.push(IN_DOWN, IN_DOWN, IN_DOWN | fwd, IN_DOWN | fwd, fwd, fwd | IN_RP);
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
        this.queue.push(IN_UP | fwd, IN_UP | fwd, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, IN_RK);
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
      const pick = r();
      const moves: number[][] = [
        [IN_LP, 0, 0, 0, 0, 0, 0, 0, 0, IN_RP],
        [IN_RP, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, IN_RK],
        [IN_DOWN, IN_DOWN | IN_LK],
        [IN_DOWN, IN_DOWN | IN_RK],
        [fwd | IN_RP],
        [IN_LK],
        [IN_LP | IN_LK],
        [fwd | IN_LP],
        [IN_DOWN, IN_DOWN | IN_RP],
        [fwd | IN_LK],
      ];
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
}
