import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, Pencil, RefreshCw, Tag, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import { ResponsiveFilterPanel } from "@/components/data/responsive-filter-panel";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import type { Classification } from "@/features/marketplace/products";
import { sellingUnitLabel, type SellingUnit } from "@/features/marketplace/selling-units";
import { procyMarketCategoryForProduct } from "@/features/marketplace/procy-market-categories";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import {
  getMarketplaceListings,
  getMarketerDailyPrices,
  publishDailyPrice,
  setDailyPricePublished,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketer/daily-prices")({
  component: MarketerDailyPricesPage,
});

const today = () => new Date().toLocaleDateString("en-CA");

function MarketerDailyPricesPage() {
  const [entries, setEntries] = useState<DailyPriceEntry[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [formDate, setFormDate] = useState(today);
  const [listingId, setListingId] = useState("");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [dailyPrices, marketplaceListings] = await Promise.all([
      getMarketerDailyPrices(),
      getMarketplaceListings(),
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

  const dateEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.date === selectedDate &&
          (!query ||
            `${entry.product} ${entry.classification} ${procyMarketCategoryForProduct(entry.product) ?? ""}`
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase())),
      ),
    [entries, query, selectedDate],
  );
  const pricesPage = usePagination(dateEntries);
  const editingEntry = entries.find((entry) => entry.id === editingId) ?? null;
  const selectedListing = listings.find((listing) => listing.id === listingId) ?? null;

  const resetForm = () => {
    setEditingId(null);
    setFormDate(today());
    setListingId("");
    setPrice("");
  };

  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Daily Prices & Deals"
        description="Publish PROCY daily product prices. Published entries appear immediately on the public Daily Prices page."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="daily-price workspace"
        />
        {!loading && !loadError ? (
          <>
            <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
              <span className="font-semibold">Shared price history:</span> published prices are
              visible publicly for their selected date, while hidden prices remain internal.
            </div>
            <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
              <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <div className="flex gap-3">
                  <Tag className="mt-0.5 size-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold">
                      {editingEntry ? `Edit ${editingEntry.product} price` : "Publish daily price"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {editingEntry
                        ? "Update the price, then save. Visibility stays under your control."
                        : "Choose a published product, date, and price. Today is selected by default."}
                    </p>
                  </div>
                </div>
                <form
                  className="mt-6 space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setSaving(true);
                    try {
                      await publishDailyPrice({
                        data: { date: formDate, listingId, price: Number(price) },
                      });
                      setSelectedDate(formDate);
                      await load();
                      toast.success(
                        editingEntry ? "Daily price updated" : "Daily price published",
                        {
                          description: "The selected price is now saved in AgriLink.",
                        },
                      );
                      resetForm();
                    } catch (error) {
                      toast.error("Daily price could not be saved", {
                        description: error instanceof Error ? error.message : "Please try again.",
                      });
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="date">Price date</Label>
                    <DatePicker
                      id="date"
                      value={formDate}
                      onValueChange={setFormDate}
                      disabled={Boolean(editingEntry)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="listingId">Product classification</Label>
                    <AppSelect
                      id="listingId"
                      value={listingId}
                      onValueChange={setListingId}
                      disabled={Boolean(editingEntry)}
                      placeholder="Select a published listing"
                      options={listings.map((product) => ({
                        value: product.id,
                        label: `[${procyMarketCategoryForProduct(product.name) ?? "Not in PROCY guide"}] ${product.name} — ${product.classification}`,
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      PROCY market categories are a guide for organizing prices. Good, Semi, and
                      Reject remain the listing quality classifications.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">
                      Price per {sellingUnitLabel(selectedListing?.sellingUnit ?? "kg")} (₱)
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" className="rounded-full" disabled={saving}>
                      {saving ? "Saving…" : editingEntry ? "Save price" : "Publish daily price"}
                    </Button>
                    {editingEntry ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={resetForm}
                      >
                        <X className="size-4" /> Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </form>
              </section>
              <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
                  <div>
                    <h2 className="text-lg font-semibold">Daily price history</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Review, edit, publish, or hide entries for one date.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => void load()}
                  >
                    <RefreshCw className="size-3.5" /> Refresh
                  </Button>
                </div>
                <ResponsiveFilterPanel
                  activeCount={Number(Boolean(query)) + Number(selectedDate !== today())}
                  contentClassName="md:grid-cols-2"
                >
                  <DatePicker
                    ariaLabel="Select price history date"
                    value={selectedDate}
                    onValueChange={setSelectedDate}
                  />
                  <Input
                    aria-label="Search price history"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search product, category, or quality"
                  />
                </ResponsiveFilterPanel>
                <div className="overflow-x-auto md:overflow-visible">
                  <table data-responsive-table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-6 py-4">Product</th>
                        <th className="px-6 py-4">PROCY market category</th>
                        <th className="px-6 py-4">Classification</th>
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
                          <td data-label="PROCY market category" className="px-6 py-4">
                            {procyMarketCategoryForProduct(entry.product) ?? "Not in PROCY guide"}
                          </td>
                          <td data-label="Classification" className="px-6 py-4">
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
                                className="rounded-full"
                                onClick={() => {
                                  setEditingId(entry.id);
                                  setFormDate(entry.date);
                                  setListingId(entry.listingId);
                                  setPrice(String(entry.price));
                                }}
                              >
                                <Pencil className="size-3" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                onClick={async () => {
                                  try {
                                    await setDailyPricePublished({
                                      data: {
                                        id: entry.id,
                                        published: entry.status !== "Published",
                                      },
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
                                        error instanceof Error
                                          ? error.message
                                          : "Please try again.",
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
                          <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
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
          </>
        ) : null}
      </main>
    </MarketerLayout>
  );
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
};
