import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Target, Users, Trophy, Star, Loader2 } from "lucide-react";
import { buildScoringConfig, DEFAULT_SCORING, type ScoringConfig } from "@/lib/scoring";

interface PublicRulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublicRulesModal({ open, onOpenChange }: PublicRulesModalProps) {
  const [c, setC] = useState<ScoringConfig>(DEFAULT_SCORING);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("settings")
      .select("*")
      .then(({ data }) => {
        const map: Record<string, any> = {};
        for (const s of data ?? []) {
          map[s.key] =
            typeof s.value === "string" ? s.value.replace(/^"|"$/g, "") : s.value;
        }
        setC(buildScoringConfig(map));
        setDeadline(map.prediction_deadline ?? null);
        setLoading(false);
      });
  }, [open]);

  const sections = [
    {
      title: "Group Stage — Match Level",
      icon: Target,
      rows: [
        ["Match Result Only", c.winner_only],
        ["Match Result + Goal Difference", c.winner_gd],
        ["Match Result + Goal Difference + Correct Score", c.winner_exact_score],
        ["Bonus: Both Teams to Score (correct yes/no)", c.btts_bonus],
      ] as const,
    },
    {
      title: "Knockout Stages — Match Level",
      icon: Target,
      rows: [
        ["Match Result Only", c.winner_only],
        ["Match Result + Goal Difference", c.winner_gd],
        ["Match Result + Goal Difference + Correct Score", c.winner_exact_score],
        ["Team to advance (correct pick)", c.team_through],
        ["Bonus: Both Teams to Score (correct yes/no)", c.btts_bonus],
      ] as const,
    },
    {
      title: "Group Stage Outcomes",
      icon: Users,
      rows: [
        ["Correct Group Winner", c.group_winner],
        ["Correct Group Runner-up", c.group_runner_up],
      ] as const,
    },
    {
      title: "Team Progression (per team)",
      icon: Trophy,
      rows: [
        ["Reach Round of 16", c.progression_r16],
        ["Reach Quarter-finals", c.progression_qf],
        ["Reach Semi-finals", c.progression_sf],
        ["Reach Final", c.progression_final],
        ["Win the World Cup", c.progression_champion],
      ] as const,
    },
    {
      title: "Player Awards",
      icon: Star,
      rows: [
        ["Top Goalscorer", c.top_scorer],
        ["Best Player (Golden Ball)", c.golden_ball],
        ["Best Young Player", c.young_player],
        ["Most Assists", c.most_assists],
      ] as const,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Tournament Rules</DialogTitle>
          <DialogDescription>
            Prediction deadline, point system and tiebreakers.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            {deadline && (
              <Card className="border-gold/30 bg-gold/5">
                <CardContent className="flex items-center gap-3 p-4">
                  <Clock className="h-5 w-5 text-gold" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Prediction Deadline
                    </p>
                    <p className="text-base font-bold text-gold">
                      {new Date(deadline).toLocaleString("en-GB", {
                        timeZone: "Europe/Malta",
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      Malta time
                    </p>
                    <p className="text-xs text-muted-foreground">(extended by 2 hours)</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {sections.map(({ title, icon: Icon, rows }) => (
              <Card key={title}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-primary" /> {title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rows.map(([label, points]) => (
                    <div
                      key={label}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 text-xs text-foreground sm:text-sm">
                        {label}
                      </span>
                      <Badge variant="secondary" className="shrink-0 font-bold">
                        {points} pts
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tiebreakers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  If two players finish on the same total points, ties are broken in
                  this order:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">
                  <li>Most correct exact match scores</li>
                  <li>Most correct match results (winner/draw)</li>
                  <li>Earliest bonus-picks submission time</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}