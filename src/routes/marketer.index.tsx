import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, PackageCheck, ReceiptText, ShoppingBag } from "lucide-react";

import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/marketer/")({
  component: MarketerDashboard,
});

const summary = [
  {
    label: "Products received",
    value: "220 kg",
    detail: "Recorded from farmer deliveries",
    icon: ReceiptText,
  },
  {
    label: "Classified listings",
    value: "4",
    detail: "Ready for marketplace monitoring",
    icon: PackageCheck,
  },
  {
    label: "Available products",
    value: "195 kg",
    detail: "Across Good, Semi and Reject",
    icon: ShoppingBag,
  },
  {
    label: "Pending buyer orders",
    value: "0",
    detail: "No order needs confirmation",
    icon: ClipboardCheck,
  },
];

function MarketerDashboard() {
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Operations Dashboard"
        description="Manage PROCY receiving, classification, marketplace listings, buyer orders, and sales monitoring."
      />
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <span className="font-semibold text-primary">Temporary demo data:</span> These figures are
          for preview only and will be replaced by MySQL records later.
        </div>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
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
            Tomato — Reject classification has 10 kg available. Review the listing quantity before
            accepting additional buyer orders.
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
