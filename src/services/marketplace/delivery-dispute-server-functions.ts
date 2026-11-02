import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const disputeCategories = [
  "missing_quantity",
  "wrong_product",
  "damaged_product",
  "incorrect_price",
  "order_not_received",
  "other",
] as const;
const disputeStatuses = [
  "submitted",
  "under_review",
  "waiting_response",
  "approved",
  "rejected",
  "resolved",
] as const;
const disputeResolutions = [
  "replace_product",
  "partial_refund",
  "full_refund",
  "credit_next_order",
  "no_action",
] as const;

const createDisputeInput = z.object({
  orderNumber: z.string().trim().min(3).max(40),
  category: z.enum(disputeCategories),
  description: z.string().trim().min(10).max(2_000),
  attachmentUrl: z.string().startsWith("data:image/").max(2_400_000).nullable(),
});
const disputeIdInput = z.object({ disputeId: z.string().uuid() });
const responseInput = disputeIdInput.extend({ message: z.string().trim().min(2).max(2_000) });
const reviewInput = disputeIdInput.extend({
  status: z.enum(disputeStatuses),
  resolution: z.enum(disputeResolutions).nullable(),
  resolutionNote: z.string().trim().min(3).max(2_000),
  refundAmount: z.number().min(0).max(1_000_000).nullable(),
});

const targetByRole = {
  Buyer: "/buyer/issues",
  Management: "/management/disputes",
  Marketer: "/marketer/disputes",
  Rider: "/rider/disputes",
  Accounting: "/accounting/refunds",
} as const;

function actorRole(roles: string[]) {
  return ["Management", "Marketer", "Rider", "Accounting", "Buyer"].find((role) =>
    roles.includes(role),
  );
}

function disputeNumber() {
  return `DSP-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function fetchDisputes() {
  const { asc, desc, eq } = await import("drizzle-orm");
  const { db } = await import("@/db/client.server");
  const { deliveryDisputeEvents, deliveryDisputeResponses, deliveryDisputes, orders, users } =
    await import("@/db/schema");
  const [rows, responseRows, eventRows] = await Promise.all([
    db
      .select({
        id: deliveryDisputes.id,
        disputeNumber: deliveryDisputes.disputeNumber,
        orderId: deliveryDisputes.orderId,
        orderNumber: orders.orderNumber,
        buyerId: deliveryDisputes.buyerId,
        buyerName: users.displayName,
        riderId: orders.assignedRiderId,
        category: deliveryDisputes.category,
        description: deliveryDisputes.description,
        attachmentUrl: deliveryDisputes.attachmentUrl,
        status: deliveryDisputes.status,
        resolution: deliveryDisputes.resolution,
        resolutionNote: deliveryDisputes.resolutionNote,
        refundAmount: deliveryDisputes.refundAmount,
        refundStatus: deliveryDisputes.refundStatus,
        totalAmount: orders.totalAmount,
        openedAt: deliveryDisputes.openedAt,
        resolvedAt: deliveryDisputes.resolvedAt,
        updatedAt: deliveryDisputes.updatedAt,
      })
      .from(deliveryDisputes)
      .innerJoin(orders, eq(deliveryDisputes.orderId, orders.id))
      .innerJoin(users, eq(deliveryDisputes.buyerId, users.id))
      .orderBy(desc(deliveryDisputes.updatedAt)),
    db
      .select({
        id: deliveryDisputeResponses.id,
        disputeId: deliveryDisputeResponses.disputeId,
        authorId: deliveryDisputeResponses.authorId,
        authorName: users.displayName,
        authorRole: deliveryDisputeResponses.authorRole,
        message: deliveryDisputeResponses.message,
        createdAt: deliveryDisputeResponses.createdAt,
      })
      .from(deliveryDisputeResponses)
      .innerJoin(users, eq(deliveryDisputeResponses.authorId, users.id))
      .orderBy(asc(deliveryDisputeResponses.createdAt)),
    db
      .select({
        id: deliveryDisputeEvents.id,
        disputeId: deliveryDisputeEvents.disputeId,
        event: deliveryDisputeEvents.event,
        note: deliveryDisputeEvents.note,
        createdAt: deliveryDisputeEvents.createdAt,
      })
      .from(deliveryDisputeEvents)
      .orderBy(asc(deliveryDisputeEvents.createdAt)),
  ]);
  return rows.map((row) => ({
    ...row,
    refundAmount: row.refundAmount === null ? null : Number(row.refundAmount),
    totalAmount: Number(row.totalAmount),
    openedAt: row.openedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    responses: responseRows
      .filter((response) => response.disputeId === row.id)
      .map((response) => ({ ...response, createdAt: response.createdAt.toISOString() })),
    events: eventRows
      .filter((event) => event.disputeId === row.id)
      .map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
  }));
}

export const createDeliveryDispute = createServerFn({ method: "POST" })
  .validator(createDisputeInput)
  .handler(async ({ data }) => {
    const { and, eq } = await import("drizzle-orm");
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    const { db } = await import("@/db/client.server");
    const { deliveryDisputeEvents, deliveryDisputes, orders } = await import("@/db/schema");
    const now = new Date();
    const created = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.orderNumber, data.orderNumber), eq(orders.buyerId, buyer.id)));
      if (!order || order.fulfillmentMethod !== "delivery") {
        throw new Error("This delivery order could not be found.");
      }
      if (order.fulfillmentStatus !== "delivered" || !order.fulfilledAt) {
        throw new Error("An issue can be reported only after delivery is completed.");
      }
      if (now.getTime() - order.fulfilledAt.getTime() > 24 * 60 * 60 * 1000) {
        throw new Error("The 24-hour reporting window for this delivery has ended.");
      }
      const [existing] = await tx
        .select({ id: deliveryDisputes.id })
        .from(deliveryDisputes)
        .where(eq(deliveryDisputes.orderId, order.id));
      if (existing) throw new Error("An issue has already been reported for this order.");
      const id = crypto.randomUUID();
      const number = disputeNumber();
      await tx.insert(deliveryDisputes).values({
        id,
        disputeNumber: number,
        orderId: order.id,
        buyerId: buyer.id,
        category: data.category,
        description: data.description,
        attachmentUrl: data.attachmentUrl,
        openedAt: now,
      });
      await tx.insert(deliveryDisputeEvents).values({
        id: crypto.randomUUID(),
        disputeId: id,
        actorId: buyer.id,
        event: "submitted",
        note: "Buyer submitted a delivery issue.",
      });
      return {
        id,
        disputeNumber: number,
        riderId: order.assignedRiderId,
        orderNumber: order.orderNumber,
      };
    });
    await writeAuditLog(buyer.id, "delivery_dispute.create", "delivery_dispute", created.id, {
      disputeNumber: created.disputeNumber,
      orderNumber: created.orderNumber,
      category: data.category,
    });
    const { notifyRole, notifyUser } = await import("@/services/messaging/notification-server");
    await Promise.all([
      notifyRole("Management", {
        title: "New delivery issue",
        message: `${created.disputeNumber} needs review.`,
        target: targetByRole.Management,
      }),
      notifyRole("Marketer", {
        title: "New delivery issue",
        message: `${created.disputeNumber} may require a product response.`,
        target: targetByRole.Marketer,
      }),
      created.riderId
        ? notifyUser(created.riderId, {
            title: "Delivery issue reported",
            message: `${created.disputeNumber} may require your response.`,
            target: targetByRole.Rider,
          })
        : Promise.resolve(),
    ]);
    return created;
  });

export const getMyDeliveryDisputes = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const buyer = await requireRole("Buyer");
  return (await fetchDisputes()).filter((dispute) => dispute.buyerId === buyer.id);
});

export const getOperationalDeliveryDisputes = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAnyRole } = await import("@/services/auth/auth-server");
    const actor = await requireAnyRole(["Management", "Marketer", "Rider"]);
    const disputes = await fetchDisputes();
    if (actor.roles.includes("Management") || actor.roles.includes("Marketer")) return disputes;
    return disputes.filter((dispute) => dispute.riderId === actor.id);
  },
);

export const respondToDeliveryDispute = createServerFn({ method: "POST" })
  .validator(responseInput)
  .handler(async ({ data }) => {
    const { eq } = await import("drizzle-orm");
    const { requireAnyRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireAnyRole(["Buyer", "Management", "Marketer", "Rider"]);
    const role = actorRole(actor.roles);
    if (!role) throw new Error("Your account cannot respond to this issue.");
    const { db } = await import("@/db/client.server");
    const { deliveryDisputeEvents, deliveryDisputeResponses, deliveryDisputes, orders } =
      await import("@/db/schema");
    const [row] = await db
      .select({ dispute: deliveryDisputes, order: orders })
      .from(deliveryDisputes)
      .innerJoin(orders, eq(deliveryDisputes.orderId, orders.id))
      .where(eq(deliveryDisputes.id, data.disputeId));
    if (!row) throw new Error("This delivery issue could not be found.");
    const permitted =
      actor.roles.includes("Management") ||
      actor.roles.includes("Marketer") ||
      row.dispute.buyerId === actor.id ||
      row.order.assignedRiderId === actor.id;
    if (!permitted) throw new Error("You cannot respond to this delivery issue.");
    if (["rejected", "resolved"].includes(row.dispute.status)) {
      throw new Error("This delivery issue is already closed.");
    }
    await db.transaction(async (tx) => {
      await tx.insert(deliveryDisputeResponses).values({
        id: crypto.randomUUID(),
        disputeId: row.dispute.id,
        authorId: actor.id,
        authorRole: role,
        message: data.message,
      });
      await tx.insert(deliveryDisputeEvents).values({
        id: crypto.randomUUID(),
        disputeId: row.dispute.id,
        actorId: actor.id,
        event: "response_added",
        note: `${role} added a response.`,
      });
    });
    await writeAuditLog(actor.id, "delivery_dispute.respond", "delivery_dispute", row.dispute.id, {
      role,
    });
    const { notifyRole, notifyUser } = await import("@/services/messaging/notification-server");
    await Promise.all([
      notifyUser(row.dispute.buyerId, {
        title: "Delivery issue updated",
        message: `${row.dispute.disputeNumber} received a ${role} response.`,
        target: targetByRole.Buyer,
      }),
      notifyRole("Management", {
        title: "Delivery issue response",
        message: `${row.dispute.disputeNumber} received a ${role} response.`,
        target: targetByRole.Management,
      }),
    ]);
    return { success: true };
  });

export const reviewDeliveryDispute = createServerFn({ method: "POST" })
  .validator(reviewInput)
  .handler(async ({ data }) => {
    const { eq } = await import("drizzle-orm");
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const manager = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { deliveryDisputeEvents, deliveryDisputes, orders } = await import("@/db/schema");
    const [row] = await db
      .select({ dispute: deliveryDisputes, totalAmount: orders.totalAmount })
      .from(deliveryDisputes)
      .innerJoin(orders, eq(deliveryDisputes.orderId, orders.id))
      .where(eq(deliveryDisputes.id, data.disputeId));
    if (!row) throw new Error("This delivery issue could not be found.");
    if (row.dispute.refundStatus === "processed") {
      throw new Error("A processed refund case can no longer be changed.");
    }
    const refundResolution = ["partial_refund", "full_refund"].includes(data.resolution ?? "");
    const refundAmount = refundResolution
      ? data.resolution === "full_refund"
        ? Number(row.totalAmount)
        : (data.refundAmount ?? 0)
      : null;
    if (refundResolution && (!refundAmount || refundAmount <= 0)) {
      throw new Error("Enter a valid approved refund amount.");
    }
    if (refundAmount && refundAmount > Number(row.totalAmount)) {
      throw new Error("The refund cannot exceed the order total.");
    }
    if (["approved", "rejected", "resolved"].includes(data.status) && !data.resolution) {
      throw new Error("Choose a resolution before closing the review.");
    }
    if (refundResolution && data.status === "resolved") {
      throw new Error("Approve the refund first so Accounting can process it before resolution.");
    }
    const now = new Date();
    const refundStatus =
      refundResolution && ["approved", "resolved"].includes(data.status)
        ? "pending"
        : "not_required";
    await db.transaction(async (tx) => {
      await tx
        .update(deliveryDisputes)
        .set({
          status: data.status,
          resolution: data.resolution,
          resolutionNote: data.resolutionNote,
          refundAmount: refundAmount?.toFixed(2) ?? null,
          refundStatus,
          decidedById: manager.id,
          resolvedAt: ["rejected", "resolved"].includes(data.status) ? now : null,
        })
        .where(eq(deliveryDisputes.id, row.dispute.id));
      await tx.insert(deliveryDisputeEvents).values({
        id: crypto.randomUUID(),
        disputeId: row.dispute.id,
        actorId: manager.id,
        event: `status_${data.status}`,
        note: data.resolutionNote,
      });
    });
    await writeAuditLog(manager.id, "delivery_dispute.review", "delivery_dispute", row.dispute.id, {
      status: data.status,
      resolution: data.resolution,
      refundAmount,
    });
    const { notifyRole, notifyUser } = await import("@/services/messaging/notification-server");
    await Promise.all([
      notifyUser(row.dispute.buyerId, {
        title: "Delivery issue reviewed",
        message: `${row.dispute.disputeNumber} is now ${data.status.replaceAll("_", " ")}.`,
        target: targetByRole.Buyer,
      }),
      refundStatus === "pending"
        ? notifyRole("Accounting", {
            title: "Approved delivery refund",
            message: `${row.dispute.disputeNumber} has an approved refund of ₱${refundAmount?.toFixed(2)}.`,
            target: targetByRole.Accounting,
          })
        : Promise.resolve(),
    ]);
    return { success: true };
  });

export const getAccountingDeliveryRefunds = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Accounting");
  return (await fetchDisputes()).filter((dispute) => dispute.refundStatus !== "not_required");
});

export const processDeliveryDisputeRefund = createServerFn({ method: "POST" })
  .validator(disputeIdInput)
  .handler(async ({ data }) => {
    const { eq } = await import("drizzle-orm");
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const accountant = await requireRole("Accounting");
    const { db } = await import("@/db/client.server");
    const { deliveryDisputeEvents, deliveryDisputes } = await import("@/db/schema");
    const [dispute] = await db
      .select()
      .from(deliveryDisputes)
      .where(eq(deliveryDisputes.id, data.disputeId));
    if (!dispute || dispute.refundStatus !== "pending" || !dispute.refundAmount) {
      throw new Error("This refund is not ready for Accounting processing.");
    }
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(deliveryDisputes)
        .set({
          refundStatus: "processed",
          status: "resolved",
          accountingProcessedById: accountant.id,
          accountingProcessedAt: now,
          resolvedAt: now,
        })
        .where(eq(deliveryDisputes.id, dispute.id));
      await tx.insert(deliveryDisputeEvents).values({
        id: crypto.randomUUID(),
        disputeId: dispute.id,
        actorId: accountant.id,
        event: "refund_processed",
        note: `Accounting processed ₱${Number(dispute.refundAmount).toFixed(2)}.`,
      });
    });
    await writeAuditLog(
      accountant.id,
      "delivery_dispute.refund_processed",
      "delivery_dispute",
      dispute.id,
      { refundAmount: Number(dispute.refundAmount) },
    );
    const { notifyRole, notifyUser } = await import("@/services/messaging/notification-server");
    await Promise.all([
      notifyUser(dispute.buyerId, {
        title: "Refund processed",
        message: `${dispute.disputeNumber} was resolved. Accounting processed ₱${Number(dispute.refundAmount).toFixed(2)}.`,
        target: targetByRole.Buyer,
      }),
      notifyRole("Management", {
        title: "Delivery refund completed",
        message: `${dispute.disputeNumber} was closed by Accounting.`,
        target: targetByRole.Management,
      }),
    ]);
    return { success: true };
  });
