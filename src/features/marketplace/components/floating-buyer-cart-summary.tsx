import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { buyerCartChangedEvent } from "@/features/marketplace/cart-events";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";
import { getBuyerCart } from "@/services/marketplace/marketplace-server-functions";

export function FloatingBuyerCartSummary({ aboveMobileNav = false }: { aboveMobileNav?: boolean }) {
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const user = await getCurrentSessionUser();
        if (!user?.roles.includes("Buyer")) {
          if (mounted) setItemCount(0);
          return;
        }
        const items = await getBuyerCart();
        if (!mounted) return;
        setItemCount(items.length);
      } catch {
        if (mounted) setItemCount(0);
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

  return (
    <Link
      to="/buyer/cart"
      className={`fixed right-4 z-[55] inline-flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-2xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        aboveMobileNav ? "bottom-20 md:bottom-5" : "bottom-5"
      }`}
      aria-label={itemCount ? `Open cart with ${itemCount} item groups` : "Open cart"}
      title="Open cart"
    >
      <ShoppingCart className="size-6" />
      {itemCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-forest px-1 text-[10px] font-bold leading-5 text-forest-foreground ring-2 ring-background">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}
