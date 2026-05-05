import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Trophy, Shield, LogOut, User, Home, KeyRound, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuthState } from "@/hooks/use-auth";
import logo from "@/assets/poolpredictor-logo.png";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Fireworks } from "@/components/tournament/Fireworks";

interface AppLayoutProps {
  auth: AuthState;
}

export function AppLayout({ auth }: AppLayoutProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const logoClicks = useRef<number[]>([]);
  const [showCredits, setShowCredits] = useState(false);

  function handleLogoClick() {
    const now = Date.now();
    logoClicks.current = [...logoClicks.current.filter((t) => now - t < 3000), now];
    if (logoClicks.current.length >= 5) {
      logoClicks.current = [];
      setShowCredits(true);
      toast("Shoutout to Alex, Miguel & Lawrence — the OG squad 🏟️", {
        description: "Thanks for helping build this. ❤️",
      });
      setTimeout(() => setShowCredits(false), 3500);
    }
  }

  const navItems = [
    { to: "/lobby" as const, label: "Lobby", icon: Home },
    { to: "/tournament" as const, label: "Tournament", icon: Trophy },
    { to: "/account" as const, label: "Settings", icon: KeyRound },
  ];

  const adminItems = auth.isAdmin
    ? [
        { to: "/dashboard" as const, label: "Admin", icon: Shield },
        { to: "/bonus-results" as const, label: "Bonus", icon: Award },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/lobby" className="flex items-center gap-3" onClick={handleLogoClick}>
            <img
              src={logo}
              alt="Pool Predictor logo"
              className="h-10 w-auto"
            />
            <h1 className="text-lg font-bold tracking-wide text-foreground leading-tight">
              POOL PREDICTOR
            </h1>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[...navItems, ...adminItems].map((item) => {
              const Icon = item.icon;
              const isActive = currentPath.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">
                {auth.profile?.first_name} {auth.profile?.last_name}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => auth.logout()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
          {[...navItems, ...adminItems].map((item) => {
            const Icon = item.icon;
            const isActive = currentPath.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      {showCredits && <Fireworks />}
    </div>
  );
}
