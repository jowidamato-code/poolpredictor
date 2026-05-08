import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Shield, LogIn, MessageCircle, KeyRound, ListChecks, Save, Mail, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "./__root";
import logo from "@/assets/poolpredictor-logo-full.png";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const auth = useAuthContext();
  const navigate = useNavigate();

  const scrollToHowToPlay = (e: React.MouseEvent) => {
    e.preventDefault();
    document
      .getElementById("how-to-play")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Already signed in → send to lobby (or admin dashboard)
  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate({ to: auth.isAdmin ? "/dashboard" : "/lobby" });
    }
  }, [auth.isAuthenticated, auth.isAdmin, navigate]);

  const steps = [
    {
      icon: MessageCircle,
      title: "Message Us on Facebook",
      body: "We set up your secure account manually to keep the pool exclusive and invite-only.",
      cta: { label: "Message on Facebook", href: "https://www.facebook.com/poolpredictor" },
    },
    {
      icon: KeyRound,
      title: "Log In",
      body: "Once you receive your credentials, sign in with your participant account to access the bracket.",
    },
    {
      icon: ListChecks,
      title: "Predict the Path",
      body: "Fill out your entire bracket. Every match, every knockout stage — all the way to the Final.",
    },
    {
      icon: Save,
      title: "Save & Dominate",
      body: "Hit save and track your progress live as the results roll in throughout the tournament.",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-sans">
      {/* Premium luxury background */}
      <div className="pointer-events-none absolute inset-0">
        {/* Dark top wash to match the logo's near-black background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 50% 0%, oklch(0.10 0 0) 0%, transparent 65%)",
          }}
        />
        {/* Fine luxury grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.85 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.85 0 0) 1px, transparent 1px)",
            backgroundSize: "120px 120px",
            maskImage:
              "radial-gradient(ellipse 70% 70% at 50% 30%, black 30%, transparent 80%)",
          }}
        />
        {/* Bottom vignette */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-background" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-[0.25em] text-gold">
              POOL PREDICTOR
            </span>
          </div>
          <Link to="/admin-login">
            <Button variant="outline" size="sm" className="gap-2 border-gold/30 text-gold hover:bg-gold/10 hover:text-gold">
              <Shield className="h-4 w-4" /> Admin Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-12 text-center sm:pt-16">
        <div className="mx-auto flex max-w-md justify-center">
          <img
            src={logo}
            alt="Pool Predictor"
            className="w-full max-w-sm drop-shadow-[0_0_40px_color-mix(in_oklab,var(--gold)_35%,transparent)]"
          />
        </div>

        <Badge className="mt-4 border-gold/40 bg-gold/10 px-4 py-1 text-xs tracking-widest text-gold">
          INVITE-ONLY · 2026 WORLD CUP
        </Badge>

        <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
          Predict. Compete. <span className="text-gold">Dominate.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          From group stage to the final — make your picks, climb the leaderboard,
          and win the pot.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/login">
            <Button
              size="lg"
              className="gap-2 px-8 py-6 text-base font-bold shadow-lg shadow-primary/30"
            >
              <LogIn className="h-5 w-5" /> Participant Sign In
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Don't have an account?{" "}
          <a
            href="#how-to-play"
            onClick={scrollToHowToPlay}
            className="font-semibold text-gold hover:underline"
          >
            Here's how to play
          </a>
          .
        </p>

        {/* How to Play */}
        <section id="how-to-play" className="mt-24 scroll-mt-20">
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold tracking-[0.3em] text-gold">
              GET STARTED
            </span>
            <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              How to Play
            </h3>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground">
              Four simple steps to join the pool and start predicting.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="group relative overflow-hidden rounded-2xl border border-gold/15 bg-card/60 p-6 text-left backdrop-blur transition-all hover:border-gold/40 hover:shadow-[0_0_30px_-10px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                >
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-3xl transition-opacity group-hover:opacity-60"
                    style={{ background: "var(--gold)" }}
                  />
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
                      <Icon className="h-5 w-5 text-gold" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tracking-widest text-gold/80">
                          STEP {i + 1}
                        </span>
                      </div>
                      <h4 className="mt-1 text-lg font-bold text-foreground">
                        {step.title}
                      </h4>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {step.body}
                      </p>
                      {step.cta && (
                        <a
                          href={step.cta.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:underline"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {step.cta.label}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Help / Contact */}
        <section className="mt-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-gold/20 bg-card/60 p-8 backdrop-blur">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <HelpCircle className="h-5 w-5 text-gold" />
              </div>
              <h4 className="text-xl font-bold text-foreground">Need help?</h4>
              <p className="text-sm text-muted-foreground">
                Reach out and we'll get you sorted.
              </p>
              <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
                <a
                  href="https://www.facebook.com/poolpredictor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/20"
                >
                  <MessageCircle className="h-4 w-4" /> facebook.com/poolpredictor
                </a>
                <a
                  href="mailto:poolpredictor.mt@gmail.com"
                  className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/20"
                >
                  <Mail className="h-4 w-4" /> poolpredictor.mt@gmail.com
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-16 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Pool Predictor — Invite-only prediction pool.
        </footer>
      </main>
    </div>
  );
}
