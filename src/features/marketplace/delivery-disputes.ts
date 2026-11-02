import type { getMyDeliveryDisputes } from "@/services/marketplace/delivery-dispute-server-functions";

export type DeliveryDispute = Awaited<ReturnType<typeof getMyDeliveryDisputes>>[number];

export const disputeCategoryLabels: Record<string, string> = {
  missing_quantity: "Missing quantity",
  wrong_product: "Wrong product or classification",
  damaged_product: "Damaged product",
  incorrect_price: "Incorrect price",
  order_not_received: "Order not received",
  other: "Other concern",
};

export const disputeStatusLabels: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  waiting_response: "Waiting for response",
  approved: "Approved",
  rejected: "Rejected",
  resolved: "Resolved",
};

export const disputeResolutionLabels: Record<string, string> = {
  replace_product: "Replace product",
  partial_refund: "Partial refund",
  full_refund: "Full refund",
  credit_next_order: "Credit on next order",
  no_action: "No action",
};
