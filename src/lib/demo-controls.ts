import { products } from "@/lib/products";

const dataKeys = [
  "agrilink-demo-procy-orders",
  "agrilink-demo-classified-inventory",
  "agrilink-demo-daily-prices",
  "agrilink-demo-notifications",
  "agrilink-demo-cart",
  "agrilink-demo-buyer-orders",
  "agrilink-demo-production-records",
  "agrilink-demo-users",
  "agrilink-demo-receiving-records",
] as const;

const dataEvents = [
  "agrilink-demo-orders-changed",
  "agrilink-demo-classified-inventory-changed",
  "agrilink-demo-daily-prices-changed",
  "agrilink-demo-notifications-changed",
] as const;

const draftsKey = "agrilink-demo-saved-drafts";
const draftsEvent = "agrilink-demo-saved-drafts-changed";

export type DemoDraft = {
  id: string;
  name: string;
  savedAt: string;
  state: Record<(typeof dataKeys)[number], string | null>;
};

function notifyDataChange() {
  dataEvents.forEach((eventName) => window.dispatchEvent(new Event(eventName)));
}

function applyState(state: Record<(typeof dataKeys)[number], string | null>) {
  dataKeys.forEach((key) => {
    const value = state[key];
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  });
  notifyDataChange();
}

export function loadSampleDemoData() {
  applyState(Object.fromEntries(dataKeys.map((key) => [key, null])) as DemoDraft["state"]);
}

export function resetDemoData() {
  const emptyInventory = Object.fromEntries(products.map((product) => [product.id, 0]));
  applyState({
    "agrilink-demo-procy-orders": "[]",
    "agrilink-demo-classified-inventory": JSON.stringify(emptyInventory),
    "agrilink-demo-daily-prices": "[]",
    "agrilink-demo-notifications": "[]",
    "agrilink-demo-cart": "[]",
    "agrilink-demo-buyer-orders": "[]",
    "agrilink-demo-production-records": "[]",
    "agrilink-demo-users": "[]",
    "agrilink-demo-receiving-records": "[]",
  });
}

export function getDemoDrafts(): DemoDraft[] {
  try {
    return JSON.parse(window.localStorage.getItem(draftsKey) ?? "[]") as DemoDraft[];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: DemoDraft[]) {
  window.localStorage.setItem(draftsKey, JSON.stringify(drafts));
  window.dispatchEvent(new Event(draftsEvent));
}

export function saveCurrentDemoDraft(name: string) {
  const draft: DemoDraft = {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled demonstration",
    savedAt: new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }),
    state: Object.fromEntries(
      dataKeys.map((key) => [key, window.localStorage.getItem(key)]),
    ) as DemoDraft["state"],
  };
  saveDrafts([draft, ...getDemoDrafts()].slice(0, 12));
  return draft;
}

export function restoreDemoDraft(draft: DemoDraft) {
  applyState(draft.state);
}

export function deleteDemoDraft(id: string) {
  saveDrafts(getDemoDrafts().filter((draft) => draft.id !== id));
}

export function subscribeDemoDrafts(callback: (drafts: DemoDraft[]) => void) {
  const refresh = () => callback(getDemoDrafts());
  window.addEventListener(draftsEvent, refresh);
  window.addEventListener("storage", refresh);
  return () => {
    window.removeEventListener(draftsEvent, refresh);
    window.removeEventListener("storage", refresh);
  };
}
