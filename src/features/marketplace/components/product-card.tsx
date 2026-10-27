import { Link } from "@tanstack/react-router";
import { ArrowUpRight, PackageX } from "lucide-react";
import { peso, type Product } from "@/features/marketplace/products";
import { ClassificationBadge } from "@/features/marketplace/components/classification-badge";

export function ProductCard({ product }: { product: Product }) {
  const availableQuantity = product.quantityKg;
  const outOfStock = availableQuantity <= 0;

  return (
    <Link
      to="/marketplace/$productId"
      params={{ productId: product.id }}
      className={`group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-all ${
        outOfStock ? "opacity-80" : "hover:-translate-y-1 hover:shadow-field"
      }`}
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
        {outOfStock ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-background/90 px-3 py-2 text-sm font-semibold text-foreground backdrop-blur-sm">
            <PackageX className="size-4 text-muted-foreground" />
            Out of stock
          </div>
        ) : null}
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
              {outOfStock ? "Out of stock — restocking soon" : `retail / kg · ${availableQuantity} kg available`}
            </p>
            {product.bundlePricePerKg && product.bundleMinimumKg ? (
              <p className="mt-1 text-xs font-medium text-primary">
                Bundle: {peso(product.bundlePricePerKg)} / kg from {product.bundleMinimumKg} kg
              </p>
            ) : null}
          </div>
          <span className={`flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors ${outOfStock ? "bg-muted text-muted-foreground" : "group-hover:bg-primary group-hover:text-primary-foreground"}`}>
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
