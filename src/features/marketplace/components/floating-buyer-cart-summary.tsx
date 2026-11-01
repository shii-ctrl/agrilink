import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { buyerCartChangedEvent } from "@/features/marketplace/cart-events";
import { peso } from "@/features/marketplace/products";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";
import { getBuyerCart } from "@/services/marketplace/marketplace-server-functions";

type CartSummary = {
  itemCount: number;
  total: number;
};

export function FloatingBuyerCartSummary() {
  const [summary, setSummary] = useState<CartSummary | null>(null);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const user = await getCurrentSessionUser();
        if (!user?.roles.includes("Buyer")) {
          if (mounted) setSummary(null);
          return;
        }
        const items = await getBuyerCart();
        if (!mounted) return;
        setSummary({
          itemCount: items.length,
          total: items.reduce((sum, item) => sum + item.pricePerKg * item.quantityKg, 0),
        });
      } catch {
        if (mounted) setSummary(null);
      }
    };

    void refresh();
    window.addEventListener(buyerCartChangedEvent, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      mounted = false;
      window.removeEventListener(buyerCartChangedEvent, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!summary?.itemCount) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md pb-[env(safe-area-inset-bottom)] sm:hidden">
      <Link
        to="/buyer/cart"
        className="flex min-h-16 items-center gap-3 rounded-2xl border border-primary/25 bg-forest px-4 py-3 text-forest-foreground shadow-2xl"
        aria-label={`View cart with ${summary.itemCount} item groups, subtotal ${peso(summary.total)}`}
      >
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <ShoppingCart className="size-5" />
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold leading-4 text-forest">
            {summary.itemCount > 99 ? "99+" : summary.itemCount}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-forest-foreground/70">Current cart subtotal</span>
          <span className="block truncate font-semibold">{peso(summary.total)}</span>
        </span>
        <span className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-forest">
          View cart
        </span>
      </Link>
    </div>
  );
}
