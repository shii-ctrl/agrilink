import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart, GitBranch } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import type { DemoOrder } from "@/lib/demo/demo-orders";
import { getDatabaseOrders } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/management/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Management | AgriLink" },
      {
        name: "description",
        content: "Management transaction-monitoring interface for AgriLink.",
      },
    ],
  }),
  component: ManagementTransactionsPage,
});

function ManagementTransactionsPage() {
  const [transactions, setTransactions] = useState<DemoOrder[]>([]);
  const [query, setQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      setTransactions(await getDatabaseOrders());
      setLoadError(null);
    } catch (error) {
      if (!background) setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(() => load(true));
  const visibleTransactions = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return transactions.filter(
      (transaction) =>
        (!search ||
          `${transaction.id} ${transaction.buyer} ${transaction.farmer} ${transaction.product}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (!orderStatus || transaction.status === orderStatus) &&
        (!paymentStatus || transaction.paymentStatus === paymentStatus) &&
        (!orderDate || transaction.createdAt?.slice(0, 10) === orderDate),
    );
  }, [orderDate, orderStatus, paymentStatus, query, transactions]);
  const hasFilters = query || orderStatus || paymentStatus || orderDate;
  const transactionsPage = usePagination(visibleTransactions);
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Transactions"
        description="Monitor buyer orders, PROCY sales, product classifications, and payment status."
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void load()}
          label="transaction records"
        />
        {!loading && !loadError && (
          <>
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-6 py-5">
                <h2 className="text-lg font-semibold">Transaction list</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Orders, sales, classifications, and payment records from AgriLink.
                </p>
              </div>
              <div className="grid gap-3 border-b border-border p-5 md:grid-cols-3">
                <Input
                  aria-label="Search transactions"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search order, buyer, farmer, or product"
                />
                <select
                  aria-label="Filter transactions by order status"
                  value={orderStatus}
                  onChange={(event) => setOrderStatus(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All order states</option>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Sold">Sold</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <select
                  aria-label="Filter transactions by payment status"
                  value={paymentStatus}
                  onChange={(event) => setPaymentStatus(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All payment states</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
                <Input
                  aria-label="Filter transactions by date"
                  type="date"
                  value={orderDate}
                  onChange={(event) => setOrderDate(event.target.value)}
                />
                {hasFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setOrderStatus("");
                      setPaymentStatus("");
                      setOrderDate("");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-medium">Transaction ID</th>
                      <th className="px-6 py-4 font-medium">Buyer</th>
                      <th className="px-6 py-4 font-medium">Product</th>
                      <th className="px-6 py-4 font-medium">Classification</th>
                      <th className="px-6 py-4 font-medium">Quantity</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Order Status</th>
                      <th className="px-6 py-4 font-medium">Payment Status</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsPage.pageItems.map((transaction) => (
                      <tr key={transaction.id} className="border-b border-border last:border-0">
                        <td className="px-6 py-4 font-medium">{transaction.id}</td>
                        <td className="px-6 py-4">{transaction.buyer}</td>
                        <td className="px-6 py-4">{transaction.product}</td>
                        <td className="px-6 py-4">{transaction.classification}</td>
                        <td className="px-6 py-4">{transaction.quantity}</td>
                        <td className="px-6 py-4">{transaction.total}</td>
                        <td className="px-6 py-4 text-primary">{transaction.status}</td>
                        <td className="px-6 py-4 text-primary">{transaction.paymentStatus}</td>
                        <td className="px-6 py-4 text-muted-foreground">{transaction.date}</td>
                      </tr>
                    ))}
                    {!visibleTransactions.length && (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">
                          {transactions.length
                            ? "No transactions match these filters."
                            : "No marketplace transactions have been saved yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...transactionsPage} itemLabel="transactions" />
            </section>

            <section className="mt-8 grid gap-4 md:grid-cols-2">
              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <GitBranch className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">Traceable relationship</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Each transaction will link the Buyer Order, PROCY Sale, Farmer Product,
                      Receiving Record, Classification, quantity, price, and payment status.
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <FileBarChart className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">Scope</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      This module records marketplace transactions only. Payroll, taxation,
                      budgeting, expenses, and financial forecasting are not included.
                    </p>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </ManagementLayout>
  );
}
