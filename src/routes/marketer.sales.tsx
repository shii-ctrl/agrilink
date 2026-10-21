import { createFileRoute } from "@tanstack/react-router";
import { Boxes, CircleDollarSign, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getDatabaseOrders } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketer/sales")({
  head: () => ({ meta: [{ title: "Sales Monitoring — Marketer | AgriLink" }] }),
  component: MarketerSalesPage,
});

function MarketerSalesPage() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof getDatabaseOrders>>>([]);
  const [query, setQuery] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const sold = useMemo(() => orders.filter((order) => order.status === "Sold"), [orders]);
  const soldKg = sold.reduce(
    (sum, order) =>
      sum + (order.items?.reduce((itemSum, item) => itemSum + item.quantityKg, 0) ?? 0),
    0,
  );
  const paid = sold.filter((order) => order.paymentStatus === "Paid").length;
  const visibleOrders = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return sold.filter(
      (order) =>
        (!search ||
          `${order.id} ${order.product} ${order.farmer} ${order.buyer} ${order.classification}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (!paymentStatus || order.paymentStatus === paymentStatus) &&
        (!saleDate || order.createdAt?.slice(0, 10) === saleDate),
    );
  }, [paymentStatus, query, saleDate, sold]);
  const salesPage = usePagination(visibleOrders);
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Sales Monitoring"
        description="Track real PROCY sales, product ownership, and payment progress. Payment records remain under Accounting."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="sales monitoring workspace"
        />
        {!loading && !loadError ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Summary
                label="Sold products"
                value={`${soldKg} kg`}
                note="Quantity from completed orders"
                icon={Boxes}
              />
              <Summary
                label="Sales recorded"
                value={String(sold.length)}
                note="Completed saved orders"
                icon={CircleDollarSign}
              />
              <Summary
                label="Payments recorded"
                value={String(paid)}
                note="Completed sales marked paid by Accounting"
                icon={CircleDollarSign}
              />
            </section>
            <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Saved sales records</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The farmer source comes from the inventory used by each marketplace listing.
                    </p>
                  </div>
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
              </div>
              <div className="grid gap-3 border-b border-border p-5 md:grid-cols-3">
                <Input
                  aria-label="Search sales records"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search product, farmer, buyer, or order"
                />
                <select
                  aria-label="Filter sales by payment status"
                  value={paymentStatus}
                  onChange={(event) => setPaymentStatus(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All payment states</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
                <Input
                  aria-label="Filter sales by date"
                  type="date"
                  value={saleDate}
                  onChange={(event) => setSaleDate(event.target.value)}
                />
                {(query || paymentStatus || saleDate) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setPaymentStatus("");
                      setSaleDate("");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-medium">Product</th>
                      <th className="px-6 py-4 font-medium">Classification</th>
                      <th className="px-6 py-4 font-medium">Farmer source</th>
                      <th className="px-6 py-4 font-medium">Buyer</th>
                      <th className="px-6 py-4 font-medium">Quantity</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Payment</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesPage.pageItems.map((order) => (
                      <tr key={order.id} className="border-b border-border last:border-0">
                        <td className="px-6 py-4 font-medium">{order.product}</td>
                        <td className="px-6 py-4">{order.classification}</td>
                        <td className="px-6 py-4">{order.farmer}</td>
                        <td className="px-6 py-4">{order.buyer}</td>
                        <td className="px-6 py-4">{order.quantity}</td>
                        <td className="px-6 py-4">{order.total}</td>
                        <td className="px-6 py-4">{order.status}</td>
                        <td className="px-6 py-4">{order.paymentStatus}</td>
                        <td className="px-6 py-4 text-muted-foreground">{order.date}</td>
                      </tr>
                    ))}
                    {!visibleOrders.length && (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">
                          {sold.length
                            ? "No sales match these filters."
                            : "No completed sales have been saved yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...salesPage} itemLabel="sales records" />
            </section>
          </>
        ) : null}
      </main>
    </MarketerLayout>
  );
}

function Summary({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Boxes;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-card">
      <Icon className="size-5 text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </article>
  );
}
