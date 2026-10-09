import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, PackageCheck, Search, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { OrderDetails } from "@/components/order-details";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DemoOrder } from "@/lib/demo-orders";
import {
  confirmDatabaseOrder,
  getDatabaseOrders,
  markDatabaseOrderSold,
  releaseDatabaseOrder,
} from "@/lib/marketplace-server-functions";

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
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    void getDatabaseOrders()
      .then(setOrders)
      .catch(() => toast.error("Could not load saved buyer orders."));
  }, []);

  async function confirmOrder(id: string) {
    if (
      !window.confirm(
        "Confirm this buyer order? Make sure the classified listing has enough stock.",
      )
    )
      return;
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    try {
      await confirmDatabaseOrder({ data: { orderNumber: id } });
      setOrders(await getDatabaseOrders());
      toast.success("Order confirmed", {
        description: "AgriLink recorded the confirmation and order timeline.",
      });
    } catch (error) {
      toast.error("Order could not be confirmed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  async function markSold(id: string) {
    if (!window.confirm("Mark this order as Sold? Accounting can then record its payment.")) return;
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    try {
      await markDatabaseOrderSold({ data: { orderNumber: id } });
      setOrders(await getDatabaseOrders());
      toast.success("Order marked Sold", {
        description: "Stock deductions and the sales timeline were saved to AgriLink.",
      });
    } catch (error) {
      toast.error("Order could not be marked Sold", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  async function rejectOrder(id: string) {
    if (!window.confirm("Reject this order? Its reserved stock will return to the marketplace.")) {
      return;
    }
    try {
      await releaseDatabaseOrder({
        data: { orderNumber: id, outcome: "rejected", reason: "Rejected by Marketer." },
      });
      setOrders(await getDatabaseOrders());
      toast.success("Order rejected", { description: "Reserved stock was released." });
    } catch (error) {
      toast.error("Order could not be rejected", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  const visibleOrders = orders.filter(
    (order) =>
      `${order.id} ${order.buyer} ${order.product} ${order.status}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!statusFilter || order.status === statusFilter),
  );

  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Buyer Orders"
        description="Review buyer requests for PROCY marketplace listings and confirm availability before the order moves forward."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 flex gap-3 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="font-semibold">Order workflow:</span> buyer order starts Pending;
            Marketer confirms it; it becomes Sold after fulfillment; Accounting records payment as
            Paid.
          </p>
        </div>
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">Buyer order queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">Live saved orders from AgriLink.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
              <ShoppingCart className="size-3.5" />{" "}
              {orders.filter((order) => order.status === "Pending").length} pending
            </span>
          </div>
          <div className="grid gap-3 border-b border-border px-6 py-4 md:grid-cols-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search order, buyer, product, or status"
                className="pl-9"
              />
            </label>
            <select
              aria-label="Filter orders by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All order states</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Sold">Sold</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Rejected">Rejected</option>
            </select>
            {(query || statusFilter) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Order ID</th>
                  <th className="px-6 py-4 font-medium">Buyer</th>
                  <th className="px-6 py-4 font-medium">Product</th>
                  <th className="px-6 py-4 font-medium">Quantity</th>
                  <th className="px-6 py-4 font-medium">Total</th>
                  <th className="px-6 py-4 font-medium">Order Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">{order.id}</td>
                    <td className="px-6 py-4">{order.buyer}</td>
                    <td className="px-6 py-4">
                      {order.product}{" "}
                      <span className="text-muted-foreground">({order.classification})</span>
                    </td>
                    <td className="px-6 py-4">{order.quantity}</td>
                    <td className="px-6 py-4">{order.total}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{order.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => setSelectedId(order.id)}
                        >
                          Details
                        </Button>
                        {order.status === "Pending" ? (
                          <>
                            <Button
                              size="sm"
                              className="rounded-full"
                              onClick={() => confirmOrder(order.id)}
                            >
                              Confirm order
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => rejectOrder(order.id)}
                            >
                              Reject
                            </Button>
                          </>
                        ) : order.status === "Confirmed" ? (
                          <Button
                            size="sm"
                            className="rounded-full"
                            onClick={() => markSold(order.id)}
                          >
                            Mark sold
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">Completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleOrders.length && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                      {orders.length
                        ? "No buyer orders match these filters."
                        : "No buyer orders have been saved yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        {selectedId &&
          (() => {
            const order = orders.find((item) => item.id === selectedId);
            return order ? (
              <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-card">
                <OrderDetails order={order} />
              </section>
            ) : null;
          })()}
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <PackageCheck className="size-5 text-primary" /> Marketer responsibility
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When an order is confirmed, AgriLink automatically checks and reserves the required
              quantity from its separate Good, Semi, or Reject listing.
            </p>
          </article>
          <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold">Accounting responsibility</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This workspace cannot mark an order Paid. Payment recording belongs to Accounting and
              no online payment gateway is included.
            </p>
          </article>
        </section>
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
