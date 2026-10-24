import { createFileRoute } from "@tanstack/react-router";

import { MarketerProductsPage } from "./marketer.products";

export const Route = createFileRoute("/marketer/price-publish")({
  head: () => ({
    meta: [
      { title: "Price & Publish — Marketer | AgriLink" },
      { name: "description", content: "Set prices and publish PROCY marketplace listings." },
    ],
  }),
  component: PriceAndPublishPage,
});

function PriceAndPublishPage() {
  return <MarketerProductsPage view="publish" />;
}
