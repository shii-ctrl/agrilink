import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/management/deliveries")({
  beforeLoad: () => {
    throw redirect({ to: "/management" });
  },
});
