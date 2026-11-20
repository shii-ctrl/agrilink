import { and, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildDeliveryReceipt } from "@/features/marketplace/delivery-receipt";
import { getOrderDetails } from "@/services/marketplace/marketplace-server-functions";

export const getMarketerDeliveryReceipt = createServerFn({ method: "GET" })
  .validator(z.object({ orderNumber: z.string().trim().min(3).max(40) }))
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/services/auth/auth-server");
    await requireRole("Marketer");
    const order = await getOrderDetails({ data });
    if (
      order.fulfillmentMethod !== "delivery" ||
      !["confirmed", "sold"].includes(order.status) ||
      ![
        "ready_for_dispatch",
        "rider_assigned",
        "out_for_delivery",
        "delivery_failed",
        "rescheduled",
        "delivered",
      ].includes(order.fulfillmentStatus)
    ) {
      throw new Error("Delivery receipts are available once an order is ready for dispatch.");
    }
    const { db } = await import("@/db/client.server");
    const { codRemittances, orders } = await import("@/db/schema");
    const [collection] = await db
      .select({ amount: codRemittances.amount, collectedAt: codRemittances.collectedAt })
      .from(codRemittances)
      .innerJoin(orders, eq(codRemittances.orderId, orders.id))
      .where(
        and(eq(orders.orderNumber, data.orderNumber), eq(orders.fulfillmentMethod, "delivery")),
      );
    return buildDeliveryReceipt(order, collection ?? null, new Date().toISOString());
  });
