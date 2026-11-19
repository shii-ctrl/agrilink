import { and, desc, eq, isNull } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  plantingInput,
  createPlantingInput,
  plantingExpenseInput,
  plantingIdInput,
  summarizePlanting,
} from "@/features/farmer/planting-costs";

type Database = (typeof import("@/db/client.server"))["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
async function ownedPlanting(tx: Transaction, id: string, farmerId: string) {
  const { farmerPlantings } = await import("@/db/schema");
  const [row] = await tx
    .select()
    .from(farmerPlantings)
    .where(and(eq(farmerPlantings.id, id), eq(farmerPlantings.farmerId, farmerId)))
    .for("update");
  if (!row) throw new Error("This planting is not available in your account.");
  return row;
}

export const getFarmerPlantingWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const farmer = await requireRole("Farmer");
  const { db } = await import("@/db/client.server");
  const {
    farmerPlantings,
    farmerPlantingExpenses,
    farmerPlantingDeliveries,
    farmerEarnings,
    receivingRecords,
    products,
    orders,
    classifications,
  } = await import("@/db/schema");
  const [plantings, expenses, deliveries, sales] = await Promise.all([
    db
      .select()
      .from(farmerPlantings)
      .where(eq(farmerPlantings.farmerId, farmer.id))
      .orderBy(desc(farmerPlantings.plantedOn), desc(farmerPlantings.id)),
    db
      .select({
        id: farmerPlantingExpenses.id,
        plantingId: farmerPlantingExpenses.plantingId,
        occurredOn: farmerPlantingExpenses.occurredOn,
        category: farmerPlantingExpenses.category,
        description: farmerPlantingExpenses.description,
        amount: farmerPlantingExpenses.amount,
        notes: farmerPlantingExpenses.notes,
      })
      .from(farmerPlantingExpenses)
      .innerJoin(farmerPlantings, eq(farmerPlantingExpenses.plantingId, farmerPlantings.id))
      .where(and(eq(farmerPlantings.farmerId, farmer.id), isNull(farmerPlantingExpenses.deletedAt)))
      .orderBy(desc(farmerPlantingExpenses.occurredOn), desc(farmerPlantingExpenses.id)),
    db
      .select({
        id: receivingRecords.id,
        productId: receivingRecords.productId,
        product: products.name,
        sellingUnit: products.sellingUnit,
        quantity: receivingRecords.totalKg,
        receivedAt: receivingRecords.receivedAt,
        plantingId: farmerPlantingDeliveries.plantingId,
      })
      .from(receivingRecords)
      .innerJoin(products, eq(receivingRecords.productId, products.id))
      .leftJoin(
        farmerPlantingDeliveries,
        eq(receivingRecords.id, farmerPlantingDeliveries.receivingId),
      )
      .where(eq(receivingRecords.farmerId, farmer.id))
      .orderBy(desc(receivingRecords.receivedAt), desc(receivingRecords.id)),
    db
      .select({
        id: farmerEarnings.id,
        receivingId: farmerEarnings.receivingId,
        orderNumber: orders.orderNumber,
        source: orders.source,
        product: products.name,
        classification: classifications.name,
        quantity: farmerEarnings.quantity,
        sellingUnit: farmerEarnings.sellingUnit,
        grossAmount: farmerEarnings.grossAmount,
        serviceFee: farmerEarnings.serviceFee,
        iponContribution: farmerEarnings.iponContribution,
        netAmount: farmerEarnings.netAmount,
        status: farmerEarnings.status,
        soldAt: orders.soldAt,
      })
      .from(farmerEarnings)
      .innerJoin(orders, eq(farmerEarnings.orderId, orders.id))
      .innerJoin(products, eq(farmerEarnings.productId, products.id))
      .innerJoin(classifications, eq(farmerEarnings.classificationId, classifications.id))
      .where(eq(farmerEarnings.farmerId, farmer.id))
      .orderBy(desc(orders.soldAt), desc(farmerEarnings.id)),
  ]);
  const receipts = deliveries.map((row) => ({ ...row, receivedAt: row.receivedAt.toISOString() }));
  return {
    plantings: plantings.map((row) => {
      const costs = expenses.filter((expense) => expense.plantingId === row.id);
      const linked = receipts.filter((receipt) => receipt.plantingId === row.id);
      const ids = new Set(linked.map((receipt) => receipt.id));
      const sold = sales.filter((sale) => ids.has(sale.receivingId));
      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        expenses: costs,
        deliveries: linked,
        sales: sold.map((sale) => ({ ...sale, soldAt: sale.soldAt?.toISOString() ?? null })),
        summary: summarizePlanting(costs, sold),
      };
    }),
    unlinkedDeliveries: receipts.filter((receipt) => receipt.plantingId === null),
  };
});

export const createFarmerPlanting = createServerFn({ method: "POST" })
  .validator(createPlantingInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const farmer = await requireRole("Farmer");
    const { db } = await import("@/db/client.server");
    const { farmerPlantings, farmerPlantingExpenses } = await import("@/db/schema");
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(farmerPlantings)
        .where(eq(farmerPlantings.id, data.id));
      if (existing) {
        if (
          existing.farmerId !== farmer.id ||
          existing.name !== data.name ||
          existing.cropName !== data.cropName ||
          existing.plantedOn !== data.plantedOn ||
          existing.notes !== data.notes
        )
          throw new Error(
            "This planting reference has already been used. Refresh your planting list.",
          );
        const costs = await tx
          .select()
          .from(farmerPlantingExpenses)
          .where(eq(farmerPlantingExpenses.plantingId, existing.id));
        if (
          data.expenses.some(
            (expense) =>
              !costs.some(
                (cost) =>
                  cost.id === expense.id &&
                  !cost.deletedAt &&
                  cost.occurredOn === expense.occurredOn &&
                  cost.category === expense.category &&
                  cost.description === expense.description &&
                  cost.amount === expense.amount.toFixed(2) &&
                  cost.notes === expense.notes,
              ),
          )
        ) {
          throw new Error("Na-save na ang taniman. I-refresh ang talaan bago magdagdag ng gastos.");
        }
        return { id: existing.id };
      }
      const { expenses, ...planting } = data;
      await tx.insert(farmerPlantings).values({ ...planting, farmerId: farmer.id });
      if (expenses.length) {
        await tx.insert(farmerPlantingExpenses).values(
          expenses.map((expense) => ({
            ...expense,
            plantingId: planting.id,
            amount: expense.amount.toFixed(2),
          })),
        );
      }
      await writeAuditLog(farmer.id, "planting.create", "farmer_planting", data.id, undefined, tx);
      return { id: data.id };
    });
  });

export const updateFarmerPlanting = createServerFn({ method: "POST" })
  .validator(plantingInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const farmer = await requireRole("Farmer");
    const { db } = await import("@/db/client.server");
    const { farmerPlantings, farmerPlantingDeliveries, receivingRecords } =
      await import("@/db/schema");
    return db.transaction(async (tx) => {
      await ownedPlanting(tx, data.id, farmer.id);
      const linked = await tx
        .select({ receivedAt: receivingRecords.receivedAt })
        .from(farmerPlantingDeliveries)
        .innerJoin(receivingRecords, eq(farmerPlantingDeliveries.receivingId, receivingRecords.id))
        .where(eq(farmerPlantingDeliveries.plantingId, data.id));
      if (
        linked.some(
          (receipt) =>
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Manila",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(receipt.receivedAt) < data.plantedOn,
        )
      )
        throw new Error("The planting date cannot be later than a linked delivery.");
      await tx
        .update(farmerPlantings)
        .set({
          name: data.name,
          cropName: data.cropName,
          plantedOn: data.plantedOn,
          notes: data.notes,
        })
        .where(eq(farmerPlantings.id, data.id));
      await writeAuditLog(farmer.id, "planting.update", "farmer_planting", data.id, undefined, tx);
      return { id: data.id };
    });
  });

export const setFarmerPlantingStatus = createServerFn({ method: "POST" })
  .validator(plantingIdInput.extend({ status: z.enum(["active", "finished"]) }))
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const farmer = await requireRole("Farmer");
    const { db } = await import("@/db/client.server");
    const { farmerPlantings } = await import("@/db/schema");
    return db.transaction(async (tx) => {
      await ownedPlanting(tx, data.plantingId, farmer.id);
      await tx
        .update(farmerPlantings)
        .set({ status: data.status })
        .where(eq(farmerPlantings.id, data.plantingId));
      await writeAuditLog(
        farmer.id,
        "planting.status",
        "farmer_planting",
        data.plantingId,
        { status: data.status },
        tx,
      );
      return { id: data.plantingId };
    });
  });

export const saveFarmerPlantingExpense = createServerFn({ method: "POST" })
  .validator(plantingExpenseInput.extend({ editing: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const farmer = await requireRole("Farmer");
    const { db } = await import("@/db/client.server");
    const { farmerPlantingExpenses } = await import("@/db/schema");
    return db.transaction(async (tx) => {
      await ownedPlanting(tx, data.plantingId, farmer.id);
      const [existing] = await tx
        .select()
        .from(farmerPlantingExpenses)
        .where(eq(farmerPlantingExpenses.id, data.id))
        .for("update");
      const values = {
        occurredOn: data.occurredOn,
        category: data.category,
        description: data.description,
        amount: data.amount.toFixed(2),
        notes: data.notes,
      };
      if (existing) {
        if (existing.plantingId !== data.plantingId || existing.deletedAt)
          throw new Error("This expense is not available in this planting.");
        if (!data.editing) {
          if (
            Object.entries(values).some(
              ([key, value]) => existing[key as keyof typeof values] !== value,
            )
          )
            throw new Error("This expense was already recorded. Refresh before editing it.");
          return { id: existing.id };
        }
        await tx
          .update(farmerPlantingExpenses)
          .set(values)
          .where(eq(farmerPlantingExpenses.id, data.id));
      } else {
        if (data.editing) throw new Error("The expense could not be found.");
        await tx
          .insert(farmerPlantingExpenses)
          .values({ id: data.id, plantingId: data.plantingId, ...values });
      }
      await writeAuditLog(
        farmer.id,
        data.editing ? "planting.expense.update" : "planting.expense.add",
        "farmer_planting_expense",
        data.id,
        { plantingId: data.plantingId },
        tx,
      );
      return { id: data.id };
    });
  });

export const removeFarmerPlantingExpense = createServerFn({ method: "POST" })
  .validator(plantingIdInput.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const farmer = await requireRole("Farmer");
    const { db } = await import("@/db/client.server");
    const { farmerPlantingExpenses } = await import("@/db/schema");
    return db.transaction(async (tx) => {
      await ownedPlanting(tx, data.plantingId, farmer.id);
      const [row] = await tx
        .select()
        .from(farmerPlantingExpenses)
        .where(
          and(
            eq(farmerPlantingExpenses.id, data.id),
            eq(farmerPlantingExpenses.plantingId, data.plantingId),
          ),
        )
        .for("update");
      if (!row) throw new Error("This expense is not available in this planting.");
      if (!row.deletedAt) {
        await tx
          .update(farmerPlantingExpenses)
          .set({ deletedAt: new Date() })
          .where(eq(farmerPlantingExpenses.id, row.id));
        await writeAuditLog(
          farmer.id,
          "planting.expense.remove",
          "farmer_planting_expense",
          row.id,
          { plantingId: data.plantingId },
          tx,
        );
      }
      return { id: row.id };
    });
  });

export const linkFarmerPlantingDelivery = createServerFn({ method: "POST" })
  .validator(plantingIdInput.extend({ receivingId: z.string().uuid(), linked: z.boolean() }))
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const farmer = await requireRole("Farmer");
    const { db } = await import("@/db/client.server");
    const { farmerPlantings, farmerPlantingDeliveries, receivingRecords } =
      await import("@/db/schema");
    return db.transaction(async (tx) => {
      const planting = await ownedPlanting(tx, data.plantingId, farmer.id);
      const [receipt] = await tx
        .select()
        .from(receivingRecords)
        .where(
          and(eq(receivingRecords.id, data.receivingId), eq(receivingRecords.farmerId, farmer.id)),
        )
        .for("update");
      if (!receipt) throw new Error("Choose a delivery recorded for your own Farmer account.");
      const [existing] = await tx
        .select()
        .from(farmerPlantingDeliveries)
        .where(eq(farmerPlantingDeliveries.receivingId, receipt.id))
        .for("update");
      if (existing && existing.plantingId !== planting.id)
        throw new Error("This delivery is already linked to another planting.");
      if (data.linked) {
        const receivedOn = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(receipt.receivedAt);
        if (receivedOn < planting.plantedOn)
          throw new Error("This delivery was recorded before the planting date.");
        if (planting.productId && planting.productId !== receipt.productId)
          throw new Error(
            "Choose a delivery for the same product as this planting's other deliveries.",
          );
        if (existing) return { id: receipt.id };
        await tx
          .insert(farmerPlantingDeliveries)
          .values({ receivingId: receipt.id, plantingId: planting.id });
        await tx
          .update(farmerPlantings)
          .set({ productId: receipt.productId })
          .where(eq(farmerPlantings.id, planting.id));
      } else {
        if (!existing) return { id: receipt.id };
        await tx
          .delete(farmerPlantingDeliveries)
          .where(eq(farmerPlantingDeliveries.receivingId, receipt.id));
        const [remaining] = await tx
          .select({ id: farmerPlantingDeliveries.receivingId })
          .from(farmerPlantingDeliveries)
          .where(eq(farmerPlantingDeliveries.plantingId, planting.id))
          .limit(1);
        if (!remaining)
          await tx
            .update(farmerPlantings)
            .set({ productId: null })
            .where(eq(farmerPlantings.id, planting.id));
      }
      await writeAuditLog(
        farmer.id,
        data.linked ? "planting.delivery.link" : "planting.delivery.unlink",
        "farmer_planting",
        planting.id,
        { receivingId: receipt.id },
        tx,
      );
      return { id: receipt.id };
    });
  });
