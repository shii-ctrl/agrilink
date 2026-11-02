import type { SellingUnit } from "@/features/marketplace/selling-units";

export type OrderStatus = "Pending" | "Confirmed" | "Sold" | "Cancelled" | "Rejected";
export type PaymentStatus = "Unpaid" | "Paid";
export type FulfillmentMethod = "pickup" | "delivery";
export type FulfillmentStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "ready_for_dispatch"
  | "rider_assigned"
  | "out_for_delivery"
  | "delivery_failed"
  | "rescheduled"
  | "picked_up"
  | "delivered"
  | "cancelled"
  | "rejected";

export type OrderLine = {
  listingId: string;
  name: string;
  classification: string;
  quantityKg: number;
  pricePerKg: number;
  image?: string | null;
  sellingUnit?: SellingUnit;
};

export type OrderAllocation = {
  farmer: string;
  product: string;
  classification: string;
  quantityKg: number;
  receivedAt: string;
};

/** Shared order DTO returned by the marketplace service to role workspaces. */
export type OrderRecord = {
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
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  date: string;
  createdAt?: string;
  paymentId?: string;
  paymentMethod?: string;
  paidAt?: string;
  contact?: string;
  pickupNote?: string;
  fulfillmentMethod?: FulfillmentMethod;
  fulfillmentStatus?: FulfillmentStatus;
  recipientName?: string | null;
  deliveryAddress?: string | null;
  preferredSchedule?: string | null;
  deliveryInstructions?: string | null;
  assignedRiderId?: string | null;
  assignedRiderName?: string | null;
  deliveryOtpCode?: string | null;
  deliveryProof?: {
    recipientName: string | null;
    proofPhotoUrl: string | null;
    signatureUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    attemptedAt: string;
  } | null;
  fulfilledAt?: string;
  confirmedAt?: string;
  soldAt?: string;
  items?: OrderLine[];
  allocations?: OrderAllocation[];
  history?: { status: string; note: string | null; changedAt: string }[];
  stockReserved?: boolean;
};
