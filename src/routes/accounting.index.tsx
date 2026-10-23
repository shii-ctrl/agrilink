import { createFileRoute } from "@tanstack/react-router";
import { CircleDollarSign, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingLayout, AccountingPageHeader } from "@/components/workspaces/accounting-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getDatabaseOrders } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/accounting/")({ component: AccountingDashboard });

function AccountingDashboard() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof getDatabaseOrders>>>([]);
  useEffect(() => {
    void getDatabaseOrders()
      .then(setOrders)
      .catch(() => toast.error("Could not load accounting totals."));
  }, []);
  useAutoRefresh(() =>
    getDatabaseOrders()
      .then(setOrders)
      .catch(() => undefined),
  );
  const summary = useMemo(() => {
    const paid = orders.filter((order) => order.paymentStatus === "Paid");
    const collected = paid.reduce((sum, order) => sum + (order.amount ?? 0), 0);
    return [
      {
        label: "Recorded transactions",
        value: String(orders.length),
        note: "Saved buyer orders",
        icon: ReceiptText,
      },
      {
        label: "Payments recorded",
        value: String(paid.length),
        note: "Orders marked paid by Accounting",
        icon: CircleDollarSign,
      },
      {
        label: "Amount collected",
        value: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
          collected,
        ),
        note: "Total from paid saved orders",
        icon: WalletCards,
      },
    ];
  }, [orders]);
  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Accounting Dashboard"
        description="Monitor saved order and payment information after the Marketer completes the sales workflow."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          {summary.map((item) => (
            <Card key={item.label} className="shadow-card">
              <CardContent className="p-5">
                <item.icon className="size-5 text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 font-display text-3xl font-semibold">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
              </CardContent>
            </Card>
          ))}
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold">Accounting responsibility</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Record payment only after the sales process reaches the appropriate stage. Marketers
              cannot mark orders as Paid.
            </p>
          </article>
          <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold">No payment gateway</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              AgriLink records payment information but does not process online payments or connect
              to a payment gateway.
            </p>
          </article>
        </section>
      </main>
    </AccountingLayout>
  );
}
