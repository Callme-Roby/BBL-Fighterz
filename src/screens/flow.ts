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
import { MessageScreen, TournamentHomeScreen, TournamentOnlineScreen } from './tournamentOnline';

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

/** `assists` = friends chosen on the select screen (null = CPU: drawn from the fight seed) */
export function goStageSelect(mode: FightMode, p1: FighterDef, p2: FighterDef, link?: NetLink, assists?: [FighterDef | null, FighterDef | null]) {
  app.go(new StageSelectScreen(app, mode, p1, p2, link, assists));
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

// ---------------------------------------------------------------- online tournament

/** TOURNOI menu: on this browser / online (create, join). `joinCode` = from a ?tournoi= link */
export function goTournamentHome(joinCode?: string) {
  app.go(new TournamentHomeScreen(app, joinCode));
}

/** Lobby or bracket of the running online tournament. */
export function goTournamentOnline() {
  app.go(new TournamentOnlineScreen(app));
}

export function goTournamentChampionOnline(t: Tournament) {
  app.go(new TournamentChampionScreen(app, t, true));
}

/** A message (tournament over, connection lost…) then the main menu. */
export function goMenuWithMessage(title: string, message: string) {
  app.go(new MessageScreen(app, title, message));
}
