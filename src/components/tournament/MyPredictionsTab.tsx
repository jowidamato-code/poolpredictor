import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Check, X, Minus, Loader2, Clock } from "lucide-react";
import { TeamFlag } from "./TeamFlag";
import { formatMaltaDate, formatMaltaTime } from "@/lib/tournament-utils";
import { buildScoringConfig, scoreMatchPrediction, type ScoringConfig } from "@/lib/scoring";

const ROUND_LABELS: Record<string, string> = {
  group: "Group Stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarter Finals",
  semi_final: "Semi Finals",
  third_place: "Third Place",
  final: "Final",
};

interface MyPredictionsTabProps {
  userId: string;
}

export function MyPredictionsTab({ userId }: MyPredictionsTabProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ScoringConfig | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("teams").select("*").order("group_name").order("name"),
      supabase.from("matches").select("*").order("match_number"),
      supabase.from("predictions").select("*").eq("user_id", userId),
      supabase.from("settings").select("*"),
    ]).then(([teamsRes, matchesRes, predsRes, settingsRes]) => {
      setTeams(teamsRes.data ?? []);
      setMatches(matchesRes.data ?? []);
      setPredictions(predsRes.data ?? []);
      const settingsMap = Object.fromEntries(
        (settingsRes.data ?? []).map((s: any) => [s.key, s.value]),
      );
      setConfig(buildScoringConfig(settingsMap));
      setLoading(false);
    });
  }, [userId]);

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const predMap = Object.fromEntries(predictions.map((p) => [p.match_id, p]));
  const rounds = [...new Set(matches.map((m) => m.round))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="py-20 text-center">
        <Trophy className="mx-auto h-16 w-16 text-muted-foreground/30" />
        <h3 className="mt-4 text-xl font-semibold text-foreground">No Predictions Yet</h3>
        <p className="mt-2 text-muted-foreground">
          Go to the Predictions tab to submit your picks!
        </p>
      </div>
    );
  }

  const lastUpdated = predictions.reduce<string | null>((latest, p) => {
    const t = p.updated_at ?? p.created_at;
    if (!t) return latest;
    if (!latest || new Date(t) > new Date(latest)) return t;
    return latest;
  }, null);

  return (
    <div className="space-y-4">
      {lastUpdated && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>
            Last submitted:{" "}
            <span className="font-medium text-foreground">
              {formatMaltaDate(lastUpdated)} · {formatMaltaTime(lastUpdated)} MLT
            </span>
          </span>
        </div>
      )}
      <Tabs defaultValue={rounds[0]} className="space-y-4">
      <TabsList className="flex-wrap">
        {rounds.map((round) => (
          <TabsTrigger key={round} value={round} className="text-xs">
            {ROUND_LABELS[round] ?? round}
          </TabsTrigger>
        ))}
      </TabsList>

      {rounds.map((round) => (
        <TabsContent key={round} value={round} className="space-y-3">
          {matches
            .filter((m) => m.round === round)
            .map((match) => {
              const teamA = match.team_a_id ? teamMap[match.team_a_id] : null;
              const teamB = match.team_b_id ? teamMap[match.team_b_id] : null;
              const pred = predMap[match.id];

              const hasResult = match.played;

              // Compute detailed result categories
              let resultKind: "exact" | "gd" | "winner" | "wrong" | null = null;
              let bttsCorrect: boolean | null = null;
              let pointsEarned = 0;
              if (hasResult && pred && pred.predicted_score_a != null && pred.predicted_score_b != null && match.score_a != null && match.score_b != null) {
                const actualWinner =
                  match.score_a > match.score_b ? match.team_a_id
                    : match.score_b > match.score_a ? match.team_b_id
                    : null;
                const predictedWinner =
                  pred.predicted_score_a > pred.predicted_score_b ? match.team_a_id
                    : pred.predicted_score_b > pred.predicted_score_a ? match.team_b_id
                    : null;
                const winnerCorrect = actualWinner === predictedWinner;
                const exactScore = pred.predicted_score_a === match.score_a && pred.predicted_score_b === match.score_b;
                const gdCorrect = (match.score_a - match.score_b) === (pred.predicted_score_a - pred.predicted_score_b);
                if (exactScore) resultKind = "exact";
                else if (winnerCorrect && gdCorrect) resultKind = "gd";
                else if (winnerCorrect) resultKind = "winner";
                else resultKind = "wrong";

                const actualBtts = match.score_a > 0 && match.score_b > 0;
                const predBtts = pred.predicted_score_a > 0 && pred.predicted_score_b > 0;
                bttsCorrect = actualBtts === predBtts;

                if (config) {
                  pointsEarned = scoreMatchPrediction(match as any, pred as any, config);
                }
              }

              return (
                <Card
                  key={match.id}
                  className={`border-border bg-card ${resultKind === "exact" ? "border-primary/40" : ""}`}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="text-xs font-medium text-muted-foreground w-8 text-center">
                      #{match.match_number}
                    </div>
                    <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                      <span className="truncate text-sm font-medium text-foreground">
                        {teamA?.name ?? "TBD"}
                      </span>
                      <TeamFlag code={teamA?.code} name={teamA?.name} size={24} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-10 w-14 flex items-center justify-center text-lg font-bold text-foreground bg-muted rounded-md">
                        {pred?.predicted_score_a ?? "-"}
                      </span>
                      <span className="text-muted-foreground font-bold">:</span>
                      <span className="h-10 w-14 flex items-center justify-center text-lg font-bold text-foreground bg-muted rounded-md">
                        {pred?.predicted_score_b ?? "-"}
                      </span>
                    </div>
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <TeamFlag code={teamB?.code} name={teamB?.name} size={24} />
                      <span className="truncate text-sm font-medium text-foreground">
                        {teamB?.name ?? "TBD"}
                      </span>
                    </div>
                    {hasResult && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {resultKind === "exact" && (
                            <Badge className="bg-primary/20 text-primary text-xs">
                              <Check className="mr-1 h-3 w-3" /> Exact Score
                            </Badge>
                          )}
                          {resultKind === "gd" && (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="mr-1 h-3 w-3" /> Result + GD
                            </Badge>
                          )}
                          {resultKind === "winner" && (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="mr-1 h-3 w-3" /> Result Only
                            </Badge>
                          )}
                          {resultKind === "wrong" && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              <X className="mr-1 h-3 w-3" /> Wrong
                            </Badge>
                          )}
                          {bttsCorrect !== null && (
                            bttsCorrect ? (
                              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                                <Check className="mr-1 h-3 w-3" /> BTTS
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                <X className="mr-1 h-3 w-3" /> BTTS
                              </Badge>
                            )
                          )}
                        </div>
                        <Badge variant={pointsEarned > 0 ? "default" : "outline"} className="text-xs font-bold">
                          +{pointsEarned} pts
                        </Badge>
                      </div>
                    )}
                    {!hasResult && pred && (
                      <Badge variant="outline" className="text-xs">
                        <Minus className="mr-1 h-3 w-3" /> Pending
                      </Badge>
                    )}
                  </CardContent>
                  {pred && (
                    <div className="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Submitted {formatMaltaDate(pred.updated_at ?? pred.created_at)} ·{" "}
                      {formatMaltaTime(pred.updated_at ?? pred.created_at)} MLT
                    </div>
                  )}
                </Card>
              );
            })}
        </TabsContent>
      ))}
      </Tabs>
    </div>
  );
}
