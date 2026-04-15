import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    const { auth } = context as any;
    if (auth?.isAuthenticated) {
      throw redirect({ to: "/predictions" });
    } else {
      throw redirect({ to: "/login" });
    }
  },
  component: () => null,
});
