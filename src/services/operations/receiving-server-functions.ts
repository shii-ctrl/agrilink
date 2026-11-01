import { and, eq, inArray, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const quantity = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000)
  .refine((value) => Number.isInteger(value * 100), "Use at most two decimal places.");
const receivingInput = z.object({
  id: z.string().uuid(),
  farmerId: z.string().uuid(),
  productId: z.string().uuid(),
  totalKg: quantity.refine((value) => value > 0, "Delivered quantity must be greater than zero."),
  goodKg: quantity,
  semiKg: quantity,
  rejectKg: quantity,
});

const asCents = (value: number) => Math.round(value * 100);

export const recordReceivingDelivery = createServerFn({ method: "POST" })
  .validator(receivingInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Marketer");
    if (
      asCents(data.goodKg) + asCents(data.semiKg) + asCents(data.rejectKg) !==
      asCents(data.totalKg)
    ) {
      throw new Error(
        "Good, Semi, and Reject quantities must exactly equal the delivered quantity.",
      );
    }

    const { db } = await import("@/db/client.server");
    const {
      auditLogs,
      classifications,
      inventory,
      inventoryMovements,
      products,
      receivingClassifications,
      receivingRecords,
      roles,
      userRoles,
      users,
    } = await import("@/db/schema");

    const savedDelivery = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: receivingRecords.id,
          farmerId: receivingRecords.farmerId,
          productId: receivingRecords.productId,
          totalKg: receivingRecords.totalKg,
        })
        .from(receivingRecords)
        .where(eq(receivingRecords.id, data.id));
      if (existing) {
        const existingClassifications = await tx
          .select({ name: classifications.name, quantityKg: receivingClassifications.quantityKg })
          .from(receivingClassifications)
          .innerJoin(
            classifications,
            eq(receivingClassifications.classificationId, classifications.id),
          )
          .where(eq(receivingClassifications.receivingId, existing.id));
        const original = Object.fromEntries(
          existingClassifications.map((row) => [row.name, asCents(Number(row.quantityKg))]),
        );
        const matches =
          existing.farmerId === data.farmerId &&
          existing.productId === data.productId &&
          asCents(Number(existing.totalKg)) === asCents(data.totalKg) &&
          original["Good"] === asCents(data.goodKg) &&
          original["Semi"] === asCents(data.semiKg) &&
          original["Reject"] === asCents(data.rejectKg);
        if (!matches) {
          throw new Error("This delivery reference was already used with different details.");
        }
        return { id: existing.id, duplicate: true };
      }

      const [farmer] = await tx
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(users.id, data.farmerId), eq(users.active, true), eq(roles.name, "Farmer")));
      if (!farmer) throw new Error("Choose an active Farmer account.");
      const [product] = await tx
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(and(eq(products.id, data.productId), eq(products.active, true)));
      if (!product) throw new Error("Choose an active product.");

      const configured = await tx
        .select({ id: classifications.id, name: classifications.name })
        .from(classifications)
        .where(inArray(classifications.name, ["Good", "Semi", "Reject"]));
      if (configured.length !== 3)
        throw new Error("Good, Semi, and Reject classifications must be configured.");

      await tx.insert(receivingRecords).values({
        id: data.id,
        farmerId: data.farmerId,
        productId: data.productId,
        recordedById: actor.id,
        totalKg: data.totalKg.toFixed(2),
        receivedAt: new Date(),
      });
      const receivedAt = new Date();
      const quantities = { Good: data.goodKg, Semi: data.semiKg, Reject: data.rejectKg } as const;
      for (const classification of configured) {
        const amount = quantities[classification.name];
        await tx.insert(receivingClassifications).values({
          id: crypto.randomUUID(),
          receivingId: data.id,
          classificationId: classification.id,
          quantityKg: amount.toFixed(2),
        });
        if (amount === 0) continue;
        const inventoryId = crypto.randomUUID();
        await tx.insert(inventory).values({
          id: inventoryId,
          productId: data.productId,
          farmerId: data.farmerId,
          receivingId: data.id,
          classificationId: classification.id,
          quantityKg: amount.toFixed(2),
          reservedKg: "0",
          receivedAt,
        });
        await tx.insert(inventoryMovements).values({
          id: crypto.randomUUID(),
          inventoryId,
          movementType: "receiving",
          availableChangeKg: amount.toFixed(2),
          reservedChangeKg: "0",
          referenceType: "receiving_record",
          referenceId: data.id,
          recordedById: actor.id,
          note: `${classification.name} classification from delivery ${data.id}`,
        });
      }
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actorId: actor.id,
        action: "receiving.record",
        entityType: "receiving_record",
        entityId: data.id,
        details: { farmerId: data.farmerId, productId: data.productId, totalKg: data.totalKg },
      });
      return {
        id: data.id,
        duplicate: false,
        farmerId: farmer.id,
        farmerName: farmer.name,
        productName: product.name,
      };
    });
    if (!savedDelivery.duplicate && "farmerId" in savedDelivery) {
      const { notifyRole, notifyUser } = await import("@/services/messaging/notification-server");
      await Promise.all([
        notifyUser(savedDelivery.farmerId, {
          title: "Delivery received and classified",
          message: `${savedDelivery.productName} was recorded in your receiving history.`,
          target: "/farmer/receiving",
        }),
        notifyRole("Management", {
          title: "New farmer delivery received",
          message: `${savedDelivery.farmerName}'s ${savedDelivery.productName} delivery was classified and added to inventory.`,
          target: "/management/receiving",
        }),
      ]);
    }
    return savedDelivery;
  });

export const getReceivingWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Marketer");
  const { db } = await import("@/db/client.server");
  const {
    classifications,
    products,
    receivingClassifications,
    receivingRecords,
    roles,
    userRoles,
    users,
  } = await import("@/db/schema");
  const farmers = await db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(users.active, true), eq(roles.name, "Farmer")));
  const productRows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.active, true));
  const rows = await db
    .select({
      id: receivingRecords.id,
      farmer: users.displayName,
      product: products.name,
      totalKg: receivingRecords.totalKg,
      recordedAt: receivingRecords.receivedAt,
      classification: classifications.name,
      quantityKg: receivingClassifications.quantityKg,
    })
    .from(receivingRecords)
    .innerJoin(users, eq(receivingRecords.farmerId, users.id))
    .innerJoin(products, eq(receivingRecords.productId, products.id))
    .innerJoin(
      receivingClassifications,
      eq(receivingClassifications.receivingId, receivingRecords.id),
    )
    .innerJoin(classifications, eq(receivingClassifications.classificationId, classifications.id));
  return { farmers, products: productRows, rows };
});

async function receiveRows(farmerId?: string) {
  const { db } = await import("@/db/client.server");
  const { classifications, products, receivingClassifications, receivingRecords, users } =
    await import("@/db/schema");
  return db
    .select({
      id: receivingRecords.id,
      farmer: users.displayName,
      product: products.name,
      totalKg: receivingRecords.totalKg,
      classification: classifications.name,
      quantityKg: receivingClassifications.quantityKg,
      recordedAt: receivingRecords.receivedAt,
    })
    .from(receivingRecords)
    .innerJoin(users, eq(receivingRecords.farmerId, users.id))
    .innerJoin(products, eq(receivingRecords.productId, products.id))
    .innerJoin(
      receivingClassifications,
      eq(receivingClassifications.receivingId, receivingRecords.id),
    )
    .innerJoin(classifications, eq(receivingClassifications.classificationId, classifications.id))
    .where(farmerId ? eq(receivingRecords.farmerId, farmerId) : undefined);
}
export const getFarmerReceivingRecords = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const farmer = await requireRole("Farmer");
  return receiveRows(farmer.id);
});

export const getFarmerProductStatuses = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const farmer = await requireRole("Farmer");
  const { db } = await import("@/db/client.server");
  const { classifications, inventory, listings, products } = await import("@/db/schema");
  const rows = await db
    .select({
      id: sql<string>`MIN(${inventory.id})`,
      product: products.name,
      classification: classifications.name,
      quantityKg: sql<string>`SUM(${inventory.quantityKg})`,
      reservedKg: sql<string>`SUM(${inventory.reservedKg})`,
      availableKg: sql<string>`SUM(${inventory.quantityKg} - ${inventory.reservedKg})`,
      listingStatus: listings.status,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(classifications, eq(inventory.classificationId, classifications.id))
    .leftJoin(
      listings,
      and(
        eq(listings.productId, inventory.productId),
        eq(listings.classificationId, inventory.classificationId),
      ),
    )
    .where(eq(inventory.farmerId, farmer.id))
    .groupBy(
      inventory.productId,
      inventory.classificationId,
      products.name,
      classifications.name,
      listings.status,
    );
  return rows.map((row) => {
    const availableKg = Math.max(0, Number(row.availableKg));
    const reservedKg = Math.max(0, Number(row.reservedKg));
    const totalKg = Math.max(0, Number(row.quantityKg));
    const status = !row.listingStatus
      ? "Awaiting marketplace listing"
      : row.listingStatus !== "published"
        ? "Not available to buyers"
        : totalKg === 0 || availableKg === 0
          ? "Sold out"
          : reservedKg > 0
            ? "Listed — partly reserved"
            : "Listed for buyers";
    return { ...row, availableKg, status };
  });
});
export const getManagementReceivingRecords = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  await requireRole("Management");
  return receiveRows();
});
