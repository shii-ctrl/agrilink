import { createFileRoute } from "@tanstack/react-router";
import { PackageX, Search, Sprout, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Input } from "@/components/ui/input";
import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getMarketerProductCatalog } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketer/rejects")({
  head: () => ({
    meta: [
      { title: "Reject Stock — Marketer | AgriLink" },
      {
        name: "description",
        content: "Review internal Reject stock and its Farmer ownership.",
      },
    ],
  }),
  component: MarketerRejectStockPage,
});

type Catalog = Awaited<ReturnType<typeof getMarketerProductCatalog>>;

type RejectRow = {
  key: string;
  productId: string;
  product: string;
  cropType: string;
  imageUrl: string | null;
  farmerId: string | null;
  farmer: string;
  availableKg: number;
  totalKg: number;
};

function MarketerRejectStockPage() {
  const [products, setProducts] = useState<Catalog>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProducts(await getMarketerProductCatalog());
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

  const rows = useMemo(() => aggregateRejectRows(products), [products]);
  const visibleRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        !value || `${row.product} ${row.cropType} ${row.farmer}`.toLowerCase().includes(value),
    );
  }, [query, rows]);
  const totalKg = rows.reduce((sum, row) => sum + row.availableKg, 0);
  const productCount = new Set(rows.map((row) => row.productId)).size;
  const farmerCount = new Set(rows.map((row) => row.farmerId ?? row.farmer)).size;

  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Reject Stock"
        description="Review rejected produce and the Farmer owners recorded during stock receiving."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="Reject stock"
        />
        {!loading && !loadError ? (
          <div className="space-y-6">
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
              <PackageX className="mt-0.5 size-5 shrink-0" />
              <p>
                <span className="font-semibold">Internal stock only.</span> Reject products cannot
                be priced, published, added to cart, or sold through the buyer marketplace.
              </p>
            </div>

            <section className="grid gap-3 sm:grid-cols-3">
              <Metric icon={PackageX} label="Available Reject stock" value={`${totalKg} kg`} />
              <Metric icon={Sprout} label="Products with Rejects" value={String(productCount)} />
              <Metric icon={UsersRound} label="Farmer owners" value={String(farmerCount)} />
            </section>

            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Rejected product listing</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quantities are grouped by permanent product and Farmer owner.
                  </p>
                </div>
                <label className="relative block w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search product or Farmer"
                    className="pl-9"
                    aria-label="Search Reject stock"
                  />
                </label>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Farmer owner</th>
                      <th className="px-5 py-3 text-right">Available Reject</th>
                      <th className="px-5 py-3 text-right">Recorded total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.key} className="border-t border-border/70">
                        <td className="px-5 py-4">
                          <ProductIdentity row={row} />
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{row.cropType}</td>
                        <td className="px-5 py-4 font-medium">{row.farmer}</td>
                        <td className="px-5 py-4 text-right font-semibold">{row.availableKg} kg</td>
                        <td className="px-5 py-4 text-right text-muted-foreground">
                          {row.totalKg} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y md:hidden">
                {visibleRows.map((row) => (
                  <article key={row.key} className="space-y-3 p-5">
                    <ProductIdentity row={row} />
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Farmer owner</dt>
                        <dd className="mt-1 font-medium">{row.farmer}</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-xs text-muted-foreground">Available Reject</dt>
                        <dd className="mt-1 font-semibold">{row.availableKg} kg</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              {!visibleRows.length ? (
                <div className="px-5 py-12 text-center">
                  <PackageX className="mx-auto size-9 text-muted-foreground/60" />
                  <p className="mt-3 font-medium">
                    {query ? "No Reject stock matches your search." : "No Reject stock recorded."}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reject quantities will appear here after a delivery is recorded.
                  </p>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </MarketerLayout>
  );
}

function aggregateRejectRows(products: Catalog): RejectRow[] {
  const grouped = new Map<string, RejectRow>();
  for (const product of products) {
    for (const stock of product.contributions) {
      if (stock.classification !== "Reject") continue;
      const ownerKey = stock.farmerId ?? stock.farmer ?? "legacy";
      const key = `${product.id}:${ownerKey}`;
      const current = grouped.get(key);
      if (current) {
        current.availableKg += stock.availableKg;
        current.totalKg += stock.quantityKg;
      } else {
        grouped.set(key, {
          key,
          productId: product.id,
          product: product.name,
          cropType: product.cropType,
          imageUrl: product.imageUrl,
          farmerId: stock.farmerId,
          farmer: stock.farmer ?? "Legacy stock",
          availableKg: stock.availableKg,
          totalKg: stock.quantityKg,
        });
      }
    }
  }
  return [...grouped.values()]
    .filter((row) => row.availableKg > 0 || row.totalKg > 0)
    .sort((a, b) => a.product.localeCompare(b.product) || a.farmer.localeCompare(b.farmer));
}

function ProductIdentity({ row }: { row: RejectRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={row.imageUrl || marketplaceImageFor(row.cropType)}
        alt=""
        className="size-11 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0">
        <p className="truncate font-semibold">{row.product}</p>
        <p className="mt-0.5 text-xs text-muted-foreground md:hidden">{row.cropType}</p>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PackageX;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}
