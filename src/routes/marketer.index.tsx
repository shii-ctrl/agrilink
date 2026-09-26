import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, PackageCheck, ReceiptText, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketerDashboard } from "@/lib/marketplace-server-functions";

export const Route = createFileRoute("/marketer/")({
  component: MarketerDashboard,
});

function MarketerDashboard() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getMarketerDashboard>> | null>(
    null,
  );
  useEffect(() => {
    void getMarketerDashboard()
      .then(setSummary)
      .catch(() => toast.error("Could not load live operations totals."));
  }, []);
  const cards = [
    {
      label: "Products received",
      value: `${summary?.receivedKg ?? 0} kg`,
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
      value: `${summary?.availableKg ?? 0} kg`,
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
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <span className="font-semibold text-primary">Live Layerbase totals:</span> these figures
          are calculated from saved deliveries, inventory, listings, and buyer orders.
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
                Record farmer deliveries and classify each product as Good, Semi, or Reject before
                publishing it to the marketplace.
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
                Review incoming buyer orders, confirm stock availability, and follow their progress
                through the PROCY sales workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Orders are confirmed by the marketer, then accounting records payment. No online
                payment gateway is included.
              </p>
              <div className="rounded-lg bg-muted p-3 text-foreground">
                Order status flow: Pending → Confirmed → Sold → Paid
              </div>
            </CardContent>
          </Card>
        </section>
        <section className="rounded-3xl border border-semi/30 bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Low-stock attention</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Review delivery-backed classifications and available quantity before accepting buyer
            orders. A new record will appear here only after it is saved in Layerbase.
          </p>
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
      </div>
    </MarketerLayout>
  );
}
