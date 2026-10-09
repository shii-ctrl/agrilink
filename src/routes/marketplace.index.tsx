import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/components/ui/input";
import type { Classification } from "@/lib/products";
import { marketplaceImageFor } from "@/lib/marketplace-images";
import { getMarketplaceListings } from "@/lib/marketplace-server-functions";

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

const vegetableGuide = [
  [
    "Leafy Vegetables / Leaf Vegetables",
    "Leaves are eaten",
    "Repolyo, pechay, lettuce, spinach, kangkong, mustard greens",
  ],
  [
    "Fruit Vegetables",
    "The fruit of the plant is eaten",
    "Kalabasa, sayote, kamatis, talong, pipino, ampalaya, bell pepper, okra",
  ],
  [
    "Pod / Legume Vegetables",
    "Pods or beans are eaten",
    "Sitaw, baguio beans, snap beans, green peas",
  ],
  [
    "Root Vegetables",
    "Underground roots are eaten",
    "Carrots, radish/labanos, singkamas, beetroot",
  ],
  [
    "Tuber Vegetables",
    "Underground swollen stems or roots",
    "Potato, sweet potato/kamote, cassava/kamoteng kahoy",
  ],
  ["Bulb Vegetables", "Underground bulb is eaten", "Onion/sibuyas, garlic/bawang"],
  ["Stem Vegetables", "Stem or stalk is eaten", "Celery, asparagus, bamboo shoots/labong"],
  ["Flower Vegetables", "Flower or flower buds are eaten", "Broccoli, cauliflower"],
  [
    "Herbs / Aromatic Vegetables",
    "Mainly used for flavoring",
    "Spring onion, parsley, basil, coriander/cilantro",
  ],
] as const;
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
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
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
  const listings = Route.useLoaderData();
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
  const [isGuideExpanded, setIsGuideExpanded] = useState(false);
  const results = useMemo(
    () =>
      products.filter((p) => {
        const q = query.trim().toLowerCase();
        if (q && !`${p.name} ${p.cropType} ${p.classification}`.toLowerCase().includes(q))
          return false;
        if (crop && p.cropType !== crop) return false;
        if (grade && p.classification !== grade) return false;
        if (inStockOnly && p.quantityKg <= 0) return false;
        return true;
      }),
    [products, query, crop, grade, inStockOnly],
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pt-12">
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

        <div className="mt-10 rounded-3xl border border-border bg-card p-5 shadow-card">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, crop types, classifications..."
              className="h-12 rounded-full pl-11"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Crop type
              </p>
              <div className="flex flex-wrap gap-2">
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
              <div className="flex flex-wrap gap-2">
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

        <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Vegetable Classification Guide</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use these crop groups to understand product types in the PROCY marketplace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsGuideExpanded((expanded) => !expanded)}
              aria-expanded={isGuideExpanded}
              aria-controls="vegetable-classification-guide"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
            >
              {isGuideExpanded ? "Hide guide" : "Show guide"}
              <ChevronDown
                className={`size-4 transition-transform duration-300 ${
                  isGuideExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
          <div
            id="vegetable-classification-guide"
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${
              isGuideExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-medium">Classification</th>
                      <th className="px-6 py-4 font-medium">Meaning</th>
                      <th className="px-6 py-4 font-medium">Examples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vegetableGuide.map(([name, meaning, examples]) => (
                      <tr key={name} className="border-t border-border">
                        <td className="px-6 py-4 font-semibold">{name}</td>
                        <td className="px-6 py-4 text-muted-foreground">{meaning}</td>
                        <td className="px-6 py-4 text-muted-foreground">{examples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {results.length > 0 ? (
          <>
            <p className="mt-8 text-sm text-muted-foreground">
              {results.length} listing{results.length === 1 ? "" : "s"}
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      <SiteFooter />
    </div>
  );
}
