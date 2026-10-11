import { demoReceivingRecords } from "@/lib/demo/demo-data";
import { getDemoInventory, saveDemoInventory } from "@/lib/demo/demo-inventory";
import { products } from "@/features/marketplace/products";

export type DemoReceivingRecord = (typeof demoReceivingRecords)[number];

const receivingKey = "agrilink-demo-receiving-records";
const receivingEvent = "agrilink-demo-receiving-records-changed";

export function getDemoReceivingRecords(): DemoReceivingRecord[] {
  try {
    const stored = window.localStorage.getItem(receivingKey);
    return stored ? (JSON.parse(stored) as DemoReceivingRecord[]) : demoReceivingRecords;
  } catch {
    return demoReceivingRecords;
  }
}

export function saveDemoReceivingRecords(records: DemoReceivingRecord[]) {
  window.localStorage.setItem(receivingKey, JSON.stringify(records));
  window.dispatchEvent(new Event(receivingEvent));
}

export function addDemoReceivingRecord(record: DemoReceivingRecord) {
  saveDemoReceivingRecords([...getDemoReceivingRecords(), record]);
  const quantities = { Good: record.good, Semi: record.semi, Reject: record.reject } as const;
  const inventory = { ...getDemoInventory() };
  (Object.entries(quantities) as [keyof typeof quantities, string][]).forEach(
    ([classification, amount]) => {
      const listing = products.find(
        (product) =>
          product.name.toLowerCase() === record.product.toLowerCase() &&
          product.classification === classification,
      );
      if (listing)
        inventory[listing.id] = (inventory[listing.id] ?? 0) + (Number.parseFloat(amount) || 0);
    },
  );
  saveDemoInventory(inventory);
}

export function subscribeDemoReceivingRecords(callback: (records: DemoReceivingRecord[]) => void) {
  const refresh = () => callback(getDemoReceivingRecords());
  const onStorage = (event: StorageEvent) => {
    if (event.key === receivingKey) refresh();
  };
  window.addEventListener(receivingEvent, refresh);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(receivingEvent, refresh);
    window.removeEventListener("storage", onStorage);
  };
}
