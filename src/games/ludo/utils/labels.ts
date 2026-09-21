export const LABELS = {
  setupTitle: "Choose your game",
  setupIntro: "Select how many people will play on this device. The remaining seats are filled by bots.",
  humanPlayers: "Human players",
  configurationPreview: "Configuration preview",
  humanCount: (n: number) => `${n} human${n === 1 ? "" : "s"}`,
  playerName: (seat: number) => `Name for player ${seat + 1}`,
  human: "Human",
  bot: "Bot",
  gameEnd: "End of game",
  gameEndFull: "Play until everyone has finished",
  gameEndFirst: "Stop when the first player wins",
  start: "Start game",
  resumeHint: "A saved game was found on this device.",
  resume: "Resume",
  gameOverTitle: "Game over",
  rankingPrefix: "Final ranking",
  restart: "Play again",
  turnTitle: "Current turn",
  currentPlayer: (name: string, color: string) => `${name} — ${color}`,
  yourTurn: "Your turn",
  botTurn: (name: string) => `${name}'s turn`,
  roll: "Roll the dice",
  chooseToken: "Choose a token",
  noLegalMoves: "No legal move — turn passing…",
  winner: (name: string) => `${name} wins`,
  finished: "Finished",
  tokensHome: (home: number) => `${home} / 4 home`,
};

export const PLAYER_COLOR_NAMES: Readonly<Record<PlayerColor, string>> = {
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  blue: "Blue",
};

export type PlayerColor = "red" | "green" | "yellow" | "blue";
