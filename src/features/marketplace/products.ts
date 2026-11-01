export type Classification = "Good" | "Semi" | "Reject";

export type ProductOffer = {
  id: string;
  classification: Classification;
  pricePerKg: number;
  retailPricePerKg?: number;
  bundlePricePerKg?: number | null;
  bundleMinimumKg?: number | null;
  quantityKg: number;
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
  offers?: ProductOffer[];
};

/**
 * Marketplace listings will be populated from approved PROCY receiving and
 * classification records in the marketplace data phase. Do not seed invented
 * products, prices, quantities, or quality claims on the public website.
 */
export const products: Product[] = demoPublicProducts;

export const cropTypes = [...new Set(products.map((product) => product.cropType))];

export function getProduct(id: string) {
  return products.find((p) => p.id === id);
}

export const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
import { demoPublicProducts } from "@/lib/demo/demo-data";
