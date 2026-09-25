import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CircleAlert, LineChart, PackageSearch, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ManagementLayout, ManagementPageHeader } from "@/components/management-layout";
import { getDemoInventory, subscribeDemoInventory } from "@/lib/demo-inventory";
import { getDemoOrders, subscribeDemoOrders, type DemoOrder } from "@/lib/demo-orders";
import {
  getDemoDailyPrices,
  subscribeDemoDailyPrices,
  type DemoDailyPrice,
} from "@/lib/demo-prices";
import { peso, products } from "@/lib/products";

export const Route = createFileRoute("/management/decision-support")({
  head: () => ({
    meta: [
      { title: "Decision Support — Management | AgriLink" },
      {
        name: "description",
        content: "Management decision-support calculated from AgriLink demo records.",
      },
    ],
  }),
  component: ManagementDecisionSupportPage,
});

type ProductSummary = { name: string; supply: number; ordered: number; sold: number };

function orderLines(order: DemoOrder) {
  if (order.items?.length) return order.items;
  const listing = products.find(
    (product) => product.name === order.product && product.classification === order.classification,
  );
  return listing
    ? [
        {
          listingId: listing.id,
          name: listing.name,
          classification: listing.classification,
          quantityKg: Number.parseFloat(order.quantity) || 0,
          pricePerKg: listing.pricePerKg,
        },
      ]
    : [];
}

function recordRange(values: string[], fallback: string) {
  const dates = values
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => first.getTime() - second.getTime());
  if (!dates.length) return fallback;
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  if (!firstDate || !lastDate) return fallback;
  const format = (date: Date) =>
    date.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  return dates.length === 1 ? format(firstDate) : `${format(firstDate)} – ${format(lastDate)}`;
}

function ManagementDecisionSupportPage() {
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [dailyPrices, setDailyPrices] = useState<DemoDailyPrice[]>([]);

  useEffect(() => {
    setOrders(getDemoOrders());
    setInventory(getDemoInventory());
    setDailyPrices(getDemoDailyPrices());
    const unsubscribeOrders = subscribeDemoOrders(setOrders);
    const unsubscribeInventory = subscribeDemoInventory(setInventory);
    const unsubscribePrices = subscribeDemoDailyPrices(setDailyPrices);
    return () => {
      unsubscribeOrders();
      unsubscribeInventory();
      unsubscribePrices();
    };
  }, []);

  const summaries = useMemo<ProductSummary[]>(() => {
    const grouped = new Map<string, ProductSummary>();
    for (const listing of products) {
      const current = grouped.get(listing.name) ?? {
        name: listing.name,
        supply: 0,
        ordered: 0,
        sold: 0,
      };
      current.supply += inventory[listing.id] ?? listing.quantityKg;
      grouped.set(listing.name, current);
    }
    for (const order of orders) {
      for (const item of orderLines(order)) {
        const current = grouped.get(item.name) ?? {
          name: item.name,
          supply: 0,
          ordered: 0,
          sold: 0,
        };
        current.ordered += item.quantityKg;
        if (order.status === "Sold") current.sold += item.quantityKg;
        grouped.set(item.name, current);
      }
    }
    return [...grouped.values()].sort((first, second) => second.ordered - first.ordered);
  }, [inventory, orders]);

  const lowStock = useMemo(
    () =>
      products
        .map((listing) => ({ ...listing, available: inventory[listing.id] ?? listing.quantityKg }))
        .filter((listing) => listing.available <= 15)
        .sort((first, second) => first.available - second.available),
    [inventory],
  );
  const priceChanges = useMemo(() => {
    const published = dailyPrices.filter((entry) => entry.status === "Published");
    return products
      .map((listing) => {
        const history = published
          .filter((entry) => entry.listingId === listing.id)
          .sort((first, second) => first.date.localeCompare(second.date));
        const latest = history.at(-1);
        const previous = history.at(-2);
        return latest
          ? {
              id: listing.id,
              label: `${listing.name} — ${listing.classification}`,
              latest: latest.price,
              previous: previous?.price ?? latest.price,
              range: recordRange(
                history.map((entry) => entry.date),
                "No published dates",
              ),
            }
          : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [dailyPrices]);

  const totalSupply = summaries.reduce((total, item) => total + item.supply, 0);
  const totalOrdered = summaries.reduce((total, item) => total + item.ordered, 0);
  const totalSold = summaries.reduce((total, item) => total + item.sold, 0);
  const orderRange = recordRange(
    orders.map((order) => order.date),
    "Current demo session",
  );
  const priceRange = recordRange(
    dailyPrices.map((entry) => entry.date),
    "No published price records",
  );

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Decision Support"
        description="Live summaries calculated from current demo inventory, buyer orders, sales, and published daily prices."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="rounded-3xl border border-primary/20 bg-accent p-5 text-sm text-accent-foreground">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Calculated from current records</h2>
              <p className="mt-1 opacity-85">
                Orders: {orderRange}. Published daily prices: {priceRange}. These browser-demo
                figures refresh whenever the related records change.
              </p>
            </div>
          </div>
        </section>
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Available supply",
              value: `${totalSupply} kg`,
              detail: "Across current classified listings",
              icon: PackageSearch,
            },
            {
              label: "Buyer-ordered quantity",
              value: `${totalOrdered} kg`,
              detail: `Orders recorded ${orderRange}`,
              icon: BarChart3,
            },
            {
              label: "Completed sales",
              value: `${totalSold} kg`,
              detail: `${orders.filter((order) => order.status === "Sold").length} sold order(s)`,
              icon: TrendingUp,
            },
            {
              label: "Low-stock listings",
              value: String(lowStock.length),
              detail: "15 kg or less remaining",
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
                <h2 className="text-lg font-semibold">Supply versus buyer orders</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Current available supply compared with all orders from {orderRange}.
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
                    dataKey="supply"
                    name="Available supply"
                    fill="var(--primary)"
                    radius={[7, 7, 0, 0]}
                  />
                  <Bar
                    dataKey="ordered"
                    name="Buyer ordered"
                    fill="var(--chart-2)"
                    radius={[7, 7, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">Vegetable</th>
                    <th className="pb-3 font-medium">Available</th>
                    <th className="pb-3 font-medium">Ordered</th>
                    <th className="pb-3 font-medium">Sold</th>
                    <th className="pb-3 font-medium">Order coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((item) => (
                    <tr key={item.name} className="border-b last:border-0">
                      <td className="py-3 font-medium">{item.name}</td>
                      <td className="py-3">{item.supply} kg</td>
                      <td className="py-3">{item.ordered} kg</td>
                      <td className="py-3">{item.sold} kg</td>
                      <td className="py-3 font-medium">
                        {item.ordered <= item.supply
                          ? "Current stock covers recorded demand"
                          : `${item.ordered - item.supply} kg demand gap`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <div className="space-y-6">
            <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Best-selling vegetables</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sold quantities from {orderRange}.
              </p>
              <div className="mt-5 space-y-4">
                {summaries
                  .filter((item) => item.sold > 0)
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
                  <p className="text-sm text-muted-foreground">
                    No sold orders are recorded for this period.
                  </p>
                )}
              </div>
            </article>
            <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Low-stock attention</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Classified listings with 15 kg or less available now.
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
                      {item.available} kg left
                    </span>
                  </div>
                ))}
                {!lowStock.length && (
                  <p className="text-sm text-muted-foreground">
                    All classified listings are above the low-stock threshold.
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
                Latest price compared with the previous published date. Price history: {priceRange}.
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
        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <CircleAlert className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Decision-support boundaries</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                These insights summarize entered records for reference. AgriLink does not guarantee
                profit, income, sales, prices, buyers, harvests, or demand.
              </p>
            </div>
          </div>
        </section>
      </main>
    </ManagementLayout>
  );
}
