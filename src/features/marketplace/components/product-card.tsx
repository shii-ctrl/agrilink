import { Link } from "@tanstack/react-router";
import { ArrowUpRight, LoaderCircle, PackageX } from "lucide-react";
import { useEffect, useState } from "react";
import { peso, type Product } from "@/features/marketplace/products";
import { ClassificationBadge } from "@/features/marketplace/components/classification-badge";
import { formatSellingQuantity } from "@/features/marketplace/selling-units";

export function ProductCard({ product }: { product: Product }) {
  const offers = product.offers?.length
    ? product.offers
    : [
        {
          id: product.id,
          classification: product.classification,
          pricePerKg: product.pricePerKg,
          quantityKg: product.quantityKg,
        },
      ];
  const availableQuantity = offers.reduce((total, offer) => total + offer.quantityKg, 0);
  const pricedOffers = offers.filter((offer) => offer.priceConfigured !== false);
  const minimumPrice = pricedOffers.length
    ? Math.min(...pricedOffers.map((offer) => offer.pricePerKg))
    : 0;
  const outOfStock = availableQuantity <= 0;
  const [activeImage, setActiveImage] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const slides = offers.map((offer) => ({
    id: offer.id,
    classification: offer.classification,
    image: offer.image || product.image,
  }));
  const activeSlide = slides[activeImage] ?? slides[0];

  useEffect(() => {
    if (
      !previewing ||
      slides.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    setActiveImage((current) => (current + 1) % slides.length);
    const timer = window.setInterval(
      () => setActiveImage((current) => (current + 1) % slides.length),
      1700,
    );
    return () => window.clearInterval(timer);
  }, [previewing, slides.length]);

  function stopPreview() {
    setPreviewing(false);
    setActiveImage(0);
  }

  return (
    <Link
      to="/marketplace/$productId"
      params={{ productId: product.id }}
      preload="intent"
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          setIsOpening(true);
          setPreviewing(false);
        }
      }}
      onMouseEnter={() => setPreviewing(true)}
      onMouseLeave={stopPreview}
      onFocus={() => setPreviewing(true)}
      onBlur={stopPreview}
      aria-busy={isOpening}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-all ${
        isOpening ? "pointer-events-none" : ""
      } ${outOfStock ? "opacity-80" : "hover:-translate-y-1 hover:shadow-field"}`}
    >
      {isOpening ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center rounded-3xl border border-primary/20 bg-card px-6 py-5 text-center shadow-field">
            <span className="relative flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
              <LoaderCircle className="relative size-6 animate-spin" />
            </span>
            <span className="mt-3 font-semibold">Opening product…</span>
            <span className="mt-1 text-xs text-muted-foreground">Loading the latest stock</span>
          </div>
        </div>
      ) : null}
      <div className="relative aspect-[4/3] overflow-hidden">
        <div
          className="flex size-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${activeImage * 100}%)` }}
        >
          {slides.map((slide) => (
            <img
              key={slide.id}
              src={slide.image}
              alt={`${product.name} — ${slide.classification} quality`}
              loading="lazy"
              width={900}
              height={700}
              className="size-full shrink-0 object-cover"
            />
          ))}
        </div>
        <div className="absolute left-3 top-3 flex gap-1.5">
          {activeSlide ? <ClassificationBadge value={activeSlide.classification} /> : null}
        </div>
        {slides.length > 1 ? (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1.5 backdrop-blur-sm">
            {slides.map((slide, index) => (
              <span
                key={slide.id}
                className={`h-1.5 rounded-full transition-all ${index === activeImage ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/45"}`}
              />
            ))}
          </div>
        ) : null}
        {outOfStock ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-background/90 px-3 py-2 text-sm font-semibold text-foreground backdrop-blur-sm">
            <PackageX className="size-4 text-muted-foreground" />
            No stock
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {product.cropType}
          </p>
          <h3 className="mt-1 text-lg font-semibold capitalize">{product.name}</h3>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="text-xl font-semibold text-primary">
              {outOfStock ? "No stock" : `From ${peso(minimumPrice)}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {outOfStock
                ? "No stock available"
                : `${offers.length} quality option${offers.length === 1 ? "" : "s"} · ${formatSellingQuantity(availableQuantity, product.sellingUnit)} available`}
            </p>
          </div>
          <span
            className={`flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors ${outOfStock ? "bg-muted text-muted-foreground" : "group-hover:bg-primary group-hover:text-primary-foreground"}`}
          >
            {isOpening ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
