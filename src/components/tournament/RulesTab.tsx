import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Clock, Target, Trophy, Loader2 } from "lucide-react";

export function RulesTab() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .then(({ data }) => {
        const map: Record<string, any> = {};
        for (const s of data ?? []) {
          map[s.key] =
            typeof s.value === "string"
              ? s.value.replace(/^"|"$/g, "")
              : s.value;
        }
        setSettings(map);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const deadline = settings.prediction_deadline;
  const scoringRules = [
    { label: "Correct Match Winner", points: settings.points_correct_winner ?? 3, icon: Target },
    { label: "Correct Exact Score", points: settings.points_correct_score ?? 5, icon: Award },
    { label: "Correct Group Winner", points: settings.points_correct_group_winner ?? 5, icon: Trophy },
    { label: "Correct Group Runner-up", points: settings.points_correct_group_runner_up ?? 3, icon: Trophy },
    { label: "Correct Finalist", points: settings.points_correct_finalist ?? 10, icon: Trophy },
    { label: "Correct Champion", points: settings.points_correct_champion ?? 20, icon: Trophy },
    { label: "Correct Golden Boot", points: settings.points_correct_golden_boot ?? 10, icon: Award },
  ];

  return (
    <div className="space-y-6">
      {/* Deadline */}
      {deadline && (
        <Card className="border-gold/30 bg-gold/5">
          <CardContent className="flex items-center gap-3 p-5">
            <Clock className="h-5 w-5 text-gold" />
            <div>
              <p className="text-sm font-semibold text-foreground">Prediction Deadline</p>
              <p className="text-lg font-bold text-gold">
                {new Date(deadline).toLocaleString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Point System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scoringRules.map(({ label, points, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
              <Badge variant="secondary" className="text-sm font-bold">
                {points} pts
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">1. Predict</strong> — Fill in your
            predicted scores for every match from the group stage through to the final.
          </p>
          <p>
            <strong className="text-foreground">2. Lock In</strong> — All predictions
            must be submitted before the deadline. Once locked, they cannot be changed.
          </p>
          <p>
            <strong className="text-foreground">3. Earn Points</strong> — After each
            match is played, points are awarded based on the scoring system above.
          </p>
          <p>
            <strong className="text-foreground">4. Win</strong> — The participant with
            the most points at the end of the tournament wins!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
