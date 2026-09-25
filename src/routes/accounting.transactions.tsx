import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";

import { AccountingLayout, AccountingPageHeader } from "@/components/accounting-layout";
import { demoTransactions } from "@/lib/demo-data";

export const Route = createFileRoute("/accounting/transactions")({
  component: AccountingTransactionsPage,
});

function AccountingTransactionsPage() {
  return (
    <AccountingLayout>
      <AccountingPageHeader
        title="Transactions"
        description="Review PROCY sales transactions and their current order and payment status."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="flex items-start gap-3 border-b border-border px-6 py-5">
            <ReceiptText className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Transaction records</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Temporary records connected to the completed PROCY sales workflow.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Transaction ID</th>
                  <th className="px-6 py-4 font-medium">Buyer</th>
                  <th className="px-6 py-4 font-medium">Product</th>
                  <th className="px-6 py-4 font-medium">Quantity</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Order Status</th>
                  <th className="px-6 py-4 font-medium">Payment Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {demoTransactions.map((record) => (
                  <tr key={record.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">{record.id}</td>
                    <td className="px-6 py-4">{record.buyer}</td>
                    <td className="px-6 py-4">
                      {record.product}{" "}
                      <span className="text-muted-foreground">({record.classification})</span>
                    </td>
                    <td className="px-6 py-4">{record.quantity}</td>
                    <td className="px-6 py-4">{record.amount}</td>
                    <td className="px-6 py-4">{record.orderStatus}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {record.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{record.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AccountingLayout>
  );
}
