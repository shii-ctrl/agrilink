import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Download, FileBarChart, MessageSquareText, Star } from "lucide-react";
import { useCallback } from "react";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { Button } from "@/components/ui/button";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { getManagementReport } from "@/services/marketplace/marketplace-server-functions";
import { getManagementFeedbackSummary } from "@/services/marketplace/order-feedback-server-functions";

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

function ManagementReportsPage() {
  const loadReport = useCallback(async () => {
    const [report, feedback] = await Promise.all([
      getManagementReport(),
      getManagementFeedbackSummary(),
    ]);
    return { report, feedback };
  }, []);
  const { data, loading, error, reload } = useWorkspaceData(loadReport);
  const report = data?.report;
  const feedback = data?.feedback;
  const highestAvailability = Math.max(
    ...(report?.availability ?? []).map((item) => item.value),
    1,
  );
  function downloadReport() {
    const csv = [
      "Report,Value,Detail",
      ...(report?.summaries ?? []).map((item) => `${item.label},${item.value},${item.detail}`),
      `Buyer feedback responses,${feedback?.totals.feedbackCount ?? 0},Completed-order ratings`,
      `Average product rating,${feedback?.totals.averageProduct ?? ""},Out of 5`,
      `Average PROCY service rating,${feedback?.totals.averageService ?? ""},Out of 5`,
      `Average Rider rating,${feedback?.totals.averageRider ?? ""},Out of 5`,
      ...(feedback?.products ?? []).map(
        (item) =>
          `Product rating: ${item.productName},${item.averageRating},${item.ratingCount} response${item.ratingCount === 1 ? "" : "s"}`,
      ),
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

            <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    <MessageSquareText className="size-4" /> Buyer feedback
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">Completed-order ratings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Product quality, PROCY service, and Rider performance from fulfilled orders.
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                  {feedback?.totals.feedbackCount ?? 0} response
                  {(feedback?.totals.feedbackCount ?? 0) === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Product quality", feedback?.totals.averageProduct],
                  ["PROCY service", feedback?.totals.averageService],
                  ["Rider service", feedback?.totals.averageRider],
                  ["Low-rating orders", feedback?.totals.lowRatingCount ?? 0],
                ].map(([label, value]) => (
                  <article key={label} className="rounded-2xl border border-border bg-muted/25 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-2xl font-semibold">
                      {label === "Low-rating orders"
                        ? String(value)
                        : value === null || value === undefined
                          ? "—"
                          : `${Number(value).toFixed(1)} / 5`}
                      {label !== "Low-rating orders" && value !== null && value !== undefined ? (
                        <Star className="size-5 fill-amber-400 text-amber-400" />
                      ) : null}
                    </p>
                  </article>
                ))}
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <RatingSummary
                  title="Product rating summary"
                  empty="No product ratings yet."
                  rows={(feedback?.products ?? []).slice(0, 8).map((product) => ({
                    id: product.productId,
                    label: product.productName,
                    average: product.averageRating,
                    count: product.ratingCount,
                  }))}
                />
                <RatingSummary
                  title="Rider performance"
                  empty="No Rider ratings yet."
                  rows={(feedback?.riders ?? []).slice(0, 8).map((rider) => ({
                    id: rider.riderId,
                    label: rider.riderName,
                    average: rider.averageRating,
                    count: rider.ratingCount,
                  }))}
                />
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-border">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="font-semibold">Recent Buyer feedback</h3>
                </div>
                <div className="divide-y divide-border">
                  {(feedback?.recent ?? []).map((item) => (
                    <article key={item.id} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.buyerName} · {new Date(item.updatedAt).toLocaleString("en-PH")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <RatingBadge
                            label="Products"
                            value={item.productAverage?.toFixed(1) ?? "—"}
                          />
                          <RatingBadge label="Service" value={String(item.serviceRating)} />
                          {item.riderRating !== null ? (
                            <RatingBadge label="Rider" value={String(item.riderRating)} />
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.products
                          .map((product) => `${product.productName} (${product.rating}★)`)
                          .join(" · ")}
                      </p>
                      {item.comment ? (
                        <p className="mt-3 text-sm leading-relaxed">“{item.comment}”</p>
                      ) : null}
                    </article>
                  ))}
                  {!feedback?.recent.length ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Buyer feedback will appear here after completed orders are rated.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </ManagementLayout>
  );
}

function RatingSummary({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; label: string; average: number; count: number }>;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-muted/35 px-3 py-2.5 text-sm"
          >
            <span className="min-w-0 truncate font-medium">{row.label}</span>
            <span className="shrink-0 text-muted-foreground">
              {row.average.toFixed(1)} ★ · {row.count}
            </span>
          </div>
        ))}
        {!rows.length ? (
          <p className="py-5 text-center text-sm text-muted-foreground">{empty}</p>
        ) : null}
      </div>
    </div>
  );
}

function RatingBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
      {label} {value} ★
    </span>
  );
}
