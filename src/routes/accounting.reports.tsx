import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, FileText, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingLayout, AccountingPageHeader } from "@/components/workspaces/accounting-layout";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getDatabaseOrders } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/accounting/reports")({ component: AccountingReportsPage });

function AccountingReportsPage() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof getDatabaseOrders>>>([]);
  useEffect(() => {
    void getDatabaseOrders()
      .then(setOrders)
      .catch(() => toast.error("Could not load saved reports."));
  }, []);
  useAutoRefresh(() =>
    getDatabaseOrders()
      .then(setOrders)
      .catch(() => undefined),
  );
  const reports = useMemo(() => {
    const paid = orders.filter((order) => order.paymentStatus === "Paid");
    const total = paid.reduce((sum, order) => sum + (order.amount ?? 0), 0);
    return [
      {
        title: "Collected sales",
        value: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(total),
        note: "Total from paid orders",
        icon: BarChart3,
      },
      {
        title: "Payment summary",
        value: `${paid.length} paid`,
        note: "Payments recorded by Accounting",
        icon: ReceiptText,
      },
      {
        title: "Transaction summary",
        value: `${orders.length} record${orders.length === 1 ? "" : "s"}`,
        note: "Marketplace orders saved in Layerbase",
        icon: FileText,
      },
    ];
  }, [orders]);
  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Reports"
        description="Review saved sales, transaction, and payment summaries for PROCY."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          {reports.map((report) => (
            <article
              key={report.title}
              className="rounded-3xl border border-border bg-card p-6 shadow-card"
            >
              <report.icon className="size-5 text-primary" />
              <h2 className="mt-5 text-lg font-semibold">{report.title}</h2>
              <p className="mt-2 font-display text-3xl font-semibold">{report.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{report.note}</p>
            </article>
          ))}
        </section>
        <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Reporting scope</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Accounting records payment information, while Management has the broader monitoring and
            reporting view. Exporting, tax computation, and financial statements are not included.
          </p>
        </section>
      </main>
    </AccountingLayout>
  );
}
