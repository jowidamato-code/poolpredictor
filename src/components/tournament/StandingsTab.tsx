import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";

export function StandingsTab() {
  const [standings, setStandings] = useState<
    { user_id: string; first_name: string; last_name: string; points: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStandings();
  }, []);

  async function loadStandings() {
    const [profilesRes, predictionsRes, matchesRes, settingsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, first_name, last_name"),
      supabase.from("predictions").select("*"),
      supabase.from("matches").select("*").eq("played", true),
      supabase.from("settings").select("*"),
    ]);

    const profiles = profilesRes.data ?? [];
    const allPredictions = predictionsRes.data ?? [];
    const playedMatches = matchesRes.data ?? [];
    const settings = Object.fromEntries(
      (settingsRes.data ?? []).map((s) => [s.key, s.value]),
    );

    const pointsCorrectWinner = Number(settings.points_correct_winner ?? 3);
    const pointsCorrectScore = Number(settings.points_correct_score ?? 5);

    const standingsMap: Record<string, number> = {};
    for (const profile of profiles) {
      standingsMap[profile.user_id] = 0;
    }

    for (const match of playedMatches) {
      const matchPredictions = allPredictions.filter((p) => p.match_id === match.id);
      for (const pred of matchPredictions) {
        let points = 0;
        if (match.winner_id && pred.predicted_winner_id === match.winner_id) {
          points += pointsCorrectWinner;
        }
        if (
          pred.predicted_score_a !== null &&
          pred.predicted_score_b !== null &&
          pred.predicted_score_a === match.score_a &&
          pred.predicted_score_b === match.score_b
        ) {
          points += pointsCorrectScore;
        }
        if (standingsMap[pred.user_id] !== undefined) {
          standingsMap[pred.user_id] += points;
        }
      }
    }

    const sorted = profiles
      .map((p) => ({
        user_id: p.user_id,
        first_name: p.first_name,
        last_name: p.last_name,
        points: standingsMap[p.user_id] ?? 0,
      }))
      .sort((a, b) => b.points - a.points);

    setStandings(sorted);
    setLoading(false);
  }

  const positionIcons = [
    <Trophy key="1" className="h-5 w-5 text-gold" />,
    <Medal key="2" className="h-5 w-5 text-muted-foreground" />,
    <Award key="3" className="h-5 w-5 text-chart-4" />,
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-border">
        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="w-8 text-center">#</span>
            <span>Name</span>
          </div>
          <span>Points</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {standings.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No standings yet. Matches haven't been played.
          </div>
        ) : (
          standings.map((player, index) => (
            <div
              key={player.user_id}
              className={`flex items-center justify-between border-b border-border px-6 py-4 last:border-0 transition-colors ${
                index < 3 ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center">
                  {index < 3 ? (
                    positionIcons[index]
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                  )}
                </div>
                <span className="font-medium text-foreground">
                  {player.first_name} {player.last_name}
                </span>
              </div>
              <Badge
                variant={index === 0 ? "default" : "secondary"}
                className="min-w-[3rem] justify-center text-sm font-bold"
              >
                {player.points}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
