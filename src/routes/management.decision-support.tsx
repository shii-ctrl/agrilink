import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { peso } from "@/features/marketplace/products";
import {
  sellingUnitLabel,
  sellingUnitOptions,
  formatSellingQuantity,
  type SellingUnit,
} from "@/features/marketplace/selling-units";
import {
  buildDecisionSupport,
  manilaDay,
  shiftDay,
  validDay,
} from "@/features/management/decision-support";
import { getManagementDecisionSupport } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/management/decision-support")({
  head: () => ({ meta: [{ title: "Decision Support — Management | AgriLink" }] }),
  component: ManagementDecisionSupportPage,
});

const qualityOptions = ["all", "Good", "Semi", "Reject"].map((quality) => ({
  value: quality,
  label: quality === "all" ? "All qualities" : quality,
}));

type Recommendation = {
  id: string;
  label: string;
  priority: "High" | "Medium" | "Review";
  reason: string;
  action: string;
  to: "/management/transactions" | "/management/products" | "/management/receiving";
};

function changeLabel(current: number, previous: number) {
  if (!previous) return current ? "No sales in previous period" : "No change from previous period";
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs previous period`;
}

function ManagementDecisionSupportPage() {
  const loadSupport = useCallback(() => getManagementDecisionSupport(), []);
  const { data: support, loading, error, reload } = useWorkspaceData(loadSupport);
  const today = manilaDay(new Date());
  const [period, setPeriod] = useState("7");
  const [start, setStart] = useState(() => shiftDay(today, -6));
  const [end, setEnd] = useState(today);
  const [unit, setUnit] = useState<SellingUnit>("kg");
  const [quality, setQuality] = useState("all");
  const [query, setQuery] = useState("");
  const validRange = validDay(start) && validDay(end) && start <= end && end <= today;
  const analysis = useMemo(
    () =>
      support && validRange ? buildDecisionSupport(support, { start, end, unit, quality }) : null,
    [support, validRange, start, end, unit, quality],
  );
  const rows = analysis?.rows ?? [];
  const filtered = rows.filter((row) =>
    `${row.name} ${row.classification}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const page = usePagination(filtered, { pageSize: 8 });
  const agingPage = usePagination(
    rows.filter((row) => row.aging),
    { pageSize: 5 },
  );
  const topSellers = [...rows]
    .filter((row) => row.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);
  const actions = rows
    .flatMap<Recommendation>((row) => {
      const label = `${row.name} · ${row.classification}`;
      if (row.shortage > 0)
        return [
          {
            id: row.id,
            label,
            priority: "High",
            reason: `Open orders exceed on-hand stock by ${formatSellingQuantity(row.shortage, unit)}.`,
            action: "Review supply and confirmed orders",
            to: "/management/transactions" as const,
          },
        ];
      if (row.published && row.stock === 0)
        return [
          {
            id: row.id,
            label,
            priority: "High",
            reason: "This published quality has no available stock.",
            action: "Review stock with Marketer",
            to: "/management/products" as const,
          },
        ];
      if (row.published && row.replenish > 0)
        return [
          {
            id: row.id,
            label,
            priority: "Medium",
            reason: `Estimated coverage is ${row.coverage} days. Suggested additional supply: ${formatSellingQuantity(row.replenish, unit)} for 7 days.`,
            action: "Coordinate replenishment",
            to: "/management/receiving" as const,
          },
        ];
      if (row.slowMoving)
        return [
          {
            id: row.id,
            label,
            priority: "Medium",
            reason: `Oldest remaining batch is ${row.ageDays} days old with slow recent sales.`,
            action: "Review quality and pricing",
            to: "/management/products" as const,
          },
        ];
      if (row.aging)
        return [
          {
            id: row.id,
            label,
            priority: "Review",
            reason: `Oldest remaining batch is ${row.ageDays} days old.`,
            action: "Inspect remaining stock",
            to: "/management/receiving" as const,
          },
        ];
      return [];
    })
    .sort(
      (a, b) =>
        ["High", "Medium", "Review"].indexOf(a.priority) -
        ["High", "Medium", "Review"].indexOf(b.priority),
    );
  const actionsPage = usePagination(actions, { pageSize: 6 });
  const prices = useMemo(() => {
    const grouped = new Map<string, NonNullable<typeof support>["priceHistory"]>();
    for (const row of support?.priceHistory ?? []) {
      const day = manilaDay(row.priceDate);
      if (
        row.sellingUnit !== unit ||
        (quality !== "all" && row.classification !== quality) ||
        day < start ||
        day > end
      )
        continue;
      const history = grouped.get(row.listingId) ?? [];
      history.push(row);
      grouped.set(row.listingId, history);
    }
    return [...grouped.values()].map((history) => {
      const ordered = [...history].sort((a, b) => a.priceDate.localeCompare(b.priceDate));
      return { latest: ordered.at(-1)!, previous: ordered.at(-2) };
    });
  }, [support, unit, quality, start, end]);
  const pricesPage = usePagination(prices, { pageSize: 8 });
  const quantity = (value: number) => formatSellingQuantity(value, unit);
  const totals = analysis?.totals;
  const selectPeriod = (value: string) => {
    setPeriod(value);
    if (value !== "custom") {
      setStart(shiftDay(today, 1 - Number(value)));
      setEnd(today);
    }
  };

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Decision Support"
        description="Supply priorities, sales performance, and stock planning."
      />
      <main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 md:px-8">
        <section className="rounded-3xl border border-border bg-card p-4 shadow-card">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Sales period</Label>
              <AppSelect
                ariaLabel="Sales period"
                value={period}
                onValueChange={selectPeriod}
                options={[
                  { value: "1", label: "Today" },
                  { value: "7", label: "Last 7 days" },
                  { value: "30", label: "Last 30 days" },
                  { value: "custom", label: "Custom range" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Selling unit</Label>
              <AppSelect
                ariaLabel="Selling unit"
                value={unit}
                onValueChange={(value) => setUnit(value as SellingUnit)}
                options={sellingUnitOptions}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quality</Label>
              <AppSelect
                ariaLabel="Quality"
                value={quality}
                onValueChange={setQuality}
                options={qualityOptions}
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                variant="outline"
                disabled={loading}
                onClick={() => void reload().catch(() => undefined)}
              >
                Refresh data
              </Button>
            </div>
          </div>
          {period === "custom" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>From</Label>
                <DatePicker
                  ariaLabel="Sales from date"
                  value={start}
                  onValueChange={setStart}
                  max={end || today}
                />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <DatePicker
                  ariaLabel="Sales to date"
                  value={end}
                  onValueChange={setEnd}
                  min={start}
                  max={today}
                />
              </div>
            </div>
          )}
          {!validRange && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Choose a valid date range ending today or earlier.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Sales period {start} – {end} · Philippine time
            {support
              ? ` · Updated ${new Date(support.updatedAt).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })}`
              : ""}
          </p>
        </section>
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="decision-support data"
        />
        {analysis && !loading && !error && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Available stock now",
                  value: quantity(totals!.stock),
                  detail: `${quantity(totals!.reserved)} reserved separately`,
                },
                {
                  label: "Open-order demand now",
                  value: quantity(totals!.demand),
                  detail: "Pending and confirmed orders across all dates",
                },
                {
                  label: "Completed sales",
                  value: quantity(totals!.sold),
                  detail: changeLabel(totals!.sold, totals!.previousSold),
                },
                {
                  label: "Product sales value",
                  value: peso(totals!.sales),
                  detail: changeLabel(totals!.sales, totals!.previousSales),
                },
              ].map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-3xl border border-border bg-card p-5 shadow-card"
                >
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 break-words text-2xl font-bold">{metric.value}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{metric.detail}</p>
                </article>
              ))}
            </section>
            <p className="text-xs text-muted-foreground">
              Comparison period {analysis.previousStart} – {analysis.previousEnd}. Product sales
              value excludes delivery fees.
              {analysis.legacySales > 0
                ? " Older sales without a completion date use their order date."
                : ""}
            </p>
            <section className="rounded-3xl border border-border bg-card p-4 shadow-card sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Action priorities</h2>
                <span className="text-xs text-muted-foreground">
                  Current stock · {actions.length} items
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {actionsPage.pageItems.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-border p-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${item.priority === "High" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}
                    >
                      {item.priority}
                    </span>
                    <h3 className="mt-3 font-semibold">{item.label}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
                    <Link
                      to={item.to}
                      className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-4"
                    >
                      {item.action} →
                    </Link>
                  </article>
                ))}
              </div>
              {!actions.length && (
                <p className="py-5 text-sm text-muted-foreground">
                  No current priorities for this unit and quality. Products with limited sales
                  history may need manual review.
                </p>
              )}
              <PaginationControls {...actionsPage} itemLabel="priorities" />
            </section>
            <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <article className="min-w-0 rounded-3xl border border-border bg-card p-4 shadow-card sm:p-6">
                <h2 className="text-lg font-semibold">Available and reserved stock</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current quantities in {sellingUnitLabel(unit, 2)}. Reservations are already
                  deducted from available stock.
                </p>
                <Input
                  className="mt-4"
                  aria-label="Search product summary"
                  placeholder="Search product or quality"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {page.pageItems.length > 0 && (
                  <div
                    className="mt-5 w-full min-w-0"
                    style={{ height: Math.max(250, page.pageItems.length * 58) }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={page.pageItems.map((row) => ({
                          ...row,
                          label: `${row.name} · ${row.classification}`,
                        }))}
                        margin={{ left: 0, right: 12 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="var(--border)"
                        />
                        <XAxis
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={115}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                          }}
                          formatter={(value: number) => quantity(value)}
                        />
                        <Legend />
                        <Bar
                          dataKey="stock"
                          name="Available"
                          fill="var(--primary)"
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar
                          dataKey="reserved"
                          name="Reserved"
                          fill="var(--chart-2)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-5">
                  <table data-responsive-table className="w-full text-left text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="py-3">Product / quality</th>
                        <th>Available</th>
                        <th>Open orders</th>
                        <th>Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.pageItems.map((row) => (
                        <tr key={row.id} className="border-b border-border last:border-0">
                          <td data-label="Product / quality" className="py-3 font-medium">
                            {row.name}
                            <span className="block text-xs text-muted-foreground">
                              {row.classification}
                            </span>
                          </td>
                          <td data-label="Available">{quantity(row.stock)}</td>
                          <td data-label="Open orders">{quantity(row.demand)}</td>
                          <td data-label="Coverage">
                            {row.coverage === null ? "Insufficient data" : `${row.coverage} days`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!page.pageItems.length && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No products match these filters.
                    </p>
                  )}
                </div>
                <PaginationControls {...page} itemLabel="products" />
                <p className="mt-3 text-xs text-muted-foreground">
                  Coverage uses the last 14 calendar days of completed sales and available stock.
                  Estimates require at least 7 days of history and 3 selling days. Replenishment
                  targets 7 days of supply when coverage is 3 days or less.
                </p>
              </article>
              <div className="min-w-0 space-y-6">
                <article className="rounded-3xl border border-border bg-card p-5 shadow-card">
                  <h2 className="text-lg font-semibold">Best-selling products</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Selected sales period · {sellingUnitLabel(unit, 2)}
                  </p>
                  <div className="mt-4 space-y-4">
                    {topSellers.map((row, index) => (
                      <div key={row.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {index + 1}. {row.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{row.classification}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold">{quantity(row.sold)}</span>
                      </div>
                    ))}
                  </div>
                  {!topSellers.length && (
                    <p className="py-5 text-sm text-muted-foreground">
                      No completed sales in this period.
                    </p>
                  )}
                </article>
                <article className="rounded-3xl border border-border bg-card p-5 shadow-card">
                  <h2 className="text-lg font-semibold">Aging and slow-moving stock</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Remaining batches received 7 or more days ago. Age indicates review priority,
                    not an expiry date.
                  </p>
                  <div className="mt-4 space-y-3">
                    {agingPage.pageItems.map((row) => (
                      <div key={row.id} className="rounded-2xl border border-border p-3">
                        <p className="font-medium">
                          {row.name} · {row.classification}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {quantity(row.stock)} available · oldest batch {row.ageDays} days
                        </p>
                        <p className="mt-1 text-xs font-medium text-primary">
                          {row.slowMoving
                            ? "Slow-moving · review quality and pricing"
                            : "Review oldest remaining batch"}
                        </p>
                      </div>
                    ))}
                  </div>
                  {!agingPage.pageItems.length && (
                    <p className="py-5 text-sm text-muted-foreground">
                      No aging stock for these filters.
                    </p>
                  )}
                  <PaginationControls {...agingPage} itemLabel="products" />
                </article>
              </div>
            </section>
            <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-lg font-semibold">Published price changes</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Latest two published prices within the selected period.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {pricesPage.pageItems.map(({ latest, previous }) => (
                  <article key={latest.listingId} className="rounded-2xl border border-border p-4">
                    <h3 className="font-medium">
                      {latest.name} · {latest.classification}
                    </h3>
                    <p className="mt-3 text-xl font-bold">
                      {peso(latest.price)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {sellingUnitLabel(latest.sellingUnit)}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {previous
                        ? latest.price === previous.price
                          ? "No price change"
                          : `${latest.price > previous.price ? "↑" : "↓"} ${peso(Math.abs(latest.price - previous.price))} from ${manilaDay(previous.priceDate)}`
                        : "One price record · no comparison yet"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Published {manilaDay(latest.priceDate)}
                    </p>
                  </article>
                ))}
              </div>
              {!prices.length && (
                <p className="py-5 text-sm text-muted-foreground">
                  No published prices for these filters.
                </p>
              )}
              <PaginationControls {...pricesPage} itemLabel="prices" />
            </section>
          </>
        )}
      </main>
    </ManagementLayout>
  );
}
