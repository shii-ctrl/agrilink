import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArrowLeft, PackageCheck, RefreshCw, Search, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { OrderDetails } from "@/features/marketplace/components/order-details";
import { WalkInOrderDialog } from "@/features/marketplace/components/walk-in-order-dialog";
import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { ResponsiveFilterPanel } from "@/components/data/responsive-filter-panel";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { formatSellingQuantity } from "@/features/marketplace/selling-units";
import type { OrderRecord } from "@/features/marketplace/order-records";
import {
  confirmDatabaseOrder,
  getDatabaseOrders,
  markDatabaseOrderSold,
  releaseDatabaseOrder,
  updateOrderFulfillment,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketer/orders")({
  head: () => ({
    meta: [
      { title: "Buyer Orders — Marketer | AgriLink" },
      {
        name: "description",
        content: "Review and confirm buyer orders for PROCY marketplace listings.",
      },
    ],
  }),
  component: MarketerOrdersPage,
});

function MarketerOrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmationPending = useRef(false);
  const [orderDate, setOrderDate] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const load = useCallback(async () => {
    setOrders(await getDatabaseOrders());
    setLoadError(null);
  }, []);
  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => void loadWorkspace(), [loadWorkspace]);
  useAutoRefresh(() => load().catch(() => undefined));

  async function confirmOrder(id: string) {
    if (confirmationPending.current) return;
    const order = orders.find((item) => item.id === id);
    if (!order || !hasEnoughStock(order)) return;
    confirmationPending.current = true;
    try {
      const accepted = await requestConfirmation({
        title: "Confirm buyer order?",
        description: `Confirm ${order.id} for ${order.buyer}. These quantities will be deducted from marketplace availability.`,
        confirmLabel: "Confirm order",
        details: (
          <ul className="space-y-2 text-sm">
            {order.items?.map((item) => (
              <li key={item.listingId}>
                {item.name} · {item.classification} ·{" "}
                {formatSellingQuantity(item.quantityKg, item.sellingUnit ?? "kg")}
              </li>
            ))}
          </ul>
        ),
      });
      if (!accepted) return;
      setConfirmingId(id);
      await confirmDatabaseOrder({ data: { orderNumber: id } });
      await load();
      toast.success("Order confirmed", {
        description: "Stock has been allocated and marketplace availability updated.",
      });
    } catch (error) {
      await load().catch(() => undefined);
      toast.error("Order could not be confirmed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      confirmationPending.current = false;
      setConfirmingId(null);
    }
  }

  async function markSold(id: string) {
    if (
      !(await requestConfirmation({
        title: "Mark order as sold?",
        description: "Accounting can record its payment after the sale is saved.",
        confirmLabel: "Mark as sold",
      }))
    )
      return;
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    try {
      await markDatabaseOrderSold({ data: { orderNumber: id } });
      await load();
      toast.success("Order marked Sold", {
        description: "Stock deductions and the sales timeline were saved to AgriLink.",
      });
    } catch (error) {
      toast.error("Order could not be marked Sold", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  async function advanceFulfillment(
    id: string,
    status: "preparing" | "ready_for_pickup" | "ready_for_dispatch" | "picked_up",
  ) {
    try {
      await updateOrderFulfillment({ data: { orderNumber: id, status } });
      await load();
      toast.success("Fulfillment updated", {
        description: status.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase()),
      });
    } catch (error) {
      toast.error("Could not update fulfillment", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  async function rejectOrder(id: string) {
    if (
      !(await requestConfirmation({
        title: "Reject this order?",
        description: "The Buyer will be notified that this Pending order was rejected.",
        confirmLabel: "Reject order",
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await releaseDatabaseOrder({
        data: { orderNumber: id, outcome: "rejected", reason: "Rejected by Marketer." },
      });
      await load();
      toast.success("Order rejected");
    } catch (error) {
      toast.error("Order could not be rejected", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  async function cancelConfirmedOrder(id: string) {
    if (
      !(await requestConfirmation({
        title: "Cancel confirmed order?",
        description: "Its reserved stock will return to the marketplace.",
        confirmLabel: "Cancel order",
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await releaseDatabaseOrder({
        data: { orderNumber: id, outcome: "cancelled", reason: "Cancelled by Marketer." },
      });
      await load();
      toast.success("Confirmed order cancelled", { description: "Reserved stock was released." });
    } catch (error) {
      toast.error("Order could not be cancelled", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  const oldestPendingId = [...orders]
    .filter((order) => order.status === "Pending")
    .sort(compareOrderAge)[0]?.id;
  const archivedCount = orders.filter(isArchivedOrder).length;
  const scopedOrders = orders.filter((order) => isArchivedOrder(order) === archiveOpen);
  const selectedOrder = scopedOrders.find((order) => order.id === selectedId);
  const orderStatusFilters = archiveOpen
    ? (["Sold", "Cancelled", "Rejected"] as const)
    : (["Pending", "Confirmed", "Sold"] as const);
  const visibleOrders = scopedOrders.filter(
    (order) =>
      `${order.id} ${order.buyer} ${order.product} ${order.status} ${order.source === "walk_in" ? "walk-in" : "online"} ${order.items?.map((item) => `${item.name} ${item.classification}`).join(" ") ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!statusFilter || order.status === statusFilter) &&
      (!orderDate || order.createdAt?.slice(0, 10) === orderDate),
  );
  visibleOrders.sort(compareOrderAge);
  const ordersPage = usePagination(visibleOrders);
  const { setPage } = ordersPage;
  useEffect(() => setPage(1), [archiveOpen, query, statusFilter, orderDate, setPage]);

  function showArchive(nextArchiveOpen: boolean) {
    setArchiveOpen(nextArchiveOpen);
    setStatusFilter(nextArchiveOpen ? "" : "Pending");
    setQuery("");
    setOrderDate("");
    setSelectedId(null);
  }

  return (
    <MarketerLayout>
      {confirmationDialog}
      {walkInOpen && (
        <WalkInOrderDialog
          onClose={() => setWalkInOpen(false)}
          onCreated={() => {
            setWalkInOpen(false);
            showArchive(false);
            setStatusFilter("Confirmed");
            void load().catch(() => void loadWorkspace());
          }}
        />
      )}
      <MarketerPageHeader
        title="Buyer Orders"
        description="Review buyer requests for PROCY marketplace listings and confirm availability before the order moves forward."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="buyer order queue"
        />
        {!loading && !loadError ? (
          <>
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold">
                    {archiveOpen ? "Archived orders" : "Buyer order queue"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {archiveOpen
                      ? "Completed and paid orders, plus cancelled and rejected orders."
                      : "Oldest orders first. Confirm each order after reviewing its available stock."}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                  {archiveOpen ? (
                    <Archive className="size-3.5" />
                  ) : (
                    <ShoppingCart className="size-3.5" />
                  )}
                  {archiveOpen
                    ? `${archivedCount} archived`
                    : `${orders.filter((order) => order.status === "Pending").length} pending`}
                </span>
                <Button type="button" size="sm" onClick={() => setWalkInOpen(true)}>
                  New walk-in order
                </Button>
                <Button
                  type="button"
                  variant={archiveOpen ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  aria-pressed={archiveOpen}
                  onClick={() => showArchive(!archiveOpen)}
                >
                  {archiveOpen ? (
                    <ArrowLeft className="size-3.5" />
                  ) : (
                    <Archive className="size-3.5" />
                  )}
                  {archiveOpen ? "Back to orders" : `Archive (${archivedCount})`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => void load()}
                >
                  <RefreshCw className="size-3.5" /> Refresh
                </Button>
              </div>
              <ResponsiveFilterPanel
                activeCount={
                  Number(Boolean(query)) +
                  Number(Boolean(statusFilter)) +
                  Number(Boolean(orderDate))
                }
                contentClassName="md:grid-cols-[minmax(0,1fr)_minmax(11rem,0.6fr)]"
              >
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search order, buyer, product, or status"
                    className="pl-9"
                  />
                </label>
                <DatePicker
                  ariaLabel="Filter orders by date"
                  value={orderDate}
                  onValueChange={setOrderDate}
                />
                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Filter by order status
                  </p>
                  <div className="flex flex-wrap gap-2" aria-label="Filter orders by status">
                    <Button
                      type="button"
                      size="sm"
                      variant={statusFilter === "" ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setStatusFilter("")}
                    >
                      All <span className="ml-1 opacity-75">{scopedOrders.length}</span>
                    </Button>
                    {orderStatusFilters.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={statusFilter === status ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status}{" "}
                        <span className="ml-1 opacity-75">
                          {scopedOrders.filter((order) => order.status === status).length}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
                {(query || statusFilter || orderDate) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="md:col-span-2 md:justify-self-start"
                    onClick={() => {
                      setQuery("");
                      setStatusFilter("");
                      setOrderDate("");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </ResponsiveFilterPanel>
              <div className="grid gap-4 p-4 xl:grid-cols-2">
                {ordersPage.pageItems.map((order) => (
                  <article key={order.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {order.id}
                        </p>
                        <h3 className="mt-1 truncate font-semibold">{order.buyer}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {order.product} · {order.quantity}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <StatusBadge status={order.status} />
                        {order.source === "walk_in" && (
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                            Walk-in
                          </span>
                        )}
                        {order.status === "Sold" && (
                          <span className="text-xs text-muted-foreground">
                            {order.paymentStatus === "Paid" ? "Paid" : "Awaiting payment"}
                          </span>
                        )}
                        {order.id === oldestPendingId && (
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            Oldest pending
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Ordered{" "}
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString("en-PH", {
                            timeZone: "Asia/Manila",
                          })
                        : order.date}
                    </p>
                    {order.status === "Pending" && (
                      <div className="mt-3 space-y-2 rounded-xl bg-muted/40 p-3 text-sm">
                        {order.items?.map((item) => (
                          <div
                            key={item.listingId}
                            className="flex flex-wrap justify-between gap-2"
                          >
                            <span>
                              {item.name} · {item.classification}
                            </span>
                            <span
                              className={
                                (item.availableKg ?? 0) < item.quantityKg
                                  ? "font-medium text-destructive"
                                  : ""
                              }
                            >
                              Requested{" "}
                              {formatSellingQuantity(item.quantityKg, item.sellingUnit ?? "kg")} ·
                              Available{" "}
                              {formatSellingQuantity(
                                item.availableKg ?? 0,
                                item.sellingUnit ?? "kg",
                              )}
                            </span>
                          </div>
                        ))}
                        <p
                          className={
                            hasEnoughStock(order)
                              ? "font-medium text-primary"
                              : "font-medium text-destructive"
                          }
                        >
                          {hasEnoughStock(order)
                            ? "Enough stock"
                            : "Insufficient stock — review the available quantities above."}
                        </p>
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <span className="capitalize text-muted-foreground">
                        {(order.fulfillmentStatus ?? "pending").replaceAll("_", " ")}
                      </span>
                      <span className="font-semibold">{order.total}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(order.id)}>
                        View details
                      </Button>
                      {order.status === "Pending" ? (
                        <>
                          <Button
                            size="sm"
                            disabled={confirmingId !== null || !hasEnoughStock(order)}
                            onClick={() => void confirmOrder(order.id)}
                          >
                            {confirmingId === order.id ? "Confirming…" : "Confirm order"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={confirmingId !== null}
                            onClick={() => void rejectOrder(order.id)}
                          >
                            Reject
                          </Button>
                        </>
                      ) : order.status === "Confirmed" &&
                        order.fulfillmentStatus === "confirmed" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => void advanceFulfillment(order.id, "preparing")}
                          >
                            Start preparing
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void cancelConfirmedOrder(order.id)}
                          >
                            Cancel order
                          </Button>
                        </>
                      ) : order.status === "Confirmed" &&
                        order.fulfillmentStatus === "preparing" ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            void advanceFulfillment(
                              order.id,
                              order.fulfillmentMethod === "delivery"
                                ? "ready_for_dispatch"
                                : "ready_for_pickup",
                            )
                          }
                        >
                          {order.fulfillmentMethod === "delivery"
                            ? "Ready for dispatch"
                            : "Ready for pickup"}
                        </Button>
                      ) : order.status === "Confirmed" &&
                        order.fulfillmentStatus === "ready_for_pickup" ? (
                        <Button
                          size="sm"
                          onClick={() => void advanceFulfillment(order.id, "picked_up")}
                        >
                          Confirm pickup
                        </Button>
                      ) : order.status === "Confirmed" &&
                        ["picked_up", "delivered"].includes(order.fulfillmentStatus ?? "") ? (
                        <Button size="sm" onClick={() => void markSold(order.id)}>
                          Finalize sold
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              {!visibleOrders.length && (
                <p className="px-6 py-10 text-center text-muted-foreground">
                  {scopedOrders.length
                    ? "No buyer orders match these filters."
                    : archiveOpen
                      ? "No archived orders yet."
                      : "No active buyer orders. Completed orders are available in Archive."}
                </p>
              )}
              <PaginationControls {...ordersPage} itemLabel="orders" />
            </section>
            <Dialog
              open={Boolean(selectedOrder)}
              onOpenChange={(open) => {
                if (!open) setSelectedId(null);
              }}
            >
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Order details</DialogTitle>
                  <DialogDescription>{selectedOrder?.id}</DialogDescription>
                </DialogHeader>
                {selectedOrder && <OrderDetails order={selectedOrder} />}
              </DialogContent>
            </Dialog>
            <section className="mt-8 grid gap-4 md:grid-cols-2">
              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <PackageCheck className="size-5 text-primary" /> Marketer responsibility
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  When an order is confirmed, AgriLink automatically checks and reserves the
                  required quantity from its separate Good, Semi, or Reject listing.
                </p>
              </article>
              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <h2 className="text-lg font-semibold">Accounting responsibility</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  This workspace cannot mark an order Paid. Payment recording belongs to Accounting
                  and no online payment gateway is included.
                </p>
              </article>
            </section>
          </>
        ) : null}
      </main>
    </MarketerLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Pending"
      ? "bg-semi/20 text-foreground"
      : status === "Confirmed"
        ? "bg-primary/10 text-primary"
        : "bg-accent text-accent-foreground";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{status}</span>
  );
}

function hasEnoughStock(order: OrderRecord) {
  const items = order.items ?? [];
  return items.length > 0 && items.every((item) => (item.availableKg ?? 0) >= item.quantityKg);
}

function isArchivedOrder(order: OrderRecord) {
  return (
    order.status === "Cancelled" ||
    order.status === "Rejected" ||
    (order.status === "Sold" && order.paymentStatus === "Paid")
  );
}

function compareOrderAge(first: OrderRecord, second: OrderRecord) {
  return (
    (first.createdAt ?? "").localeCompare(second.createdAt ?? "") ||
    first.id.localeCompare(second.id)
  );
}
