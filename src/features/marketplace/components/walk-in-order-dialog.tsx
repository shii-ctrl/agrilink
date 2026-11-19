import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { peso, type Product } from "@/features/marketplace/products";
import {
  requiresWholeSellingQuantity,
  sellingUnitLabel,
} from "@/features/marketplace/selling-units";
import {
  createWalkInOrder,
  getMarketplaceListings,
} from "@/services/marketplace/marketplace-server-functions";
import { userFacingErrorMessage } from "@/lib/ui/user-facing-error";
import { toast } from "@/lib/ui/toast";

export function WalkInOrderDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (orderNumber: string) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [buyerName, setBuyerName] = useState("");
  const [contact, setContact] = useState("");
  const [lines, setLines] = useState([{ id: crypto.randomUUID(), listingId: "", quantity: "1" }]);

  async function refreshProducts() {
    setLoading(true);
    setLoadError("");
    try {
      setProducts(await getMarketplaceListings());
    } catch (error) {
      setLoadError(userFacingErrorMessage(error, "Could not load products. Try again."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refreshProducts();
  }, []);

  const options = products.flatMap((product) =>
    (product.offers ?? []).map((offer) => ({
      ...offer,
      name: product.name,
      sellingUnit: product.sellingUnit,
    })),
  );
  const reviewed = lines.map((line) => {
    const offer = options.find((item) => item.id === line.listingId);
    const quantity = Number(line.quantity);
    const price =
      offer && offer.bundleMinimumKg && offer.bundlePricePerKg && quantity >= offer.bundleMinimumKg
        ? offer.bundlePricePerKg
        : (offer?.retailPricePerKg ?? offer?.pricePerKg ?? 0);
    const valid =
      Boolean(offer) &&
      Number.isFinite(quantity) &&
      quantity > 0 &&
      quantity <= (offer?.quantityKg ?? 0) &&
      (!requiresWholeSellingQuantity(offer?.sellingUnit ?? "kg") || Number.isInteger(quantity));
    return { ...line, offer, quantity, price, valid, total: Number((quantity * price).toFixed(2)) };
  });
  const total = reviewed.reduce(
    (sum, line) => sum + (Number.isFinite(line.total) ? line.total : 0),
    0,
  );
  const valid =
    buyerName.trim().length >= 2 &&
    reviewed.every((line) => line.valid) &&
    new Set(lines.map((line) => line.listingId)).size === lines.length;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !savingRef.current) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New walk-in order</DialogTitle>
          <DialogDescription>
            For buyers at PROCY. No buyer account is needed. Pickup only.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!valid || loading || savingRef.current) return;
            savingRef.current = true;
            setSaving(true);
            try {
              const result = await createWalkInOrder({
                data: {
                  requestId,
                  buyerName: buyerName.trim(),
                  contact: contact.trim(),
                  items: reviewed.map((line) => ({
                    listingId: line.listingId,
                    quantityKg: line.quantity,
                    expectedUnitPrice: line.price,
                  })),
                },
              });
              toast.success("Walk-in order confirmed", {
                description: `${result.orderNumber} · Stock reserved. Prepare the order for pickup.`,
              });
              onCreated(result.orderNumber);
            } catch (error) {
              toast.error("Could not confirm walk-in order", {
                description: userFacingErrorMessage(error, "Review the order and try again."),
              });
            } finally {
              savingRef.current = false;
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={saving} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="walk-in-name">Buyer name</Label>
                <Input
                  id="walk-in-name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  minLength={2}
                  maxLength={160}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="walk-in-contact">Contact number (optional)</Label>
                <Input
                  id="walk-in-contact"
                  type="tel"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={80}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Products</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => void refreshProducts()}
              >
                <RefreshCw className="size-4" />
                Refresh products
              </Button>
            </div>
            {loading && (
              <p role="status" className="text-sm text-muted-foreground">
                Loading available products…
              </p>
            )}
            {loadError && (
              <p role="alert" className="text-sm text-destructive">
                {loadError}
              </p>
            )}
            {!loading && !loadError && !options.length && (
              <p className="text-sm text-muted-foreground">No products are currently available.</p>
            )}
            {reviewed.map((line, index) => (
              <div key={line.id} className="space-y-3 rounded-2xl border border-border p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor={`walk-in-product-${line.id}`}>
                      Product {index + 1} and classification
                    </Label>
                    <AppSelect
                      id={`walk-in-product-${line.id}`}
                      value={line.listingId}
                      disabled={loading || saving}
                      onValueChange={(listingId) =>
                        setLines((current) =>
                          current.map((item) =>
                            item.id === line.id ? { ...item, listingId } : item,
                          ),
                        )
                      }
                      options={options.map((offer) => ({
                        value: offer.id,
                        label: `${offer.name} · ${offer.classification}`,
                        description: `${offer.quantityKg} ${sellingUnitLabel(offer.sellingUnit, offer.quantityKg)} available`,
                        disabled: lines.some(
                          (item) => item.id !== line.id && item.listingId === offer.id,
                        ),
                      }))}
                      placeholder="Choose a product"
                      searchable
                    />
                  </div>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove product ${index + 1}`}
                      onClick={() =>
                        setLines((current) => current.filter((item) => item.id !== line.id))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="grid items-end gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`walk-in-qty-${line.id}`}>
                      Quantity ({line.offer?.sellingUnit ?? "kg"})
                    </Label>
                    <Input
                      id={`walk-in-qty-${line.id}`}
                      type="number"
                      min={requiresWholeSellingQuantity(line.offer?.sellingUnit ?? "kg") ? 1 : 0.01}
                      step={
                        requiresWholeSellingQuantity(line.offer?.sellingUnit ?? "kg") ? 1 : 0.01
                      }
                      max={line.offer?.quantityKg ?? 999999}
                      required
                      value={lines[index]!.quantity}
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((item) =>
                            item.id === line.id ? { ...item, quantity: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {peso(line.price)} / {line.offer?.sellingUnit ?? "kg"}
                  </p>
                  <p className="font-semibold sm:text-right">
                    {peso(Number.isFinite(line.total) ? line.total : 0)}
                  </p>
                </div>
                {line.offer && (
                  <p
                    className={`text-xs ${line.valid ? "text-muted-foreground" : "text-destructive"}`}
                  >
                    Available: {line.offer.quantityKg}{" "}
                    {sellingUnitLabel(line.offer.sellingUnit, line.offer.quantityKg)}
                    {!line.valid ? " · Enter a valid quantity within available stock." : ""}
                  </p>
                )}
                {line.listingId && !line.offer && !loading && (
                  <p className="text-xs text-destructive">
                    This product is no longer available. Choose another product.
                  </p>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={lines.length >= 50 || loading}
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { id: crypto.randomUUID(), listingId: "", quantity: "1" },
                ])
              }
            >
              <Plus className="size-4" />
              Add product
            </Button>
            <div className="rounded-2xl bg-muted/50 p-4">
              <div className="flex justify-between gap-4 font-semibold">
                <span>Total · Pickup</span>
                <span>{peso(total)}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Confirming reserves stock immediately. After pickup and finalizing the sale,
                Accounting records the payment. Farmer sales and payouts follow the allocated stock.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || loading || Boolean(loadError) || saving}>
                {saving ? "Confirming…" : "Confirm walk-in order"}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
