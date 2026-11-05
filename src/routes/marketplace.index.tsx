import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Check, Grid2X2, List, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProductCard } from "@/features/marketplace/components/product-card";
import { FloatingBuyerCartSummary } from "@/features/marketplace/components/floating-buyer-cart-summary";
import { Input } from "@/components/ui/input";
import { ResponsiveFilterPanel } from "@/components/data/responsive-filter-panel";
import type { Classification, Product } from "@/features/marketplace/products";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import { procyMarketCategoryGuide } from "@/features/marketplace/procy-market-categories";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getMarketplaceListings } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketplace/")({
  validateSearch: z.object({
    q: z.string().optional(),
    crop: z.string().optional(),
    grade: z.enum(["Good", "Semi", "Reject"]).optional(),
    available: z.boolean().optional(),
    deals: z.boolean().optional(),
  }),
  loader: () => getMarketplaceListings(),
  head: () => ({
    meta: [
      { title: "Marketplace — AgriLink Farm Produce by PROCY" },
      {
        name: "description",
        content:
          "Search and filter fresh farm produce by crop type, quality classification, and availability. Managed and sold by PROCY.",
      },
      { property: "og:title", content: "AgriLink Marketplace" },
      {
        property: "og:description",
        content: "Fresh produce supplied by farmer members and sold by PROCY.",
      },
    ],
  }),
  component: MarketplacePage,
});

const classifications: Classification[] = ["Good", "Semi", "Reject"];
type CatalogView = "grid" | "list";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function MarketplacePage() {
  const router = useRouter();
  const search = Route.useSearch();
  const listings = Route.useLoaderData() as Product[];
  useAutoRefresh(() => router.invalidate());
  const products = useMemo(
    () =>
      listings.map((listing) => ({
        ...listing,
        image: listing.image || marketplaceImageFor(listing.name),
      })),
    [listings],
  );
  const cropTypes = useMemo(
    () => [...new Set(products.map((product) => product.cropType))],
    [products],
  );
  const [query, setQuery] = useState(search.q ?? "");
  const [crop, setCrop] = useState<string | null>(search.crop ?? null);
  const [grade, setGrade] = useState<Classification | null>(search.grade ?? null);
  const [inStockOnly, setInStockOnly] = useState(search.available ?? false);
  const [bundleDealsOnly, setBundleDealsOnly] = useState(search.deals ?? false);
  const [catalogView, setCatalogView] = useState<CatalogView>("grid");

  useEffect(() => {
    const savedView =
      window.localStorage.getItem("agrilink-marketplace-view") ??
      window.localStorage.getItem("agrilink-marketplace-mobile-view");
    if (savedView === "grid" || savedView === "list") setCatalogView(savedView);
  }, []);

  const selectCatalogView = (view: CatalogView) => {
    setCatalogView(view);
    window.localStorage.setItem("agrilink-marketplace-view", view);
  };
  const results = useMemo(
    () =>
      products.filter((p) => {
        const q = query.trim().toLowerCase();
        if (
          q &&
          !`${p.name} ${p.cropType} ${(p.offers ?? []).map((offer) => offer.classification).join(" ")}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        if (crop && p.cropType !== crop) return false;
        if (grade && !(p.offers ?? []).some((offer) => offer.classification === grade))
          return false;
        if (inStockOnly && !(p.offers ?? []).some((offer) => offer.quantityKg > 0)) return false;
        if (
          bundleDealsOnly &&
          !(p.offers ?? []).some(
            (offer) => offer.bundlePricePerKg !== null && offer.bundlePricePerKg !== undefined,
          )
        )
          return false;
        return true;
      }),
    [products, query, crop, grade, inStockOnly, bundleDealsOnly],
  );

  const catalog = (
    <main className="w-full px-4 pb-24 pt-8 sm:px-6 sm:pb-0 sm:pt-12 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        · PROCY marketplace
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold md:text-5xl">
        Fresh produce from local farmer members
      </h1>
      <p className="mt-4 max-w-xl text-sm text-muted-foreground">
        Browse quality-classified products supplied by PROCY farmer members, with current prices and
        live stock availability.
      </p>
      <p className="mt-3 inline-flex rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
        Live product availability
      </p>

      <ResponsiveFilterPanel
        activeCount={
          Number(Boolean(query)) +
          Number(Boolean(crop)) +
          Number(Boolean(grade)) +
          Number(inStockOnly) +
          Number(bundleDealsOnly)
        }
        className="mt-8 rounded-2xl border border-border bg-card shadow-card sm:mt-10 sm:rounded-3xl"
        contentClassName="md:block"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products or crop types"
            className="h-12 rounded-full pl-11 text-base sm:text-sm"
          />
        </div>

        <div className="mt-5 grid gap-4 sm:gap-6 lg:grid-cols-[1fr_auto_auto]">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Crop type
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
              <Chip active={crop === null} onClick={() => setCrop(null)}>
                All
              </Chip>
              {cropTypes.map((c) => (
                <Chip key={c} active={crop === c} onClick={() => setCrop(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Classification
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
              <Chip active={grade === null} onClick={() => setGrade(null)}>
                All
              </Chip>
              {classifications.map((g) => (
                <Chip key={g} active={grade === g} onClick={() => setGrade(g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Availability
            </p>
            <div className="flex gap-2">
              <Chip active={inStockOnly} onClick={() => setInStockOnly((v) => !v)}>
                Available only
              </Chip>
              <Chip active={bundleDealsOnly} onClick={() => setBundleDealsOnly((v) => !v)}>
                Bundle deals
              </Chip>
            </div>
          </div>
        </div>
      </ResponsiveFilterPanel>

      {results.length > 0 ? (
        <>
          <div className="mt-8 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {results.length} listing{results.length === 1 ? "" : "s"}
            </p>
            <div
              className="inline-flex items-center rounded-xl border border-border bg-card p-1 shadow-sm"
              role="group"
              aria-label="Marketplace view"
            >
              {(["grid", "list"] as const).map((view) => {
                const active = catalogView === view;
                const Icon = view === "grid" ? Grid2X2 : List;
                const label = view === "grid" ? "Grid" : "List";
                return (
                  <button
                    key={view}
                    type="button"
                    onClick={() => selectCatalogView(view)}
                    aria-pressed={active}
                    aria-label={`${label} view`}
                    className={`flex min-h-9 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-sm transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {active ? <Check className="size-3.5" /> : null}
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className={`mt-4 grid gap-3 sm:gap-6 ${
              catalogView === "grid" ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            }`}
          >
            {results.map((p) => (
              <ProductCard key={p.id} product={p} catalogView={catalogView} />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No agricultural products are currently available.
        </div>
      )}
    </main>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      {catalog}
      <FloatingBuyerCartSummary />
      <SiteFooter />
    </div>
  );
}
