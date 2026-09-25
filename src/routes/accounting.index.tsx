import { createFileRoute } from "@tanstack/react-router";
import { CircleDollarSign, ReceiptText, WalletCards } from "lucide-react";

import { AccountingLayout, AccountingPageHeader } from "@/components/accounting-layout";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/accounting/")({ component: AccountingDashboard });

function AccountingDashboard() {
  const summary = [
    {
      label: "Recorded transactions",
      value: "1",
      note: "Temporary transaction records",
      icon: ReceiptText,
    },
    {
      label: "Payments recorded",
      value: "1",
      note: "Payment status: Paid",
      icon: CircleDollarSign,
    },
    {
      label: "Amount collected",
      value: "₱1,950",
      note: "Temporary recorded payment",
      icon: WalletCards,
    },
  ];
  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Accounting Dashboard"
        description="Record payments for PROCY sales and monitor payment information after the Marketer completes the order workflow."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <span className="font-semibold">Temporary demo data:</span> Payment records shown here are
          browser-only until MySQL is connected.
        </div>
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
