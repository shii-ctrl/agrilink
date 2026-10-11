import type { Product } from "@/features/marketplace/products";
import { getDemoAccount } from "@/lib/demo/demo-session";

export type CartItem = Pick<Product, "id" | "name" | "classification" | "pricePerKg" | "image"> & {
  quantityKg: number;
  availableQuantityKg?: number;
};

const cartKey = "agrilink-demo-cart";

function currentCartKey() {
  const username = getDemoAccount()?.username;
  return username ? `${cartKey}-${username}` : cartKey;
}

export function getDemoCart(): CartItem[] {
  const stored = window.localStorage.getItem(currentCartKey());
  return stored ? (JSON.parse(stored) as CartItem[]) : [];
}

export function saveDemoCart(items: CartItem[]) {
  window.localStorage.setItem(currentCartKey(), JSON.stringify(items));
}

export function addToDemoCart(product: Product, quantityKg: number) {
  const cart = getDemoCart();
  const existing = cart.find((item) => item.id === product.id);
  const availableQuantity = product.quantityKg;
  const additionalQuantity = Math.max(
    0,
    Math.min(quantityKg, availableQuantity - (existing?.quantityKg ?? 0)),
  );
  if (additionalQuantity === 0) return { cart, addedQuantity: 0, availableQuantity };
  const next = existing
    ? cart.map((item) =>
        item.id === product.id
          ? { ...item, quantityKg: item.quantityKg + additionalQuantity }
          : item,
      )
    : [
        ...cart,
        {
          id: product.id,
          name: product.name,
          classification: product.classification,
          pricePerKg: product.pricePerKg,
          image: product.image,
          availableQuantityKg: product.quantityKg,
          quantityKg: additionalQuantity,
        },
      ];
  saveDemoCart(next);
  return { cart: next, addedQuantity: additionalQuantity, availableQuantity };
}
