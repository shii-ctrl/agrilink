import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/marketer/published-listings")({
  beforeLoad: () => {
    throw redirect({ to: "/marketer/products" });
  },
  component: () => null,
});
