import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ManagementLayout, ManagementPageHeader } from "@/components/management-layout";
import { Input } from "@/components/ui/input";
import type { DemoOrder } from "@/lib/demo-orders";
import { getDatabaseOrders } from "@/lib/marketplace-server-functions";

export const Route = createFileRoute("/management/sales")({
  head: () => ({
    meta: [
      { title: "Sales — Management | AgriLink" },
      {
        name: "description",
        content: "Management sales-record monitoring interface for AgriLink.",
      },
    ],
  }),
  component: ManagementSalesPage,
});

function ManagementSalesPage() {
  const [sales, setSales] = useState<DemoOrder[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    void getDatabaseOrders()
      .then((orders) => setSales(orders.filter((order) => order.status === "Sold")))
      .catch(() => toast.error("Could not load saved sales records."));
  }, []);
  const visibleSales = sales.filter((sale) =>
    `${sale.id} ${sale.product} ${sale.farmer} ${sale.buyer} ${sale.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Sales"
        description="Monitor sales created from confirmed buyer orders and their current payment status."
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sales records"
              className="h-11 rounded-full pl-11"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Live sales data from AgriLink.</p>
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">Sales records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A Marketer marks a confirmed order as Sold after fulfillment. Accounting then records
              the payment status.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Product</th>
                  <th className="px-6 py-4 font-medium">Classification</th>
                  <th className="px-6 py-4 font-medium">Farmer</th>
                  <th className="px-6 py-4 font-medium">Buyer</th>
                  <th className="px-6 py-4 font-medium">Sold Quantity</th>
                  <th className="px-6 py-4 font-medium">Selling Price</th>
                  <th className="px-6 py-4 font-medium">Sales Status</th>
                  <th className="px-6 py-4 font-medium">Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">{sale.product}</td>
                    <td className="px-6 py-4">{sale.classification}</td>
                    <td className="px-6 py-4">{sale.farmer}</td>
                    <td className="px-6 py-4">{sale.buyer}</td>
                    <td className="px-6 py-4">{sale.quantity}</td>
                    <td className="px-6 py-4">{sale.total}</td>
                    <td className="px-6 py-4 text-primary">{sale.status}</td>
                    <td className="px-6 py-4 text-primary">{sale.paymentStatus}</td>
                  </tr>
                ))}
                {!visibleSales.length && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                      {sales.length
                        ? "No sales match your search."
                        : "No completed sales have been saved yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold">Sales lifecycle</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A confirmed buyer order creates a sale with Sales Status: Sold. The product quantity
              remains reserved when PROCY confirms the order and is reduced when the order is marked
              Sold.
            </p>
          </article>
          <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <ReceiptText className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Payment visibility</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Management monitors payment status. Accounting records payments and changes their
                  status from Unpaid to Paid.
                </p>
              </div>
            </div>
          </article>
        </section>
      </main>
    </ManagementLayout>
  );
}
