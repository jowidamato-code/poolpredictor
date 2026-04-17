// Shared types and helpers for tournament prediction UI

export interface Team {
  id: string;
  name: string;
  code: string;
  group_name: string;
}

export interface Match {
  id: string;
  round: string;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  match_date: string | null;
  played: boolean;
}

export interface LocalPrediction {
  winner_id: string | null;
  score_a: number | null;
  score_b: number | null;
}

export interface Prediction {
  id: string;
  match_id: string;
  predicted_winner_id: string | null;
  predicted_score_a: number | null;
  predicted_score_b: number | null;
  locked: boolean;
}

export const ROUND_LABELS: Record<string, string> = {
  group: "Group Stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarter Finals",
  semi_final: "Semi Finals",
  third_place: "Third Place",
  final: "Final",
};

export const KNOCKOUT_ROUNDS = [
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

const maltaDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta",
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const maltaTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatMaltaDate(iso: string | null): string {
  if (!iso) return "TBD";
  return maltaDateFmt.format(new Date(iso));
}

export function formatMaltaTime(iso: string | null): string {
  if (!iso) return "—";
  return maltaTimeFmt.format(new Date(iso));
}

export interface GroupStanding {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/** Compute group standings from a user's predictions for that group */
export function computeGroupStandings(
  groupTeams: Team[],
  groupMatches: Match[],
  localPredictions: Record<string, LocalPrediction>,
): GroupStanding[] {
  const map = new Map<string, GroupStanding>();
  for (const t of groupTeams) {
    map.set(t.id, {
      team: t,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  for (const m of groupMatches) {
    if (!m.team_a_id || !m.team_b_id) continue;
    const pred = localPredictions[m.id];
    if (!pred || pred.score_a == null || pred.score_b == null) continue;

    const a = map.get(m.team_a_id);
    const b = map.get(m.team_b_id);
    if (!a || !b) continue;

    a.played++;
    b.played++;
    a.gf += pred.score_a;
    a.ga += pred.score_b;
    b.gf += pred.score_b;
    b.ga += pred.score_a;

    if (pred.score_a > pred.score_b) {
      a.wins++;
      b.losses++;
      a.points += 3;
    } else if (pred.score_a < pred.score_b) {
      b.wins++;
      a.losses++;
      b.points += 3;
    } else {
      a.draws++;
      b.draws++;
      a.points++;
      b.points++;
    }
  }

  const list = [...map.values()];
  for (const s of list) s.gd = s.gf - s.ga;
  list.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf);
  return list;
}

export function isGroupComplete(
  groupMatches: Match[],
  localPredictions: Record<string, LocalPrediction>,
): boolean {
  return groupMatches.every((m) => {
    const p = localPredictions[m.id];
    return p && p.score_a != null && p.score_b != null;
  });
}
