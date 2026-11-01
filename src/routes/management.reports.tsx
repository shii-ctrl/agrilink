import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Download, FileBarChart } from "lucide-react";
import { useCallback } from "react";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { Button } from "@/components/ui/button";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getManagementReport } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/management/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — Management | AgriLink" },
      {
        name: "description",
        content: "Management report and analytics interface for AgriLink.",
      },
    ],
  }),
  component: ManagementReportsPage,
});

type ManagementReport = Awaited<ReturnType<typeof getManagementReport>>;

function ManagementReportsPage() {
  const loadReport = useCallback(() => getManagementReport(), []);
  const { data: report, loading, error, reload } = useWorkspaceData(loadReport);
  const highestAvailability = Math.max(
    ...(report?.availability ?? []).map((item) => item.value),
    1,
  );
  function downloadReport() {
    const csv = [
      "Report,Value,Detail",
      ...(report?.summaries ?? []).map((item) => `${item.label},${item.value},${item.detail}`),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "agrilink-management-report.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Reports / Analytics"
        description="Clear organizational summaries for availability, supply, demand, receiving, sales, payments, and transactions."
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="live report"
        />
        {!loading && !error && (
          <>
            <section className="rounded-3xl border border-primary/20 bg-accent p-5 text-sm text-accent-foreground">
              <div className="flex items-start gap-3">
                <FileBarChart className="mt-0.5 size-5 shrink-0" />
                <div>
                  <h2 className="font-semibold">Live AgriLink report</h2>
                  <p className="mt-1 opacity-85">
                    These values are calculated from the current saved AgriLink records.
                  </p>
                </div>
              </div>
              <Button variant="outline" className="mt-4 rounded-full" onClick={downloadReport}>
                <Download className="size-4" /> Download CSV
              </Button>
            </section>

            <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(report?.summaries ?? []).map((report) => (
                <article
                  key={report.label}
                  className="rounded-3xl border border-border bg-card p-5 shadow-card"
                >
                  <p className="text-sm text-muted-foreground">{report.label}</p>
                  <p className="mt-3 font-display text-3xl font-semibold text-primary">
                    {report.value}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{report.detail}</p>
                </article>
              ))}
            </section>

            <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <BarChart3 className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Product availability by classification</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Classified stock after buyer reservations is shown separately for every product
                    classification.
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-5">
                {(report?.availability ?? []).map((item) => (
                  <div key={item.label}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-muted-foreground">{item.value} kg</p>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.round((item.value / highestAvailability) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </ManagementLayout>
  );
}
