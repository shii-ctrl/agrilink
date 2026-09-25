import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageCheck, ShoppingBag, ShoppingCart } from "lucide-react";
import { BuyerLayout, BuyerPageHeader } from "@/components/buyer-layout";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/buyer/")({ component: BuyerDashboard });
function BuyerDashboard() {
  return (
    <BuyerLayout>
      <BuyerPageHeader
        title="Buyer Dashboard"
        description="Browse PROCY marketplace products, manage your cart, and track your submitted orders."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          <Tile
            icon={ShoppingBag}
            label="Marketplace"
            text="Browse PROCY products by Good, Semi, and Reject classifications."
            link="/marketplace"
            action="Browse products"
          />
          <Tile
            icon={ShoppingCart}
            label="My Cart"
            text="Review product quantities before placing a temporary order."
            link="/buyer/cart"
            action="Open cart"
          />
          <Tile
            icon={PackageCheck}
            label="My Orders"
            text="Track orders after they are submitted for PROCY confirmation."
            link="/buyer/orders"
            action="View orders"
          />
        </section>
        <section className="mt-6 rounded-3xl border border-primary/20 bg-accent p-6 text-sm text-accent-foreground">
          <span className="font-semibold">Order note:</span> Placing an order creates a Pending
          request for PROCY. There is no online payment gateway.
        </section>
      </main>
    </BuyerLayout>
  );
}
function Tile({
  icon: Icon,
  label,
  text,
  link,
  action,
}: {
  icon: typeof ShoppingBag;
  label: string;
  text: string;
  link: "/marketplace" | "/buyer/cart" | "/buyer/orders";
  action: string;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <Icon className="size-5 text-primary" />
      <h2 className="mt-5 text-lg font-semibold">{label}</h2>
      <p className="mt-2 min-h-12 text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline" className="mt-5 rounded-full">
        <Link to={link}>{action}</Link>
      </Button>
    </article>
  );
}
