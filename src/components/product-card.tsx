import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { peso, type Product } from "@/lib/products";
import { ClassificationBadge } from "@/components/classification-badge";

export function ProductCard({ product }: { product: Product }) {
  const availableQuantity = product.quantityKg;

  return (
    <Link
      to="/marketplace/$productId"
      params={{ productId: product.id }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-field"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={product.image}
          alt={`${product.name} — ${product.classification} classification`}
          loading="lazy"
          width={900}
          height={700}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3">
          <ClassificationBadge value={product.classification} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {product.cropType}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{product.name}</h3>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="text-xl font-semibold text-primary">{peso(product.pricePerKg)}</p>
            <p className="text-xs text-muted-foreground">
              retail / kg · {availableQuantity} kg{" "}
              {availableQuantity > 0 ? "available" : "unavailable"}
            </p>
            {product.bundlePricePerKg && product.bundleMinimumKg ? (
              <p className="mt-1 text-xs font-medium text-primary">
                Bundle: {peso(product.bundlePricePerKg)} / kg from {product.bundleMinimumKg} kg
              </p>
            ) : null}
          </div>
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
