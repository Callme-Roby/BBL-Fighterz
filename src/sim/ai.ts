import { moveFor, statsOf } from './archetypes';
import { PROJ_RADIUS } from './moves';
import {
  BODY_RADIUS,
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
  type Archetype,
  type FighterState,
  type GameState,
  type MoveId,
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
  /** ranged profile: chance per neutral decision to throw the projectile from mid / long range */
  zoning: number;
  /** chance to jump over an incoming projectile (instead of blocking it) */
  jumpOver: number;
}

const TUNING: Record<Difficulty, Tuning> = {
  easy: {
    reaction: 24, blockChance: 0.2, aggression: 0.28, comboSkill: 0.15, antiAirChance: 0.1, parryChance: 0,
    autoCombo: 0.12, airCombo: 0.05, assistUse: 0.001, airDash: 0, mashFrames: 32, zoning: 0.1, jumpOver: 0.05,
  },
  normal: {
    reaction: 14, blockChance: 0.55, aggression: 0.55, comboSkill: 0.55, antiAirChance: 0.35, parryChance: 0.12,
    autoCombo: 0.35, airCombo: 0.55, assistUse: 0.006, airDash: 0.15, mashFrames: 90, zoning: 0.5, jumpOver: 0.2,
  },
  hard: {
    reaction: 8, blockChance: 0.72, aggression: 0.8, comboSkill: 0.9, antiAirChance: 0.7, parryChance: 0.3,
    autoCombo: 0.25, airCombo: 0.9, assistUse: 0.012, airDash: 0.35, mashFrames: 90, zoning: 0.35, jumpOver: 0.35,
  },
};

/**
 * Profile flavour on top of the difficulty (sim/archetypes.ts):
 * fast presses more, heavy grabs up close, ranged keeps away and zones with its projectile.
 */
interface Style {
  aggression: number;
  autoCombo: number;
  /** extra throw entries in the close-range attack pick + direct grab chance up close */
  grab: number;
  /** chance to back off instead of walking in (keep-away) */
  keepAway: number;
  jumpOver: number;
}
const STYLE: Record<Archetype, Style> = {
  balanced: { aggression: 0.05, autoCombo: 0, grab: 0, keepAway: 0, jumpOver: 1 },
  heavy: { aggression: 0, autoCombo: 0, grab: 0.2, keepAway: 0, jumpOver: 0.8 },
  fast: { aggression: 0.1, autoCombo: 0.1, grab: 0, keepAway: 0, jumpOver: 1.3 },
  ranged: { aggression: -0.1, autoCombo: 0, grab: 0, keepAway: 0.5, jumpOver: 0.8 },
};

function styled(t: Tuning, a: Archetype): Tuning {
  const st = STYLE[a];
  return {
    ...t,
    aggression: Math.max(0.05, Math.min(1, t.aggression + st.aggression)),
    autoCombo: Math.min(1, t.autoCombo + st.autoCombo),
    jumpOver: Math.min(1, t.jumpOver * st.jumpOver),
  };
}

/** below this share of its guard gauge the CPU stops turtling (parries, backs off, jumps out) */
const GUARD_LOW = 0.35;

const STUNNED = new Set(['hitstun', 'blockstun', 'juggle', 'knockdown', 'getup', 'thrown', 'throwing', 'throwBreak', 'wallSplat', 'parried', 'guardCrush']);

/** the fighter's move as its profile performs it */
const mv = (f: FighterState, id: MoveId) => moveFor(f.archetype, id);

/**
 * CPU opponent. Produces raw input bits each frame, exactly like a human pad,
 * so it plays by the same rules. Not deterministic (local games only).
 */
export class CpuBrain {
  private t: Tuning;
  private base: Tuning;
  private styles: Partial<Record<Archetype, Tuning>> = {};
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
  /** the opponent's projectile already reacted to (frame it was thrown) and the plan */
  private projSeen = -1;
  private projPlan: 'clash' | 'jump' | 'parry' | 'block' | 'none' = 'none';

  constructor(public difficulty: Difficulty = 'normal') {
    this.base = TUNING[difficulty];
    this.t = this.base;
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
    this.t = this.styles[f.archetype] ??= styled(this.base, f.archetype);
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

    // the opponent's projectile: clash it, jump over it, parry or block it
    const pr = this.projectileDefense(s, f, me, dist, fwd, back);
    if (pr !== null) return pr;

    // the guard gauge is low: stop turtling (more parries, fewer plain blocks, back off / jump out)
    const guardLow = f.guard < f.guardMax * GUARD_LOW;

    // defence: react to an incoming attack after the reaction delay
    const oAttacking = (o.action === 'attack' || o.action === 'airAttack') && o.moveId;
    if (oAttacking) {
      const m = mv(o, o.moveId!);
      const startedAt = s.frame - o.actionFrame;
      if (this.seenAttackFrame !== startedAt) {
        this.seenAttackFrame = startedAt;
        const willBlock = r() < this.t.blockChance * (guardLow ? 0.75 : 1);
        const canSee = m.startup > this.t.reaction * 0.6 || r() < 0.3;
        if (willBlock && canSee && dist < m.reach + 1.0) {
          this.blocking = m.startup + m.active + 4;
          this.hold = m.level === 'low' ? back | IN_DOWN : back;
          const until = m.startup - o.actionFrame - 3;
          const free = f.action === 'idle' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'crouch';
          // low guard, early enough: get out instead (jump back / back dash)
          if (guardLow && free && until >= 4 && r() < 0.35 + this.t.comboSkill * 0.25) {
            this.queue.length = 0;
            if (m.level === 'low' || r() < 0.5) this.queue.push(IN_UP | back, IN_UP | back);
            else this.queue.push(back, 0, back, back);
            this.blocking = 0;
            return this.queue.shift()!;
          }
          // sometimes go for the parry: tap guard a few frames before the impact
          if (until >= 0 && r() < (guardLow ? Math.min(0.85, this.t.parryChance * 2 + 0.15) : this.t.parryChance)) {
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

    // the opponent's guard broke: walk in and open them up
    if (o.action === 'guardCrush' && !STUNNED.has(f.action) && r() < 0.3 + this.t.comboSkill * 0.7) {
      const free = f.action === 'idle' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'crouch';
      if (free) {
        if (dist > 0.85) return fwd;
        if (r() < 0.5 + this.t.autoCombo) {
          this.mash = this.t.mashFrames;
          return IN_LP;
        }
        this.queue.push(IN_DOWN | fwd, IN_DOWN | fwd | IN_RP);
        return 0;
      }
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
        const next = mv(f, f.moveId).cancels?.[0];
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

    // ranged: forward + RP is the projectile, its close-range heavy is the roundhouse
    const ranged = f.archetype === 'ranged';
    const heavyHit = ranged ? IN_RK : fwd | IN_RP;

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
        [heavyHit],
      ];
      this.queue.push(...options[Math.floor(r() * options.length)]);
      return 0;
    }

    // punish an opponent stuck in recovery / getting up
    const oRecovering = o.action === 'parried' || (o.action === 'attack' && o.moveId && o.actionFrame > mv(o, o.moveId).startup + mv(o, o.moveId).active && !o.moveHit);
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
      // ranged: zone with the projectile from mid / long range (one on screen at a time)
      if (ranged && dist > 1.9 && !s.projectiles[me] && r() < this.t.zoning) {
        this.queue.push(fwd | IN_RP, 0);
        this.cooldown = 4 + Math.floor(r() * 10);
        this.holdFrames = 0;
        return 0;
      }
      // keep-away profiles back off from mid range instead of always walking in
      if (STYLE[f.archetype].keepAway > 0 && dist < 3.2 && r() < STYLE[f.archetype].keepAway * 0.3) {
        // walk / dash back only with room behind (7 m arena half-width)
        const room = back === IN_LEFT ? f.x + 7 : 7 - f.x;
        this.hold = r() < 0.25 && room > 1.5 ? back : 0;
        if (this.hold === back && r() < 0.3) {
          this.queue.push(back, 0, back);
          return 0;
        }
        this.holdFrames = 8 + Math.floor(r() * 10);
        this.cooldown = this.holdFrames;
        return this.hold;
      }
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

    // low guard up close: get some room
    if (guardLow && dist < 1.2 && r() < 0.06 + this.t.comboSkill * 0.06) {
      this.queue.push(...(r() < 0.5 ? [back, 0, back] : [IN_UP | back, IN_UP | back]));
      return 0;
    }
    // heavy: the grab is the big threat up close
    if (STYLE[f.archetype].grab > 0 && dist < 0.95 && r() < STYLE[f.archetype].grab * 0.12) {
      this.queue.push(IN_GRAB, 0);
      this.cooldown = 10 + Math.floor(r() * 16);
      return 0;
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
        [heavyHit],
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

  /**
   * The opponent's projectile is flying at us: decided once per projectile (after the reaction
   * delay): clash it with our own (ranged), jump over it (then jump-kick the thrower), parry, block.
   */
  private projectileDefense(s: GameState, f: FighterState, me: 0 | 1, dist: number, fwd: number, back: number): number | null {
    const p = s.projectiles[1 - me];
    if (!p) return null;
    const dir = p.vx > 0 ? 1 : -1;
    const gap = (f.x - p.x) * dir - (PROJ_RADIUS + BODY_RADIUS);
    if (gap < -0.1) return null;
    const eta = gap / Math.abs(p.vx);
    const thrownAt = s.frame - p.frame;
    const r = Math.random;
    const free = f.action === 'idle' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'crouch';
    if (this.projSeen !== thrownAt) {
      if (p.frame < this.t.reaction * 0.5 || STUNNED.has(f.action)) return null;
      this.projSeen = thrownAt;
      const roll = r();
      const low = f.guard < f.guardMax * GUARD_LOW;
      const clash = f.archetype === 'ranged' && !s.projectiles[me] ? 0.55 * this.t.comboSkill + 0.1 : 0;
      const jump = this.t.jumpOver * (low ? 1.5 : 1);
      const parry = this.t.parryChance * (low ? 1.5 : 0.6);
      if (roll < clash) this.projPlan = 'clash';
      else if (roll < clash + jump) this.projPlan = 'jump';
      else if (roll < clash + jump + parry) this.projPlan = 'parry';
      else if (roll < clash + jump + parry + this.t.blockChance) this.projPlan = 'block';
      else this.projPlan = 'none';
    }
    const prejump = statsOf(f.archetype).prejump;
    switch (this.projPlan) {
      case 'clash':
        // our own throw needs ~13 frames to come out
        if (free && eta > 14) {
          this.projPlan = 'block';
          this.queue.length = 0;
          this.queue.push(0);
          return fwd | IN_RP;
        }
        if (eta <= 14) this.projPlan = 'block';
        return null;
      case 'jump':
        // take off so that we are high when it passes under us, kick on the way down if close
        if (free && eta <= prejump + 10 && eta > prejump + 2) {
          this.projPlan = 'none';
          this.queue.length = 0;
          const kick = dist < 3.0;
          this.queue.push(IN_UP | fwd, ...Array(12).fill(0), kick ? IN_RK : 0);
          return 0;
        }
        if (eta <= prejump + 2) this.projPlan = 'block';
        return null;
      case 'parry':
        if (eta <= 3 && free) {
          this.projPlan = 'none';
          this.queue.length = 0;
          this.queue.push(IN_GUARD, IN_GUARD, 0, 0);
          return IN_GUARD;
        }
        return eta < 10 ? 0 : null;
      case 'block':
        if (eta < 12 && (free || f.action === 'blockstun' || f.action === 'guard')) {
          this.queue.length = 0;
          return back;
        }
        return null;
    }
    return null;
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
    else if (o.action === 'parried' || (o.action === 'attack' && o.moveId && !o.moveHit && o.actionFrame > mv(o, o.moveId).startup)) p = use * 6;
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
      const heavyHit = f.archetype === 'ranged' ? IN_RK : fwd | IN_RP;
      if (dist > 1.4) this.queue.push(fwd, 0, fwd, fwd, fwd, fwd, fwd, fwd, fwd, fwd, fwd, fwd, heavyHit);
      else this.queue.push(heavyHit);
      return 0;
    }
    return null;
  }
}
