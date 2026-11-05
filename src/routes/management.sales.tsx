import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/management/sales")({
  beforeLoad: () => {
    throw redirect({ to: "/management/transactions", replace: true });
  },
});
