import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bike,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  MapPin,
  MessageCircle,
  PackageCheck,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "@/lib/ui/toast";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Button } from "@/components/ui/button";
import { RiderLayout, RiderPageHeader } from "@/components/workspaces/rider-layout";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  DeliveryCompletionDialog,
  DeliveryIssueDialog,
} from "@/features/marketplace/components/delivery-proof-dialog";
import {
  getRiderDeliveryStatus,
  updateOrderFulfillment,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/rider/")({ component: RiderDashboard });
type DeliveryFilter = "all" | "rider_assigned" | "out_for_delivery";
const statusLabels: Record<string, string> = {
  rider_assigned: "Assigned",
  out_for_delivery: "Out for delivery",
  delivery_failed: "Delivery failed",
  rescheduled: "Rescheduled",
};
const money = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

function RiderDashboard() {
  const request = useCallback(() => getRiderDeliveryStatus(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const [filter, setFilter] = useState<DeliveryFilter>("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const actionPending = useRef(false);
  const [completingOrder, setCompletingOrder] = useState<string | null>(null);
  const [issueOrder, setIssueOrder] = useState<string | null>(null);
  const assignedCount =
    data?.assignments.filter((order) => order.fulfillmentStatus === "rider_assigned").length ?? 0;
  const onTripCount =
    data?.assignments.filter((order) => order.fulfillmentStatus === "out_for_delivery").length ?? 0;
  const visibleOrders =
    data?.assignments.filter((order) => filter === "all" || order.fulfillmentStatus === filter) ??
    [];

  async function updateDelivery(orderNumber: string) {
    if (actionPending.current) return;
    actionPending.current = true;
    setUpdating(orderNumber);
    try {
      await updateOrderFulfillment({ data: { orderNumber, status: "out_for_delivery" } });
      await reload({ background: true });
      toast.success("Delivery started");
    } catch (cause) {
      toast.error("Could not update delivery", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      actionPending.current = false;
      setUpdating(null);
    }
  }

  return (
    <RiderLayout>
      <DeliveryCompletionDialog
        orderNumber={completingOrder}
        expectedRecipientName={
          data?.assignments.find((order) => order.orderNumber === completingOrder)?.recipientName ??
          data?.assignments.find((order) => order.orderNumber === completingOrder)?.buyer ??
          null
        }
        onClose={() => setCompletingOrder(null)}
        onSaved={reload}
      />
      <DeliveryIssueDialog
        orderNumber={issueOrder}
        onClose={() => setIssueOrder(null)}
        onSaved={reload}
      />
      <RiderPageHeader
        title="My Deliveries"
        description="Your assignments and delivery progress today."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="deliveries"
        />
        {!loading && !error && data ? (
          <>
            <section aria-label="Delivery summary" className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { label: "Assigned", value: assignedCount, icon: PackageCheck },
                { label: "Out for delivery", value: onTripCount, icon: Bike },
                { label: "Completed today", value: data.completedToday, icon: CheckCircle2 },
              ].map((summary) => (
                <div
                  key={summary.label}
                  className="min-w-0 rounded-2xl border border-border bg-card p-3 shadow-card sm:p-5"
                >
                  <summary.icon className="mb-2 size-5 text-primary" />
                  <p className="font-display text-2xl font-semibold sm:text-3xl">{summary.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{summary.label}</p>
                </div>
              ))}
            </section>
            <section className="mt-6" aria-labelledby="active-deliveries-heading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 id="active-deliveries-heading" className="text-lg font-semibold">
                  Active deliveries
                </h2>
                <Button asChild variant="outline" size="sm">
                  <Link to="/rider/completed">View completed</Link>
                </Button>
              </div>
              <div aria-label="Filter deliveries" className="mb-4 flex flex-wrap gap-2">
                {(
                  [
                    { value: "all", label: "All", count: data.assignments.length },
                    { value: "rider_assigned", label: "Assigned", count: assignedCount },
                    { value: "out_for_delivery", label: "Out for delivery", count: onTripCount },
                  ] as const
                ).map((item) => (
                  <Button
                    key={item.value}
                    variant={filter === item.value ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    aria-pressed={filter === item.value}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                    <span className="rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums">
                      {item.count}
                    </span>
                  </Button>
                ))}
              </div>
              {visibleOrders.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {visibleOrders.map((order) => {
                    const onTrip = order.fulfillmentStatus === "out_for_delivery";
                    const needsAttention = ["delivery_failed", "rescheduled"].includes(
                      order.fulfillmentStatus,
                    );
                    return (
                      <article
                        key={order.orderNumber}
                        className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="break-all text-xs font-semibold tracking-wide text-primary">
                            {order.orderNumber}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${needsAttention ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : "bg-primary/10 text-primary"}`}
                          >
                            {statusLabels[order.fulfillmentStatus] ?? order.fulfillmentStatus}
                          </span>
                        </div>
                        <h3 className="mt-3 break-words text-lg font-semibold">{order.buyer}</h3>
                        <p className="mt-1 break-words text-sm text-muted-foreground">
                          Recipient: {order.recipientName || order.buyer}
                        </p>
                        <div className="my-4 space-y-3 rounded-xl bg-muted/50 p-3 text-sm">
                          <p className="flex items-start gap-2">
                            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span className="min-w-0 break-words">
                              {order.deliveryAddress || "Address unavailable"}
                            </span>
                          </p>
                          {order.preferredSchedule && (
                            <p className="flex items-start gap-2">
                              <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
                              <span className="min-w-0 break-words">{order.preferredSchedule}</span>
                            </p>
                          )}
                          {order.deliveryInstructions && (
                            <p className="break-words text-muted-foreground">
                              Note: {order.deliveryInstructions}
                            </p>
                          )}
                        </div>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">
                            {order.paymentId ? "Payment recorded" : "COD to collect"}
                          </span>
                          <span className="text-lg font-semibold">
                            {order.paymentId ? "Paid" : money(order.totalAmount)}
                          </span>
                        </div>
                        <div className="mt-auto grid gap-2">
                          <Button asChild variant="outline" className="w-full">
                            <Link to="/rider/community" search={{ contact: order.buyerId }}>
                              <MessageCircle className="size-4" />
                              Message
                            </Link>
                          </Button>
                          {order.fulfillmentStatus === "rider_assigned" ? (
                            <Button
                              className="w-full"
                              disabled={updating !== null}
                              onClick={() => void updateDelivery(order.orderNumber)}
                            >
                              {updating === order.orderNumber ? (
                                <LoaderCircle className="size-4 animate-spin" />
                              ) : (
                                <Bike className="size-4" />
                              )}
                              {updating === order.orderNumber
                                ? "Starting delivery…"
                                : "Start delivery"}
                            </Button>
                          ) : onTrip ? (
                            <>
                              <Button
                                className="w-full"
                                disabled={updating !== null}
                                onClick={() => setCompletingOrder(order.orderNumber)}
                              >
                                <CheckCircle2 className="size-4" />
                                Complete delivery
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full"
                                disabled={updating !== null}
                                onClick={() => setIssueOrder(order.orderNumber)}
                              >
                                <CircleAlert className="size-4" />
                                Report issue
                              </Button>
                            </>
                          ) : needsAttention ? (
                            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                              Awaiting a delivery update.
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center">
                  <Bike className="mx-auto mb-3 size-7 text-primary" />
                  <h3 className="font-semibold">
                    {data.assignments.length
                      ? "No deliveries in this status"
                      : "No active deliveries"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.assignments.length
                      ? "Choose another filter to see your assignments."
                      : "New assignments will appear here automatically."}
                  </p>
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </RiderLayout>
  );
}
