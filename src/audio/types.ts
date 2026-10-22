export type MusicId = 'title' | 'select' | 'hood' | 'dojo' | 'parking' | 'victory' | 'rap';

export type SfxId =
  | 'hitLight'
  | 'hitMedium'
  | 'hitHeavy'
  | 'block'
  | 'whiff'
  | 'whiffHeavy'
  | 'land'
  | 'step'
  | 'fall'
  | 'throw'
  | 'super'
  | 'ko'
  | 'cursor'
  | 'confirm'
  | 'cancel'
  | 'roundBell'
  // BBL MAX cinematics
  | 'gunshot'
  | 'explosion'
  | 'rocket'
  | 'pin'
  | 'poof'
  | 'powerUp'
  | 'thwip'
  | 'crowdOoh'
  | 'crowdLaugh'
  | 'scratch'
  | 'recordStop'
  | 'bonk'
  | 'boing'
  | 'crash'
  | 'crack'
  | 'dash'
  | 'flex'
  | 'shine'
  // combat hit feel
  | 'impact'
  | 'bounce'
  | 'wallBreak'
  | 'superJump'
  | 'airDash'
  // profiles & guard gauge
  /** overarm throw whoosh (projectiles) */
  | 'toss'
  /** energy ball launch / pop */
  | 'zap'
  /** web ball sticking on something */
  | 'splat'
  /** guard crush: the guard shatters like glass */
  | 'guardBreak'
  // throws
  /** hands closing on clothes (a grab connects) */
  | 'clutch'
  /** throw escape: sharp double slap + ringing spark */
  | 'tech';

export type AnnouncerLine =
  | 'round1'
  | 'round2'
  | 'round3'
  | 'finalRound'
  | 'fight'
  | 'ko'
  | 'doubleKo'
  | 'perfect'
  | 'timeUp'
  | 'youWin'
  | 'youLose'
  | 'draw'
  | 'chooseFighter'
  | 'gameTitle';

export interface VoiceOptions {
  /** BCP-47 language, default 'fr-FR'. */
  lang?: string;
  /** 0..2, default 1 */
  pitch?: number;
  /** 0.1..2, default 1 */
  rate?: number;
  /** Optional audio file (relative URL, e.g. 'audio/voices/blaze_intro.mp3'). Takes priority over TTS. */
  file?: string;
}

export interface SfxOptions {
  volume?: number;
  /** -1 (left) .. 1 (right) */
  pan?: number;
  /** playback-rate multiplier, default 1 */
  pitch?: number;
}

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  voice: number;
}
