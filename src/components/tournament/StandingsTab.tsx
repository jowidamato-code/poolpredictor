import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";
import { buildScoringConfig, scoreMatchPrediction, scoreBonusPrediction } from "@/lib/scoring";

interface Standing {
  user_id: string;
  first_name: string;
  last_name: string;
  points: number;
  submitted_at: string | null;
}

export function StandingsTab() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStandings();
  }, []);

  async function loadStandings() {
    const [profilesRes, predsRes, matchesRes, settingsRes, bonusPredsRes, bonusResultsRes] =
      await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name"),
        supabase.from("predictions").select("*"),
        supabase.from("matches").select("*"),
        supabase.from("settings").select("*"),
        (supabase as any).from("bonus_predictions").select("*"),
        (supabase as any).from("bonus_results").select("*").maybeSingle(),
      ]);

    const profiles = profilesRes.data ?? [];
    const allPreds = predsRes.data ?? [];
    const allMatches = matchesRes.data ?? [];
    const settingsMap = Object.fromEntries(
      (settingsRes.data ?? []).map((s) => [s.key, s.value]),
    );
    const config = buildScoringConfig(settingsMap);
    const bonusPreds = bonusPredsRes.data ?? [];
    const bonusResult = bonusResultsRes.data;

    const matchById = Object.fromEntries(allMatches.map((m: any) => [m.id, m]));

    const points: Record<string, number> = {};
    const submitted: Record<string, string | null> = {};
    for (const p of profiles) {
      points[p.user_id] = 0;
      submitted[p.user_id] = null;
    }

    // Match-level points
    for (const pred of allPreds) {
      const match = matchById[pred.match_id];
      if (!match || !match.played) continue;
      if (points[pred.user_id] === undefined) continue;
      points[pred.user_id] += scoreMatchPrediction(match, pred as any, config);
    }

    // Bonus points
    if (bonusResult) {
      for (const bp of bonusPreds) {
        if (points[bp.user_id] === undefined) continue;
        points[bp.user_id] += scoreBonusPrediction(bp as any, bonusResult as any, config);
        submitted[bp.user_id] = bp.submitted_at;
      }
    } else {
      for (const bp of bonusPreds) {
        if (submitted[bp.user_id] !== undefined) submitted[bp.user_id] = bp.submitted_at;
      }
    }

    const sorted: Standing[] = profiles
      .map((p) => ({
        user_id: p.user_id,
        first_name: p.first_name,
        last_name: p.last_name,
        points: points[p.user_id] ?? 0,
        submitted_at: submitted[p.user_id],
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        // Tiebreaker: earliest submitted_at wins (nulls last)
        if (a.submitted_at && b.submitted_at) {
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        }
        if (a.submitted_at) return -1;
        if (b.submitted_at) return 1;
        return 0;
      });

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
