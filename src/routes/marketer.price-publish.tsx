import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/marketer/price-publish")({
  beforeLoad: () => {
    throw redirect({ to: "/marketer/products" });
  },
  component: () => null,
});
