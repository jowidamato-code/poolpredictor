import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthContext } from "./__root";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const auth = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.isAuthenticated) navigate({ to: "/" });
  }, [auth.isAuthenticated, navigate]);

  if (!auth.isAuthenticated) return null;

  return <AppLayout auth={auth} />;
}
