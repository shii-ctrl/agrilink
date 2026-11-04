import { Link } from "@tanstack/react-router";
import { ArrowUpRight, LoaderCircle, PackageX } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { peso, type Product } from "@/features/marketplace/products";
import { ClassificationBadge } from "@/features/marketplace/components/classification-badge";
import { formatSellingQuantity } from "@/features/marketplace/selling-units";

export function ProductCard({
  product,
  mobileView = "grid",
}: {
  product: Product;
  mobileView?: "grid" | "list";
}) {
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

  useEffect(() => {
    if (!isOpening) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpening]);

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
      className={`group relative overflow-hidden border border-border bg-card shadow-card transition-all sm:flex sm:flex-col sm:rounded-3xl ${
        mobileView === "list" ? "flex flex-row rounded-2xl" : "flex flex-col rounded-2xl"
      } ${
        isOpening ? "pointer-events-none" : ""
      } ${outOfStock ? "opacity-80" : "hover:-translate-y-1 hover:shadow-field"}`}
    >
      {isOpening && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex cursor-wait items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
              role="status"
              aria-live="assertive"
              aria-label={`Opening ${product.name}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <div className="flex flex-col items-center rounded-3xl border border-primary/20 bg-card px-7 py-6 text-center shadow-field">
                <span className="relative flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
                  <LoaderCircle className="relative size-7 animate-spin" />
                </span>
                <span className="mt-4 text-lg font-semibold">Opening product…</span>
                <span className="mt-1 text-sm text-muted-foreground">Loading the latest stock</span>
                <span className="mt-3 text-xs text-muted-foreground">Please wait a moment</span>
              </div>
            </div>,
            document.body,
          )
        : null}
      <div
        className={`relative shrink-0 overflow-hidden sm:aspect-[4/3] sm:w-full ${
          mobileView === "list" ? "aspect-square w-28" : "aspect-square w-full"
        }`}
      >
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
        <div className="absolute left-2 top-2 flex gap-1.5 sm:left-3 sm:top-3">
          {activeSlide ? <ClassificationBadge value={activeSlide.classification} /> : null}
        </div>
        {slides.length > 1 ? (
          <div className="absolute bottom-2 left-1/2 hidden -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1.5 backdrop-blur-sm sm:flex">
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
      <div
        className={`flex min-w-0 flex-1 flex-col sm:gap-3 sm:p-5 ${
          mobileView === "list" ? "gap-1.5 p-3" : "gap-2 p-3"
        }`}
      >
        <div>
          <p className="truncate text-[0.65rem] uppercase tracking-wide text-muted-foreground sm:text-xs">
            {product.cropType}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold capitalize sm:mt-1 sm:text-lg">
            {product.name}
          </h3>
        </div>
        <p className="hidden line-clamp-2 text-sm text-muted-foreground sm:block">
          {product.description}
        </p>
        <div className="mt-auto flex min-w-0 items-end justify-between gap-1 pt-1 sm:pt-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary sm:text-xl">
              {outOfStock ? "No stock" : `From ${peso(minimumPrice)}`}
            </p>
            <p className="truncate text-[0.65rem] text-muted-foreground sm:text-xs">
              {outOfStock
                ? "No stock available"
                : `${offers.length} quality option${offers.length === 1 ? "" : "s"} · ${formatSellingQuantity(availableQuantity, product.sellingUnit)} available`}
            </p>
          </div>
          <span
            className={`hidden size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors sm:flex ${outOfStock ? "bg-muted text-muted-foreground" : "group-hover:bg-primary group-hover:text-primary-foreground"}`}
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
