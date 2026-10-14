/**
 * TOURNOI — single-elimination tournament for up to 16 local participants.
 *
 * Pure logic (bracket building, seeding, byes, results, round names, stage
 * rotation, instant CPU-vs-CPU simulation) plus localStorage persistence.
 * No DOM here: the screens live in `src/screens/tournament*.ts`.
 *
 * Bracket model
 * -------------
 * The bracket has `size` = next power of two ≥ N slots. `rounds[0]` holds
 * size/2 matches, `rounds[r]` holds size/2^(r+1) matches and match `m` of
 * round `r` is fed by matches `2m` and `2m+1` of round `r-1`.
 * A match side is a participant index, `BYE` (nobody: the other side goes
 * through automatically) or `null` (not decided yet).
 */
import type { FighterDef } from '../data/roster';
import { CpuBrain, type Difficulty } from '../sim/ai';
import { createGame, step } from '../sim/sim';
import { fullRoster } from './settings';

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 16;
/** participant counts offered by the setup screen */
export const PARTICIPANT_CHOICES = [4, 6, 8, 10, 12, 16] as const;
export const DEFAULT_PARTICIPANTS = 10;
/** max length of a participant name */
export const NAME_MAX = 14;

/** Marks an empty bracket side (the opponent advances automatically). */
export const BYE = -1;

const STORAGE_KEY = 'bbl.tournament';
const VERSION = 1;

export interface Participant {
  name: string;
  cpu: boolean;
  /** id of the chosen fighter (resolved against `fullRoster()` when used) */
  fighterId: string;
}

/** participant index, BYE, or null = not known yet */
export type Side = number | null;

export interface Match {
  a: Side;
  b: Side;
  /** participant index of the winner, BYE for a match with nobody in it, null = pending */
  winner: Side;
  /** decided without a fight (one side was a bye) */
  bye: boolean;
}

export type Phase = 'pick' | 'bracket' | 'done';

export interface Tournament {
  v: number;
  /** base seed: fight seeds and the stage rotation derive from it */
  seed: number;
  /** in seeding order (index 0 = seed #1) */
  participants: Participant[];
  rounds: Match[][];
  phase: Phase;
  /** pick screen progress: index of the participant choosing a fighter */
  pickIndex: number;
  /** number of real (non-bye) matches played */
  played: number;
  /** replays caused by draws (changes the fight seed) */
  replays: number;
  /** next match to play, kept in sync by `refresh()` (null once finished) */
  current: { r: number; m: number } | null;
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix a few integers into one 32-bit seed. */
function mix(...n: number[]): number {
  let h = 0x811c9dc5;
  for (const v of n) {
    h ^= v >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/** Fisher-Yates shuffle (in place). */
export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Upper-case, accents removed, trimmed: "Clément " → "CLEMENT". */
export function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

/** Cleans a typed participant name (falls back to `fallback` when empty). */
export function cleanName(s: string, fallback: string): string {
  const n = s.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, NAME_MAX);
  return n || fallback;
}

/** Default participant name: fighter names of the roster, then "JOUEUR n". */
export function defaultName(i: number, roster: FighterDef[]): string {
  return roster[i]?.name.slice(0, NAME_MAX) ?? `JOUEUR ${i + 1}`;
}

// ---------------------------------------------------------------------------
// bracket
// ---------------------------------------------------------------------------

/** Next power of two ≥ n (n clamped to 2..16). */
export function bracketSize(n: number): number {
  let s = 2;
  while (s < Math.min(MAX_PARTICIPANTS, Math.max(MIN_PARTICIPANTS, n))) s *= 2;
  return s;
}

/**
 * Standard seeding order of the first round, as 1-based seeds:
 * size 16 → 1,16, 8,9, 5,12, 4,13, 3,14, 6,11, 7,10, 2,15
 * (pairs = first-round matches). Seeds 1 and 2 can only meet in the final,
 * and since seeds above N are byes, byes go to the top seeds and are spread
 * over the whole bracket.
 */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    order.forEach((s, i) => {
      if (i % 2 === 0) next.push(s, n + 1 - s);
      else next.push(n + 1 - s, s);
    });
    order = next;
  }
  return order;
}

/** Number of real matches needed to crown a champion. */
export function totalMatches(t: Tournament): number {
  return Math.max(0, t.participants.length - 1);
}

/**
 * Fill the sides of later rounds from the winners of their feeder matches and
 * auto-advance byes. Idempotent; also updates `current` and `phase`.
 */
export function refresh(t: Tournament) {
  t.rounds.forEach((round, r) => {
    round.forEach((m, i) => {
      if (r > 0) {
        m.a = t.rounds[r - 1][i * 2].winner;
        m.b = t.rounds[r - 1][i * 2 + 1].winner;
      }
      if (m.winner === null && m.a !== null && m.b !== null && (m.a === BYE || m.b === BYE)) {
        m.winner = m.a === BYE ? m.b : m.a;
        m.bye = true;
      }
    });
  });
  t.current = nextMatch(t);
  if (champion(t) !== null) {
    t.phase = 'done';
    t.current = null;
  }
}

/** Builds a new tournament; participants are given in seeding order. */
export function createTournament(participants: Participant[], seed = (Math.random() * 2 ** 32) >>> 0): Tournament {
  const n = Math.min(MAX_PARTICIPANTS, participants.length);
  if (n < MIN_PARTICIPANTS) throw new Error('tournament needs at least 2 participants');
  const size = bracketSize(n);
  const order = seedOrder(size);
  const first: Match[] = [];
  for (let i = 0; i < size; i += 2) {
    const side = (seedNo: number): Side => (seedNo <= n ? seedNo - 1 : BYE);
    // better seed on the left (P1) side: 8 v 9, and a bye is always the right side
    const hi = Math.min(order[i], order[i + 1]);
    const lo = Math.max(order[i], order[i + 1]);
    first.push({ a: side(hi), b: side(lo), winner: null, bye: false });
  }
  const rounds: Match[][] = [first];
  for (let len = size / 4; len >= 1; len /= 2) {
    rounds.push(Array.from({ length: len }, () => ({ a: null, b: null, winner: null, bye: false })));
  }
  const t: Tournament = {
    v: VERSION,
    seed: seed >>> 0,
    participants: participants.slice(0, n).map((p) => ({ ...p })),
    rounds,
    phase: 'pick',
    pickIndex: 0,
    played: 0,
    replays: 0,
    current: null,
  };
  refresh(t);
  return t;
}

/** First pending match whose two participants are known (round by round, top to bottom). */
export function nextMatch(t: Tournament): { r: number; m: number } | null {
  for (let r = 0; r < t.rounds.length; r++) {
    const round = t.rounds[r];
    for (let m = 0; m < round.length; m++) {
      const x = round[m];
      if (x.winner === null && x.a !== null && x.b !== null && x.a >= 0 && x.b >= 0) return { r, m };
    }
  }
  return null;
}

/** Participant index of the champion, or null while the final is not decided. */
export function champion(t: Tournament): number | null {
  const final = t.rounds[t.rounds.length - 1]?.[0];
  return final && final.winner !== null && final.winner >= 0 ? final.winner : null;
}

/** The participant who lost the final (null while undecided). */
export function finalist(t: Tournament): number | null {
  const final = t.rounds[t.rounds.length - 1]?.[0];
  if (!final || final.winner === null || final.winner < 0) return null;
  const other = final.winner === final.a ? final.b : final.a;
  return other !== null && other >= 0 ? other : null;
}

/**
 * Records the result of match (r, m): side 0 = participant `a` (left / P1)
 * won, 1 = `b` (right / P2) won, 2 = draw (nothing recorded, the match is
 * replayed with another seed). Returns false if the match was not pending.
 */
export function recordResult(t: Tournament, r: number, m: number, side: 0 | 1 | 2): boolean {
  const x = t.rounds[r]?.[m];
  if (!x || x.winner !== null || x.a === null || x.b === null || x.a < 0 || x.b < 0) return false;
  if (side === 2) {
    t.replays++;
    return true;
  }
  x.winner = side === 0 ? x.a : x.b;
  t.played++;
  refresh(t);
  return true;
}

// ---------------------------------------------------------------------------
// labels
// ---------------------------------------------------------------------------

/** Column header of round r: « HUITIÈMES », « QUARTS DE FINALE », « DEMI-FINALES », « FINALE ». */
export function roundName(t: Tournament, r: number): string {
  const n = t.rounds[r]?.length ?? 0;
  if (n >= 8) return 'HUITIÈMES';
  if (n === 4) return 'QUARTS DE FINALE';
  if (n === 2) return 'DEMI-FINALES';
  return 'FINALE';
}

/** Name of one match of round r (singular): « QUART DE FINALE »… */
function matchName(t: Tournament, r: number): string {
  const n = t.rounds[r]?.length ?? 0;
  if (n >= 8) return 'HUITIÈME DE FINALE';
  if (n === 4) return 'QUART DE FINALE';
  if (n === 2) return 'DEMI-FINALE';
  return 'FINALE';
}

/** Title shown in the fight, e.g. « QUART DE FINALE 2/4 » (byes are not counted). */
export function matchTitle(t: Tournament, r: number, m: number): string {
  const round = t.rounds[r] ?? [];
  // real matches of the round = those that are not (or will not be) byes
  const real = round.map((x, i) => ({ x, i })).filter(({ x }) => !x.bye && x.a !== BYE && x.b !== BYE);
  const name = matchName(t, r);
  if (real.length <= 1) return name;
  const k = real.findIndex(({ i }) => i === m);
  return `${name} ${k + 1}/${real.length}`;
}

// ---------------------------------------------------------------------------
// fights
// ---------------------------------------------------------------------------

/** Seed for the next fight (changes with every played match and every replay). */
export function fightSeed(t: Tournament): number {
  return mix(t.seed, t.played, t.replays, 0x5eed) % 1e9;
}

/**
 * Stage for the next fight: the stages are dealt in a seeded shuffled order
 * (a new shuffle every cycle, never the same stage twice in a row), so the
 * tournament visits every arena.
 */
export function stageFor(t: Tournament, stageIds: string[]): string {
  return stageAt(t.seed, t.played, stageIds);
}

function stageAt(seed: number, k: number, ids: string[]): string {
  if (ids.length === 0) return '';
  if (ids.length === 1) return ids[0];
  const cycle = Math.floor(k / ids.length);
  const order = shuffle(ids.slice(), rng(mix(seed, cycle, 0x57a9e)));
  if (cycle > 0) {
    // the first stage of a cycle must differ from the last stage of the previous one
    const prevOrder = shuffle(ids.slice(), rng(mix(seed, cycle - 1, 0x57a9e)));
    if (order[0] === prevOrder[prevOrder.length - 1]) [order[0], order[1]] = [order[1], order[0]];
  }
  return order[k % ids.length];
}

/**
 * Instant CPU vs CPU match with the real simulation. Returns 0 (left won),
 * 1 (right won) or 2 (draw). If the frame cap is hit the match is decided on
 * rounds won, then on remaining HP.
 */
export function simulateCpuMatch(roundsToWin: number, difficulty: Difficulty, maxFrames = 60 * 60 * 6): 0 | 1 | 2 {
  const s = createGame({ skipIntro: true, roundsToWin });
  const brains = [new CpuBrain(difficulty), new CpuBrain(difficulty)] as const;
  for (let i = 0; i < maxFrames && s.phase !== 'matchOver'; i++) {
    step(s, [brains[0].think(s, 0), brains[1].think(s, 1)]);
  }
  if (s.phase === 'matchOver' && (s.matchWinner === 0 || s.matchWinner === 1 || s.matchWinner === 2)) return s.matchWinner;
  const [a, b] = s.fighters;
  if (a.wins !== b.wins) return a.wins > b.wins ? 0 : 1;
  if (a.hp !== b.hp) return a.hp > b.hp ? 0 : 1;
  return 2;
}

// ---------------------------------------------------------------------------
// fighters
// ---------------------------------------------------------------------------

/** Fighter of participant i (unknown ids fall back to the first roster fighter). */
export function fighterOf(t: Tournament, i: number, roster: FighterDef[] = fullRoster()): FighterDef {
  const id = t.participants[i]?.fighterId;
  return roster.find((d) => d.id === id) ?? roster[0];
}

/** Roster index of the fighter whose name matches the participant's name, or -1. */
export function fighterIndexByName(name: string, roster: FighterDef[]): number {
  const n = normName(name);
  return n ? roster.findIndex((d) => normName(d.name) === n) : -1;
}

/** Number of human participants in a match. */
export function humansIn(t: Tournament, m: Match): number {
  let n = 0;
  for (const s of [m.a, m.b]) if (s !== null && s >= 0 && !t.participants[s].cpu) n++;
  return n;
}

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

export function saveTournament(t: Tournament) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* private mode, quota… the tournament just won't survive a reload */
  }
}

export function clearTournament() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const isSide = (v: unknown, n: number) => v === null || v === BYE || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n);

/** Shape check of stored data (anything odd → the save is ignored). */
function valid(d: unknown): d is Tournament {
  if (!d || typeof d !== 'object') return false;
  const t = d as Tournament;
  if (t.v !== VERSION || !Array.isArray(t.participants) || !Array.isArray(t.rounds)) return false;
  const n = t.participants.length;
  if (n < MIN_PARTICIPANTS || n > MAX_PARTICIPANTS) return false;
  if (!t.participants.every((p) => p && typeof p.name === 'string' && typeof p.fighterId === 'string')) return false;
  const size = bracketSize(n);
  let len = size / 2;
  if (t.rounds.length !== Math.log2(size)) return false;
  for (const round of t.rounds) {
    if (!Array.isArray(round) || round.length !== len) return false;
    if (!round.every((m) => m && isSide(m.a, n) && isSide(m.b, n) && isSide(m.winner, n))) return false;
    len /= 2;
  }
  return t.phase === 'pick' || t.phase === 'bracket' || t.phase === 'done';
}

/** Saved tournament, if any (finished ones are ignored). */
export function loadTournament(): Tournament | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d: unknown = JSON.parse(raw);
    if (!valid(d)) return null;
    const t = d;
    t.seed = Number(t.seed) >>> 0;
    t.played = Math.max(0, Number(t.played) | 0);
    t.replays = Math.max(0, Number(t.replays) | 0);
    t.pickIndex = Math.min(t.participants.length - 1, Math.max(0, Number(t.pickIndex) | 0));
    for (const p of t.participants) {
      p.name = cleanName(p.name, '???');
      p.cpu = !!p.cpu;
    }
    for (const round of t.rounds) for (const m of round) m.bye = !!m.bye;
    // fighters that no longer exist (deleted lab fighter…) → first roster fighter
    const roster = fullRoster();
    for (const p of t.participants) if (!roster.some((d) => d.id === p.fighterId)) p.fighterId = roster[0]?.id ?? '';
    refresh(t);
    return t.phase === 'done' ? null : t;
  } catch {
    return null;
  }
}
