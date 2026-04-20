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
  const eq = (a?: string | null, b?: string | null) =>
    !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  if (eq(pred.top_scorer, result.top_scorer)) pts += config.top_scorer;
  if (eq(pred.golden_ball, result.golden_ball)) pts += config.golden_ball;
  if (eq(pred.young_player, result.young_player)) pts += config.young_player;
  if (eq(pred.most_assists, result.most_assists)) pts += config.most_assists;
  return pts;
}

interface MatchLike {
  id: string;
  round: string;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  played: boolean;
  winner_id?: string | null;
}

interface PredLike {
  match_id: string;
  predicted_score_a: number | null;
  predicted_score_b: number | null;
}

interface TeamLike {
  id: string;
  group_name: string;
}

function computeGroupTop2(
  teams: TeamLike[],
  matchScores: Record<string, { team_a_id: string; team_b_id: string; a: number; b: number }>,
): { winners: Record<string, string>; runners: Record<string, string> } {
  const groups: Record<string, TeamLike[]> = {};
  for (const t of teams) (groups[t.group_name] ??= []).push(t);
  const winners: Record<string, string> = {};
  const runners: Record<string, string> = {};
  for (const [g, gTeams] of Object.entries(groups)) {
    const stats: Record<string, { pts: number; gd: number; gf: number }> = {};
    for (const t of gTeams) stats[t.id] = { pts: 0, gd: 0, gf: 0 };
    for (const m of Object.values(matchScores)) {
      if (!stats[m.team_a_id] || !stats[m.team_b_id]) continue;
      stats[m.team_a_id].gf += m.a;
      stats[m.team_a_id].gd += m.a - m.b;
      stats[m.team_b_id].gf += m.b;
      stats[m.team_b_id].gd += m.b - m.a;
      if (m.a > m.b) stats[m.team_a_id].pts += 3;
      else if (m.b > m.a) stats[m.team_b_id].pts += 3;
      else {
        stats[m.team_a_id].pts++;
        stats[m.team_b_id].pts++;
      }
    }
    const sorted = gTeams.slice().sort((x, y) => {
      const sx = stats[x.id], sy = stats[y.id];
      return sy.pts - sx.pts || sy.gd - sx.gd || sy.gf - sx.gf;
    });
    if (sorted[0]) winners[g] = sorted[0].id;
    if (sorted[1]) runners[g] = sorted[1].id;
  }
  return { winners, runners };
}

/** Score group winners/runners-up derived from user's match score predictions */
export function scoreDerivedGroupStage(
  teams: TeamLike[],
  matches: MatchLike[],
  userPreds: PredLike[],
  config: ScoringConfig,
): number {
  const groupMatches = matches.filter((m) => m.round === "group" && m.team_a_id && m.team_b_id);
  const teamGroup: Record<string, string> = {};
  for (const t of teams) teamGroup[t.id] = t.group_name;
  const matchesByGroup: Record<string, MatchLike[]> = {};
  for (const m of groupMatches) {
    const g = teamGroup[m.team_a_id!];
    if (g) (matchesByGroup[g] ??= []).push(m);
  }

  const actualScores: Record<string, { team_a_id: string; team_b_id: string; a: number; b: number }> = {};
  for (const m of groupMatches) {
    if (m.played && m.score_a != null && m.score_b != null) {
      actualScores[m.id] = { team_a_id: m.team_a_id!, team_b_id: m.team_b_id!, a: m.score_a, b: m.score_b };
    }
  }
  const actualTop2 = computeGroupTop2(teams, actualScores);

  const predMap: Record<string, PredLike> = {};
  for (const p of userPreds) predMap[p.match_id] = p;
  const predScores: Record<string, { team_a_id: string; team_b_id: string; a: number; b: number }> = {};
  for (const m of groupMatches) {
    const p = predMap[m.id];
    if (p && p.predicted_score_a != null && p.predicted_score_b != null) {
      predScores[m.id] = { team_a_id: m.team_a_id!, team_b_id: m.team_b_id!, a: p.predicted_score_a, b: p.predicted_score_b };
    }
  }
  const predTop2 = computeGroupTop2(teams, predScores);

  let pts = 0;
  for (const [g, ms] of Object.entries(matchesByGroup)) {
    const allPlayed = ms.every((m) => m.played && m.score_a != null && m.score_b != null);
    if (!allPlayed) continue;
    if (predTop2.winners[g] && predTop2.winners[g] === actualTop2.winners[g]) pts += config.group_winner;
    if (predTop2.runners[g] && predTop2.runners[g] === actualTop2.runners[g]) pts += config.group_runner_up;
  }
  return pts;
}

/** Score knockout progression derived from user's predicted match winners vs actual */
export function scoreDerivedProgression(
  matches: MatchLike[],
  userPreds: PredLike[],
  config: ScoringConfig,
): number {
  const predMap: Record<string, PredLike> = {};
  for (const p of userPreds) predMap[p.match_id] = p;
  const nextRoundFromMatch: Record<string, string> = {
    round_of_32: "round_of_16",
    round_of_16: "quarter_final",
    quarter_final: "semi_final",
    semi_final: "final",
    final: "champion",
  };
  const roundPoints: Record<string, number> = {
    round_of_16: config.progression_r16,
    quarter_final: config.progression_qf,
    semi_final: config.progression_sf,
    final: config.progression_final,
  };
  let pts = 0;
  for (const m of matches) {
    if (m.round === "group" || m.round === "third_place") continue;
    if (!m.played || !m.winner_id) continue;
    const p = predMap[m.id];
    if (!p || p.predicted_score_a == null || p.predicted_score_b == null) continue;
    const predWinner =
      p.predicted_score_a > p.predicted_score_b
        ? m.team_a_id
        : p.predicted_score_b > p.predicted_score_a
          ? m.team_b_id
          : null;
    if (!predWinner || predWinner !== m.winner_id) continue;
    const nextRound = nextRoundFromMatch[m.round];
    if (nextRound === "champion") pts += config.progression_champion;
    else if (nextRound && roundPoints[nextRound] != null) pts += roundPoints[nextRound];
  }
  return pts;
}

/** Backward-compat helper (no longer used by user UI) */
export function deriveProgressionFromBracket(
  knockoutMatches: MatchLike[],
  pickedWinners: Record<string, string>,
) {
  const teamsInRound = (round: string) => {
    const set = new Set<string>();
    for (const m of knockoutMatches.filter((m) => m.round === round)) {
      if (m.team_a_id) set.add(m.team_a_id);
      if (m.team_b_id) set.add(m.team_b_id);
    }
    return [...set];
  };
  const winnersOfRound = (round: string) =>
    knockoutMatches.filter((m) => m.round === round).map((m) => pickedWinners[m.id]).filter(Boolean);
  const finalMatch = knockoutMatches.find((m) => m.round === "final");
  return {
    round_of_16: teamsInRound("round_of_16"),
    quarter_finals: winnersOfRound("round_of_16").length ? winnersOfRound("round_of_16") : teamsInRound("quarter_final"),
    semi_finals: winnersOfRound("quarter_final").length ? winnersOfRound("quarter_final") : teamsInRound("semi_final"),
    finalists: winnersOfRound("semi_final").length ? winnersOfRound("semi_final") : teamsInRound("final"),
    champion: finalMatch ? (pickedWinners[finalMatch.id] ?? null) : null,
  };
}
