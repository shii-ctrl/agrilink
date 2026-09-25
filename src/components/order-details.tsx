import { ClipboardList, MapPin, Phone } from "lucide-react";

import { peso } from "@/lib/products";
import type { DemoOrder, DemoOrderItem } from "@/lib/demo-orders";

function orderItems(order: DemoOrder): DemoOrderItem[] {
  if (order.items?.length) return order.items;
  return [
    {
      listingId: `${order.product.toLowerCase()}-${order.classification.toLowerCase()}`,
      name: order.product,
      classification: order.classification,
      quantityKg: Number.parseFloat(order.quantity) || 0,
      pricePerKg: 0,
    },
  ];
}

function reachedStep(order: DemoOrder, step: string) {
  const orderSteps = ["Pending", "Confirmed", "Sold"];
  if (step === "Ready for pickup") return orderSteps.indexOf(order.status) >= 1;
  if (step === "Paid") return order.paymentStatus === "Paid";
  return (
    orderSteps.indexOf(order.status) >= orderSteps.indexOf(step as (typeof orderSteps)[number])
  );
}

function stepTime(order: DemoOrder, step: string) {
  if (step === "Pending") return order.date;
  if (step === "Confirmed") return order.confirmedAt;
  if (step === "Ready for pickup") return order.confirmedAt;
  if (step === "Sold") return order.soldAt;
  return order.paidAt;
}

export function OrderProgressTimeline({ order }: { order: DemoOrder }) {
  const steps = ["Pending", "Confirmed", "Ready for pickup", "Sold", "Paid"];
  return (
    <div className="grid gap-2 sm:grid-cols-5" aria-label="Order progress">
      {steps.map((step) => {
        const complete = reachedStep(order, step);
        return (
          <div
            key={step}
            className={`rounded-xl border px-3 py-3 text-center text-xs ${
              complete
                ? "border-primary/20 bg-primary text-primary-foreground"
                : "border-border bg-muted/50 text-muted-foreground"
            }`}
          >
            <p className="font-semibold">{step}</p>
            <p className="mt-1 opacity-80">{stepTime(order, step) ?? "Waiting"}</p>
          </div>
        );
      })}
    </div>
  );
}

export function OrderDetails({
  order,
  showBuyer = true,
}: {
  order: DemoOrder;
  showBuyer?: boolean;
}) {
  const items = orderItems(order);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Order details
          </p>
          <h2 className="mt-1 text-xl font-semibold">{order.id}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Submitted {order.date} to PROCY.</p>
        </div>
        <p className="font-display text-2xl font-semibold">{order.total}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {showBuyer && (
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Buyer
            </p>
            <p className="mt-2 font-medium">{order.buyer}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="size-3.5" /> {order.contact}
            </p>
          </div>
        )}
        <div className="rounded-2xl bg-muted/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pickup or delivery arrangement
          </p>
          <p className="mt-2 flex gap-2 text-sm leading-relaxed text-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> {order.pickupNote}
          </p>
        </div>
        <div className="rounded-2xl bg-muted/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payment information
          </p>
          <p className="mt-2 font-medium">{order.paymentStatus}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.paymentId
              ? `${order.paymentMethod ?? "Payment"} · ${order.paymentId}`
              : "Payment is recorded by Accounting after sale completion."}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
          <ClipboardList className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Ordered classified items</h3>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.listingId}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.classification} classification
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{item.quantityKg} kg</p>
                {item.pricePerKg > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {peso(item.pricePerKg)} / kg
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold">Order progress</p>
        <OrderProgressTimeline order={order} />
      </div>

      {order.history?.length ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-3">
            <h3 className="text-sm font-semibold">Order activity</h3>
          </div>
          <div className="divide-y divide-border">
            {order.history.map((entry) => (
              <div key={`${entry.status}-${entry.changedAt}`} className="px-4 py-3 text-sm">
                <p className="font-medium">{entry.status}</p>
                <p className="mt-1 text-muted-foreground">{entry.note ?? "Status updated."}</p>
                <p className="mt-1 text-xs text-muted-foreground">{entry.changedAt}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
