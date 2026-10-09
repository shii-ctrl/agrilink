import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls, usePagination } from "@/components/pagination-controls";
import type { Classification } from "@/lib/products";
import {
  getMarketplaceListings,
  getMarketerDailyPrices,
  publishDailyPrice,
  setDailyPricePublished,
} from "@/lib/marketplace-server-functions";

export const Route = createFileRoute("/marketer/daily-prices")({
  component: MarketerDailyPricesPage,
});

function MarketerDailyPricesPage() {
  const [entries, setEntries] = useState<DailyPriceEntry[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    void Promise.all([getMarketerDailyPrices(), getMarketplaceListings()]).then(
      ([dailyPrices, marketplaceListings]) => {
        setEntries(dailyPrices);
        setListings(marketplaceListings);
        setSelectedDate((current) => current || dailyPrices.at(-1)?.date || "");
      },
    );
  }, []);

  const dateEntries = useMemo(
    () => entries.filter((entry) => entry.date === selectedDate),
    [entries, selectedDate],
  );
  const pricesPage = usePagination(dateEntries);

  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Daily Prices & Deals"
        description="Publish PROCY daily product prices. Published entries appear immediately on the public Daily Prices page."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <span className="font-semibold">Shared price history:</span> published prices are visible
          publicly for their selected date, while hidden prices remain internal.
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex gap-3">
              <Tag className="mt-0.5 size-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Publish daily price</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Publishing again for the same date and classification updates that price.
                </p>
              </div>
            </div>
            <form
              className="mt-6 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                try {
                  await publishDailyPrice({
                    data: {
                      date: String(data.get("date")),
                      listingId: String(data.get("listingId")),
                      price: Number(data.get("price")),
                    },
                  });
                  const refreshed = await getMarketerDailyPrices();
                  setEntries(refreshed);
                  setSelectedDate(String(data.get("date")));
                  form.reset();
                  toast.success("Daily price published", {
                    description:
                      "The public Daily Prices page now shows this entry for the selected date.",
                  });
                } catch (error) {
                  toast.error("Daily price could not be saved", {
                    description: error instanceof Error ? error.message : "Please try again.",
                  });
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="date">Price date</Label>
                <Input id="date" name="date" type="date" defaultValue={selectedDate} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="listingId">Product classification</Label>
                <select
                  id="listingId"
                  name="listingId"
                  defaultValue=""
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Select a classified listing
                  </option>
                  {listings.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} — {product.classification}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price per kg (₱)</Label>
                <Input id="price" name="price" type="number" min="0.01" step="0.01" required />
              </div>
              <Button type="submit" className="rounded-full">
                Publish daily price
              </Button>
            </form>
          </section>
          <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold">Published price history</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review or hide entries for a selected price date.
                </p>
              </div>
              <Input
                aria-label="Select price history date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-40"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Classification</th>
                    <th className="px-6 py-4">Price / kg</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pricesPage.pageItems.map((entry) => (
                    <tr key={entry.id} className="border-t border-border">
                      <td className="px-6 py-4 font-medium">{entry.product}</td>
                      <td className="px-6 py-4">{entry.classification}</td>
                      <td className="px-6 py-4">₱{entry.price.toFixed(2)}</td>
                      <td className="px-6 py-4">{entry.status}</td>
                      <td className="px-6 py-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={async () => {
                            try {
                              await setDailyPricePublished({
                                data: { id: entry.id, published: entry.status !== "Published" },
                              });
                              setEntries(await getMarketerDailyPrices());
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
                      </td>
                    </tr>
                  ))}
                  {dateEntries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                        No price entries recorded for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls {...pricesPage} itemLabel="price entries" />
          </section>
        </div>
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
};
