import type { SellingUnit } from "@/features/marketplace/selling-units";

type ReceiptOrder = {
  orderNumber: string;
  buyer: string;
  recipientName: string | null;
  contact: string;
  deliveryAddress: string | null;
  preferredSchedule: string | null;
  deliveryInstructions: string | null;
  assignedRiderName: string | null;
  createdAt: string;
  totalAmount: number;
  deliveryFee: number;
  payment: { paymentNumber: string; paidAt: string | null } | null;
  items: {
    name: string;
    classification: string;
    sellingUnit: SellingUnit;
    quantityKg: number;
    pricePerKg: number;
  }[];
};
type Collection = { amount: string | number; collectedAt: Date | string } | null;
const money = (value: number) => Math.round(value * 100) / 100;

/** Buyer-facing dispatch document; never changes payment or fulfillment records. */
export function buildDeliveryReceipt(
  order: ReceiptOrder,
  collection: Collection,
  printedAt: string,
) {
  const total = money(order.totalAmount);
  const deliveryFee = money(order.deliveryFee);
  const items = order.items.map((item) => ({
    name: item.name,
    classification: item.classification,
    sellingUnit: item.sellingUnit,
    quantity: item.quantityKg,
    unitPrice: item.pricePerKg,
    lineTotal: money(item.quantityKg * item.pricePerKg),
  }));
  const subtotal = money(total - deliveryFee);
  const roundedLines = items.reduce((sum, item) => sum + Math.round(item.lineTotal * 100), 0) / 100;
  const collected = collection ? money(Number(collection.amount)) : 0;
  const amountDue = order.payment ? 0 : Math.max(0, money(total - collected));
  return {
    orderNumber: order.orderNumber,
    recipientName: order.recipientName || order.buyer,
    contact: order.contact,
    deliveryAddress: order.deliveryAddress,
    preferredSchedule: order.preferredSchedule,
    deliveryInstructions: order.deliveryInstructions,
    riderName: order.assignedRiderName,
    orderDate: order.createdAt,
    printedAt,
    items,
    subtotal,
    deliveryFee,
    total,
    roundingAdjustment: money(subtotal - roundedLines),
    paymentStatus: order.payment
      ? ("paid" as const)
      : collection
        ? ("collected" as const)
        : ("cod" as const),
    paymentReference: order.payment?.paymentNumber ?? null,
    paidAt: order.payment?.paidAt ?? null,
    collectedAmount: collected,
    collectedAt: collection ? new Date(collection.collectedAt).toISOString() : null,
    amountDue,
  };
}

export type DeliveryReceipt = ReturnType<typeof buildDeliveryReceipt>;
