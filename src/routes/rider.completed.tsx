import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarCheck,
  CheckCircle2,
  MapPin,
  PackageCheck,
  Phone,
  WalletCards,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RiderLayout, RiderPageHeader } from "@/components/workspaces/rider-layout";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import {
  getRiderCompletedDeliveries,
  updateCodRemittance,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/rider/completed")({ component: RiderCompletedDeliveries });

const emptyDeliveries: Awaited<ReturnType<typeof getRiderCompletedDeliveries>> = [];

const remittanceLabels: Record<string, string> = {
  collected: "Cash to submit",
  submitted: "Submitted to Accounting",
  verified: "Verified by Accounting",
  closed: "COD closed",
};

function formatDeliveredAt(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function RiderCompletedDeliveries() {
  const request = useCallback(() => getRiderCompletedDeliveries(), []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const deliveries = data ?? emptyDeliveries;
  const [query, setQuery] = useState("");
  const [remittanceStatus, setRemittanceStatus] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const filteredDeliveries = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return deliveries.filter(
      (delivery) =>
        (!search ||
          `${delivery.orderNumber} ${delivery.buyer} ${delivery.recipientName ?? ""} ${delivery.deliveryAddress ?? ""}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (!remittanceStatus || delivery.codRemittanceStatus === remittanceStatus),
    );
  }, [deliveries, query, remittanceStatus]);
  const page = usePagination(filteredDeliveries, { pageSize: 8 });
  const pendingCash = deliveries.filter(
    (delivery) => delivery.codRemittanceStatus === "collected",
  ).length;

  async function submitCash(orderNumber: string) {
    setUpdating(orderNumber);
    try {
      await updateCodRemittance({ data: { orderNumber, action: "submit" } });
      await reload();
      toast.success("COD submitted to Accounting", {
        description: `${orderNumber} is now waiting for Accounting verification.`,
      });
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
      <RiderPageHeader
        title="Completed Deliveries"
        description="Review every order you delivered and submit any collected COD cash to Accounting."
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="completed deliveries"
        />
        {!loading && !error ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <Card className="shadow-card">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <PackageCheck className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm text-muted-foreground">Completed deliveries</p>
                    <p className="font-display text-3xl font-semibold">{deliveries.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <WalletCards className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm text-muted-foreground">COD cash to submit</p>
                    <p className="font-display text-3xl font-semibold">{pendingCash}</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="border-b border-border p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold">Delivery history</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Completed orders move here automatically after Buyer OTP verification.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Input
                    aria-label="Search completed deliveries"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search order, Buyer, or address"
                  />
                  <AppSelect
                    ariaLabel="Filter completed deliveries by COD status"
                    value={remittanceStatus}
                    onValueChange={setRemittanceStatus}
                    options={[
                      { value: "", label: "All COD states" },
                      { value: "collected", label: "Cash to submit" },
                      { value: "submitted", label: "Submitted to Accounting" },
                      { value: "verified", label: "Verified by Accounting" },
                      { value: "closed", label: "COD closed" },
                    ]}
                  />
                </div>
              </div>

              {page.pageItems.length ? (
                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  {page.pageItems.map((delivery) => (
                    <article
                      key={delivery.orderNumber}
                      className="rounded-3xl border border-border bg-background p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {delivery.orderNumber}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold">
                            {delivery.recipientName || delivery.buyer}
                          </h3>
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          Delivered
                        </span>
                      </div>
                      <div className="mt-4 space-y-3 rounded-2xl bg-muted/50 p-4 text-sm">
                        <p className="flex items-start gap-2">
                          <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{formatDeliveredAt(delivery.deliveredAt)}</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{delivery.deliveryAddress || "Address unavailable"}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="size-4 text-primary" /> {delivery.contact}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Order total</p>
                          <p className="text-lg font-semibold">
                            ₱{delivery.totalAmount.toFixed(2)}
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                          {remittanceLabels[delivery.codRemittanceStatus ?? ""] ?? "COD pending"}
                        </span>
                      </div>
                      {delivery.codRemittanceStatus === "collected" ? (
                        <Button
                          className="mt-4 w-full rounded-full"
                          disabled={updating !== null}
                          onClick={() => void submitCash(delivery.orderNumber)}
                        >
                          <WalletCards className="size-4" />
                          {updating === delivery.orderNumber
                            ? "Submitting…"
                            : `Submit COD ₱${delivery.totalAmount.toFixed(2)}`}
                        </Button>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <PackageCheck className="mx-auto size-8 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">
                    {deliveries.length ? "No matching deliveries" : "No completed deliveries yet"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {deliveries.length
                      ? "Try another search or COD status."
                      : "Delivered orders will appear here automatically."}
                  </p>
                </div>
              )}
              <PaginationControls {...page} itemLabel="deliveries" />
            </section>
          </>
        ) : null}
      </main>
    </RiderLayout>
  );
}
