import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const orderNumberInput = z.object({ orderNumber: z.string().trim().min(3).max(40) });
const rating = z.number().int().min(1).max(5);
const submitFeedbackInput = orderNumberInput.extend({
  serviceRating: rating,
  riderRating: rating.nullable(),
  comment: z.string().trim().max(1_500).nullable(),
  itemRatings: z
    .array(z.object({ orderItemId: z.string().uuid(), rating }))
    .min(1)
    .max(50),
});

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

async function loadOrderFeedback(orderNumber: string, buyerId?: string) {
  const { and, eq, sql } = await import("drizzle-orm");
  const { db } = await import("@/db/client.server");
  const {
    classifications,
    listings,
    orderFeedback,
    orderItemRatings,
    orderItems,
    orders,
    products,
  } = await import("@/db/schema");
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      buyerId: orders.buyerId,
      status: orders.status,
      fulfillmentMethod: orders.fulfillmentMethod,
      fulfillmentStatus: orders.fulfillmentStatus,
      assignedRiderId: orders.assignedRiderId,
      fulfilledAt: orders.fulfilledAt,
    })
    .from(orders)
    .where(
      buyerId
        ? and(eq(orders.orderNumber, orderNumber), eq(orders.buyerId, buyerId))
        : eq(orders.orderNumber, orderNumber),
    );
  if (!order) throw new Error("This order could not be found.");

  const items = await db
    .select({
      orderItemId: orderItems.id,
      productId: listings.productId,
      name: sql<string>`COALESCE(${orderItems.productName}, ${products.name})`,
      classification: sql<string>`COALESCE(${orderItems.classificationName}, ${classifications.name})`,
    })
    .from(orderItems)
    .innerJoin(listings, eq(orderItems.listingId, listings.id))
    .innerJoin(products, eq(listings.productId, products.id))
    .innerJoin(classifications, eq(listings.classificationId, classifications.id))
    .where(eq(orderItems.orderId, order.id));

  const [feedback] = await db
    .select()
    .from(orderFeedback)
    .where(eq(orderFeedback.orderId, order.id));
  const itemRatingRows = feedback
    ? await db
        .select({ orderItemId: orderItemRatings.orderItemId, rating: orderItemRatings.rating })
        .from(orderItemRatings)
        .where(eq(orderItemRatings.feedbackId, feedback.id))
    : [];
  const ratingsByItem = new Map(itemRatingRows.map((item) => [item.orderItemId, item.rating]));
  const eligible =
    order.status === "sold" &&
    ["picked_up", "delivered"].includes(order.fulfillmentStatus) &&
    Boolean(order.fulfilledAt);

  return {
    order,
    eligible,
    items: items.map((item) => ({ ...item, rating: ratingsByItem.get(item.orderItemId) ?? null })),
    feedback: feedback
      ? {
          id: feedback.id,
          serviceRating: feedback.serviceRating,
          riderRating: feedback.riderRating,
          comment: feedback.comment,
          createdAt: feedback.createdAt.toISOString(),
          updatedAt: feedback.updatedAt.toISOString(),
        }
      : null,
  };
}

export const getMyOrderFeedback = createServerFn({ method: "GET" })
  .validator(orderNumberInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    const result = await loadOrderFeedback(data.orderNumber, buyer.id);
    return {
      orderNumber: result.order.orderNumber,
      fulfillmentMethod: result.order.fulfillmentMethod,
      eligible: result.eligible,
      items: result.items,
      feedback: result.feedback,
    };
  });

export const submitOrderFeedback = createServerFn({ method: "POST" })
  .validator(submitFeedbackInput)
  .handler(async ({ data }) => {
    const { eq } = await import("drizzle-orm");
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const buyer = await requireRole("Buyer");
    const current = await loadOrderFeedback(data.orderNumber, buyer.id);
    if (!current.eligible) {
      throw new Error("Feedback can be submitted only after an order is picked up or delivered.");
    }
    if (current.order.fulfillmentMethod === "delivery" && data.riderRating === null) {
      throw new Error("Please rate your Rider for this delivery.");
    }
    const expectedItemIds = new Set(current.items.map((item) => item.orderItemId));
    const submittedItemIds = new Set(data.itemRatings.map((item) => item.orderItemId));
    if (
      submittedItemIds.size !== data.itemRatings.length ||
      submittedItemIds.size !== expectedItemIds.size ||
      [...submittedItemIds].some((id) => !expectedItemIds.has(id))
    ) {
      throw new Error("Please rate every product in this order once.");
    }

    const { db } = await import("@/db/client.server");
    const { orderFeedback, orderItemRatings } = await import("@/db/schema");
    const feedbackId = current.feedback?.id ?? crypto.randomUUID();
    const itemById = new Map(current.items.map((item) => [item.orderItemId, item]));
    await db.transaction(async (tx) => {
      if (current.feedback) {
        await tx
          .update(orderFeedback)
          .set({
            serviceRating: data.serviceRating,
            riderRating: current.order.fulfillmentMethod === "delivery" ? data.riderRating : null,
            comment: data.comment || null,
          })
          .where(eq(orderFeedback.id, feedbackId));
      } else {
        await tx.insert(orderFeedback).values({
          id: feedbackId,
          orderId: current.order.id,
          buyerId: buyer.id,
          serviceRating: data.serviceRating,
          riderRating: current.order.fulfillmentMethod === "delivery" ? data.riderRating : null,
          comment: data.comment || null,
        });
      }
      for (const itemRating of data.itemRatings) {
        const item = itemById.get(itemRating.orderItemId);
        if (!item) throw new Error("One of the rated products is no longer part of this order.");
        await tx
          .insert(orderItemRatings)
          .values({
            id: crypto.randomUUID(),
            feedbackId,
            orderItemId: item.orderItemId,
            productId: item.productId,
            rating: itemRating.rating,
          })
          .onDuplicateKeyUpdate({
            set: { feedbackId, productId: item.productId, rating: itemRating.rating },
          });
      }
    });
    await writeAuditLog(
      buyer.id,
      current.feedback ? "order_feedback.update" : "order_feedback.create",
      "order_feedback",
      feedbackId,
      {
        orderNumber: current.order.orderNumber,
        serviceRating: data.serviceRating,
        riderRating: data.riderRating,
        productRatings: data.itemRatings,
      },
    );
    if (!current.feedback) {
      const { notifyRole } = await import("@/services/messaging/notification-server");
      await notifyRole("Management", {
        title: "New Buyer feedback",
        message: `${current.order.orderNumber} received a completed-order rating.`,
        target: "/management/reports",
      });
    }
    return { success: true, feedbackId };
  });

export const getManagementFeedbackSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { desc, eq } = await import("drizzle-orm");
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Management");
  const { db } = await import("@/db/client.server");
  const { orderFeedback, orderItemRatings, orders, products, users } = await import("@/db/schema");
  const [feedbackRows, productRows, userRows] = await Promise.all([
    db
      .select({
        id: orderFeedback.id,
        orderNumber: orders.orderNumber,
        buyerId: orderFeedback.buyerId,
        fulfillmentMethod: orders.fulfillmentMethod,
        riderId: orders.assignedRiderId,
        serviceRating: orderFeedback.serviceRating,
        riderRating: orderFeedback.riderRating,
        comment: orderFeedback.comment,
        createdAt: orderFeedback.createdAt,
        updatedAt: orderFeedback.updatedAt,
      })
      .from(orderFeedback)
      .innerJoin(orders, eq(orderFeedback.orderId, orders.id))
      .orderBy(desc(orderFeedback.updatedAt)),
    db
      .select({
        feedbackId: orderItemRatings.feedbackId,
        productId: orderItemRatings.productId,
        productName: products.name,
        rating: orderItemRatings.rating,
      })
      .from(orderItemRatings)
      .innerJoin(products, eq(orderItemRatings.productId, products.id)),
    db.select({ id: users.id, name: users.displayName }).from(users),
  ]);
  const userNames = new Map(userRows.map((user) => [user.id, user.name]));
  const productGroups = new Map<
    string,
    { productId: string; productName: string; ratings: number[] }
  >();
  for (const row of productRows) {
    const group = productGroups.get(row.productId) ?? {
      productId: row.productId,
      productName: row.productName,
      ratings: [],
    };
    group.ratings.push(row.rating);
    productGroups.set(row.productId, group);
  }
  const riderGroups = new Map<string, number[]>();
  for (const row of feedbackRows) {
    if (!row.riderId || row.riderRating === null) continue;
    riderGroups.set(row.riderId, [...(riderGroups.get(row.riderId) ?? []), row.riderRating]);
  }
  const productsSummary = [...productGroups.values()]
    .map((group) => ({
      productId: group.productId,
      productName: group.productName,
      averageRating: average(group.ratings) ?? 0,
      ratingCount: group.ratings.length,
    }))
    .sort((a, b) => b.ratingCount - a.ratingCount || b.averageRating - a.averageRating);
  const ridersSummary = [...riderGroups.entries()]
    .map(([riderId, ratings]) => ({
      riderId,
      riderName: userNames.get(riderId) ?? "Rider",
      averageRating: average(ratings) ?? 0,
      ratingCount: ratings.length,
    }))
    .sort((a, b) => b.ratingCount - a.ratingCount || b.averageRating - a.averageRating);

  return {
    totals: {
      feedbackCount: feedbackRows.length,
      averageService: average(feedbackRows.map((row) => row.serviceRating)),
      averageProduct: average(productRows.map((row) => row.rating)),
      averageRider: average(
        feedbackRows.flatMap((row) => (row.riderRating === null ? [] : [row.riderRating])),
      ),
      lowRatingCount: feedbackRows.filter((row) => {
        const itemRatings = productRows
          .filter((item) => item.feedbackId === row.id)
          .map((item) => item.rating);
        return (
          row.serviceRating <= 2 ||
          (row.riderRating !== null && row.riderRating <= 2) ||
          itemRatings.some((value) => value <= 2)
        );
      }).length,
    },
    products: productsSummary,
    riders: ridersSummary,
    recent: feedbackRows.slice(0, 20).map((row) => {
      const ratedProducts = productRows.filter((item) => item.feedbackId === row.id);
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        buyerName: userNames.get(row.buyerId) ?? "Buyer",
        fulfillmentMethod: row.fulfillmentMethod,
        serviceRating: row.serviceRating,
        riderRating: row.riderRating,
        productAverage: average(ratedProducts.map((item) => item.rating)),
        products: ratedProducts.map((item) => ({
          productName: item.productName,
          rating: item.rating,
        })),
        comment: row.comment,
        updatedAt: row.updatedAt.toISOString(),
      };
    }),
  };
});
