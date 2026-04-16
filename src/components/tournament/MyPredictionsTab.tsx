import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Check, X, Minus, Loader2 } from "lucide-react";

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

  useEffect(() => {
    Promise.all([
      supabase.from("teams").select("*").order("group_name").order("name"),
      supabase.from("matches").select("*").order("match_number"),
      supabase.from("predictions").select("*").eq("user_id", userId),
    ]).then(([teamsRes, matchesRes, predsRes]) => {
      setTeams(teamsRes.data ?? []);
      setMatches(matchesRes.data ?? []);
      setPredictions(predsRes.data ?? []);
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

  return (
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
              const correctScore =
                hasResult &&
                pred &&
                pred.predicted_score_a === match.score_a &&
                pred.predicted_score_b === match.score_b;
              const correctWinner =
                hasResult &&
                pred &&
                match.winner_id &&
                pred.predicted_winner_id === match.winner_id;

              return (
                <Card
                  key={match.id}
                  className={`border-border bg-card ${hasResult ? (correctScore ? "border-primary/40" : "") : ""}`}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="text-xs font-medium text-muted-foreground w-8 text-center">
                      #{match.match_number}
                    </div>
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {teamA?.name ?? "TBD"}
                      </span>
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
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {teamB?.name ?? "TBD"}
                      </span>
                    </div>
                    {hasResult && (
                      <div className="flex items-center gap-1">
                        {correctScore && (
                          <Badge className="bg-primary/20 text-primary text-xs">
                            <Check className="mr-1 h-3 w-3" /> Exact
                          </Badge>
                        )}
                        {correctWinner && !correctScore && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="mr-1 h-3 w-3" /> Winner
                          </Badge>
                        )}
                        {!correctWinner && !correctScore && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            <X className="mr-1 h-3 w-3" /> Wrong
                          </Badge>
                        )}
                      </div>
                    )}
                    {!hasResult && pred && (
                      <Badge variant="outline" className="text-xs">
                        <Minus className="mr-1 h-3 w-3" /> Pending
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </TabsContent>
      ))}
    </Tabs>
  );
}
