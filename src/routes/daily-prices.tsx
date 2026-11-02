import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronDown,
  CircleMinus,
  Clock3,
  PackageCheck,
  Search,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import {
  procyCategoryOrder,
  procyMarketCategories,
  procyMarketCategoryForProduct,
} from "@/features/marketplace/procy-market-categories";
import type { Classification } from "@/features/marketplace/products";
import {
  sellingUnitLabel,
  sellingUnits,
  type SellingUnit,
} from "@/features/marketplace/selling-units";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";
import {
  getMyDailyPriceAlerts,
  getPublicDailyPrices,
  saveDailyPriceAlert,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/daily-prices")({
  head: () => ({
    meta: [
      { title: "Daily Vegetable Prices — AgriLink" },
      {
        name: "description",
        content: "View published PROCY vegetable prices by classification and date.",
      },
    ],
  }),
  component: DailyPricesPage,
});

const classifications: Classification[] = ["Good", "Semi", "Reject"];
const qualityColor: Record<Classification, string> = {
  Good: "text-good",
  Semi: "text-semi",
  Reject: "text-reject",
};

function dateFromValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day, 12);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateLabel(value: string) {
  const parsed = dateFromValue(value);
  return parsed
    ? new Intl.DateTimeFormat("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(parsed)
    : "Latest available prices";
}

function todayValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function relativeUpdated(value: string | null) {
  if (!value) return "Update time unavailable";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `Updated ${Math.floor(hours / 24)} day${hours < 48 ? "" : "s"} ago`;
}

function movementLabel(value: number | null) {
  if (value === null || Math.abs(value) < 0.005) {
    return { text: value === null ? "First recorded price" : "No change", icon: CircleMinus };
  }
  return {
    text: `${value > 0 ? "+" : "−"}₱${Math.abs(value).toFixed(2)}`,
    icon: value > 0 ? ArrowUpRight : ArrowDownRight,
  };
}

function DailyPricesPage() {
  const [date, setDate] = useState("");
  const [entries, setEntries] = useState<DailyPriceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [marketCategory, setMarketCategory] = useState("");
  const [classification, setClassification] = useState("");
  const [sellingUnit, setSellingUnit] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [chartProduct, setChartProduct] = useState("");
  const [chartRange, setChartRange] = useState<7 | 30 | 90>(30);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [buyerSignedIn, setBuyerSignedIn] = useState(false);
  const [alertTargets, setAlertTargets] = useState<Record<string, string>>({});
  const [savingAlert, setSavingAlert] = useState<string | null>(null);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const dailyPrices = await getPublicDailyPrices();
      setEntries(dailyPrices);
      const dates = [...new Set(dailyPrices.map((item) => item.date))].sort();
      setDate((current) => (current && dates.includes(current) ? current : (dates.at(-1) ?? "")));
      setChartProduct((current) => current || dailyPrices.at(-1)?.product || "");
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "Price information could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrices();
    void getCurrentSessionUser()
      .then(async (user) => {
        const isBuyer = Boolean(user?.roles.includes("Buyer"));
        setBuyerSignedIn(isBuyer);
        if (!isBuyer) return;
        const alerts = await getMyDailyPriceAlerts();
        setAlertTargets(
          Object.fromEntries(alerts.map((alert) => [alert.listingId, String(alert.targetPrice)])),
        );
      })
      .catch(() => setBuyerSignedIn(false));
  }, [loadPrices]);

  const availableDates = useMemo(
    () => [...new Set(entries.map((entry) => entry.date))].sort(),
    [entries],
  );
  const latestDate = availableDates.at(-1) ?? "";
  const selectedDateIndex = availableDates.indexOf(date);
  const publishedEntries = useMemo(
    () => entries.filter((entry) => entry.date === date && entry.status === "Published"),
    [entries, date],
  );
  const productRows = useMemo<ProductRow[]>(() => {
    const products = new Map<string, DailyPriceEntry[]>();
    for (const entry of publishedEntries) {
      const current = products.get(entry.productId) ?? [];
      current.push(entry);
      products.set(entry.productId, current);
    }
    return [...products.entries()]
      .map(([productId, prices]) => {
        const product = prices[0]!;
        const offers = Object.fromEntries(
          prices.map((entry) => {
            const previous = [...entries]
              .filter(
                (item) =>
                  item.listingId === entry.listingId &&
                  item.status === "Published" &&
                  item.date < entry.date,
              )
              .sort((first, second) => second.date.localeCompare(first.date))[0];
            return [
              entry.classification.toLowerCase(),
              { ...entry, change: previous ? entry.price - previous.price : null },
            ];
          }),
        ) as ProductRow["offers"];
        return {
          productId,
          product: product.product,
          crop: product.cropType,
          description: product.description ?? "",
          imageUrl: product.imageUrl || marketplaceImageFor(product.product),
          sellingUnit: product.sellingUnit,
          marketCategory: procyMarketCategoryForProduct(product.product),
          availableQuantity: prices.reduce((total, entry) => total + entry.availableQuantity, 0),
          updatedAt: prices
            .map((entry) => entry.createdAt)
            .sort((first, second) => second.localeCompare(first))[0]!,
          offers,
        };
      })
      .sort(
        (first, second) =>
          procyCategoryOrder(first.marketCategory) - procyCategoryOrder(second.marketCategory) ||
          first.product.localeCompare(second.product),
      );
  }, [entries, publishedEntries]);

  const visibleProductRows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return productRows.filter((item) => {
      if (search && !`${item.product} ${item.crop}`.toLocaleLowerCase().includes(search))
        return false;
      if (marketCategory && item.marketCategory !== marketCategory) return false;
      if (classification && !item.offers[classification.toLocaleLowerCase() as QualityKey])
        return false;
      if (sellingUnit && item.sellingUnit !== sellingUnit) return false;
      if (availableOnly && item.availableQuantity <= 0) return false;
      return true;
    });
  }, [availableOnly, classification, marketCategory, productRows, query, sellingUnit]);
  const productRowsPage = usePagination(visibleProductRows, { pageSize: 8 });
  const selectedProduct = productRows.find((item) => item.productId === selectedProductId) ?? null;

  const chartData = useMemo(() => {
    const end = dateFromValue(latestDate)?.getTime() ?? Date.now();
    const cutoff = end - (chartRange - 1) * 24 * 60 * 60 * 1000;
    return [...new Set(entries.map((entry) => entry.date))]
      .sort()
      .filter((historyDate) => (dateFromValue(historyDate)?.getTime() ?? 0) >= cutoff)
      .map((historyDate) => {
        const values = Object.fromEntries(
          entries
            .filter(
              (entry) =>
                entry.date === historyDate &&
                entry.product === chartProduct &&
                entry.status === "Published",
            )
            .map((entry) => [entry.classification.toLowerCase(), entry.price]),
        );
        return {
          date: historyDate.slice(5).replace("-", "/"),
          good: values["good"],
          semi: values["semi"],
          reject: values["reject"],
        };
      });
  }, [chartProduct, chartRange, entries, latestDate]);

  const selectedUpdatedAt = publishedEntries
    .map((entry) => entry.createdAt)
    .sort((first, second) => second.localeCompare(first))[0];

  async function saveAlert(offer: PriceOffer) {
    const targetPrice = Number(alertTargets[offer.listingId]);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      toast.error("Enter a valid target price");
      return;
    }
    setSavingAlert(offer.listingId);
    try {
      await saveDailyPriceAlert({ data: { listingId: offer.listingId, targetPrice } });
      toast.success("Price alert saved", {
        description: `We’ll notify you when this price reaches ₱${targetPrice.toFixed(2)} or lower.`,
      });
    } catch (cause) {
      toast.error("Price alert could not be saved", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setSavingAlert(null);
    }
  }

  const clearFilters = () => {
    setQuery("");
    setMarketCategory("");
    setClassification("");
    setSellingUnit("");
    setAvailableOnly(false);
  };
  const filtersActive = Boolean(
    query || marketCategory || classification || sellingUnit || availableOnly,
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Market information
            </p>
            <h1 className="mt-3 text-4xl font-semibold md:text-5xl">Daily Vegetable Prices</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Compare published PROCY prices by quality, selling unit, and date before you buy.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            <Clock3 className="size-4" />
            {date === latestDate ? relativeUpdated(selectedUpdatedAt ?? null) : "Historical prices"}
          </span>
        </div>

        <section className="mt-7 rounded-3xl border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={selectedDateIndex <= 0}
              onClick={() => setDate(availableDates[selectedDateIndex - 1] ?? date)}
            >
              <ArrowLeft className="size-4" /> Previous
            </Button>
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prices for
              </p>
              <DatePicker
                ariaLabel="Select price date"
                value={date}
                onValueChange={setDate}
                {...(availableDates[0] ? { min: availableDates[0] } : {})}
                max={todayValue()}
                className="h-11 w-auto min-w-48 rounded-full px-4"
              />
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={selectedDateIndex < 0 || selectedDateIndex >= availableDates.length - 1}
              onClick={() => setDate(availableDates[selectedDateIndex + 1] ?? date)}
            >
              Next <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => setDate(todayValue())}
            >
              View today
            </button>
          </div>
        </section>

        <details className="group mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
            <span className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" /> How PROCY pricing works
            </span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-3 text-muted-foreground sm:grid-cols-2">
            <p>Marketers publish daily prices. Hidden records never appear to public visitors.</p>
            <p>
              Market categories organize products; Good, Semi, and Reject remain separate quality
              classifications.
            </p>
          </div>
        </details>

        <section className="mt-7 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Price guide</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading
                    ? "Loading the latest published prices…"
                    : `${visibleProductRows.length} product${visibleProductRows.length === 1 ? "" : "s"} for ${dateLabel(date)}.`}
                </p>
              </div>
              {filtersActive ? (
                <Button variant="ghost" className="rounded-full" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <label className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <Input
                  aria-label="Search daily prices"
                  className="pl-10"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search product or crop type"
                />
              </label>
              <AppSelect
                ariaLabel="Filter daily prices by PROCY market category"
                value={marketCategory}
                onValueChange={setMarketCategory}
                options={[
                  { value: "", label: "All categories" },
                  ...procyMarketCategories.map((category) => ({
                    value: category,
                    label: category,
                  })),
                ]}
              />
              <AppSelect
                ariaLabel="Filter by quality"
                value={classification}
                onValueChange={setClassification}
                options={[
                  { value: "", label: "All qualities" },
                  ...classifications.map((quality) => ({ value: quality, label: quality })),
                ]}
              />
              <AppSelect
                ariaLabel="Filter by selling unit"
                value={sellingUnit}
                onValueChange={setSellingUnit}
                options={[
                  { value: "", label: "All selling units" },
                  ...sellingUnits.map((unit) => ({ value: unit, label: sellingUnitLabel(unit) })),
                ]}
              />
            </div>
            <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-medium">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(event) => setAvailableOnly(event.target.checked)}
                className="size-4 accent-primary"
              />{" "}
              Available products only
            </label>
          </div>

          {loading ? (
            <PriceLoadingState />
          ) : loadError ? (
            <div className="p-10 text-center">
              <h3 className="font-semibold">Prices could not be loaded</h3>
              <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
              <Button className="mt-4 rounded-full" onClick={() => void loadPrices()}>
                Try again
              </Button>
            </div>
          ) : productRowsPage.pageItems.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4">Product</th>
                      <th className="px-5 py-4">Category / unit</th>
                      <th className="px-5 py-4">Good</th>
                      <th className="px-5 py-4">Semi</th>
                      <th className="px-5 py-4">Reject</th>
                      <th className="px-5 py-4">Stock</th>
                      <th className="px-5 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRowsPage.pageItems.map((item) => (
                      <PriceTableRow
                        key={item.productId}
                        item={item}
                        onOpen={() => setSelectedProductId(item.productId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-4 p-4 md:hidden">
                {productRowsPage.pageItems.map((item) => (
                  <PriceMobileCard
                    key={item.productId}
                    item={item}
                    onOpen={() => setSelectedProductId(item.productId)}
                  />
                ))}
              </div>
              <PaginationControls {...productRowsPage} itemLabel="priced products" />
            </>
          ) : (
            <div className="px-6 py-14 text-center">
              <ShoppingBag className="mx-auto size-9 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No published prices for this date</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Try another date, change your filters, or return to the latest available prices.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {filtersActive ? (
                  <Button variant="outline" className="rounded-full" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
                {latestDate ? (
                  <Button className="rounded-full" onClick={() => setDate(latestDate)}>
                    View latest prices
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">Price history comparison</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare Good, Semi, and Reject prices over time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 30, 90].map((range) => (
                <Button
                  key={range}
                  size="sm"
                  variant={chartRange === range ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setChartRange(range as 7 | 30 | 90)}
                >
                  {range === 90 ? "3 months" : `${range} days`}
                </Button>
              ))}
            </div>
            <AppSelect
              ariaLabel="Choose product for price history"
              value={chartProduct}
              onValueChange={setChartProduct}
              options={[...new Set(entries.map((entry) => entry.product))].map((name) => ({
                value: name,
                label: name,
              }))}
            />
          </div>
          {chartData.length ? (
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₱${value}`} />
                  <Tooltip formatter={(value) => `₱${Number(value).toFixed(2)}`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="good"
                    name="Good"
                    stroke="var(--good)"
                    strokeWidth={3}
                    connectNulls
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="semi"
                    name="Semi"
                    stroke="var(--semi)"
                    strokeWidth={3}
                    connectNulls
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="reject"
                    name="Reject"
                    stroke="var(--reject)"
                    strokeWidth={3}
                    connectNulls
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-muted/40 py-12 text-center text-sm text-muted-foreground">
              No price history is available for this product and period.
            </div>
          )}
        </section>
      </main>
      <SiteFooter />

      <Sheet
        open={Boolean(selectedProduct)}
        onOpenChange={(open) => {
          if (!open) setSelectedProductId(null);
        }}
      >
        <SheetContent className="w-[min(94vw,34rem)] overflow-y-auto sm:max-w-xl">
          {selectedProduct ? (
            <>
              <SheetHeader className="pr-8 text-left">
                <SheetTitle>{selectedProduct.product}</SheetTitle>
                <SheetDescription>
                  Prices and live availability for {dateLabel(date)}.
                </SheetDescription>
              </SheetHeader>
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.product}
                className="mt-5 aspect-[4/3] w-full rounded-3xl object-cover"
              />
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
                  {selectedProduct.marketCategory || selectedProduct.crop}
                </span>
                <span className="rounded-full bg-muted px-3 py-1.5">
                  Sold per {sellingUnitLabel(selectedProduct.sellingUnit)}
                </span>
                <span className="rounded-full bg-muted px-3 py-1.5">
                  {selectedProduct.availableQuantity} available
                </span>
              </div>
              {selectedProduct.description ? (
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {selectedProduct.description}
                </p>
              ) : null}
              <div className="mt-6 space-y-3">
                {classifications.map((quality) => {
                  const offer = selectedProduct.offers[quality.toLowerCase() as QualityKey];
                  if (!offer) return null;
                  const movement = movementLabel(offer.change);
                  const MovementIcon = movement.icon;
                  return (
                    <div key={quality} className="rounded-2xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`font-semibold ${qualityColor[quality]}`}>{quality}</p>
                          <p className="mt-1 text-2xl font-semibold">
                            ₱{offer.price.toFixed(2)}
                            <span className="ml-1 text-sm font-normal text-muted-foreground">
                              / {sellingUnitLabel(selectedProduct.sellingUnit)}
                            </span>
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                          {offer.availableQuantity} available
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <MovementIcon className="size-3.5" /> {movement.text}
                      </p>
                      {buyerSignedIn ? (
                        <div className="mt-4 flex gap-2 border-t border-border pt-4">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            aria-label={`Target price for ${quality}`}
                            value={alertTargets[offer.listingId] ?? ""}
                            onChange={(event) =>
                              setAlertTargets((current) => ({
                                ...current,
                                [offer.listingId]: event.target.value,
                              }))
                            }
                            placeholder="Target price"
                          />
                          <Button
                            variant="outline"
                            className="shrink-0 rounded-xl"
                            disabled={savingAlert === offer.listingId}
                            onClick={() => void saveAlert(offer)}
                          >
                            <Bell className="size-4" />
                            {savingAlert === offer.listingId ? "Saving…" : "Set alert"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {!buyerSignedIn ? (
                <p className="mt-5 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
                  Buyer accounts can set a notification when a quality reaches a preferred price.
                </p>
              ) : null}
              <Button asChild className="mt-6 w-full rounded-full">
                <Link
                  to="/marketplace/$productId"
                  params={{ productId: selectedProduct.productId }}
                >
                  <ShoppingBag className="size-4" /> View in marketplace
                </Link>
              </Button>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PriceCell({ offer, unit }: { offer: PriceOffer | undefined; unit: SellingUnit }) {
  if (!offer) return <span className="text-muted-foreground">—</span>;
  const movement = movementLabel(offer.change);
  const MovementIcon = movement.icon;
  return (
    <div>
      <p className="font-semibold">
        ₱{offer.price.toFixed(2)} / {sellingUnitLabel(unit)}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <MovementIcon className="size-3.5" /> {movement.text}
      </p>
    </div>
  );
}

function PriceTableRow({ item, onOpen }: { item: ProductRow; onOpen: () => void }) {
  return (
    <tr className="border-t border-border transition-colors hover:bg-muted/25">
      <td className="px-5 py-4">
        <button type="button" className="flex items-center gap-3 text-left" onClick={onOpen}>
          <img src={item.imageUrl} alt="" className="size-12 rounded-xl object-cover" />
          <span>
            <span className="block font-semibold">{item.product}</span>
            <span className="text-xs text-muted-foreground">{item.crop}</span>
          </span>
        </button>
      </td>
      <td className="px-5 py-4">
        <span className="block text-xs font-medium">{item.marketCategory || "Other"}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          per {sellingUnitLabel(item.sellingUnit)}
        </span>
      </td>
      <td className="px-5 py-4 text-good">
        <PriceCell offer={item.offers.good} unit={item.sellingUnit} />
      </td>
      <td className="px-5 py-4 text-semi">
        <PriceCell offer={item.offers.semi} unit={item.sellingUnit} />
      </td>
      <td className="px-5 py-4 text-reject">
        <PriceCell offer={item.offers.reject} unit={item.sellingUnit} />
      </td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <PackageCheck className="size-3.5" /> {item.availableQuantity} available
        </span>
      </td>
      <td className="px-5 py-4">
        <Button variant="outline" size="sm" className="rounded-full" onClick={onOpen}>
          View details
        </Button>
      </td>
    </tr>
  );
}

function PriceMobileCard({ item, onOpen }: { item: ProductRow; onOpen: () => void }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <img src={item.imageUrl} alt={item.product} className="aspect-[16/8] w-full object-cover" />
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{item.product}</h3>
              <p className="text-xs text-muted-foreground">
                {item.marketCategory || item.crop} · per {sellingUnitLabel(item.sellingUnit)}
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {item.availableQuantity} available
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {classifications.map((quality) => {
              const offer = item.offers[quality.toLowerCase() as QualityKey];
              return (
                <div key={quality} className="rounded-xl bg-muted/45 p-2.5">
                  <p className={`text-xs font-semibold ${qualityColor[quality]}`}>{quality}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {offer ? `₱${offer.price.toFixed(2)}` : "—"}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-sm font-semibold text-primary">View details</p>
        </div>
      </button>
    </article>
  );
}

function PriceLoadingState() {
  return (
    <div className="space-y-3 p-5" aria-label="Loading daily prices">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="flex animate-pulse items-center gap-3 rounded-2xl border border-border p-4"
        >
          <div className="size-12 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="hidden h-8 w-64 rounded bg-muted sm:block" />
        </div>
      ))}
    </div>
  );
}

type QualityKey = "good" | "semi" | "reject";
type PriceOffer = DailyPriceEntry & { change: number | null };
type ProductRow = {
  productId: string;
  product: string;
  crop: string;
  description: string;
  imageUrl: string;
  sellingUnit: SellingUnit;
  marketCategory: string | null;
  availableQuantity: number;
  updatedAt: string;
  offers: Partial<Record<QualityKey, PriceOffer>>;
};
type DailyPriceEntry = {
  id: string;
  listingId: string;
  productId: string;
  date: string;
  product: string;
  cropType: string;
  sellingUnit: SellingUnit;
  description: string | null;
  imageUrl: string | null;
  classification: Classification;
  price: number;
  availableQuantity: number;
  createdAt: string;
  status: "Published" | "Hidden";
};
