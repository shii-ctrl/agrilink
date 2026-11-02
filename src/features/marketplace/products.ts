import type { SellingUnit } from "@/features/marketplace/selling-units";

export type Classification = "Good" | "Semi" | "Reject";

export type ProductOffer = {
  id: string;
  classification: Classification;
  image?: string;
  pricePerKg: number;
  retailPricePerKg?: number;
  bundlePricePerKg?: number | null;
  bundleMinimumKg?: number | null;
  quantityKg: number;
  priceConfigured?: boolean;
};

export type Product = {
  id: string;
  name: string;
  cropType: string;
  classification: Classification;
  pricePerKg: number;
  retailPricePerKg?: number;
  bundlePricePerKg?: number | null;
  bundleMinimumKg?: number | null;
  quantityKg: number;
  description: string;
  image: string;
  sellingUnit: SellingUnit;
  offers?: ProductOffer[];
};

export const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
