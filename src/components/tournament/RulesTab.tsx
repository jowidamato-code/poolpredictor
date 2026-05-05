import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, Trophy, Users, Star, Target, Wallet } from "lucide-react";
import { buildScoringConfig } from "@/lib/scoring";
import { computePrizeBreakdown, fmtMoney } from "@/lib/prize-utils";

export function RulesTab() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from("settings").select("*"),
      supabase.from("profiles").select("user_id", { count: "exact", head: true }),
    ]).then(([sRes, pRes]) => {
      const map: Record<string, any> = {};
      for (const s of sRes.data ?? []) {
        map[s.key] =
          typeof s.value === "string" ? s.value.replace(/^"|"$/g, "") : s.value;
      }
      setSettings(map);
      setParticipants(pRes.count ?? 0);
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

  const c = buildScoringConfig(settings);
  const deadline = settings.prediction_deadline;
  const b = computePrizeBreakdown(settings, participants);

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
    <div className="space-y-6">
      {/* Entry fee + prize pool */}
      <Card className="border-gold/30 bg-gold/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-gold" /> Entry Fee & Prize Pool
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Entry fee: <strong className="text-foreground">{fmtMoney(b.entryFee, b.currency)}</strong> per participant
            {" · "}
            <strong className="text-foreground">{b.adminFeePct}%</strong> admin fee
            {" · "}
            <strong className="text-foreground">{100 - b.adminFeePct}%</strong> goes to the winning pot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <span className="text-foreground">Current pot ({b.participants} participants)</span>
            <Badge variant="secondary" className="font-bold">
              {fmtMoney(b.winningPot, b.currency)}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: `1st (${b.splitPct.first}%)`, amount: b.prizes.first },
              { label: `2nd (${b.splitPct.second}%)`, amount: b.prizes.second },
              { label: `3rd (${b.splitPct.third}%)`, amount: b.prizes.third },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
              >
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className="text-sm font-bold text-gold">
                  {fmtMoney(row.amount, b.currency)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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

      {sections.map(({ title, icon: Icon, rows }) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="h-4 w-4 text-primary" /> {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map(([label, points]) => (
              <div
                key={label}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
              >
                <span className="min-w-0 flex-1 text-xs text-foreground sm:text-sm">{label}</span>
                <Badge variant="secondary" className="shrink-0 font-bold">{points} pts</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tiebreakers</CardTitle>
          <CardDescription>
            If two players finish on the same total points, ties are broken in this order:
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground">
              <li>Most correct exact match scores</li>
              <li>Most correct match results (winner/draw)</li>
              <li>Earliest bonus-picks submission time</li>
            </ol>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong className="text-foreground">1. Predict</strong> — Fill in scores for every match plus your bonus picks.</p>
          <p><strong className="text-foreground">2. Lock In</strong> — All predictions and bonus picks lock at the deadline.</p>
          <p><strong className="text-foreground">3. Earn Points</strong> — Points are awarded as matches play out and as bonus outcomes resolve.</p>
          <p><strong className="text-foreground">4. Win</strong> — Highest total wins. Earliest submission breaks ties.</p>
        </CardContent>
      </Card>
    </div>
  );
}
