import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, FileText, ReceiptText } from "lucide-react";

import { AccountingLayout, AccountingPageHeader } from "@/components/accounting-layout";

export const Route = createFileRoute("/accounting/reports")({ component: AccountingReportsPage });

function AccountingReportsPage() {
  const reports = [
    {
      title: "Sales Summary",
      value: "₱1,950",
      note: "Temporary recorded sales value",
      icon: BarChart3,
    },
    {
      title: "Payment Summary",
      value: "1 paid",
      note: "Payment records recorded by Accounting",
      icon: ReceiptText,
    },
    {
      title: "Transaction Summary",
      value: "1 record",
      note: "Completed temporary transaction",
      icon: FileText,
    },
  ];
  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Reports"
        description="Review temporary sales, transactions, and payment summaries for PROCY."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <span className="font-semibold">Preview only:</span> Exporting, tax computation, and
          financial statements are not included in the current workplan.
        </div>
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
            reporting view. These summary cards will become MySQL-driven reports in the database
            phase.
          </p>
        </section>
      </main>
    </AccountingLayout>
  );
}
