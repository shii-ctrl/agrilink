import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ClipboardCheck,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketerDashboard } from "@/services/marketplace/marketplace-server-functions";
import { formatSellingQuantity, type SellingUnit } from "@/features/marketplace/selling-units";

export const Route = createFileRoute("/marketer/")({
  component: MarketerDashboard,
});

function MarketerDashboard() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getMarketerDashboard>> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const nextSummary = await getMarketerDashboard();
    setSummary(nextSummary);
    setLoadError(null);
  }, []);
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => void loadDashboard(), [loadDashboard]);
  useAutoRefresh(() => load().catch(() => undefined));
  const combinedUnits = (
    totals: { unit: SellingUnit; received: number; available: number }[] | undefined,
    field: "received" | "available",
  ) =>
    totals
      ?.filter((item) => item[field] > 0)
      .map((item) => formatSellingQuantity(item[field], item.unit))
      .join(" + ") || "0";
  const cards = [
    {
      label: "Products received",
      value: combinedUnits(summary?.unitTotals, "received"),
      detail: "Recorded from farmer deliveries",
      icon: ReceiptText,
    },
    {
      label: "Published listings",
      value: String(summary?.publishedListings ?? 0),
      detail: "Visible to buyers",
      icon: PackageCheck,
    },
    {
      label: "Available products",
      value: combinedUnits(summary?.unitTotals, "available"),
      detail: "Across Good, Semi and Reject",
      icon: ShoppingBag,
    },
    {
      label: "Pending buyer orders",
      value: String(summary?.pendingOrders ?? 0),
      detail: "Orders needing confirmation",
      icon: ClipboardCheck,
    },
  ];
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Operations Dashboard"
        description="Manage PROCY receiving, classification, marketplace listings, buyer orders, and sales monitoring."
      />
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadDashboard()}
          label="operations dashboard"
        />
        {!loading && !loadError ? (
          <>
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
              <span className="font-semibold text-primary">Live Layerbase totals:</span> these
              figures are calculated from saved deliveries, inventory, listings, and buyer orders.
            </div>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((item) => (
                <Card key={item.label} className="border-border/70 shadow-sm">
                  <CardContent className="flex items-start justify-between p-5">
                    <div>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="mt-2 font-display text-3xl font-semibold text-foreground">
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <item.icon className="size-5" />
                    </span>
                  </CardContent>
                </Card>
              ))}
            </section>
            <section className="grid gap-5 lg:grid-cols-2">
              <Card className="border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>Receiving and classification</CardTitle>
                  <CardDescription>
                    Record farmer deliveries and classify each product as Good, Semi, or Reject
                    before publishing it to the marketplace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Next module: capture delivery details, traceability information, quantity, and
                    quality classification.
                  </p>
                  <div className="rounded-lg bg-muted p-3 text-foreground">
                    Farmers supply PROCY; buyers see only PROCY marketplace listings.
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>Buyer order handling</CardTitle>
                  <CardDescription>
                    Review incoming buyer orders, confirm stock availability, and follow their
                    progress through the PROCY sales workflow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Orders are confirmed by the marketer, then accounting records payment. No online
                    payment gateway is included.
                  </p>
                  <div className="rounded-lg bg-muted p-3 text-foreground">
                    Order flow: Pending → Confirmed → Sold; Accounting then records payment as Paid.
                  </div>
                </CardContent>
              </Card>
            </section>
            <section className="rounded-3xl border border-semi/30 bg-card p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <AlertTriangle className="size-5 text-semi" /> Low-stock attention
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Published listings with 5 selling units or less available. Refreshes
                    automatically while this page is open.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void load()}
                >
                  <RefreshCw className="size-3.5" /> Refresh
                </Button>
              </div>
              {summary?.lowStock.length ? (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.lowStock.map((item) => (
                    <li key={item.id} className="rounded-2xl border border-border bg-muted/30 p-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.classification} classification
                      </p>
                      <p className="mt-3 font-semibold text-semi">
                        {formatSellingQuantity(item.availableKg, item.sellingUnit)} available
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                  No published listings are at or below 5 selling units right now.
                </p>
              )}
            </section>
            <section className="flex flex-wrap gap-3 rounded-3xl border border-border bg-card p-6 shadow-card">
              <Button asChild className="rounded-full">
                <Link to="/marketer/receiving">Receive delivery</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/marketer/products">Create listing</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/marketer/orders">Review orders</Link>
              </Button>
            </section>
          </>
        ) : null}
      </div>
    </MarketerLayout>
  );
}
