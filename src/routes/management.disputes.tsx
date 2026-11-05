import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/management/disputes")({
  beforeLoad: () => {
    throw redirect({ to: "/management" });
  },
});
