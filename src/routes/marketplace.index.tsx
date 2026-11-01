import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProductCard } from "@/features/marketplace/components/product-card";
import { FloatingBuyerCartSummary } from "@/features/marketplace/components/floating-buyer-cart-summary";
import { Input } from "@/components/ui/input";
import type { Classification, Product } from "@/features/marketplace/products";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import { procyMarketCategoryGuide } from "@/features/marketplace/procy-market-categories";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getMarketplaceListings } from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketplace/")({
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
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState<string | null>(null);
  const [grade, setGrade] = useState<Classification | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
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
        return true;
      }),
    [products, query, crop, grade, inStockOnly],
  );

  const catalog = (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:pb-0 sm:pt-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        · Public marketplace
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold md:text-5xl">
        Produce supplied by farmer members, sold by PROCY
      </h1>
      <p className="mt-4 max-w-xl text-sm text-muted-foreground">
        Browse freely. Login or register as a buyer to add items to your cart and place orders.
      </p>
      <p className="mt-3 inline-flex rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
        Live Layerbase marketplace listings
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-card sm:mt-10 sm:rounded-3xl sm:p-5">
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
            <Chip active={inStockOnly} onClick={() => setInStockOnly((v) => !v)}>
              Available only
            </Chip>
          </div>
        </div>
      </div>

      {results.length > 0 ? (
        <>
          <p className="mt-8 text-sm text-muted-foreground">
            {results.length} listing{results.length === 1 ? "" : "s"}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
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
