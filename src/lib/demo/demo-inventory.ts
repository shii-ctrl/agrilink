import { demoPublicProducts as products } from "@/lib/demo/demo-data";

export type InventoryLine = {
  listingId: string;
  quantityKg: number;
};

const inventoryKey = "agrilink-demo-classified-inventory";
const inventoryEvent = "agrilink-demo-classified-inventory-changed";

function initialInventory() {
  return Object.fromEntries(products.map((product) => [product.id, product.quantityKg]));
}

export function getDemoInventory(): Record<string, number> {
  const stored = window.localStorage.getItem(inventoryKey);
  if (!stored) return initialInventory();

  try {
    return { ...initialInventory(), ...(JSON.parse(stored) as Record<string, number>) };
  } catch {
    return initialInventory();
  }
}

export function getAvailableQuantity(listingId: string, fallbackQuantity = 0) {
  return getDemoInventory()[listingId] ?? fallbackQuantity;
}

export function saveDemoInventory(inventory: Record<string, number>) {
  window.localStorage.setItem(inventoryKey, JSON.stringify(inventory));
  window.dispatchEvent(new Event(inventoryEvent));
}

export function checkInventory(lines: InventoryLine[]) {
  const inventory = getDemoInventory();
  const requested = lines.reduce<Record<string, number>>((total, line) => {
    total[line.listingId] = (total[line.listingId] ?? 0) + line.quantityKg;
    return total;
  }, {});
  const unavailable = Object.entries(requested).find(
    ([listingId, quantityKg]) => quantityKg > (inventory[listingId] ?? 0),
  );
  return {
    available: !unavailable,
    listingId: unavailable?.[0],
    availableQuantity: unavailable ? (inventory[unavailable[0]] ?? 0) : undefined,
  };
}

export function reserveInventory(lines: InventoryLine[]) {
  const check = checkInventory(lines);
  if (!check.available) return check;

  const next = { ...getDemoInventory() };
  for (const line of lines) {
    next[line.listingId] = (next[line.listingId] ?? 0) - line.quantityKg;
  }
  saveDemoInventory(next);
  return check;
}

export function subscribeDemoInventory(callback: (inventory: Record<string, number>) => void) {
  const refresh = () => callback(getDemoInventory());
  const onStorage = (event: StorageEvent) => {
    if (event.key === inventoryKey) refresh();
  };
  window.addEventListener(inventoryEvent, refresh);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(inventoryEvent, refresh);
    window.removeEventListener("storage", onStorage);
  };
}
