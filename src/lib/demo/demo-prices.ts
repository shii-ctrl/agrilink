import { products } from "@/features/marketplace/products";

export type DemoDailyPrice = {
  id: string;
  date: string;
  listingId: string;
  product: string;
  cropType: string;
  classification: "Good" | "Semi" | "Reject";
  price: number;
  status: "Published" | "Hidden";
};

const priceKey = "agrilink-demo-daily-prices";
const priceEvent = "agrilink-demo-daily-prices-changed";

function price(
  date: string,
  listingId: string,
  value: number,
  status: DemoDailyPrice["status"] = "Published",
): DemoDailyPrice {
  const product = products.find((item) => item.id === listingId);
  if (!product) throw new Error(`Unknown listing: ${listingId}`);
  return {
    id: `${date}-${listingId}`,
    date,
    listingId,
    product: product.name,
    cropType: product.cropType,
    classification: product.classification,
    price: value,
    status,
  };
}

const initialPrices: DemoDailyPrice[] = [
  price("2026-09-01", "tomato-good", 74),
  price("2026-09-01", "tomato-semi", 50),
  price("2026-09-01", "tomato-reject", 22),
  price("2026-09-01", "cabbage-good", 58),
  price("2026-09-02", "tomato-good", 76),
  price("2026-09-02", "tomato-semi", 50),
  price("2026-09-02", "tomato-reject", 23),
  price("2026-09-02", "cabbage-good", 60),
  price("2026-09-03", "tomato-good", 75),
  price("2026-09-03", "tomato-semi", 51),
  price("2026-09-03", "tomato-reject", 23),
  price("2026-09-03", "cabbage-good", 59),
  price("2026-09-04", "tomato-good", 77),
  price("2026-09-04", "tomato-semi", 52),
  price("2026-09-04", "tomato-reject", 24),
  price("2026-09-04", "cabbage-good", 60),
  price("2026-09-05", "tomato-good", 78),
  price("2026-09-05", "tomato-semi", 52),
  price("2026-09-05", "tomato-reject", 24),
  price("2026-09-05", "cabbage-good", 60),
];

export function getDemoDailyPrices(): DemoDailyPrice[] {
  const stored = window.localStorage.getItem(priceKey);
  if (!stored) return initialPrices;
  try {
    return JSON.parse(stored) as DemoDailyPrice[];
  } catch {
    return initialPrices;
  }
}

export function saveDemoDailyPrices(entries: DemoDailyPrice[]) {
  window.localStorage.setItem(priceKey, JSON.stringify(entries));
  window.dispatchEvent(new Event(priceEvent));
}

export function publishDemoDailyPrice(entry: Omit<DemoDailyPrice, "id" | "status">) {
  const next: DemoDailyPrice = {
    ...entry,
    id: `${entry.date}-${entry.listingId}`,
    status: "Published",
  };
  const entries = getDemoDailyPrices();
  const matchingIndex = entries.findIndex((item) => item.id === next.id);
  const updated =
    matchingIndex >= 0
      ? entries.map((item, index) => (index === matchingIndex ? next : item))
      : [...entries, next];
  saveDemoDailyPrices(updated);
}

export function setDemoDailyPriceStatus(id: string, status: DemoDailyPrice["status"]) {
  saveDemoDailyPrices(
    getDemoDailyPrices().map((item) => (item.id === id ? { ...item, status } : item)),
  );
}

export function subscribeDemoDailyPrices(callback: (entries: DemoDailyPrice[]) => void) {
  const refresh = () => callback(getDemoDailyPrices());
  const onStorage = (event: StorageEvent) => {
    if (event.key === priceKey) refresh();
  };
  window.addEventListener(priceEvent, refresh);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(priceEvent, refresh);
    window.removeEventListener("storage", onStorage);
  };
}
