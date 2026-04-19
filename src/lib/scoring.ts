// Centralized scoring engine for tournament predictions

import type { Team, Match } from "./tournament-utils";

export interface ScoringConfig {
  winner_only: number;
  winner_gd: number;
  winner_exact_score: number;
  btts_bonus: number;
  team_through: number;
  group_winner: number;
  group_runner_up: number;
  progression_r16: number;
  progression_qf: number;
  progression_sf: number;
  progression_final: number;
  progression_champion: number;
  top_scorer: number;
  golden_ball: number;
  young_player: number;
  most_assists: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  winner_only: 3,
  winner_gd: 4,
  winner_exact_score: 6,
  btts_bonus: 1,
  team_through: 2,
  group_winner: 8,
  group_runner_up: 5,
  progression_r16: 4,
  progression_qf: 6,
  progression_sf: 10,
  progression_final: 15,
  progression_champion: 25,
  top_scorer: 20,
  golden_ball: 15,
  young_player: 10,
  most_assists: 10,
};

export function buildScoringConfig(settings: Record<string, any>): ScoringConfig {
  const num = (key: string, fallback: number) => {
    const v = settings[`points_${key}`];
    if (v == null) return fallback;
    const n = Number(typeof v === "string" ? v.replace(/^"|"$/g, "") : v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    winner_only: num("winner_only", DEFAULT_SCORING.winner_only),
    winner_gd: num("winner_gd", DEFAULT_SCORING.winner_gd),
    winner_exact_score: num("winner_exact_score", DEFAULT_SCORING.winner_exact_score),
    btts_bonus: num("btts_bonus", DEFAULT_SCORING.btts_bonus),
    team_through: num("team_through", DEFAULT_SCORING.team_through),
    group_winner: num("group_winner", DEFAULT_SCORING.group_winner),
    group_runner_up: num("group_runner_up", DEFAULT_SCORING.group_runner_up),
    progression_r16: num("progression_r16", DEFAULT_SCORING.progression_r16),
    progression_qf: num("progression_qf", DEFAULT_SCORING.progression_qf),
    progression_sf: num("progression_sf", DEFAULT_SCORING.progression_sf),
    progression_final: num("progression_final", DEFAULT_SCORING.progression_final),
    progression_champion: num("progression_champion", DEFAULT_SCORING.progression_champion),
    top_scorer: num("top_scorer", DEFAULT_SCORING.top_scorer),
    golden_ball: num("golden_ball", DEFAULT_SCORING.golden_ball),
    young_player: num("young_player", DEFAULT_SCORING.young_player),
    most_assists: num("most_assists", DEFAULT_SCORING.most_assists),
  };
}

interface MatchPrediction {
  predicted_score_a: number | null;
  predicted_score_b: number | null;
  predicted_winner_id: string | null;
  predicted_team_through?: string | null;
}

/** Score a single match prediction against the actual result */
export function scoreMatchPrediction(
  match: Match & { score_a: number | null; score_b: number | null; winner_id: string | null },
  pred: MatchPrediction,
  config: ScoringConfig,
): number {
  if (!match.played || match.score_a == null || match.score_b == null) return 0;
  if (pred.predicted_score_a == null || pred.predicted_score_b == null) return 0;

  let pts = 0;

  // Determine actual winner from scores or winner_id
  const actualWinner =
    match.score_a > match.score_b
      ? match.team_a_id
      : match.score_b > match.score_a
        ? match.team_b_id
        : null; // draw

  const predictedWinner =
    pred.predicted_score_a > pred.predicted_score_b
      ? match.team_a_id
      : pred.predicted_score_b > pred.predicted_score_a
        ? match.team_b_id
        : null;

  const winnerCorrect = actualWinner === predictedWinner;
  const exactScore =
    pred.predicted_score_a === match.score_a && pred.predicted_score_b === match.score_b;
  const gdActual = match.score_a - match.score_b;
  const gdPred = pred.predicted_score_a - pred.predicted_score_b;
  const gdCorrect = gdActual === gdPred;

  if (winnerCorrect && exactScore) {
    pts += config.winner_exact_score;
  } else if (winnerCorrect && gdCorrect) {
    pts += config.winner_gd;
  } else if (winnerCorrect) {
    pts += config.winner_only;
  }

  // BTTS bonus (derived)
  const actualBtts = match.score_a > 0 && match.score_b > 0;
  const predBtts = pred.predicted_score_a > 0 && pred.predicted_score_b > 0;
  if (actualBtts === predBtts) {
    pts += config.btts_bonus;
  }

  // Knockout: team to advance bonus (when scores tie or always reward correct guess)
  if (match.round !== "group" && match.winner_id && pred.predicted_team_through) {
    if (pred.predicted_team_through === match.winner_id) {
      pts += config.team_through;
    }
  }

  return pts;
}

interface BonusPrediction {
  group_winners?: Record<string, string>; // {A: teamId}
  group_runners_up?: Record<string, string>;
  team_progression?: {
    round_of_16?: string[];
    quarter_finals?: string[];
    semi_finals?: string[];
    finalists?: string[];
    champion?: string;
  };
  top_scorer?: string | null;
  golden_ball?: string | null;
  young_player?: string | null;
  most_assists?: string | null;
}

export function scoreBonusPrediction(
  pred: BonusPrediction,
  result: BonusPrediction,
  config: ScoringConfig,
): number {
  let pts = 0;

  // Group winners / runners-up
  for (const [g, teamId] of Object.entries(pred.group_winners ?? {})) {
    if (result.group_winners?.[g] === teamId) pts += config.group_winner;
  }
  for (const [g, teamId] of Object.entries(pred.group_runners_up ?? {})) {
    if (result.group_runners_up?.[g] === teamId) pts += config.group_runner_up;
  }

  // Team progression — per team correctly predicted to reach each round
  const r = result.team_progression ?? {};
  const p = pred.team_progression ?? {};
  const intersect = (a?: string[], b?: string[]) =>
    (a ?? []).filter((id) => (b ?? []).includes(id)).length;

  pts += intersect(p.round_of_16, r.round_of_16) * config.progression_r16;
  pts += intersect(p.quarter_finals, r.quarter_finals) * config.progression_qf;
  pts += intersect(p.semi_finals, r.semi_finals) * config.progression_sf;
  pts += intersect(p.finalists, r.finalists) * config.progression_final;
  if (p.champion && p.champion === r.champion) pts += config.progression_champion;

  // Player awards (case-insensitive text match)
  const eq = (a?: string | null, b?: string | null) =>
    !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  if (eq(pred.top_scorer, result.top_scorer)) pts += config.top_scorer;
  if (eq(pred.golden_ball, result.golden_ball)) pts += config.golden_ball;
  if (eq(pred.young_player, result.young_player)) pts += config.young_player;
  if (eq(pred.most_assists, result.most_assists)) pts += config.most_assists;

  return pts;
}

/** Bracket helper: derive progression lists from picked knockout winners */
export function deriveProgressionFromBracket(
  knockoutMatches: Match[],
  pickedWinners: Record<string, string>, // matchId -> teamId
): {
  round_of_16: string[];
  quarter_finals: string[];
  semi_finals: string[];
  finalists: string[];
  champion: string | null;
} {
  const teamsInRound = (round: string) => {
    const ms = knockoutMatches.filter((m) => m.round === round);
    const set = new Set<string>();
    for (const m of ms) {
      if (m.team_a_id) set.add(m.team_a_id);
      if (m.team_b_id) set.add(m.team_b_id);
    }
    return [...set];
  };

  const winnersOfRound = (round: string) => {
    const ms = knockoutMatches.filter((m) => m.round === round);
    return ms.map((m) => pickedWinners[m.id]).filter(Boolean);
  };

  // R16 = teams entering R16 round (from picks if user picked R32, else just teams listed in R16 matches)
  const r16Entries = teamsInRound("round_of_16");
  const qfEntries = winnersOfRound("round_of_16").length
    ? winnersOfRound("round_of_16")
    : teamsInRound("quarter_final");
  const sfEntries = winnersOfRound("quarter_final").length
    ? winnersOfRound("quarter_final")
    : teamsInRound("semi_final");
  const finalEntries = winnersOfRound("semi_final").length
    ? winnersOfRound("semi_final")
    : teamsInRound("final");
  const finalMatch = knockoutMatches.find((m) => m.round === "final");
  const champion = finalMatch ? (pickedWinners[finalMatch.id] ?? null) : null;

  return {
    round_of_16: r16Entries,
    quarter_finals: qfEntries,
    semi_finals: sfEntries,
    finalists: finalEntries,
    champion,
  };
}
