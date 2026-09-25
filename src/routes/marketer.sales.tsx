import { createFileRoute } from "@tanstack/react-router";
import { Boxes, CircleDollarSign } from "lucide-react";

import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { demoSalesRecords } from "@/lib/demo-data";

export const Route = createFileRoute("/marketer/sales")({
  head: () => ({ meta: [{ title: "Sales Monitoring — Marketer | AgriLink" }] }),
  component: MarketerSalesPage,
});

function MarketerSalesPage() {
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Sales Monitoring"
        description="Track PROCY sales performance, sold quantities, and order progress. Payment records remain under Accounting."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          <Summary
            label="Sold products"
            value="25 kg"
            note="Temporary completed sale quantity"
            icon={Boxes}
          />
          <Summary
            label="Sales recorded"
            value="1"
            note="Temporary sales record"
            icon={CircleDollarSign}
          />
          <Summary
            label="Payment status"
            value="Paid"
            note="Recorded by Accounting"
            icon={CircleDollarSign}
          />
        </section>
        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold">Sales records</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Temporary data for reviewing sales monitoring before MySQL is connected.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Product</th>
                  <th className="px-6 py-4 font-medium">Classification</th>
                  <th className="px-6 py-4 font-medium">Farmer Source</th>
                  <th className="px-6 py-4 font-medium">Buyer</th>
                  <th className="px-6 py-4 font-medium">Quantity</th>
                  <th className="px-6 py-4 font-medium">Price</th>
                  <th className="px-6 py-4 font-medium">Sales Status</th>
                  <th className="px-6 py-4 font-medium">Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {demoSalesRecords.map((record) => (
                  <tr
                    key={`${record.buyer}-${record.product}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-6 py-4 font-medium">{record.product}</td>
                    <td className="px-6 py-4">{record.classification}</td>
                    <td className="px-6 py-4">{record.farmer}</td>
                    <td className="px-6 py-4">{record.buyer}</td>
                    <td className="px-6 py-4">{record.quantity}</td>
                    <td className="px-6 py-4">{record.price}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                        {record.salesStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {record.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
