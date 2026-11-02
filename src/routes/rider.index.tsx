import { createFileRoute } from "@tanstack/react-router";
import { Bike, CircleDollarSign, MapPin, Phone, ShieldCheck, WalletCards } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Card, CardContent } from "@/components/ui/card";
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
  updateCodRemittance,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/rider/")({ component: RiderDashboard });

function RiderDashboard() {
  const request = useCallback(() => getRiderDeliveryStatus(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const [updating, setUpdating] = useState<string | null>(null);
  const [completingOrder, setCompletingOrder] = useState<string | null>(null);
  const [issueOrder, setIssueOrder] = useState<string | null>(null);
  async function updateDelivery(orderNumber: string, status: "out_for_delivery") {
    setUpdating(orderNumber);
    try {
      await updateOrderFulfillment({ data: { orderNumber, status } });
      await reload();
      toast.success("Delivery started");
    } catch (cause) {
      toast.error("Could not update delivery", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setUpdating(null);
    }
  }

  async function submitCash(orderNumber: string) {
    setUpdating(orderNumber);
    try {
      await updateCodRemittance({ data: { orderNumber, action: "submit" } });
      await reload();
      toast.success("COD submitted to Accounting");
    } catch (cause) {
      toast.error("Could not submit COD", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setUpdating(null);
    }
  }

  return (
    <RiderLayout>
      <DeliveryCompletionDialog
        orderNumber={completingOrder}
        onClose={() => setCompletingOrder(null)}
        onSaved={reload}
      />
      <DeliveryIssueDialog
        orderNumber={issueOrder}
        onClose={() => setIssueOrder(null)}
        onSaved={reload}
      />
      <RiderPageHeader
        title="Rider Workspace"
        description="Check delivery availability. Delivery assignments will appear here when Management sends them to you."
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="rider workspace"
        />
        {!loading && !error && data ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <Bike className="size-5 text-primary" />
                  <p className="mt-4 text-sm text-muted-foreground">Delivery checkout</p>
                  <p className="mt-1 font-display text-3xl font-semibold">
                    {data.deliveryEnabled ? "On" : "Off"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Management controls whether buyers may choose delivery.
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <CircleDollarSign className="size-5 text-primary" />
                  <p className="mt-4 text-sm text-muted-foreground">Delivery fee</p>
                  <p className="mt-1 font-display text-3xl font-semibold">
                    ₱{data.deliveryFee.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The current flat fee shown to buyers at checkout.
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <ShieldCheck className="size-5 text-primary" />
                  <p className="mt-4 text-sm text-muted-foreground">Account access</p>
                  <p className="mt-1 font-display text-3xl font-semibold">Active</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your Rider account was created and is managed by Management.
                  </p>
                </CardContent>
              </Card>
            </section>
            <section className="mt-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">My delivery assignments</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start a trip only when the order is in your possession. Mark Delivered after the
                  Buyer receives it.
                </p>
              </div>
              {data.assignments.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.assignments.map((order) => (
                    <article
                      key={order.orderNumber}
                      className="rounded-3xl border border-border bg-card p-5 shadow-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {order.orderNumber}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold">
                            {order.recipientName || order.buyer}
                          </h3>
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          {order.fulfillmentStatus.replaceAll("_", " ")}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3 rounded-2xl bg-muted/50 p-4 text-sm">
                        <p className="flex items-start gap-2">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{order.deliveryAddress || "Address unavailable"}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="size-4 text-primary" /> {order.contact}
                        </p>
                        {order.preferredSchedule ? (
                          <p className="text-muted-foreground">
                            Preferred: {order.preferredSchedule}
                          </p>
                        ) : null}
                        {order.deliveryInstructions ? (
                          <p className="text-muted-foreground">
                            Note: {order.deliveryInstructions}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {order.fulfillmentStatus === "rider_assigned" ? (
                          <Button
                            className="w-full sm:col-span-2"
                            disabled={updating !== null}
                            onClick={() =>
                              void updateDelivery(order.orderNumber, "out_for_delivery")
                            }
                          >
                            {updating === order.orderNumber ? "Updating…" : "Start delivery"}
                          </Button>
                        ) : order.fulfillmentStatus === "out_for_delivery" ? (
                          <>
                            <Button
                              variant="outline"
                              className="w-full"
                              disabled={updating !== null}
                              onClick={() => setIssueOrder(order.orderNumber)}
                            >
                              Report issue
                            </Button>
                            <Button
                              className="w-full"
                              disabled={updating !== null}
                              onClick={() => setCompletingOrder(order.orderNumber)}
                            >
                              Complete with proof
                            </Button>
                          </>
                        ) : order.fulfillmentStatus === "delivered" &&
                          order.codRemittanceStatus === "collected" ? (
                          <Button
                            className="w-full sm:col-span-2"
                            disabled={updating !== null}
                            onClick={() => void submitCash(order.orderNumber)}
                          >
                            <WalletCards className="size-4" />
                            {updating === order.orderNumber
                              ? "Submitting…"
                              : `Submit COD ₱${order.totalAmount.toFixed(2)}`}
                          </Button>
                        ) : ["delivery_failed", "rescheduled"].includes(order.fulfillmentStatus) ? (
                          <p className="sm:col-span-2 text-sm font-medium text-amber-700">
                            Waiting for Management to retry or reassign this delivery.
                          </p>
                        ) : (
                          <p className="sm:col-span-2 text-sm font-medium text-primary">
                            Delivered · COD{" "}
                            {order.codRemittanceStatus?.replaceAll("_", " ") ?? "pending"}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
                  <h3 className="font-semibold">No delivery assignments yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Management-assigned orders will appear here automatically.
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
