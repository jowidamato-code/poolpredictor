import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Trophy, Shield, LogIn, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "./__root";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const auth = useAuthContext();
  const navigate = useNavigate();

  // Already signed in → send to lobby (or admin dashboard)
  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate({ to: auth.isAdmin ? "/dashboard" : "/lobby" });
    }
  }, [auth.isAuthenticated, auth.isAdmin, navigate]);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-foreground">
                WC Predictor
              </h1>
              <p className="text-xs text-muted-foreground">2026 World Cup</p>
            </div>
          </div>

          <Link to="/admin-login">
            <Button variant="outline" size="sm" className="gap-2">
              <Shield className="h-4 w-4" /> Admin Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Background pattern */}
      <div className="pointer-events-none fixed inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 60px, currentColor 60px, currentColor 61px),
                             repeating-linear-gradient(90deg, transparent, transparent 80px, currentColor 80px, currentColor 81px)`,
          }}
        />
      </div>

      {/* Hero */}
      <main className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
        <Badge className="mb-6 border-gold/30 bg-gold/15 px-4 py-1 text-sm text-gold">
          <Star className="mr-1.5 h-3.5 w-3.5" /> Predictions Open
        </Badge>
        <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
          Predict the <span className="text-gold">World Cup 2026</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          From group stage to the final — make your picks, climb the leaderboard,
          and win the pot.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/login">
            <Button
              size="lg"
              className="gap-2 px-8 py-6 text-lg font-bold shadow-lg shadow-primary/25"
            >
              <LogIn className="h-5 w-5" /> Participant Sign In
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Don't have an account? Ask your admin to create one for you.
        </p>
      </main>
    </div>
  );
}
