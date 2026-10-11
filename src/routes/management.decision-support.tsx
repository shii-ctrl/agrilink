import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CircleAlert, LineChart, PackageSearch, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { Input } from "@/components/ui/input";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { peso } from "@/features/marketplace/products";
import { getManagementDecisionSupport } from "@/services/marketplace/marketplace-server-functions";
import { toast } from "sonner";

export const Route = createFileRoute("/management/decision-support")({
  head: () => ({
    meta: [
      { title: "Decision Support — Management | AgriLink" },
      { name: "description", content: "Live Management decision support for AgriLink." },
    ],
  }),
  component: ManagementDecisionSupportPage,
});

type Support = Awaited<ReturnType<typeof getManagementDecisionSupport>>;
type ProductSummary = { name: string; stock: number; ordered: number; sold: number };

function dateRange(values: string[], fallback: string) {
  const dates = values
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => first.getTime() - second.getTime());
  if (!dates.length) return fallback;
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) return fallback;
  const format = (date: Date) =>
    date.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  return dates.length === 1 ? format(first) : `${format(first)} – ${format(last)}`;
}

function ManagementDecisionSupportPage() {
  const [support, setSupport] = useState<Support | null>(null);
  const [summaryQuery, setSummaryQuery] = useState("");

  useEffect(() => {
    void getManagementDecisionSupport()
      .then(setSupport)
      .catch(() => toast.error("Could not load saved decision-support data."));
  }, []);

  const summaries = useMemo<ProductSummary[]>(() => {
    const grouped = new Map<string, ProductSummary>();
    for (const item of support?.stock ?? []) {
      const summary = grouped.get(item.name) ?? { name: item.name, stock: 0, ordered: 0, sold: 0 };
      summary.stock += item.availableKg;
      grouped.set(item.name, summary);
    }
    for (const line of support?.orderLines ?? []) {
      const summary = grouped.get(line.name) ?? { name: line.name, stock: 0, ordered: 0, sold: 0 };
      if (line.status === "pending" || line.status === "confirmed")
        summary.ordered += line.quantityKg;
      if (line.status === "sold") summary.sold += line.quantityKg;
      grouped.set(line.name, summary);
    }
    return [...grouped.values()].sort((first, second) => second.ordered - first.ordered);
  }, [support]);

  const lowStock = useMemo(
    () =>
      (support?.stock ?? [])
        .filter((item) => item.listingStatus === "published" && item.availableKg <= 15)
        .sort((first, second) => first.availableKg - second.availableKg),
    [support],
  );
  const visibleSummaries = useMemo(() => {
    const query = summaryQuery.trim().toLocaleLowerCase();
    return summaries.filter((item) => !query || item.name.toLocaleLowerCase().includes(query));
  }, [summaries, summaryQuery]);
  const summariesPage = usePagination(visibleSummaries, { pageSize: 8 });

  const priceChanges = useMemo(() => {
    const byListing = new Map<string, Support["priceHistory"]>();
    for (const row of support?.priceHistory ?? []) {
      const entries = byListing.get(row.listingId) ?? [];
      entries.push(row);
      byListing.set(row.listingId, entries);
    }
    return [...byListing.values()]
      .map((history) => {
        const ordered = [...history].sort((first, second) =>
          first.priceDate.localeCompare(second.priceDate),
        );
        const latest = ordered.at(-1);
        if (!latest) return null;
        const previous = ordered.at(-2) ?? latest;
        return {
          id: latest.listingId,
          label: `${latest.name} — ${latest.classification}`,
          latest: latest.price,
          previous: previous.price,
          range: dateRange(
            ordered.map((entry) => entry.priceDate),
            "No published dates",
          ),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [support]);

  const stockKg = summaries.reduce((total, item) => total + item.stock, 0);
  const orderedKg = summaries.reduce((total, item) => total + item.ordered, 0);
  const soldKg = summaries.reduce((total, item) => total + item.sold, 0);
  const orderRange = dateRange(
    (support?.orderLines ?? []).map((line) => line.createdAt),
    "No saved orders",
  );
  const priceRange = dateRange(
    (support?.priceHistory ?? []).map((entry) => entry.priceDate),
    "No published price records",
  );

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Decision Support"
        description="Live summaries from saved classified stock, buyer orders, sales, and published prices."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-primary/20 bg-accent p-5 text-sm text-accent-foreground">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Saved AgriLink records</h2>
              <p className="mt-1 opacity-85">
                Order records: {orderRange}. Published price history: {priceRange}. No browser demo
                data is used here.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Classified stock",
              value: `${stockKg} kg`,
              detail: "After current reservations",
              icon: PackageSearch,
            },
            {
              label: "Reserved demand",
              value: `${orderedKg} kg`,
              detail: "Pending and confirmed orders",
              icon: BarChart3,
            },
            {
              label: "Completed sales",
              value: `${soldKg} kg`,
              detail: `${summaries.filter((item) => item.sold > 0).length} product type(s) sold`,
              icon: TrendingUp,
            },
            {
              label: "Low-stock listings",
              value: String(lowStock.length),
              detail: "Published listings with 15 kg or less",
              icon: CircleAlert,
            },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                key={metric.label}
                className="rounded-3xl border border-border bg-card p-5 shadow-card"
              >
                <Icon className="size-5 text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{metric.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{metric.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Stock versus reserved demand</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Current classified stock compared with pending and confirmed orders.
                </p>
              </div>
              <BarChart3 className="size-5 shrink-0 text-primary" />
            </div>
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaries} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} unit=" kg" />
                  <Tooltip formatter={(value: number) => [`${value} kg`, ""]} />
                  <Bar
                    dataKey="stock"
                    name="Classified stock"
                    fill="var(--primary)"
                    radius={[7, 7, 0, 0]}
                  />
                  <Bar
                    dataKey="ordered"
                    name="Reserved demand"
                    fill="var(--chart-2)"
                    radius={[7, 7, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 max-w-md">
              <Input
                aria-label="Search stock and demand summary"
                value={summaryQuery}
                onChange={(event) => setSummaryQuery(event.target.value)}
                placeholder="Search product summary"
              />
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">Product</th>
                    <th className="pb-3 font-medium">Stock</th>
                    <th className="pb-3 font-medium">Reserved</th>
                    <th className="pb-3 font-medium">Sold</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summariesPage.pageItems.map((item) => (
                    <tr key={item.name} className="border-b last:border-0">
                      <td className="py-3 font-medium">{item.name}</td>
                      <td className="py-3">{item.stock} kg</td>
                      <td className="py-3">{item.ordered} kg</td>
                      <td className="py-3">{item.sold} kg</td>
                      <td className="py-3 font-medium">
                        {item.ordered <= item.stock
                          ? "Stock covers reserved demand"
                          : `${item.ordered - item.stock} kg shortfall`}
                      </td>
                    </tr>
                  ))}
                  {!visibleSummaries.length && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No product summary matches your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls {...summariesPage} itemLabel="product summaries" />
          </article>
          <div className="space-y-6">
            <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Best-selling products</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sold quantities from {orderRange}.
              </p>
              <div className="mt-5 space-y-4">
                {summaries
                  .filter((item) => item.sold > 0)
                  .sort((first, second) => second.sold - first.sold)
                  .slice(0, 3)
                  .map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.sold} kg sold</span>
                    </div>
                  ))}
                {!summaries.some((item) => item.sold > 0) && (
                  <p className="text-sm text-muted-foreground">No sold orders are recorded yet.</p>
                )}
              </div>
            </article>
            <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Low-stock attention</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Published listings with 15 kg or less available.
              </p>
              <div className="mt-5 space-y-3">
                {lowStock.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl bg-destructive/8 px-3 py-2.5"
                  >
                    <span className="font-medium">
                      {item.name} — {item.classification}
                    </span>
                    <span className="text-sm font-semibold text-destructive">
                      {item.availableKg} kg left
                    </span>
                  </div>
                ))}
                {!lowStock.length && (
                  <p className="text-sm text-muted-foreground">
                    No published listings need low-stock attention.
                  </p>
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <LineChart className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Published price changes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Latest saved price compared with the previous published price. Price history:{" "}
                {priceRange}.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {priceChanges.map((item) => {
              const change = item.latest - item.previous;
              return (
                <article key={item.id} className="rounded-2xl border border-border p-4">
                  <p className="font-medium">{item.label}</p>
                  <p className="mt-3 text-xl font-bold">
                    {peso(item.latest)}
                    <span className="text-sm font-normal text-muted-foreground"> / kg</span>
                  </p>
                  <p
                    className={`mt-2 text-sm font-medium ${change >= 0 ? "text-primary" : "text-destructive"}`}
                  >
                    {change === 0
                      ? "No change"
                      : `${change > 0 ? "↑" : "↓"} ${peso(Math.abs(change))} from previous price`}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Compared within {item.range}</p>
                </article>
              );
            })}
            {!priceChanges.length && (
              <p className="text-sm text-muted-foreground">
                No published daily-price records are available yet.
              </p>
            )}
          </div>
        </section>
      </main>
    </ManagementLayout>
  );
}
