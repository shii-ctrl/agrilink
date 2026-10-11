import { and, asc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const productionInput = z
  .object({
    farmerId: z.string().uuid(),
    productId: z.string().uuid(),
    plantingDate: z.string().date(),
    expectedHarvestDate: z.string().date(),
    harvestedQuantityKg: z.number().min(0).max(1_000_000).optional(),
  })
  .refine((value) => value.expectedHarvestDate >= value.plantingDate, {
    message: "Expected harvest must be on or after the planting date.",
  });

export const getManagementProductionWorkspace = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireRole } = await import("@/services/auth/auth-server");
    await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { products, productionRecords, roles, userRoles, users } = await import("@/db/schema");
    const [farmers, productRows, records] = await Promise.all([
      db
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(users.active, true), eq(roles.name, "Farmer"))),
      db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(eq(products.active, true)),
      db
        .select({
          id: productionRecords.id,
          farmer: users.displayName,
          product: products.name,
          plantingDate: productionRecords.plantingDate,
          expectedHarvestDate: productionRecords.expectedHarvestDate,
          harvestedQuantityKg: productionRecords.harvestedQuantityKg,
        })
        .from(productionRecords)
        .innerJoin(users, eq(productionRecords.farmerId, users.id))
        .leftJoin(products, eq(productionRecords.productId, products.id)),
    ]);
    return { farmers, products: productRows, records };
  },
);

export const createManagementProductionRecord = createServerFn({ method: "POST" })
  .validator(productionInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const actor = await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { products, productionRecords, roles, userRoles, users } = await import("@/db/schema");
    const [farmer, product] = await Promise.all([
      db
        .select({ id: users.id })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(users.id, data.farmerId), eq(users.active, true), eq(roles.name, "Farmer"))),
      db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(and(eq(products.id, data.productId), eq(products.active, true))),
    ]);
    if (!farmer[0]) throw new Error("Choose an active Farmer account.");
    if (!product[0]) throw new Error("Choose an active product.");
    const id = crypto.randomUUID();
    await db.insert(productionRecords).values({
      id,
      farmerId: data.farmerId,
      productId: data.productId,
      cropName: product[0].name,
      plantingDate: new Date(`${data.plantingDate}T00:00:00`),
      expectedHarvestDate: new Date(`${data.expectedHarvestDate}T00:00:00`),
      ...(data.harvestedQuantityKg !== undefined
        ? { harvestedQuantityKg: data.harvestedQuantityKg.toFixed(2) }
        : {}),
      recordedById: actor.id,
    });
    await writeAuditLog(actor.id, "production.create", "production_record", id, data);
    return { id };
  });

async function productionRows(filters: { farmerId?: string; consultantId?: string } = {}) {
  const { db } = await import("@/db/client.server");
  const { farmerConsultantAssignments, products, productionRecords, users } =
    await import("@/db/schema");
  const query = db
    .select({
      id: productionRecords.id,
      farmerId: productionRecords.farmerId,
      farmer: users.displayName,
      product: products.name,
      plantingDate: productionRecords.plantingDate,
      expectedHarvestDate: productionRecords.expectedHarvestDate,
      harvestedQuantityKg: productionRecords.harvestedQuantityKg,
    })
    .from(productionRecords)
    .innerJoin(users, eq(productionRecords.farmerId, users.id))
    .leftJoin(products, eq(productionRecords.productId, products.id));

  if (filters.consultantId) {
    return query
      .innerJoin(
        farmerConsultantAssignments,
        eq(farmerConsultantAssignments.farmerId, productionRecords.farmerId),
      )
      .where(eq(farmerConsultantAssignments.consultantId, filters.consultantId))
      .orderBy(asc(productionRecords.expectedHarvestDate));
  }

  return query
    .where(filters.farmerId ? eq(productionRecords.farmerId, filters.farmerId) : undefined)
    .orderBy(asc(productionRecords.expectedHarvestDate));
}

export const getFarmerProductionRecords = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const farmer = await requireRole("Farmer");
  return productionRows({ farmerId: farmer.id });
});

export const getConsultantProductionRecords = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireRole } = await import("@/services/auth/auth-server");
    const consultant = await requireRole("Farm Consultant");
    return productionRows({ consultantId: consultant.id });
  },
);
