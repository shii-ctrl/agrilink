export type DemoOrderStatus = "Pending" | "Confirmed" | "Sold" | "Cancelled" | "Rejected";
export type DemoPaymentStatus = "Unpaid" | "Paid";

export type DemoOrderItem = {
  listingId: string;
  name: string;
  classification: string;
  quantityKg: number;
  pricePerKg: number;
  image?: string | null;
};

export type DemoOrderAllocation = {
  farmer: string;
  product: string;
  classification: string;
  quantityKg: number;
  receivedAt: string;
};

export type DemoOrder = {
  id: string;
  buyer: string;
  buyerUsername?: string;
  farmer: string;
  product: string;
  classification: string;
  quantity: string;
  total: string;
  amount?: number;
  deliveryFee?: number;
  status: DemoOrderStatus;
  paymentStatus: DemoPaymentStatus;
  date: string;
  createdAt?: string;
  paymentId?: string;
  paymentMethod?: string;
  paidAt?: string;
  contact?: string;
  pickupNote?: string;
  confirmedAt?: string;
  soldAt?: string;
  items?: DemoOrderItem[];
  allocations?: DemoOrderAllocation[];
  history?: { status: string; note: string | null; changedAt: string }[];
  stockReserved?: boolean;
};
export const initialDemoOrders: DemoOrder[] = [
  {
    id: "ORD-2026-001",
    buyer: "Carlo Mendoza",
    buyerUsername: "buyer.demo",
    farmer: "Juan Dela Cruz",
    product: "Tomato",
    classification: "Good",
    quantity: "15 kg",
    total: "₱1,170",
    status: "Pending",
    paymentStatus: "Unpaid",
    date: "Sep 02, 2026",
    contact: "0917 555 0115",
    pickupNote: "Buyer will coordinate pickup with PROCY.",
  },
  {
    id: "ORD-2026-002",
    buyer: "Carlo Mendoza",
    buyerUsername: "buyer.demo",
    farmer: "Juan Dela Cruz",
    product: "Tomato",
    classification: "Good",
    quantity: "25 kg",
    total: "₱1,950",
    status: "Sold",
    paymentStatus: "Paid",
    paymentId: "PAY-2026-001",
    paymentMethod: "Cash",
    paidAt: "Sep 02, 2026",
    confirmedAt: "Sep 01, 2026",
    soldAt: "Sep 01, 2026",
    contact: "0917 555 0115",
    pickupNote: "Pickup completed at the PROCY collection point.",
    stockReserved: true,
    items: [
      {
        listingId: "tomato-good",
        name: "Tomato",
        classification: "Good",
        quantityKg: 25,
        pricePerKg: 78,
      },
    ],
    date: "Sep 01, 2026",
  },
];
const orderKey = "agrilink-demo-procy-orders";
const orderEvent = "agrilink-demo-orders-changed";

function normalizeOrder(order: Partial<DemoOrder>): DemoOrder {
  return {
    id: order.id ?? "ORD-DEMO",
    buyer: order.buyer ?? "Carlo Mendoza",
    ...(order.buyerUsername ? { buyerUsername: order.buyerUsername } : {}),
    farmer: order.farmer ?? "Juan Dela Cruz",
    product: order.product ?? "Product",
    classification: order.classification ?? "Good",
    quantity: order.quantity ?? "0 kg",
    total: order.total ?? "₱0",
    ...(order.deliveryFee !== undefined ? { deliveryFee: order.deliveryFee } : {}),
    status: order.status ?? "Pending",
    paymentStatus: order.paymentStatus ?? "Unpaid",
    date: order.date ?? "Just now",
    ...(order.createdAt ? { createdAt: order.createdAt } : {}),
    ...(order.amount !== undefined ? { amount: order.amount } : {}),
    ...(order.paymentId ? { paymentId: order.paymentId } : {}),
    ...(order.paymentMethod ? { paymentMethod: order.paymentMethod } : {}),
    ...(order.paidAt ? { paidAt: order.paidAt } : {}),
    contact: order.contact ?? "Not yet provided",
    pickupNote: order.pickupNote ?? "No pickup or delivery note provided",
    ...(order.confirmedAt ? { confirmedAt: order.confirmedAt } : {}),
    ...(order.soldAt ? { soldAt: order.soldAt } : {}),
    ...(order.items ? { items: order.items } : {}),
    ...(order.history ? { history: order.history } : {}),
    stockReserved: order.stockReserved ?? order.status === "Sold",
  };
}

export function getDemoOrders() {
  const stored = window.localStorage.getItem(orderKey);
  if (!stored) return initialDemoOrders;
  try {
    return (JSON.parse(stored) as Partial<DemoOrder>[]).map(normalizeOrder);
  } catch {
    return initialDemoOrders;
  }
}
export function saveDemoOrders(orders: DemoOrder[]) {
  window.localStorage.setItem(orderKey, JSON.stringify(orders));
  window.dispatchEvent(new Event(orderEvent));
}
export function updateDemoOrder(id: string, changes: Partial<DemoOrder>) {
  const next = getDemoOrders().map((order) => (order.id === id ? { ...order, ...changes } : order));
  saveDemoOrders(next);
  return next;
}

export function getOrderInventoryLines(order: DemoOrder): InventoryLine[] {
  if (order.items?.length) {
    return order.items.map(({ listingId, quantityKg }) => ({ listingId, quantityKg }));
  }
  const listing = products.find(
    (product) => product.name === order.product && product.classification === order.classification,
  );
  const quantityKg = Number.parseFloat(order.quantity) || 0;
  return listing ? [{ listingId: listing.id, quantityKg }] : [];
}
export function subscribeDemoOrders(callback: (orders: DemoOrder[]) => void) {
  const refresh = () => callback(getDemoOrders());
  const onStorage = (event: StorageEvent) => {
    if (event.key === orderKey) refresh();
  };
  window.addEventListener(orderEvent, refresh);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(orderEvent, refresh);
    window.removeEventListener("storage", onStorage);
  };
}
import { products } from "@/features/marketplace/products";
import type { InventoryLine } from "@/lib/demo/demo-inventory";
