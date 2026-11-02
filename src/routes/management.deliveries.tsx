import { createFileRoute } from "@tanstack/react-router";
import { Bike, MapPin, Phone, RefreshCw, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  assignDeliveryRider,
  getManagementDeliveryFee,
  getManagementDeliveryOperations,
  updateManagementDeliveryAvailability,
  updateManagementDeliveryFee,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/management/deliveries")({
  head: () => ({
    meta: [
      { title: "Delivery Operations — Management | AgriLink" },
      {
        name: "description",
        content: "Manage delivery availability, fees, Rider assignments, and dispatch progress.",
      },
    ],
  }),
  component: ManagementDeliveriesPage,
});

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
}

function ManagementDeliveriesPage() {
  const [deliveryFee, setDeliveryFee] = useState("59");
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [operations, setOperations] = useState<
    Awaited<ReturnType<typeof getManagementDeliveryOperations>> | undefined
  >();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingFee, setSavingFee] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [assigningOrder, setAssigningOrder] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "completed">("active");

  const load = useCallback(async () => {
    try {
      const [settings, deliveryOperations] = await Promise.all([
        getManagementDeliveryFee(),
        getManagementDeliveryOperations(),
      ]);
      setDeliveryFee(String(settings.deliveryFee));
      setDeliveryEnabled(settings.deliveryEnabled);
      setOperations(deliveryOperations);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const deliveries = useMemo(
    () =>
      (operations?.deliveries ?? []).filter((delivery) =>
        filter === "completed"
          ? delivery.fulfillmentStatus === "delivered"
          : delivery.fulfillmentStatus !== "delivered",
      ),
    [filter, operations],
  );
  const activeCount = (operations?.deliveries ?? []).filter(
    (delivery) => delivery.fulfillmentStatus !== "delivered",
  ).length;
  const completedCount = (operations?.deliveries ?? []).filter(
    (delivery) => delivery.fulfillmentStatus === "delivered",
  ).length;

  async function saveDeliveryFee() {
    const fee = Number(deliveryFee);
    if (!Number.isFinite(fee) || fee < 0) {
      toast.error("Enter a valid delivery fee.");
      return;
    }
    setSavingFee(true);
    try {
      const saved = await updateManagementDeliveryFee({ data: { deliveryFee: fee } });
      setDeliveryFee(String(saved.deliveryFee));
      toast.success("Delivery fee updated");
    } catch (cause) {
      toast.error("Could not update delivery fee", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setSavingFee(false);
    }
  }

  async function saveAvailability(enabled: boolean) {
    setSavingAvailability(true);
    try {
      const saved = await updateManagementDeliveryAvailability({
        data: { deliveryEnabled: enabled },
      });
      setDeliveryEnabled(saved.deliveryEnabled);
      toast.success(saved.deliveryEnabled ? "Delivery turned on" : "Delivery turned off");
    } catch (cause) {
      toast.error("Could not update delivery availability", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setSavingAvailability(false);
    }
  }

  async function assignRider(orderNumber: string, riderId: string) {
    setAssigningOrder(orderNumber);
    try {
      await assignDeliveryRider({ data: { orderNumber, riderId } });
      await load();
      toast.success("Rider assigned", { description: `${orderNumber} is now in the Rider queue.` });
    } catch (cause) {
      toast.error("Could not assign Rider", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setAssigningOrder(null);
    }
  }

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Delivery Operations"
        description="Control delivery checkout, set the fee, assign Riders, and monitor dispatch progress."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void load()}
          label="delivery operations"
        />
        {!loading && !error ? (
          <div className="space-y-6">
            <section className="rounded-3xl border border-border bg-card p-4 shadow-card sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Truck className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Delivery settings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Changes apply to new orders. Existing orders keep their original fee.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="space-y-2">
                  <Label htmlFor="delivery-fee">Flat delivery fee (₱)</Label>
                  <Input
                    id="delivery-fee"
                    value={deliveryFee}
                    inputMode="decimal"
                    onChange={(event) => setDeliveryFee(event.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full lg:w-48"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full lg:w-auto"
                  disabled={savingFee}
                  onClick={() => void saveDeliveryFee()}
                >
                  {savingFee ? "Saving…" : "Save delivery fee"}
                </Button>
              </div>
              <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Delivery checkout</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Turn this off when no Rider is available. Buyers will see pickup only.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {deliveryEnabled ? "Delivery on" : "Delivery off"}
                  </span>
                  <Switch
                    checked={deliveryEnabled}
                    disabled={savingAvailability}
                    onCheckedChange={(checked) => void saveAvailability(checked)}
                    aria-label="Enable delivery checkout"
                  />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold">
                    <Bike className="size-5 text-primary" /> Delivery dispatch
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Orders appear here after the Marketer marks them Ready for dispatch.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => void load()}
                >
                  <RefreshCw className="size-4" /> Refresh
                </Button>
              </div>
              <div className="flex gap-2 overflow-x-auto border-b border-border p-4 sm:px-6">
                <Button
                  size="sm"
                  variant={filter === "active" ? "default" : "outline"}
                  className="shrink-0 rounded-full"
                  onClick={() => setFilter("active")}
                >
                  Active {activeCount}
                </Button>
                <Button
                  size="sm"
                  variant={filter === "completed" ? "default" : "outline"}
                  className="shrink-0 rounded-full"
                  onClick={() => setFilter("completed")}
                >
                  Delivered {completedCount}
                </Button>
              </div>
              <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-6">
                {deliveries.map((delivery) => (
                  <article
                    key={delivery.orderNumber}
                    className="rounded-2xl border border-border p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {delivery.orderNumber}
                        </p>
                        <h3 className="mt-1 truncate font-semibold">
                          {delivery.recipientName || delivery.buyer}
                        </h3>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                        {statusLabel(delivery.fulfillmentStatus)}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 rounded-2xl bg-muted/40 p-3 text-sm">
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{delivery.deliveryAddress || "No structured address saved"}</span>
                      </p>
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="size-4 text-primary" /> {delivery.contact}
                      </p>
                      {delivery.preferredSchedule ? (
                        <p className="text-muted-foreground">
                          Preferred: {delivery.preferredSchedule}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      <AppSelect
                        value={delivery.assignedRiderId ?? ""}
                        onValueChange={(riderId) => void assignRider(delivery.orderNumber, riderId)}
                        options={(operations?.riders ?? []).map((rider) => ({
                          value: rider.id,
                          label: rider.name,
                        }))}
                        placeholder={
                          operations?.riders.length ? "Assign a Rider" : "No active Riders"
                        }
                        disabled={
                          assigningOrder !== null ||
                          !["ready_for_dispatch", "rider_assigned"].includes(
                            delivery.fulfillmentStatus,
                          )
                        }
                        className="w-full justify-between"
                      />
                      {delivery.assignedRiderName ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Assigned to {delivery.assignedRiderName}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
                {!deliveries.length ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground lg:col-span-2">
                    {filter === "active"
                      ? "No delivery orders are waiting for dispatch."
                      : "No delivered orders yet."}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </ManagementLayout>
  );
}
