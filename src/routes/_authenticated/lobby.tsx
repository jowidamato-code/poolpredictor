import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, Euro, Clock } from "lucide-react";
import { computePrizeBreakdown, fmtMoney } from "@/lib/prize-utils";
import { fetchParticipantCount } from "@/lib/participants";

export const Route = createFileRoute("/_authenticated/lobby")({
  component: LobbyPage,
});

function LobbyPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [participants, setParticipants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Promise.all([
      supabase.from("settings").select("*"),
      fetchParticipantCount(),
    ]).then(([sRes, count]) => {
      const map: Record<string, any> = {};
      for (const s of sRes.data ?? []) {
        const val = s.value;
        map[s.key] = typeof val === "string" ? val.replace(/^"|"$/g, "") : val;
      }
      setSettings(map);
      setParticipants(count);
      setLoading(false);
    });
  }, []);

  const breakdown = computePrizeBreakdown(settings, participants);
  const totalPot = fmtMoney(breakdown.winningPot, breakdown.currency);
  const firstPrize = fmtMoney(breakdown.prizes.first, breakdown.currency);
  const entryFee = fmtMoney(breakdown.entryFee, breakdown.currency);
  const deadline = settings.prediction_deadline;
  const tournamentName = settings.tournament_name || "World Cup 2026 Predictor";

  const deadlineMs = deadline ? new Date(deadline).getTime() : null;
  const diff = deadlineMs ? deadlineMs - now : null;
  let countdown: string | null = null;
  if (diff !== null) {
    if (diff <= 0) {
      countdown = "Predictions closed";
    } else {
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      countdown = `${d}d ${h}h ${m}m ${s}s`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Slim page heading */}
      <div className="max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
          Lobby
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
          Available Tournaments
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a tournament to enter your predictions and compete for prizes.
        </p>
      </div>

      {/* Tournament Card */}
      <Card className="overflow-hidden border-border/60 bg-card shadow-[0_1px_0_0_oklch(1_0_0_/_4%)_inset,0_30px_60px_-30px_oklch(0_0_0_/_60%)]">
        <div className="relative overflow-hidden p-6 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 0% 0%, color-mix(in oklch, var(--gold) 12%, transparent), transparent 60%), radial-gradient(ellipse 60% 50% at 100% 100%, color-mix(in oklch, var(--secondary) 60%, transparent), transparent 70%)",
            }}
          />
          <div className="relative">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                {tournamentName}
              </h3>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Total Prize Pot
              </p>
              <p className="mt-1 text-5xl font-black tracking-tight text-gold">
                {totalPot}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {breakdown.participants} {breakdown.participants === 1 ? "entry" : "entries"} so far · grows with every new player
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                1st place takes {firstPrize} ({breakdown.splitPct.first}% of pot)
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Link to="/tournament">
                <Button
                  size="lg"
                  className="px-8 py-6 text-lg font-bold shadow-lg shadow-primary/25"
                >
                  <Trophy className="mr-2 h-5 w-5" /> Enter Tournament
                </Button>
              </Link>
              <span className="text-xs text-muted-foreground">
                Entry fee: {entryFee}{" "}
                <span className="opacity-75">
                  ({fmtMoney(breakdown.adminFeePerEntry, breakdown.currency)} admin fee)
                </span>
              </span>
            </div>
          </div>
          </div>
        </div>

        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
            <Calendar className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Format</p>
              <p className="text-sm font-medium text-foreground">
                48 Teams • Full Bracket
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
            <Clock className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Deadline</p>
              <p className="text-sm font-medium text-foreground">
                {deadline
                  ? new Date(deadline).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "TBD"}
              </p>
              {countdown && (
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-gold">
                  {countdown}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
            <Euro className="h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="text-xs text-muted-foreground">Prize Pool</p>
              <p className="text-sm font-medium text-foreground">
                {totalPot} total · {firstPrize} to winner
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
