import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Trophy, Shield, Settings, LogOut, User, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuthState } from "@/hooks/use-auth";

interface AppLayoutProps {
  auth: AuthState;
}

export function AppLayout({ auth }: AppLayoutProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { to: "/" as const, label: "Lobby", icon: Home },
    { to: "/tournament" as const, label: "Tournament", icon: Trophy },
  ];

  const adminItems = auth.isAdmin
    ? [
        { to: "/dashboard" as const, label: "Admin", icon: Shield },
        { to: "/settings" as const, label: "Settings", icon: Settings },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">
                WC Predictor
              </h1>
              <p className="text-xs text-muted-foreground">2026 World Cup</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {[...navItems, ...adminItems].map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === "/"
                  ? currentPath === "/"
                  : currentPath.startsWith(item.to);
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
            const isActive =
              item.to === "/"
                ? currentPath === "/"
                : currentPath.startsWith(item.to);
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
    </div>
  );
}
