import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BuyerLayout, BuyerPageHeader } from "@/components/buyer-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { peso } from "@/lib/products";
import { marketplaceImageFor } from "@/lib/marketplace-images";
import {
  getBuyerCart,
  placeBuyerOrder,
  setBuyerCartItem,
} from "@/lib/marketplace-server-functions";
export const Route = createFileRoute("/buyer/cart")({ component: BuyerCartPage });

type CartItem = Awaited<ReturnType<typeof getBuyerCart>>[number] & { image: string };

function BuyerCartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const loadCart = async () => {
    const cart = await getBuyerCart();
    setItems(cart.map((item) => ({ ...item, image: marketplaceImageFor(item.name) })));
  };
  useEffect(() => {
    void loadCart().catch(() => toast.error("Could not load your saved cart."));
  }, []);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.pricePerKg * item.quantityKg, 0),
    [items],
  );
  async function update(id: string, quantityKg: number) {
    const item = items.find((cartItem) => cartItem.id === id);
    const availableQuantity = item?.availableKg ?? 0;
    const nextQuantity = Math.min(quantityKg, availableQuantity);
    if (quantityKg > availableQuantity) {
      toast("Only the available quantity can be ordered", {
        description: `This classified listing currently has ${availableQuantity} kg available.`,
      });
    }
    try {
      await setBuyerCartItem({ data: { listingId: id, quantityKg: Math.max(0, nextQuantity) } });
      await loadCart();
    } catch (error) {
      toast.error("Could not update your cart", {
        description: error instanceof Error ? error.message : "Please refresh and try again.",
      });
    }
  }
  return (
    <BuyerLayout>
      <BuyerPageHeader
        title="My Cart"
        description="Review your selected PROCY marketplace items before submitting a buyer order."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        {items.length === 0 ? (
          <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
            <ShoppingCart className="mx-auto size-8 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">Your cart is empty</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a product from the marketplace while signed in as a Buyer.
            </p>
            <Button className="mt-5 rounded-full" onClick={() => navigate({ to: "/marketplace" })}>
              Browse marketplace
            </Button>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <section className="space-y-4">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-card"
                >
                  <img src={item.image} alt="" className="size-20 rounded-2xl object-cover" />
                  <div className="min-w-36 flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.classification} · {peso(item.pricePerKg)} / kg
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.availableKg} kg currently available
                    </p>
                  </div>
                  <div className="flex items-center rounded-full border border-border p-1">
                    <button
                      className="flex size-8 items-center justify-center rounded-full hover:bg-muted"
                      onClick={() => void update(item.id, item.quantityKg - 1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-14 text-center text-sm font-semibold">
                      {item.quantityKg} kg
                    </span>
                    <button
                      className="flex size-8 items-center justify-center rounded-full hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => void update(item.id, item.quantityKg + 1)}
                      disabled={item.quantityKg >= item.availableKg}
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <p className="w-24 text-right font-semibold">
                    {peso(item.quantityKg * item.pricePerKg)}
                  </p>
                </article>
              ))}
            </section>
            <section className="h-fit rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Order summary</h2>
              <p className="mt-4 text-sm text-muted-foreground">{items.length} product group(s)</p>
              <p className="mt-2 font-display text-3xl font-semibold">{peso(total)}</p>
              <form
                className="mt-6 space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  try {
                    const databaseOrder = await placeBuyerOrder({
                      data: {
                        contact: String(formData.get("contact")),
                        pickupNote: String(formData.get("pickup")),
                        items: items.map((item) => ({
                          listingId: item.id,
                          quantityKg: item.quantityKg,
                        })),
                      },
                    });
                    await loadCart();
                    toast.success("Order submitted", {
                      description: `${databaseOrder.orderNumber} is Pending PROCY confirmation.`,
                    });
                    window.location.assign("/buyer/orders");
                  } catch (error) {
                    toast.error("Order could not be submitted", {
                      description:
                        error instanceof Error
                          ? error.message
                          : "Please refresh the marketplace and try again.",
                    });
                  }
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact number</Label>
                  <Input id="contact" name="contact" placeholder="0917 000 0000" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickup">Pickup or delivery note</Label>
                  <Input
                    id="pickup"
                    name="pickup"
                    placeholder="Enter your preferred arrangement"
                    required
                  />
                </div>
                <Button type="submit" className="w-full rounded-full">
                  Place order
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                No payment gateway. PROCY will review and confirm this order.
              </p>
            </section>
          </div>
        )}
      </main>
    </BuyerLayout>
  );
}
