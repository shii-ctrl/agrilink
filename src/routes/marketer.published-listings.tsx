import { createFileRoute } from "@tanstack/react-router";

import { MarketerProductsPage } from "./marketer.products";

export const Route = createFileRoute("/marketer/published-listings")({
  head: () => ({
    meta: [
      { title: "Published Listings — Marketer | AgriLink" },
      { name: "description", content: "Review and manage PROCY marketplace listings." },
    ],
  }),
  component: PublishedListingsPage,
});

function PublishedListingsPage() {
  return <MarketerProductsPage view="listings" />;
}
