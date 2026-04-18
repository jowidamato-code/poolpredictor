import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, DollarSign, Clock, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: LobbyPage,
});

function LobbyPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .then(({ data }) => {
        const map: Record<string, any> = {};
        for (const s of data ?? []) {
          const val = s.value;
          map[s.key] = typeof val === "string" ? val.replace(/^"|"$/g, "") : val;
        }
        setSettings(map);
        setLoading(false);
      });
  }, []);

  const prize = settings.prize_1st || "€500";
  const entryFee = settings.entry_fee || "TBD";
  const deadline = settings.prediction_deadline;
  const tournamentName = settings.tournament_name || "World Cup 2026 Predictor";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 60px, currentColor 60px, currentColor 61px),
                               repeating-linear-gradient(90deg, transparent, transparent 80px, currentColor 80px, currentColor 81px)`,
            }}
          />
        </div>
        <div className="relative px-4 py-12 text-center">
          <Badge className="mb-4 border-gold/30 bg-gold/15 px-4 py-1 text-sm text-gold">
            <Star className="mr-1.5 h-3.5 w-3.5" /> Tournament Lobby
          </Badge>
          <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
            Available Tournaments
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Pick a tournament to enter your predictions and compete for prizes.
          </p>
        </div>
      </div>

      {/* Tournament Card */}
      <Card className="overflow-hidden border-border bg-card">
        <div className="bg-gradient-to-r from-primary/20 to-gold/10 p-6 sm:p-10">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <h3 className="text-2xl font-bold text-foreground">
                {tournamentName}
              </h3>
              <p className="mt-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Winner Takes
              </p>
              <p className="mt-1 text-5xl font-black text-gold">{prize}</p>
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
                Entry fee: {entryFee}
              </span>
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
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
            <DollarSign className="h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="text-xs text-muted-foreground">Prize Pool</p>
              <p className="text-sm font-medium text-foreground">
                {prize} for the winner
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
