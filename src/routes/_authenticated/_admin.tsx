import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuthContext } from "../__root";

export const Route = createFileRoute("/_authenticated/_admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const auth = useAuthContext();
  const navigate = useNavigate();

  if (!auth.isAdmin) {
    navigate({ to: "/predictions" });
    return null;
  }

  return <Outlet />;
}
