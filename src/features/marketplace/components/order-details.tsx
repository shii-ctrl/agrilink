import { Check, ClipboardList, MapPin, Phone } from "lucide-react";

import { peso } from "@/features/marketplace/products";
import type { DemoOrder, DemoOrderItem } from "@/lib/demo/demo-orders";

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

function stepTime(order: DemoOrder, step: string) {
  if (step === "Pending") return order.date;
  if (step === "Confirmed") return order.confirmedAt;
  if (step === "Ready for pickup") return order.confirmedAt;
  if (step === "Sold") return order.soldAt;
  return order.paidAt;
}

export function OrderProgressTimeline({ order }: { order: DemoOrder }) {
  const steps = ["Pending", "Confirmed", "Ready for pickup", "Sold", "Paid"];
  const currentStep =
    order.paymentStatus === "Paid"
      ? 4
      : order.status === "Sold"
        ? 3
        : order.status === "Confirmed"
          ? 2
          : 0;

  return (
    <div
      className="overflow-x-auto pb-2 [scrollbar-width:thin]"
      aria-label="Order progress"
      role="region"
    >
      <ol className="flex min-w-[42rem] px-2 pt-1" aria-label="Order status steps">
        {steps.map((step, index) => {
          const completed = index < currentStep;
          const current = index === currentStep;
          const reached = index <= currentStep;
          return (
            <li
              key={step}
              className="relative flex min-w-0 flex-1 flex-col items-center text-center"
              aria-current={current ? "step" : undefined}
            >
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-4 h-0.5 w-full transition-colors ${
                    index < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              ) : null}
              <span
                className={`relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  completed
                    ? "border-primary bg-primary text-primary-foreground"
                    : current
                      ? "border-primary bg-background text-primary ring-4 ring-primary/15"
                      : "border-border bg-background text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                {completed ? <Check className="size-4" strokeWidth={3} /> : index + 1}
              </span>
              <div className="mt-3 px-2">
                <p
                  className={`text-xs font-semibold sm:text-sm ${
                    reached ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step}
                </p>
                <p
                  className={`mt-1 text-[11px] ${current ? "font-medium text-primary" : "text-muted-foreground"}`}
                >
                  {current ? "Current · " : ""}
                  {stepTime(order, step) ?? "Waiting"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
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
