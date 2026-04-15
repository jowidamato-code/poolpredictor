import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import type { AuthState } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context }) => {
    const { auth } = context as { auth: AuthState };
    if (!auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { auth } = Route.useRouteContext() as { auth: AuthState };
  return <AppLayout auth={auth} />;
}
