import type { App } from '../app';
import type { FighterDef } from '../data/roster';
import type { Participant, Tournament } from '../game/tournament';
import type { NetLink } from '../net/peer';
import { FightScreen, type FightMode, type FightSetup } from './fight';
import { LabScreen } from './lab';
import { OnlineScreen } from './online';
import { OptionsScreen } from './options';
import { SelectScreen } from './select';
import { StageSelectScreen } from './stageSelect';
import { TitleScreen } from './title';
import { TournamentSetupScreen } from './tournament';
import { TournamentBracketScreen } from './tournamentBracket';
import { TournamentChampionScreen } from './tournamentChampion';
import { TournamentPickScreen } from './tournamentPick';

/** Central navigation between screens. */
let app: App;

export function initFlow(a: App) {
  app = a;
}

export function goTitle(skipPress = false) {
  app.go(new TitleScreen(app, skipPress));
}

export function goMenu() {
  goTitle(true);
}

export function goSelect(mode: FightMode, link?: NetLink) {
  app.go(new SelectScreen(app, mode, link));
}

export function goStageSelect(mode: FightMode, p1: FighterDef, p2: FighterDef, link?: NetLink) {
  app.go(new StageSelectScreen(app, mode, p1, p2, link));
}

export function startFight(setup: FightSetup) {
  app.go(new FightScreen(app, setup));
}

export function goOnline(autoJoin?: string) {
  app.go(new OnlineScreen(app, autoJoin));
}

export function goLab() {
  app.go(new LabScreen(app));
}

export function goOptions() {
  app.go(new OptionsScreen(app));
}

// ---------------------------------------------------------------- tournament

/**
 * Tournament entry point: offers to resume a saved tournament, then the setup
 * form. `prefill` (participants of a previous tournament) skips the prompt.
 */
export function goTournament(prefill?: Participant[]) {
  app.go(new TournamentSetupScreen(app, prefill));
}

/** Participants choose their fighters one after another. */
export function goTournamentPick(t: Tournament) {
  app.go(new TournamentPickScreen(app, t));
}

/** Bracket + next match; `flash` = short message about the last result. */
export function goTournamentBracket(t: Tournament, flash?: string) {
  app.go(new TournamentBracketScreen(app, t, flash));
}

export function goTournamentChampion(t: Tournament) {
  app.go(new TournamentChampionScreen(app, t));
}
