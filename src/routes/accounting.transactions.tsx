import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingLayout, AccountingPageHeader } from "@/components/workspaces/accounting-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { getDatabaseOrders } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/accounting/transactions")({
  component: AccountingTransactionsPage,
});

function AccountingTransactionsPage() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof getDatabaseOrders>>>([]);
  const [query, setQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [orderDate, setOrderDate] = useState("");

  useEffect(() => {
    void getDatabaseOrders()
      .then(setOrders)
      .catch(() => toast.error("Could not load saved transactions."));
  }, []);
  const visibleOrders = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return orders.filter(
      (order) =>
        (!search ||
          `${order.id} ${order.buyer} ${order.farmer} ${order.product}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (!orderStatus || order.status === orderStatus) &&
        (!paymentStatus || order.paymentStatus === paymentStatus) &&
        (!orderDate || order.createdAt?.slice(0, 10) === orderDate),
    );
  }, [orderDate, orderStatus, orders, paymentStatus, query]);
  const hasFilters = query || orderStatus || paymentStatus || orderDate;
  const ordersPage = usePagination(visibleOrders);

  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Transactions"
        description="Review saved PROCY orders and payments from the marketplace workflow."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="flex items-start gap-3 border-b border-border px-6 py-5">
            <ReceiptText className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Saved transaction records</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each row comes from a buyer order stored in Layerbase.
              </p>
            </div>
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
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Order</th>
                  <th className="px-6 py-4 font-medium">Buyer</th>
                  <th className="px-6 py-4 font-medium">Farmer owner</th>
                  <th className="px-6 py-4 font-medium">Product</th>
                  <th className="px-6 py-4 font-medium">Quantity</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Order status</th>
                  <th className="px-6 py-4 font-medium">Payment</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {ordersPage.pageItems.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">{order.id}</td>
                    <td className="px-6 py-4">{order.buyer}</td>
                    <td className="px-6 py-4">{order.farmer}</td>
                    <td className="px-6 py-4">
                      {order.product}{" "}
                      <span className="text-muted-foreground">({order.classification})</span>
                    </td>
                    <td className="px-6 py-4">{order.quantity}</td>
                    <td className="px-6 py-4">{order.total}</td>
                    <td className="px-6 py-4">{order.status}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{order.date}</td>
                  </tr>
                ))}
                {!visibleOrders.length && (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">
                      {orders.length
                        ? "No transactions match these filters."
                        : "No marketplace orders have been saved yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls {...ordersPage} itemLabel="transactions" />
        </section>
      </main>
    </AccountingLayout>
  );
}
