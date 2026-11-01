import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/marketer/rejects")({
  beforeLoad: () => {
    throw redirect({ to: "/marketer/classification" });
  },
  component: () => null,
});
