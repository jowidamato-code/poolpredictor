import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import type { AuthState } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: ({ context }) => {
    const { auth } = context as { auth: AuthState };
    if (!auth.isAdmin) {
      throw redirect({ to: "/predictions" });
    }
  },
  component: () => <Outlet />,
});
