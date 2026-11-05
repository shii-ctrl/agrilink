import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  RefreshCw,
  Search,
  Tag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/ui/toast";

import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { ResponsiveFilterPanel } from "@/components/data/responsive-filter-panel";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import type { Classification } from "@/features/marketplace/products";
import { procyMarketCategoryForProduct } from "@/features/marketplace/procy-market-categories";
import { sellingUnitLabel, type SellingUnit } from "@/features/marketplace/selling-units";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import {
  getMarketerDailyPrices,
  getMarketerMarketplaceListings,
  publishDailyPricesBulk,
  setDailyPricePublished,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketer/daily-prices")({
  component: MarketerDailyPricesPage,
});

const today = () => new Date().toLocaleDateString("en-CA");
const draftKey = (date: string) => `agrilink:daily-price-draft:${date}`;

function MarketerDailyPricesPage() {
  const [entries, setEntries] = useState<DailyPriceEntry[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [priceDate, setPriceDate] = useState(today);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draftReadyFor, setDraftReadyFor] = useState<string | null>(null);
  const [publisherQuery, setPublisherQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [qualityFilter, setQualityFilter] = useState<Classification>("Good");
  const [selectedDate, setSelectedDate] = useState(today);
  const [historyQuery, setHistoryQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    const [dailyPrices, marketplaceListings] = await Promise.all([
      getMarketerDailyPrices(),
      getMarketerMarketplaceListings(),
    ]);
    setEntries(dailyPrices);
    setListings(marketplaceListings);
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

  const publishedListings = useMemo(
    () =>
      listings
        .filter((listing) => listing.status === "published")
        .sort((left, right) => {
          const stockOrder = Number(right.quantityKg > 0) - Number(left.quantityKg > 0);
          return (
            stockOrder ||
            left.name.localeCompare(right.name) ||
            qualityRank(left.classification) - qualityRank(right.classification)
          );
        }),
    [listings],
  );
  const categoryOptions = useMemo(
    () =>
      [...new Set(publishedListings.map((listing) => categoryFor(listing.name)))]
        .sort()
        .map((category) => ({ value: category, label: category })),
    [publishedListings],
  );
  const qualityListings = useMemo(
    () => publishedListings.filter((listing) => listing.classification === qualityFilter),
    [publishedListings, qualityFilter],
  );
  const visibleListings = useMemo(() => {
    const query = publisherQuery.trim().toLocaleLowerCase();
    return qualityListings.filter((listing) => {
      const category = categoryFor(listing.name);
      const matchesCategory = categoryFilter === "all" || category === categoryFilter;
      const matchesQuery =
        !query ||
        `${listing.name} ${listing.classification} ${category} ${sellingUnitLabel(listing.sellingUnit)}`
          .toLocaleLowerCase()
          .includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [categoryFilter, publisherQuery, qualityListings]);

  const currentPriceByListing = useMemo(
    () =>
      new Map(
        entries
          .filter((entry) => entry.date === priceDate)
          .map((entry) => [entry.listingId, entry]),
      ),
    [entries, priceDate],
  );
  const previousPriceByListing = useMemo(() => {
    const previous = new Map<string, DailyPriceEntry>();
    entries.forEach((entry) => {
      if (entry.date >= priceDate) return;
      const saved = previous.get(entry.listingId);
      if (!saved || saved.date < entry.date) previous.set(entry.listingId, entry);
    });
    return previous;
  }, [entries, priceDate]);

  useEffect(() => {
    if (loading) return;
    const savedPrices = Object.fromEntries(
      [...currentPriceByListing.entries()].map(([listingId, entry]) => [
        listingId,
        String(entry.price),
      ]),
    );
    let draft: PriceDraft | null = null;
    try {
      const rawDraft = window.localStorage.getItem(draftKey(priceDate));
      draft = rawDraft ? (JSON.parse(rawDraft) as PriceDraft) : null;
    } catch {
      draft = null;
    }
    const validListingIds = new Set(publishedListings.map((listing) => listing.id));
    setPrices({ ...savedPrices, ...(draft?.prices ?? {}) });
    setSelectedIds(
      (draft?.selectedIds ?? Object.keys(savedPrices)).filter((id) => validListingIds.has(id)),
    );
    setDraftReadyFor(priceDate);
  }, [currentPriceByListing, loading, priceDate, publishedListings]);

  useEffect(() => {
    if (draftReadyFor !== priceDate) return;
    window.localStorage.setItem(draftKey(priceDate), JSON.stringify({ prices, selectedIds }));
  }, [draftReadyFor, priceDate, prices, selectedIds]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPrices = useMemo(
    () =>
      qualityListings
        .filter((listing) => selectedSet.has(listing.id))
        .map((listing) => ({ listing, price: Number(prices[listing.id]) }))
        .filter((entry) => Number.isFinite(entry.price) && entry.price > 0),
    [prices, qualityListings, selectedSet],
  );
  const selectedQualityCount = qualityListings.filter((listing) =>
    selectedSet.has(listing.id),
  ).length;
  const invalidSelectedCount = selectedQualityCount - selectedPrices.length;
  const allVisibleSelected =
    visibleListings.length > 0 && visibleListings.every((listing) => selectedSet.has(listing.id));

  const dateEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.date === selectedDate &&
          (!historyQuery ||
            `${entry.product} ${entry.classification} ${categoryFor(entry.product)}`
              .toLocaleLowerCase()
              .includes(historyQuery.trim().toLocaleLowerCase())),
      ),
    [entries, historyQuery, selectedDate],
  );
  const pricesPage = usePagination(dateEntries);

  const toggleListing = (listingId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, listingId])] : current.filter((id) => id !== listingId),
    );
  };

  const copyPreviousPrices = () => {
    const copied = qualityListings.filter((listing) => previousPriceByListing.has(listing.id));
    if (!copied.length) {
      toast.warning("No earlier prices are available to copy.");
      return;
    }
    setPrices((current) => ({
      ...current,
      ...Object.fromEntries(
        copied.map((listing) => [
          listing.id,
          String(previousPriceByListing.get(listing.id)!.price),
        ]),
      ),
    }));
    setSelectedIds((current) => [...new Set([...current, ...copied.map((listing) => listing.id)])]);
    toast.success(
      `${copied.length} previous ${qualityFilter} ${copied.length === 1 ? "price" : "prices"} copied.`,
    );
  };

  const clearQualityDraft = () => {
    const qualityIds = new Set(qualityListings.map((listing) => listing.id));
    setPrices((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => !qualityIds.has(id))),
    );
    setSelectedIds((current) => current.filter((id) => !qualityIds.has(id)));
    toast.success(`${qualityFilter} price draft cleared.`);
  };

  const publishSelectedPrices = async () => {
    if (!selectedPrices.length || invalidSelectedCount > 0) return;
    setSaving(true);
    try {
      const result = await publishDailyPricesBulk({
        data: {
          date: priceDate,
          prices: selectedPrices.map(({ listing, price }) => ({ listingId: listing.id, price })),
        },
      });
      const publishedIds = new Set(selectedPrices.map(({ listing }) => listing.id));
      const remainingPrices = Object.fromEntries(
        Object.entries(prices).filter(([id]) => !publishedIds.has(id)),
      );
      const remainingSelectedIds = selectedIds.filter((id) => !publishedIds.has(id));
      window.localStorage.setItem(
        draftKey(priceDate),
        JSON.stringify({ prices: remainingPrices, selectedIds: remainingSelectedIds }),
      );
      setPrices(remainingPrices);
      setSelectedIds(remainingSelectedIds);
      setSelectedDate(priceDate);
      setReviewOpen(false);
      await load();
      toast.success(`${result.count} ${result.count === 1 ? "price" : "prices"} published`, {
        description: `${result.created} new and ${result.updated} updated for ${formatDate(priceDate)}.`,
      });
    } catch (error) {
      toast.error("Daily prices could not be published", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Daily Prices & Deals"
        description="Update Good, Semi, or Reject prices separately and publish each quality in one batch."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="daily-price workspace"
        />
        {!loading && !loadError ? (
          <div className="space-y-8">
            <section
              id="bulk-price-publisher"
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
            >
              <div className="flex flex-col gap-5 border-b border-border px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <Tag className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">Publish daily prices</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      Choose one quality, then enter only the prices that apply. Blank and unchecked
                      rows will be skipped.
                    </p>
                  </div>
                </div>
                <div className="w-full space-y-2 sm:w-64">
                  <Label htmlFor="bulk-price-date">Prices for</Label>
                  <DatePicker id="bulk-price-date" value={priceDate} onValueChange={setPriceDate} />
                </div>
              </div>

              <div className="border-b border-border px-5 py-4 sm:px-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quality to update
                </p>
                <div
                  className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1.5"
                  role="tablist"
                  aria-label="Choose product quality to update"
                >
                  {(["Good", "Semi", "Reject"] as const).map((quality) => {
                    const count = publishedListings.filter(
                      (listing) => listing.classification === quality,
                    ).length;
                    return (
                      <Button
                        key={quality}
                        type="button"
                        size="sm"
                        variant={qualityFilter === quality ? "default" : "ghost"}
                        role="tab"
                        aria-selected={qualityFilter === quality}
                        className="w-full"
                        onClick={() => setQualityFilter(quality)}
                      >
                        {quality} ({count})
                      </Button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Only {qualityFilter} prices are shown and included when you publish this tab.
                </p>
              </div>

              <ResponsiveFilterPanel
                title={`Find ${qualityFilter} products`}
                activeCount={Number(Boolean(publisherQuery)) + Number(categoryFilter !== "all")}
                contentClassName="md:grid-cols-[1fr_260px]"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search products to price"
                    value={publisherQuery}
                    onChange={(event) => setPublisherQuery(event.target.value)}
                    placeholder="Search product, quality, or unit"
                    className="pl-9"
                  />
                </div>
                <AppSelect
                  ariaLabel="Filter products by category"
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  options={[{ value: "all", label: "All categories" }, ...categoryOptions]}
                />
              </ResponsiveFilterPanel>

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => {
                      const visibleIds = visibleListings.map((listing) => listing.id);
                      setSelectedIds((current) =>
                        checked
                          ? [...new Set([...current, ...visibleIds])]
                          : current.filter((id) => !visibleIds.includes(id)),
                      );
                    }}
                  />
                  Select shown ({visibleListings.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={copyPreviousPrices}>
                    <Copy className="size-4" /> Copy previous prices
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const availableIds = visibleListings
                        .filter((listing) => listing.quantityKg > 0)
                        .map((listing) => listing.id);
                      setSelectedIds((current) => [...new Set([...current, ...availableIds])]);
                    }}
                  >
                    Select in-stock
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={clearQualityDraft}>
                    Clear {qualityFilter} draft
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto md:overflow-visible">
                <table data-responsive-table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="w-14 px-5 py-4 sm:px-6">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="px-5 py-4 sm:px-6">Product</th>
                      <th className="px-5 py-4 sm:px-6">Availability</th>
                      <th className="px-5 py-4 sm:px-6">Previous price</th>
                      <th className="w-56 px-5 py-4 sm:px-6">New price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleListings.map((listing) => {
                      const previous = previousPriceByListing.get(listing.id);
                      const current = currentPriceByListing.get(listing.id);
                      const checked = selectedSet.has(listing.id);
                      return (
                        <tr key={listing.id} className="border-t border-border align-middle">
                          <td data-label="Select" className="px-5 py-4 sm:px-6">
                            <Checkbox
                              aria-label={`Select ${listing.name} ${listing.classification}`}
                              checked={checked}
                              onCheckedChange={(value) => toggleListing(listing.id, value === true)}
                            />
                          </td>
                          <td data-label="Product" className="px-5 py-4 sm:px-6">
                            <p className="font-semibold">{listing.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {listing.classification} · {categoryFor(listing.name)}
                            </p>
                          </td>
                          <td data-label="Availability" className="px-5 py-4 sm:px-6">
                            <span
                              className={
                                listing.quantityKg > 0 ? "text-primary" : "text-muted-foreground"
                              }
                            >
                              {listing.quantityKg > 0
                                ? `${listing.quantityKg} ${sellingUnitLabel(listing.sellingUnit)} available`
                                : "No stock"}
                            </span>
                          </td>
                          <td data-label="Previous price" className="px-5 py-4 sm:px-6">
                            {previous ? (
                              <div>
                                <p className="font-medium">₱{previous.price.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(previous.date)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No earlier price</span>
                            )}
                          </td>
                          <td data-label="New price" className="px-5 py-4 sm:px-6">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">₱</span>
                              <Input
                                aria-label={`New price for ${listing.name} ${listing.classification}`}
                                type="number"
                                inputMode="decimal"
                                min="0.01"
                                max="100000"
                                step="0.01"
                                value={prices[listing.id] ?? ""}
                                placeholder={current ? String(current.price) : "Enter price"}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setPrices((saved) => ({ ...saved, [listing.id]: value }));
                                  if (value) toggleListing(listing.id, true);
                                }}
                                className="min-w-0"
                              />
                              <span className="whitespace-nowrap text-xs text-muted-foreground">
                                / {sellingUnitLabel(listing.sellingUnit)}
                              </span>
                            </div>
                            {current ? (
                              <p className="mt-1 text-xs text-primary">Published for this date</p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                    {visibleListings.length === 0 ? (
                      <tr>
                        <td
                          data-mobile-full
                          colSpan={5}
                          className="px-6 py-10 text-center text-muted-foreground"
                        >
                          No published {qualityFilter} products match these filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="sticky bottom-3 z-20 m-3 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-background/95 p-4 shadow-field backdrop-blur sm:m-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {selectedPrices.length} valid {qualityFilter.toLocaleLowerCase()}{" "}
                    {selectedPrices.length === 1 ? "price" : "prices"} ready
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Draft changes are saved on this device.
                    {invalidSelectedCount > 0
                      ? ` Add a valid price to ${invalidSelectedCount} selected ${invalidSelectedCount === 1 ? "row" : "rows"}.`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  className="sm:min-w-52"
                  disabled={!selectedPrices.length || invalidSelectedCount > 0}
                  onClick={() => setReviewOpen(true)}
                >
                  Review and publish <ArrowRight className="size-4" />
                </Button>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold">Daily price history</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review, update, publish, or hide saved prices for one date.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                  <RefreshCw className="size-3.5" /> Refresh
                </Button>
              </div>
              <ResponsiveFilterPanel
                activeCount={Number(Boolean(historyQuery)) + Number(selectedDate !== today())}
                contentClassName="md:grid-cols-2"
              >
                <DatePicker
                  ariaLabel="Select price history date"
                  value={selectedDate}
                  onValueChange={setSelectedDate}
                />
                <Input
                  aria-label="Search price history"
                  value={historyQuery}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                  placeholder="Search product, category, or quality"
                />
              </ResponsiveFilterPanel>
              <div className="overflow-x-auto md:overflow-visible">
                <table data-responsive-table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Product</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Quality</th>
                      <th className="px-6 py-4">Unit price</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricesPage.pageItems.map((entry) => (
                      <tr key={entry.id} className="border-t border-border">
                        <td data-label="Product" className="px-6 py-4 font-medium">
                          {entry.product}
                        </td>
                        <td data-label="Category" className="px-6 py-4">
                          {categoryFor(entry.product)}
                        </td>
                        <td data-label="Quality" className="px-6 py-4">
                          {entry.classification}
                        </td>
                        <td data-label="Unit price" className="px-6 py-4">
                          ₱{entry.price.toFixed(2)} / {sellingUnitLabel(entry.sellingUnit)}
                        </td>
                        <td data-label="Status" className="px-6 py-4">
                          {entry.status}
                        </td>
                        <td data-label="Actions" className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setQualityFilter(entry.classification);
                                setPriceDate(entry.date);
                                setPrices((saved) => ({
                                  ...saved,
                                  [entry.listingId]: String(entry.price),
                                }));
                                toggleListing(entry.listingId, true);
                                requestAnimationFrame(() =>
                                  document
                                    .getElementById("bulk-price-publisher")
                                    ?.scrollIntoView({ behavior: "smooth" }),
                                );
                              }}
                            >
                              <Pencil className="size-3" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await setDailyPricePublished({
                                    data: { id: entry.id, published: entry.status !== "Published" },
                                  });
                                  await load();
                                  toast.success(
                                    entry.status === "Published"
                                      ? "Daily price hidden"
                                      : "Daily price published",
                                  );
                                } catch (error) {
                                  toast.error("Price visibility could not be changed", {
                                    description:
                                      error instanceof Error ? error.message : "Please try again.",
                                  });
                                }
                              }}
                            >
                              {entry.status === "Published" ? (
                                <>
                                  <EyeOff className="size-3" /> Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="size-3" /> Publish
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {dateEntries.length === 0 ? (
                      <tr>
                        <td
                          data-mobile-full
                          colSpan={6}
                          className="px-6 py-10 text-center text-muted-foreground"
                        >
                          No price entries match this date and search.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...pricesPage} itemLabel="price entries" />
            </section>
          </div>
        ) : null}
      </main>

      <Dialog open={reviewOpen} onOpenChange={(open) => !saving && setReviewOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review daily prices</DialogTitle>
            <DialogDescription>
              Confirm {selectedPrices.length} {qualityFilter}{" "}
              {selectedPrices.length === 1 ? "price" : "prices"} for {formatDate(priceDate)}.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border rounded-2xl border border-border">
            {selectedPrices.map(({ listing, price }) => {
              const previous = previousPriceByListing.get(listing.id);
              return (
                <div
                  key={listing.id}
                  className="flex items-center justify-between gap-4 p-4 text-sm"
                >
                  <div>
                    <p className="font-semibold">
                      {listing.name} · {listing.classification}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      per {sellingUnitLabel(listing.sellingUnit)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    {previous ? (
                      <span className="text-muted-foreground">₱{previous.price.toFixed(2)}</span>
                    ) : null}
                    {previous ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
                    <span className="font-semibold text-primary">₱{price.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-accent p-4 text-sm text-accent-foreground">
            <CalendarDays className="mt-0.5 size-4 shrink-0" />
            Published prices will appear on the public Daily Prices page when the product quality
            has available stock.
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setReviewOpen(false)}
            >
              Go back
            </Button>
            <Button type="button" disabled={saving} onClick={() => void publishSelectedPrices()}>
              {saving
                ? "Publishing…"
                : `Publish ${selectedPrices.length} ${qualityFilter} ${selectedPrices.length === 1 ? "price" : "prices"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MarketerLayout>
  );
}

function categoryFor(productName: string) {
  return procyMarketCategoryForProduct(productName) ?? "Other Commodities";
}

function qualityRank(classification: Classification) {
  return ["Good", "Semi", "Reject"].indexOf(classification);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type PriceDraft = {
  prices: Record<string, string>;
  selectedIds: string[];
};

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

type MarketplaceListing = {
  id: string;
  name: string;
  cropType: string;
  classification: Classification;
  pricePerKg: number;
  quantityKg: number;
  description: string;
  image: string;
  sellingUnit: SellingUnit;
  status: "draft" | "published" | "unavailable" | "archived";
};
