import {
  Check,
  CircleCheck,
  ClipboardList,
  Clock3,
  MapPin,
  Phone,
  WalletCards,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { peso } from "@/features/marketplace/products";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import type { DemoOrder, DemoOrderItem } from "@/lib/demo/demo-orders";
import { formatSellingQuantity, sellingUnitLabel } from "@/features/marketplace/selling-units";

function formatOrderDate(value: string | undefined, includeTime = false) {
  if (!value) return "Waiting";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "Asia/Manila",
  }).format(date);
}

function orderItems(order: DemoOrder): DemoOrderItem[] {
  if (order.items?.length) return order.items;
  return [
    {
      listingId: `${order.product.toLowerCase()}-${order.classification.toLowerCase()}`,
      name: order.product,
      classification: order.classification,
      quantityKg: Number.parseFloat(order.quantity) || 0,
      pricePerKg: 0,
      sellingUnit: "kg",
    },
  ];
}

export function OrderProgressTimeline({ order }: { order: DemoOrder }) {
  const isDelivery = order.fulfillmentMethod === "delivery";
  const steps: Array<[string, string]> = isDelivery
    ? [
        ["pending", "Pending"],
        ["confirmed", "Confirmed"],
        ["preparing", "Preparing"],
        ["ready_for_dispatch", "Ready for dispatch"],
        ["rider_assigned", "Rider assigned"],
        ["out_for_delivery", "Out for delivery"],
        ["delivered", "Delivered"],
      ]
    : [
        ["pending", "Pending"],
        ["confirmed", "Confirmed"],
        ["preparing", "Preparing"],
        ["ready_for_pickup", "Ready for pickup"],
        ["picked_up", "Picked up"],
      ];
  const currentStatus =
    order.fulfillmentStatus ??
    (order.status === "Sold"
      ? isDelivery
        ? "delivered"
        : "picked_up"
      : order.status.toLowerCase());
  const matchedStep = steps.findIndex(([status]) => status === currentStatus);
  const currentStep = Math.max(0, matchedStep);
  const stepTime = (status: string) =>
    order.history?.find((entry) => entry.status.toLowerCase().replaceAll(" ", "_") === status)
      ?.changedAt ??
    (status === "pending"
      ? (order.createdAt ?? order.date)
      : status === "confirmed"
        ? order.confirmedAt
        : status === "picked_up" || status === "delivered"
          ? order.fulfilledAt
          : undefined);
  const stepDateLabel = (status: string, reached: boolean) => {
    const timestamp = stepTime(status);
    return timestamp ? formatOrderDate(timestamp) : reached ? "Completed" : "Waiting";
  };
  const stepState = (index: number) => ({
    completed: index < currentStep,
    current: index === currentStep,
    reached: index <= currentStep,
  });

  return (
    <div aria-label="Order progress" role="region">
      <ol className="space-y-0 sm:hidden" aria-label="Order status steps">
        {steps.map(([status, label], index) => {
          const { completed, current, reached } = stepState(index);
          return (
            <li
              key={status}
              className="relative flex min-h-16 gap-3"
              aria-current={current ? "step" : undefined}
            >
              <div className="relative flex w-8 shrink-0 justify-center">
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-0 top-8 w-0.5 ${index < currentStep ? "bg-primary" : "bg-border"}`}
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={`relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    completed
                      ? "border-primary bg-primary text-primary-foreground"
                      : current
                        ? "border-primary bg-background text-primary ring-4 ring-primary/15"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {completed ? <Check className="size-4" strokeWidth={3} /> : index + 1}
                </span>
              </div>
              <div className="pb-5 pt-1">
                <p
                  className={`text-sm font-semibold ${reached ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </p>
                <p
                  className={`mt-0.5 text-xs ${current ? "font-medium text-primary" : "text-muted-foreground"}`}
                >
                  {current ? "Current · " : ""}
                  {stepDateLabel(status, reached)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <ol className="hidden px-2 pt-1 sm:flex" aria-label="Order status steps">
        {steps.map(([status, label], index) => {
          const { completed, current, reached } = stepState(index);
          return (
            <li
              key={status}
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
                  {label}
                </p>
                <p
                  className={`mt-1 text-[11px] ${current ? "font-medium text-primary" : "text-muted-foreground"}`}
                >
                  {current ? "Current · " : ""}
                  {stepDateLabel(status, reached)}
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
  canMessageRider = false,
}: {
  order: DemoOrder;
  showBuyer?: boolean;
  canMessageRider?: boolean;
}) {
  const items = orderItems(order);
  const isPaid = order.paymentStatus === "Paid";
  const isInterrupted = order.status === "Cancelled" || order.status === "Rejected";
  const fulfillmentLabel = (order.fulfillmentStatus ?? "pending")
    .replaceAll("_", " ")
    .replace(/^./, (value) => value.toUpperCase());
  const statusSummary = isInterrupted
    ? {
        title: `Order ${order.status.toLowerCase()}`,
        detail: "This order will not continue to fulfillment.",
        date: order.history?.at(-1)?.changedAt,
        tone: "border-destructive/25 bg-destructive/5 text-destructive",
      }
    : isPaid
      ? {
          title: "Order complete",
          detail: "Payment has been recorded and this order is complete.",
          date: order.paidAt,
          tone: "border-primary/25 bg-primary/5 text-primary",
        }
      : order.status === "Sold"
        ? {
            title: "Order fulfilled — awaiting payment recording",
            detail: "Accounting will record the payment after it is received.",
            date: order.soldAt,
            tone: "border-amber-300 bg-amber-50 text-amber-900",
          }
        : order.status === "Confirmed"
          ? {
              title: fulfillmentLabel,
              detail:
                order.fulfillmentMethod === "delivery"
                  ? "Track preparation, Rider assignment, and delivery separately from payment."
                  : "Track preparation and pickup separately from payment.",
              date: order.history?.at(-1)?.changedAt ?? order.confirmedAt,
              tone: "border-primary/25 bg-primary/5 text-primary",
            }
          : {
              title: "Order received",
              detail: "PROCY is reviewing the order and available classified stock.",
              date: order.createdAt ?? order.date,
              tone: "border-primary/25 bg-primary/5 text-primary",
            };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Order details
          </p>
          <h2 className="mt-1 text-xl font-semibold">{order.id}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted {formatOrderDate(order.createdAt ?? order.date, true)} to PROCY.
          </p>
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
            {order.fulfillmentMethod === "delivery" ? "Delivery arrangement" : "Pickup arrangement"}
          </p>
          <div className="mt-2 flex gap-2 text-sm leading-relaxed text-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium">
                {order.recipientName ||
                  (order.fulfillmentMethod === "delivery" ? "Recipient" : "Pickup at PROCY")}
              </p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                {order.deliveryAddress || order.pickupNote}
              </p>
              {order.preferredSchedule ? (
                <p className="mt-1 text-muted-foreground">Preferred: {order.preferredSchedule}</p>
              ) : null}
              {order.deliveryInstructions ? (
                <p className="mt-1 text-muted-foreground">Note: {order.deliveryInstructions}</p>
              ) : null}
            </div>
          </div>
        </div>
        {order.fulfillmentMethod === "delivery" && order.assignedRiderName ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assigned Rider
            </p>
            {canMessageRider && order.assignedRiderId ? (
              <Link
                to="/buyer/community"
                search={{ contact: order.assignedRiderId }}
                className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-primary underline-offset-4 hover:underline"
              >
                <span>{order.assignedRiderName}</span>
                <span className="text-xs font-medium">Message Rider</span>
              </Link>
            ) : (
              <p className="mt-2 font-semibold">{order.assignedRiderName}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              This Rider is assigned to deliver your order.
            </p>
          </div>
        ) : null}
        <div
          className={`rounded-2xl border p-4 ${
            isPaid ? "border-primary/25 bg-primary/5" : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <WalletCards
              className={`mt-0.5 size-5 shrink-0 ${isPaid ? "text-primary" : "text-amber-700"}`}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Payment information
              </p>
              <p className="mt-1 font-semibold">
                {isPaid
                  ? "Paid"
                  : order.status === "Sold"
                    ? "Awaiting payment recording"
                    : "Payment not yet recorded"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.paymentId
                  ? `${order.paymentMethod ?? "Payment"} · ${order.paymentId}`
                  : "Payment is recorded by Accounting after sale completion."}
              </p>
            </div>
          </div>
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
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={item.image || marketplaceImageFor(item.name)}
                  alt=""
                  className="size-14 shrink-0 rounded-xl border border-border object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.classification} classification
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {item.pricePerKg > 0 && (
                  <>
                    <p className="font-semibold">{peso(item.quantityKg * item.pricePerKg)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatSellingQuantity(item.quantityKg, item.sellingUnit ?? "kg")} ×{" "}
                      {peso(item.pricePerKg)} / {sellingUnitLabel(item.sellingUnit ?? "kg")}
                    </p>
                  </>
                )}
                {item.pricePerKg <= 0 ? (
                  <p className="font-medium">
                    {formatSellingQuantity(item.quantityKg, item.sellingUnit ?? "kg")}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className={`flex items-start gap-3 rounded-2xl border p-4 ${statusSummary.tone}`}>
          {isInterrupted ? (
            <Clock3 className="mt-0.5 size-5 shrink-0" />
          ) : (
            <CircleCheck className="mt-0.5 size-5 shrink-0" />
          )}
          <div>
            <p className="font-semibold">{statusSummary.title}</p>
            <p className="mt-0.5 text-sm text-foreground/70">{statusSummary.detail}</p>
            {statusSummary.date ? (
              <p className="mt-1 text-xs font-medium opacity-80">
                Updated {formatOrderDate(statusSummary.date, true)}
              </p>
            ) : null}
          </div>
        </div>

        {!isInterrupted ? (
          <div>
            <p className="mb-3 text-sm font-semibold">Order progress</p>
            <OrderProgressTimeline order={order} />
          </div>
        ) : null}
      </div>

      {order.history?.length ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-3">
            <h3 className="text-sm font-semibold">Order activity</h3>
          </div>
          <div className="px-4 py-4">
            {order.history.map((entry, index) => (
              <div
                key={`${entry.status}-${entry.changedAt}`}
                className="relative flex gap-3 pb-5 last:pb-0"
              >
                {index < order.history!.length - 1 ? (
                  <span
                    className="absolute bottom-0 left-[11px] top-6 w-0.5 bg-border"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{entry.status}</p>
                  <p className="mt-0.5 text-muted-foreground">{entry.note ?? "Status updated."}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatOrderDate(entry.changedAt, true)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
