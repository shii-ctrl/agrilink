import { createFileRoute } from "@tanstack/react-router";
import { History, RefreshCw, Search, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { ResponsiveFilterPanel } from "@/components/data/responsive-filter-panel";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import type { Classification } from "@/features/marketplace/products";
import { procyMarketCategoryForProduct } from "@/features/marketplace/procy-market-categories";
import { sellingUnitLabel, type SellingUnit } from "@/features/marketplace/selling-units";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getMarketerDailyPrices } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketer/daily-prices")({
  component: MarketerDailyPricesPage,
});

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function MarketerDailyPricesPage() {
  const [entries, setEntries] = useState<DailyPriceEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [query, setQuery] = useState("");
  const [quality, setQuality] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEntries(await getMarketerDailyPrices());
    setLoadError(null);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => void loadWorkspace(), [loadWorkspace]);
  useAutoRefresh(() => load().catch(() => undefined));

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return entries
      .filter((entry) => entry.date === selectedDate)
      .filter((entry) => quality === "all" || entry.classification === quality)
      .filter(
        (entry) =>
          !normalizedQuery ||
          `${entry.product} ${entry.classification} ${categoryFor(entry.product)} ${sellingUnitLabel(entry.sellingUnit)}`
            .toLocaleLowerCase()
            .includes(normalizedQuery),
      )
      .sort(
        (left, right) =>
          left.product.localeCompare(right.product) ||
          qualityRank(left.classification) - qualityRank(right.classification),
      );
  }, [entries, quality, query, selectedDate]);
  const pricesPage = usePagination(visibleEntries);
  const todayEntries = entries.filter(
    (entry) => entry.date === today() && entry.status === "Published",
  );

  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Daily Prices & Deals"
        description="Marketplace retail prices are recorded here automatically as daily price history."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="daily-price history"
        />
        {!loading && !loadError ? (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-primary/20 bg-accent/55 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <Tag className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Today’s synced prices
                    </p>
                    <p className="mt-1 text-3xl font-semibold">{todayEntries.length}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Saving a retail price in Product Catalog updates today automatically.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary">
                    <History className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Historical records</p>
                    <p className="mt-1 text-3xl font-semibold">{entries.length}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Previous dates remain unchanged for price comparison and reporting.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold">Daily price history</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Read-only records synchronized from the Product Catalog retail price.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                  <RefreshCw className="size-3.5" /> Refresh
                </Button>
              </div>

              <ResponsiveFilterPanel
                activeCount={
                  Number(Boolean(query)) +
                  Number(selectedDate !== today()) +
                  Number(quality !== "all")
                }
                contentClassName="md:grid-cols-[0.8fr_1.2fr_0.8fr]"
              >
                <DatePicker
                  ariaLabel="Select price history date"
                  value={selectedDate}
                  onValueChange={setSelectedDate}
                />
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search price history"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search product, category, or unit"
                    className="pl-9"
                  />
                </div>
                <AppSelect
                  ariaLabel="Filter price history by quality"
                  value={quality}
                  onValueChange={setQuality}
                  options={[
                    { value: "all", label: "All qualities" },
                    { value: "Good", label: "Good" },
                    { value: "Semi", label: "Semi" },
                    { value: "Reject", label: "Reject" },
                  ]}
                />
              </ResponsiveFilterPanel>

              <div className="overflow-x-auto md:overflow-visible">
                <table data-responsive-table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4 sm:px-6">Product</th>
                      <th className="px-5 py-4 sm:px-6">Category</th>
                      <th className="px-5 py-4 sm:px-6">Quality</th>
                      <th className="px-5 py-4 sm:px-6">Retail price</th>
                      <th className="px-5 py-4 sm:px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricesPage.pageItems.map((entry) => (
                      <tr key={entry.id} className="border-t border-border">
                        <td data-label="Product" className="px-5 py-4 font-semibold sm:px-6">
                          {entry.product}
                        </td>
                        <td data-label="Category" className="px-5 py-4 sm:px-6">
                          {categoryFor(entry.product)}
                        </td>
                        <td data-label="Quality" className="px-5 py-4 sm:px-6">
                          {entry.classification}
                        </td>
                        <td data-label="Retail price" className="px-5 py-4 sm:px-6">
                          <span className="font-semibold text-primary">
                            ₱{entry.price.toFixed(2)}
                          </span>{" "}
                          <span className="text-xs text-muted-foreground">
                            / {sellingUnitLabel(entry.sellingUnit)}
                          </span>
                        </td>
                        <td data-label="Status" className="px-5 py-4 sm:px-6">
                          {entry.status === "Published" ? (
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                              Synced
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                              Price removed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {visibleEntries.length === 0 ? (
                      <tr>
                        <td
                          data-mobile-full
                          colSpan={5}
                          className="px-6 py-12 text-center text-muted-foreground"
                        >
                          No synchronized price records match this date and filter.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...pricesPage} itemLabel="price records" />
            </section>
          </div>
        ) : null}
      </main>
    </MarketerLayout>
  );
}

function categoryFor(productName: string) {
  return procyMarketCategoryForProduct(productName) ?? "Other Commodities";
}

function qualityRank(classification: Classification) {
  return ["Good", "Semi", "Reject"].indexOf(classification);
}

type DailyPriceEntry = {
  id: string;
  listingId: string;
  date: string;
  product: string;
  cropType: string;
  sellingUnit: SellingUnit;
  classification: Classification;
  price: number;
  status: "Published" | "Hidden";
};
