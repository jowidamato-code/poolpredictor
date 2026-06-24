import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Medal, Check, Minus } from "lucide-react";
import { TeamFlag } from "./TeamFlag";
import {
  computeGroupStandingsWithTies,
  type GroupTiebreakerPick,
  type LocalPrediction,
} from "@/lib/tournament-utils";
import { buildScoringConfig, type ScoringConfig } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
}

export function MyGroupStandingsTab({ userId }: Props) {
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [groupResults, setGroupResults] = useState<any[]>([]);
  const [groupTiebreakers, setGroupTiebreakers] = useState<GroupTiebreakerPick[]>([]);
  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("teams").select("*").order("group_name").order("name"),
      supabase.from("matches").select("*").eq("round", "group"),
      supabase.from("predictions").select("*").eq("user_id", userId),
      supabase.from("settings").select("*"),
      (supabase as any).from("group_results").select("*"),
      (supabase as any).from("bonus_predictions").select("*").eq("user_id", userId).maybeSingle(),
    ]).then(([teamsRes, matchesRes, predsRes, settingsRes, grRes, bpRes]) => {
      setTeams(teamsRes.data ?? []);
      setMatches(matchesRes.data ?? []);
      setPredictions(predsRes.data ?? []);
      setGroupResults(grRes.data ?? []);
      const settingsMap = Object.fromEntries(
        (settingsRes.data ?? []).map((s: any) => [s.key, s.value]),
      );
      setConfig(buildScoringConfig(settingsMap));
      const tbs = Array.isArray((bpRes.data as any)?.group_tiebreakers)
        ? ((bpRes.data as any).group_tiebreakers as GroupTiebreakerPick[])
        : [];
      setGroupTiebreakers(tbs);
      setLoading(false);
    });
  }, [userId]);

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Build user's predicted LocalPredictions for group matches
  const predLocal: Record<string, LocalPrediction> = {};
  for (const p of predictions) {
    predLocal[p.match_id] = {
      winner_id: p.predicted_winner_id,
      score_a: p.predicted_score_a,
      score_b: p.predicted_score_b,
    };
  }

  // Build "actual" LocalPredictions from played match scores (for computing
  // the official winner/runner-up using the same algorithm).
  const actualLocal: Record<string, LocalPrediction> = {};
  for (const m of matches) {
    if (m.played && m.score_a != null && m.score_b != null) {
      actualLocal[m.id] = { winner_id: null, score_a: m.score_a, score_b: m.score_b };
    }
  }

  const overrides: Record<string, { winner_team_id: string | null; runner_up_team_id: string | null }> = {};
  for (const gr of groupResults) {
    overrides[gr.group_name] = {
      winner_team_id: gr.winner_team_id,
      runner_up_team_id: gr.runner_up_team_id,
    };
  }

  const groupNames = [...new Set(teams.map((t) => t.group_name))].sort();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groupNames.map((g) => {
        const groupTeams = teams.filter((t) => t.group_name === g);
        const groupMatches = matches.filter(
          (m) => m.team_a_id && groupTeams.some((t) => t.id === m.team_a_id),
        );

        const { standings } = computeGroupStandingsWithTies(
          groupTeams as any,
          groupMatches as any,
          predLocal,
          groupTiebreakers,
        );

        const predWinnerId = standings[0]?.team.id ?? null;
        const predRunnerId = standings[1]?.team.id ?? null;

        // Determine actual winner/runner-up: admin override beats derived
        const allPlayed =
          groupMatches.length > 0 &&
          groupMatches.every(
            (m) => m.played && m.score_a != null && m.score_b != null,
          );
        let actualWinnerId: string | null = null;
        let actualRunnerId: string | null = null;
        if (allPlayed) {
          const { standings: actualStd } = computeGroupStandingsWithTies(
            groupTeams as any,
            groupMatches as any,
            actualLocal,
            [],
          );
          actualWinnerId = actualStd[0]?.team.id ?? null;
          actualRunnerId = actualStd[1]?.team.id ?? null;
        }
        const ov = overrides[g];
        if (ov?.winner_team_id) actualWinnerId = ov.winner_team_id;
        if (ov?.runner_up_team_id) actualRunnerId = ov.runner_up_team_id;
        const decided = actualWinnerId != null || actualRunnerId != null;

        const winnerCorrect = decided && predWinnerId && predWinnerId === actualWinnerId;
        const runnerCorrect = decided && predRunnerId && predRunnerId === actualRunnerId;
        const winnerPts = winnerCorrect ? config.group_winner : 0;
        const runnerPts = runnerCorrect ? config.group_runner_up : 0;
        const totalGroupPts = winnerPts + runnerPts;

        return (
          <Card key={g} className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-primary">
                    Group {g}
                  </span>
                </span>
                {decided ? (
                  <Badge
                    variant={totalGroupPts > 0 ? "default" : "outline"}
                    className="text-xs font-bold"
                  >
                    +{totalGroupPts} pts
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    <Minus className="mr-1 h-3 w-3" /> Pending
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">#</th>
                      <th className="px-2 py-1.5 text-left font-medium">Team</th>
                      <th className="px-1 py-1.5 text-center font-medium">P</th>
                      <th className="px-1 py-1.5 text-center font-medium">W</th>
                      <th className="px-1 py-1.5 text-center font-medium">D</th>
                      <th className="px-1 py-1.5 text-center font-medium">L</th>
                      <th className="px-1 py-1.5 text-center font-medium">GD</th>
                      <th className="px-2 py-1.5 text-center font-bold">Pts</th>
                      <th className="px-2 py-1.5 text-center font-medium">Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => {
                      const isWinner = s.team.id === predWinnerId;
                      const isRunner = s.team.id === predRunnerId;
                      const correct =
                        (isWinner && winnerCorrect) ||
                        (isRunner && runnerCorrect);
                      const earned = isWinner
                        ? winnerPts
                        : isRunner
                          ? runnerPts
                          : 0;
                      return (
                        <tr
                          key={s.team.id}
                          className={cn(
                            "border-t border-border",
                            isWinner && "bg-gold/15 font-semibold text-gold",
                            isRunner && "bg-primary/10 text-primary",
                          )}
                        >
                          <td className="px-2 py-1.5">
                            {isWinner ? (
                              <Trophy className="h-3 w-3" />
                            ) : isRunner ? (
                              <Medal className="h-3 w-3" />
                            ) : (
                              i + 1
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              <TeamFlag code={s.team.code} name={s.team.name} size={18} />
                              {s.team.name}
                            </span>
                          </td>
                          <td className="px-1 py-1.5 text-center">{s.played}</td>
                          <td className="px-1 py-1.5 text-center">{s.wins}</td>
                          <td className="px-1 py-1.5 text-center">{s.draws}</td>
                          <td className="px-1 py-1.5 text-center">{s.losses}</td>
                          <td className="px-1 py-1.5 text-center">
                            {s.gd > 0 ? "+" : ""}
                            {s.gd}
                          </td>
                          <td className="px-2 py-1.5 text-center font-bold">{s.points}</td>
                          <td className="px-2 py-1.5 text-center">
                            {(isWinner || isRunner) ? (
                              decided ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-0.5 font-semibold",
                                    correct ? "text-primary" : "text-muted-foreground",
                                  )}
                                >
                                  {correct && <Check className="h-3 w-3" />}
                                  +{earned}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {decided && (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-1.5",
                      winnerCorrect
                        ? "border-primary/40 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    Winner: {winnerCorrect ? `+${config.group_winner}` : "0"} pts
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-1.5",
                      runnerCorrect
                        ? "border-primary/40 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    Runner-up: {runnerCorrect ? `+${config.group_runner_up}` : "0"} pts
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}