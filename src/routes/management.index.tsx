import { createFileRoute } from "@tanstack/react-router";
import { Database, PackageOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { getManagementReport } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/management/")({
  head: () => ({
    meta: [
      { title: "Management Dashboard — AgriLink" },
      {
        name: "description",
        content: "Management overview for AgriLink operational records.",
      },
    ],
  }),
  component: ManagementDashboard,
});

type ManagementReport = Awaited<ReturnType<typeof getManagementReport>>;

function ManagementDashboard() {
  const [report, setReport] = useState<ManagementReport | null>(null);

  useEffect(() => {
    void getManagementReport()
      .then(setReport)
      .catch(() => toast.error("Could not load the Management dashboard."));
  }, []);

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Dashboard"
        description="A live overview of production, supply, demand, sales, and payment information."
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-primary/20 bg-accent p-5 text-sm text-accent-foreground">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Live operational data</h2>
              <p className="mt-1 opacity-85">
                Every value below is calculated from saved production, receiving, inventory, order,
                and payment records.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Operational overview</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {report?.summaries.map((item) => (
              <article
                key={item.label}
                className="rounded-3xl border border-border bg-card p-6 shadow-card"
              >
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-4 font-display text-3xl font-semibold text-primary">
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold">Decision support</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Compare supply, reserved demand, sales, and payment records in Management Reports.
              Availability uses current classified stock after reservations.
            </p>
          </article>

          <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <PackageOpen className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Controlled operations</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Review users, receiving, products, sales, transactions, and reports from the
                  sidebar. Changes remain traceable in the database.
                </p>
              </div>
            </div>
          </article>
        </section>
      </main>
    </ManagementLayout>
  );
}
