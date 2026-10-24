import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, CalendarDays, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { Input } from "@/components/ui/input";
import { PaginationControls, usePagination } from "@/components/data/pagination-controls";
import type { Classification } from "@/features/marketplace/products";
import {
  procyCategoryOrder,
  procyMarketCategories,
  procyMarketCategoryForProduct,
} from "@/features/marketplace/procy-market-categories";
import { getPublicDailyPrices } from "@/services/marketplace/marketplace-server-functions";

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

function DailyPricesPage() {
  const [date, setDate] = useState("");
  const [entries, setEntries] = useState<DailyPriceEntry[]>([]);
  const [chartProduct, setChartProduct] = useState("Tomato");
  const [marketCategory, setMarketCategory] = useState("");

  useEffect(() => {
    void getPublicDailyPrices().then((dailyPrices) => {
      setEntries(dailyPrices);
      setDate((current) => current || dailyPrices.at(-1)?.date || "");
    });
  }, []);

  const label = new Date(`${date}T12:00:00`).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const publishedEntries = useMemo(
    () => entries.filter((entry) => entry.date === date && entry.status === "Published"),
    [entries, date],
  );
  const productRows = useMemo(
    () =>
      [...new Set(entries.map((entry) => entry.product))]
        .map((name) => {
          const product = entries.find((item) => item.product === name)!;
          const values = Object.fromEntries(
            publishedEntries
              .filter((entry) => entry.product === name)
              .map((entry) => [entry.classification.toLowerCase(), entry.price]),
          );
          return {
            product: name,
            crop: product.cropType,
            marketCategory: procyMarketCategoryForProduct(name),
            good: values["good"],
            semi: values["semi"],
            reject: values["reject"],
          };
        })
        .sort(
          (first, second) =>
            procyCategoryOrder(first.marketCategory) - procyCategoryOrder(second.marketCategory) ||
            first.product.localeCompare(second.product),
        ),
    [entries, publishedEntries],
  );
  const chartData = useMemo(
    () =>
      [...new Set(entries.map((entry) => entry.date))].sort().map((historyDate) => {
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
      }),
    [entries, chartProduct],
  );
  const visibleProductRows = useMemo(
    () =>
      marketCategory
        ? productRows.filter((item) => item.marketCategory === marketCategory)
        : productRows,
    [marketCategory, productRows],
  );
  const productRowsPage = usePagination(visibleProductRows);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Market information
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold md:text-5xl">Daily Vegetable Prices</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Published PROCY marketplace prices, shown separately for Good, Semi, and Reject
              classifications.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
            <CalendarDays className="size-4" />
            <Input
              aria-label="Select price date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-7 w-36 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Showing published price information for{" "}
          <span className="font-medium text-foreground">{label}</span>.
        </p>

        <div className="mt-8 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <BarChart3 className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            <span className="font-semibold">Daily PROCY pricing:</span> Marketers publish and manage
            these saved price records. Hidden entries are not shown to public visitors.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <span className="font-semibold text-foreground">PROCY market categories:</span> Lowland
          Crops, Highland Crops, Fruits, Root Crops, Staple Crops, and Other Commodities. These
          labels organize the price guide and do not replace Good, Semi, or Reject quality classes.
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">Price per kilogram</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A dash means that classification has no published price for this date.
              </p>
            </div>
            <label className="space-y-1 text-sm font-medium">
              <span className="text-muted-foreground">PROCY market category</span>
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
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">PROCY market category</th>
                  <th className="px-6 py-4">Crop Type</th>
                  <th className="px-6 py-4">Good</th>
                  <th className="px-6 py-4">Semi</th>
                  <th className="px-6 py-4">Reject</th>
                </tr>
              </thead>
              <tbody>
                {productRowsPage.pageItems.map((item) => (
                  <tr key={item.product} className="border-t border-border">
                    <td className="px-6 py-4 font-semibold">{item.product}</td>
                    <td className="px-6 py-4">
                      {item.marketCategory ? (
                        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                          {item.marketCategory}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not in PROCY guide</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{item.crop}</td>
                    <td className="px-6 py-4 font-medium text-good">
                      {item.good ? `₱${item.good}` : "—"}
                    </td>
                    <td className="px-6 py-4 font-medium text-semi">
                      {item.semi ? `₱${item.semi}` : "—"}
                    </td>
                    <td className="px-6 py-4 font-medium text-reject">
                      {item.reject ? `₱${item.reject}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls {...productRowsPage} itemLabel="priced products" />
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">Price history comparison</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare Good, Semi, and Reject published prices for one PROCY vegetable.
              </p>
            </div>
            <AppSelect
              value={chartProduct}
              onValueChange={setChartProduct}
              options={[...new Set(entries.map((entry) => entry.product))].map((name) => ({
                value: name,
                label: name,
              }))}
            />
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₱${value}`} />
                <Tooltip formatter={(value) => [`₱${Number(value).toFixed(2)}`, "Price per kg"]} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="good"
                  name="Good"
                  stroke="var(--good)"
                  strokeWidth={3}
                  connectNulls
                  dot={{ r: 4, fill: "var(--good)" }}
                />
                <Line
                  type="monotone"
                  dataKey="semi"
                  name="Semi"
                  stroke="var(--semi)"
                  strokeWidth={3}
                  connectNulls
                  dot={{ r: 4, fill: "var(--semi)" }}
                />
                <Line
                  type="monotone"
                  dataKey="reject"
                  name="Reject"
                  stroke="var(--reject)"
                  strokeWidth={3}
                  connectNulls
                  dot={{ r: 4, fill: "var(--reject)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <Button asChild className="mt-8 rounded-full">
          <Link to="/marketplace">Browse marketplace products</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
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
