import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useAuth, type AuthState } from "@/hooks/use-auth";
import { createContext, useContext, useEffect } from "react";

import appCss from "../styles.css?url";

export const AuthContext = createContext<AuthState | null>(null);

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WC Predictor 2026 — World Cup Prediction Challenge" },
      { name: "description", content: "Predict the path from group stage to the final in the 2026 FIFA World Cup." },
      { property: "og:title", content: "WC Predictor 2026 — World Cup Prediction Challenge" },
      { name: "twitter:title", content: "WC Predictor 2026 — World Cup Prediction Challenge" },
      { property: "og:description", content: "Predict the path from group stage to the final in the 2026 FIFA World Cup." },
      { name: "twitter:description", content: "Predict the path from group stage to the final in the 2026 FIFA World Cup." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f0f7c027-92bd-44da-9433-90dc1ae9dadf/id-preview-a624d753--eddd5115-54c4-4e0e-9365-068d0ff7f2ce.lovable.app-1776671806488.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f0f7c027-92bd-44da-9433-90dc1ae9dadf/id-preview-a624d753--eddd5115-54c4-4e0e-9365-068d0ff7f2ce.lovable.app-1776671806488.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const auth = useAuth();

  useEffect(() => {
    const w = window as unknown as { __ppCreditsLogged?: boolean };
    if (w.__ppCreditsLogged) return;
    w.__ppCreditsLogged = true;
    console.log(
      "%cPool Predictor%c\nBuilt with help from Alex, Miguel & Lawrence — the OG squad 🏆",
      "color:#7BD389;font-weight:bold;font-size:18px;text-shadow:0 1px 0 #000;",
      "color:#E5C76B;font-size:12px;",
    );
  }, []);

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <Outlet />
    </AuthContext.Provider>
  );
}
