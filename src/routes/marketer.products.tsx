import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  Check,
  ClipboardList,
  ImagePlus,
  PackagePlus,
  Pencil,
  Store,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import { prepareProductImage } from "@/features/marketplace/product-image-upload";
import { procyMarketCategories } from "@/features/marketplace/procy-market-categories";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import {
  adjustCatalogStock,
  createCatalogProduct,
  getMarketerProductCatalog,
  saveMarketplaceProductOffers,
  setCatalogProductActive,
  updateCatalogProduct,
} from "@/services/marketplace/marketplace-server-functions";

export const Route = createFileRoute("/marketer/products")({
  head: () => ({ meta: [{ title: "Product Catalog — Marketer | AgriLink" }] }),
  component: ProductCatalogPage,
});

type Catalog = Awaited<ReturnType<typeof getMarketerProductCatalog>>;
type CatalogProduct = Catalog[number];
type EditorTab = "details" | "marketplace" | "stock" | "history";

function ProductCatalogPage() {
  const [products, setProducts] = useState<Catalog>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<EditorTab>("details");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const latestLoad = useRef(0);
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const load = useCallback(async () => {
    const requestId = ++latestLoad.current;
    const next = await getMarketerProductCatalog();
    if (requestId !== latestLoad.current) return;
    setProducts(next);
    setSelectedId((current) =>
      current && next.some((item) => item.id === current) ? current : (next[0]?.id ?? ""),
    );
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
  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    return products.filter(
      (item) => !value || `${item.name} ${item.cropType}`.toLowerCase().includes(value),
    );
  }, [products, query]);
  const selected = products.find((item) => item.id === selectedId) ?? null;

  return (
    <MarketerLayout>
      {confirmationDialog}
      <MarketerPageHeader
        title="Product Catalog"
        description="Maintain permanent vegetables, prices, visibility, pooled stock, and Farmer ownership."
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={loadError}
          onRetry={() => void loadWorkspace()}
          label="product catalog"
        />
        {!loading && !loadError ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <aside className="self-start rounded-3xl border border-border bg-card p-4 shadow-card lg:sticky lg:top-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Permanent products</h2>
                  <p className="text-xs text-muted-foreground">{products.length} catalog items</p>
                </div>
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => setShowCreate((value) => !value)}
                >
                  <PackagePlus className="size-4" /> Add
                </Button>
              </div>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search catalog"
                className="mt-4"
              />
              <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {visible.map((product) => {
                  const stock = product.contributions.reduce(
                    (total, row) => total + row.availableKg,
                    0,
                  );
                  return (
                    <button
                      key={product.id}
                      onClick={() => setSelectedId(product.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${product.id === selectedId ? "border-primary bg-accent" : "border-transparent hover:bg-muted/60"}`}
                    >
                      <img
                        src={product.imageUrl || marketplaceImageFor(product.name)}
                        alt=""
                        className="size-11 rounded-xl object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{product.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {product.active ? `${stock} kg pooled stock` : "Archived"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
            <div className="min-w-0 space-y-6">
              {showCreate ? (
                <CreateProductCard
                  onSaved={async (id) => {
                    await load();
                    setSelectedId(id);
                    setShowCreate(false);
                  }}
                />
              ) : null}
              {selected ? (
                <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 md:p-6">
                    <div className="flex min-w-0 items-center gap-4">
                      <img
                        src={selected.imageUrl || marketplaceImageFor(selected.name)}
                        alt=""
                        className="size-16 rounded-2xl object-cover"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                          {selected.cropType}
                        </p>
                        <h2 className="text-2xl font-semibold">{selected.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {selected.active ? "Active permanent product" : "Archived product"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={async () => {
                        if (
                          selected.active &&
                          !(await requestConfirmation({
                            title: `Archive ${selected.name}?`,
                            description:
                              "It will be hidden from receiving and the marketplace, but stock and history remain saved.",
                            confirmLabel: "Archive product",
                            destructive: true,
                          }))
                        )
                          return;
                        await setCatalogProductActive({
                          data: { productId: selected.id, active: !selected.active },
                        });
                        toast.success(selected.active ? "Product archived" : "Product restored");
                        await load();
                      }}
                    >
                      {selected.active ? (
                        <Archive className="size-4" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      {selected.active ? "Archive" : "Restore"}
                    </Button>
                  </div>
                  <EditorTabs value={tab} onChange={setTab} />
                  <div className="p-5 md:p-6">
                    {tab === "details" ? <DetailsEditor product={selected} onSaved={load} /> : null}
                    {tab === "marketplace" ? (
                      <MarketplaceEditor
                        key={marketplaceSavedSignature(selected.offers)}
                        product={selected}
                        onSaved={load}
                      />
                    ) : null}
                    {tab === "stock" ? <StockOwnership product={selected} onSaved={load} /> : null}
                    {tab === "history" ? <ProductHistory product={selected} /> : null}
                  </div>
                </section>
              ) : (
                <div className="rounded-3xl border border-dashed p-12 text-center text-muted-foreground">
                  Add or select a permanent product.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </MarketerLayout>
  );
}

function EditorTabs({ value, onChange }: { value: EditorTab; onChange: (tab: EditorTab) => void }) {
  const tabs = [
    ["details", "Details", Pencil],
    ["marketplace", "Marketplace", Store],
    ["stock", "Stock & owners", UsersRound],
    ["history", "History", ClipboardList],
  ] as const;
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-4 pt-2">
      {tabs.map(([id, label, Icon]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${value === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function CreateProductCard({ onSaved }: { onSaved: (id: string) => Promise<void> }) {
  const [cropType, setCropType] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <section className="rounded-3xl border border-primary/25 bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <PackagePlus className="size-5 text-primary" /> Add permanent product
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Good, Semi, and Reject offers are prepared automatically as drafts.
      </p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setSaving(true);
          try {
            const result = await createCatalogProduct({
              data: {
                name: String(data.get("name")),
                cropType: cropType as (typeof procyMarketCategories)[number],
                description: String(data.get("description") ?? ""),
                imageDataUrl: "",
              },
            });
            toast.success("Permanent product created");
            form.reset();
            setCropType("");
            await onSaved(result.id);
          } catch (error) {
            toast.error("Product could not be created", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field label="Product name">
          <Input name="name" required minLength={2} />
        </Field>
        <Field label="Category">
          <AppSelect
            name="cropType"
            value={cropType}
            onValueChange={setCropType}
            placeholder="Choose category"
            options={procyMarketCategories.map((item) => ({ value: item, label: item }))}
          />
        </Field>
        <div className="space-y-2 sm:col-span-2">
          <Label>Description (optional)</Label>
          <Input name="description" maxLength={2000} />
        </div>
        <Button
          type="submit"
          className="rounded-full sm:col-span-2 sm:justify-self-start"
          disabled={saving || !cropType}
        >
          {saving ? "Creating…" : "Create product"}
        </Button>
      </form>
    </section>
  );
}

function DetailsEditor({
  product,
  onSaved,
}: {
  product: CatalogProduct;
  onSaved: () => Promise<void>;
}) {
  const [cropType, setCropType] = useState(product.cropType);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setCropType(product.cropType);
    setImageDataUrl("");
  }, [product.cropType, product.id]);
  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSaving(true);
        try {
          await updateCatalogProduct({
            data: {
              productId: product.id,
              name: String(data.get("name")),
              cropType: cropType as (typeof procyMarketCategories)[number],
              description: String(data.get("description") ?? ""),
              imageDataUrl,
            },
          });
          toast.success("Product details updated");
          setImageDataUrl("");
          await onSaved();
        } catch (error) {
          toast.error("Product could not be updated", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <Field label="Product name">
        <Input name="name" defaultValue={product.name} key={`${product.id}-name`} required />
      </Field>
      <Field label="Category">
        <AppSelect
          name="cropType"
          value={cropType}
          onValueChange={setCropType}
          options={procyMarketCategories.map((item) => ({ value: item, label: item }))}
        />
      </Field>
      <div className="space-y-2 sm:col-span-2">
        <Label>Description</Label>
        <Input
          name="description"
          defaultValue={product.description ?? ""}
          key={`${product.id}-description`}
        />
      </div>
      <div className="space-y-3 sm:col-span-2">
        <Label>Product photo</Label>
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border p-4">
          <img
            src={imageDataUrl || product.imageUrl || marketplaceImageFor(product.name)}
            alt="Product preview"
            className="size-24 rounded-2xl object-cover"
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setPreparing(true);
              void prepareProductImage(file)
                .then(setImageDataUrl)
                .catch((error) =>
                  toast.error(error instanceof Error ? error.message : "Choose another image."),
                )
                .finally(() => setPreparing(false));
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            {preparing ? "Preparing…" : "Replace photo"}
          </Button>
        </div>
      </div>
      <Button
        type="submit"
        className="rounded-full sm:col-span-2 sm:justify-self-start"
        disabled={saving || preparing}
      >
        {saving ? "Saving…" : "Save product details"}
      </Button>
    </form>
  );
}

function MarketplaceEditor({
  product,
  onSaved,
}: {
  product: CatalogProduct;
  onSaved: () => Promise<void>;
}) {
  const [drafts, setDrafts] = useState(() => marketplaceDrafts(product.offers));
  const [saving, setSaving] = useState(false);
  const updateDraft = (
    offerId: string,
    field: keyof MarketplaceOfferDraft,
    value: string | boolean,
  ) => {
    setDrafts((current) => {
      const existing = current[offerId];
      if (!existing) return current;
      return { ...current, [offerId]: { ...existing, [field]: value } };
    });
  };
  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await saveMarketplaceProductOffers({
            data: {
              productId: product.id,
              offers: product.offers.map((offer) => {
                const draft = drafts[offer.id];
                return {
                  listingId: offer.id,
                  retailPricePerKg: Number(draft?.retailPricePerKg),
                  bundlePricePerKg: optionalNumber(draft?.bundlePricePerKg ?? null),
                  bundleMinimumKg: optionalNumber(draft?.bundleMinimumKg ?? null),
                  visible: draft?.visible ?? false,
                };
              }),
            },
          });
          toast.success("Good, Semi, and Reject marketplace settings saved");
          await onSaved();
        } catch (error) {
          toast.error("Marketplace settings could not be saved", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="rounded-2xl border border-primary/20 bg-accent/50 p-4 text-sm">
        Select all qualities you want buyers to see, then use the single Save button below.
        Published qualities stay visible as Sold out and automatically become purchasable after new
        stock is recorded.
      </div>
      {product.offers.map((offer) => (
        <OfferEditor
          key={offer.id}
          offer={offer}
          active={product.active}
          draft={drafts[offer.id] ?? marketplaceOfferDraft(offer)}
          onChange={(field, value) => updateDraft(offer.id, field, value)}
        />
      ))}
      <Button type="submit" className="rounded-full" disabled={saving || !product.active}>
        {saving ? "Saving all qualities…" : "Save all marketplace settings"}
      </Button>
    </form>
  );
}

function OfferEditor({
  offer,
  active,
  draft,
  onChange,
}: {
  offer: CatalogProduct["offers"][number];
  active: boolean;
  draft: MarketplaceOfferDraft;
  onChange: (field: keyof MarketplaceOfferDraft, value: string | boolean) => void;
}) {
  return (
    <section className="grid gap-4 rounded-3xl border p-5 sm:grid-cols-3">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
        <div>
          <h3 className="font-semibold">{offer.classification} quality</h3>
          <p className="text-sm text-muted-foreground">{offer.availableKg} kg pooled stock</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={draft.visible}
            onChange={(event) => onChange("visible", event.target.checked)}
            disabled={!active}
          />{" "}
          Visible in marketplace
        </label>
      </div>
      <Field label="Retail ₱ / kg">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={draft.retailPricePerKg}
          onChange={(event) => onChange("retailPricePerKg", event.target.value)}
          required
        />
      </Field>
      <Field label="Bundle ₱ / kg">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={draft.bundlePricePerKg}
          onChange={(event) => onChange("bundlePricePerKg", event.target.value)}
        />
      </Field>
      <Field label="Bundle starts at kg">
        <Input
          type="number"
          min="1"
          step="0.01"
          value={draft.bundleMinimumKg}
          onChange={(event) => onChange("bundleMinimumKg", event.target.value)}
        />
      </Field>
    </section>
  );
}

type MarketplaceOfferDraft = {
  retailPricePerKg: string;
  bundlePricePerKg: string;
  bundleMinimumKg: string;
  visible: boolean;
};

function marketplaceOfferDraft(offer: CatalogProduct["offers"][number]): MarketplaceOfferDraft {
  return {
    retailPricePerKg: offer.priceConfigured ? String(offer.retailPricePerKg) : "",
    bundlePricePerKg: offer.bundlePricePerKg === null ? "" : String(offer.bundlePricePerKg),
    bundleMinimumKg: offer.bundleMinimumKg === null ? "" : String(offer.bundleMinimumKg),
    visible: offer.status === "published",
  };
}

function marketplaceDrafts(offers: CatalogProduct["offers"]) {
  return Object.fromEntries(
    offers.map((offer) => [offer.id, marketplaceOfferDraft(offer)]),
  ) as Record<string, MarketplaceOfferDraft>;
}

function marketplaceSavedSignature(offers: CatalogProduct["offers"]) {
  return offers
    .map(
      (offer) =>
        `${offer.id}:${offer.status}:${offer.retailPricePerKg}:${offer.bundlePricePerKg}:${offer.bundleMinimumKg}:${offer.priceConfigured}`,
    )
    .join("|");
}

function StockOwnership({
  product,
  onSaved,
}: {
  product: CatalogProduct;
  onSaved: () => Promise<void>;
}) {
  const total = product.contributions.reduce((sum, row) => sum + row.availableKg, 0);
  const reserved = product.contributions.reduce((sum, row) => sum + row.reservedKg, 0);
  const owners = new Set(product.contributions.map((row) => row.farmerId).filter(Boolean)).size;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Pooled available" value={`${total} kg`} />
        <Metric label="Farmer contributors" value={String(owners)} />
        <Metric label="Reserved" value={`${reserved} kg`} />
      </div>
      <div className="mt-5 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Farmer owner</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Available</th>
              <th className="px-4 py-3">Reserved</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Correction</th>
            </tr>
          </thead>
          <tbody>
            {product.contributions.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3 font-medium">{row.farmer ?? "Legacy stock"}</td>
                <td className="px-4 py-3">{row.classification}</td>
                <td className="px-4 py-3">{row.availableKg} kg</td>
                <td className="px-4 py-3">{row.reservedKg} kg</td>
                <td className="px-4 py-3">{row.quantityKg} kg</td>
                <td className="px-4 py-3">
                  <StockAdjustment
                    inventoryId={row.id}
                    label={`${row.farmer ?? "Legacy stock"} ${row.classification}`}
                    onSaved={onSaved}
                  />
                </td>
              </tr>
            ))}
            {!product.contributions.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No stock received yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Receiving records cannot be edited. Corrections create a separate audited inventory movement
        and never erase the original delivery.
      </p>
    </div>
  );
}

function StockAdjustment({
  inventoryId,
  label,
  onSaved,
}: {
  inventoryId: string;
  label: string;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!open)
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full"
        onClick={() => setOpen(true)}
      >
        Adjust
      </Button>
    );
  return (
    <form
      className="min-w-64 space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setSaving(true);
        try {
          await adjustCatalogStock({
            data: {
              inventoryId,
              adjustmentKg: Number(data.get("adjustmentKg")),
              reason: String(data.get("reason")),
            },
          });
          toast.success(`Stock correction saved for ${label}`);
          setOpen(false);
          await onSaved();
        } catch (error) {
          toast.error("Stock correction could not be saved", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <Input name="adjustmentKg" type="number" step="0.01" placeholder="+ or - kg" required />
      <Input
        name="reason"
        minLength={3}
        maxLength={500}
        placeholder="Reason for correction"
        required
      />
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ProductHistory({ product }: { product: CatalogProduct }) {
  return (
    <div>
      {product.history.map((entry) => (
        <div key={entry.id} className="flex gap-3 border-b py-3 last:border-0">
          <ClipboardList className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-semibold capitalize">{entry.movementType}</p>
            <p className="text-muted-foreground">
              {entry.farmer ?? "Legacy stock"} · {entry.classification} · Available{" "}
              {signed(entry.availableChangeKg)} kg · Reserved {signed(entry.reservedChangeKg)} kg
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.note ?? "Inventory updated."} ·{" "}
              {new Date(entry.createdAt).toLocaleString("en-PH")}
            </p>
          </div>
        </div>
      ))}
      {!product.history.length ? (
        <p className="rounded-2xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
          No stock activity yet.
        </p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
function optionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? Number(normalized) : null;
}
function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}
