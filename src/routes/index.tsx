import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, DollarSign, Users, Clock, Star } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LobbyPage,
});

function LobbyPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("settings").select("*"),
      supabase.auth.getSession(),
    ]).then(([settingsRes, sessionRes]) => {
      const map: Record<string, any> = {};
      for (const s of settingsRes.data ?? []) {
        const val = s.value;
        map[s.key] = typeof val === "string" ? val.replace(/^"|"$/g, "") : val;
      }
      setSettings(map);
      setIsLoggedIn(!!sessionRes.data?.session);
      setLoading(false);
    });
  }, []);

  const prize = settings.prize_1st || "€500";
  const entryFee = settings.entry_fee || "TBD";
  const deadline = settings.prediction_deadline;
  const tournamentName = settings.tournament_name || "World Cup 2026 Predictor";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">WC Predictor 2026</h1>
          </div>
          {isLoggedIn ? (
            <Link to="/tournament">
              <Button>Enter Tournament</Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button>Sign In</Button>
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 60px, currentColor 60px, currentColor 61px),
                               repeating-linear-gradient(90deg, transparent, transparent 80px, currentColor 80px, currentColor 81px)`,
            }}
          />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center">
          <Badge className="mb-6 bg-gold/15 text-gold border-gold/30 text-sm px-4 py-1">
            <Star className="mr-1.5 h-3.5 w-3.5" /> Now Open
          </Badge>
          <h2 className="text-4xl font-extrabold text-foreground sm:text-5xl">
            {tournamentName}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            Predict the full bracket from group stage to the final. Compete against
            friends and win prizes!
          </p>
        </div>
      </div>

      {/* Tournament Card */}
      <div className="mx-auto max-w-4xl px-4 -mt-4 pb-16">
        <Card className="border-border bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/20 to-gold/10 p-6 sm:p-10">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
              {/* Prize */}
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Winner Takes
                </p>
                <p className="mt-1 text-5xl font-black text-gold">{prize}</p>
              </div>

              {/* Entry Button */}
              <div className="flex flex-col items-center gap-2">
                {isLoggedIn ? (
                  <Link to="/tournament">
                    <Button size="lg" className="text-lg px-8 py-6 font-bold shadow-lg shadow-primary/25">
                      <Trophy className="mr-2 h-5 w-5" /> Enter Tournament
                    </Button>
                  </Link>
                ) : (
                  <Link to="/login">
                    <Button size="lg" className="text-lg px-8 py-6 font-bold shadow-lg shadow-primary/25">
                      <Trophy className="mr-2 h-5 w-5" /> Sign In to Play
                    </Button>
                  </Link>
                )}
                <span className="text-xs text-muted-foreground">
                  Entry fee: {entryFee}
                </span>
              </div>
            </div>
          </div>

          <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Format</p>
                <p className="text-sm font-medium text-foreground">48 Teams • Full Bracket</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
              <Clock className="h-5 w-5 text-primary shrink-0" />
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
              <DollarSign className="h-5 w-5 text-gold shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Prize Pool</p>
                <p className="text-sm font-medium text-foreground">{prize} for the winner</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
