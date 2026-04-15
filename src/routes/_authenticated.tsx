import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuthContext } from "./__root";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const auth = useAuthContext();
  const navigate = useNavigate();

  if (!auth.isAuthenticated) {
    navigate({ to: "/login" });
    return null;
  }

  return <AppLayout auth={auth} />;
}
