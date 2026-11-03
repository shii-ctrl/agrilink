import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  FARMER_IPON_PER_KILOGRAM,
  FARMER_SERVICE_FEE_PER_KILOGRAM,
  FARMER_TOTAL_DEDUCTION_PER_KILOGRAM,
} from "@/features/settlements/policy";

const payoutInput = z.object({
  farmerId: z.string().uuid(),
  receivingId: z.string().uuid(),
});
const iponInput = z.object({ farmerId: z.string().uuid() });

const amount = (value: string | number | null | undefined) => Number(value ?? 0);
const totals = (rows: Array<Record<string, unknown>>) => ({
  grossAmount: rows.reduce((sum, row) => sum + amount(row["grossAmount"] as string), 0),
  serviceFee: rows.reduce((sum, row) => sum + amount(row["serviceFee"] as string), 0),
  iponContribution: rows.reduce((sum, row) => sum + amount(row["iponContribution"] as string), 0),
  netAmount: rows.reduce((sum, row) => sum + amount(row["netAmount"] as string), 0),
});

async function settlementRows() {
  const { db } = await import("@/db/client.server");
  const { classifications, farmerEarnings, orders, products, receivingRecords, users } =
    await import("@/db/schema");
  return db
    .select({
      id: farmerEarnings.id,
      farmerId: farmerEarnings.farmerId,
      farmerName: users.displayName,
      receivingId: farmerEarnings.receivingId,
      receivedAt: receivingRecords.receivedAt,
      orderNumber: orders.orderNumber,
      product: products.name,
      classification: classifications.name,
      sellingUnit: farmerEarnings.sellingUnit,
      quantity: farmerEarnings.quantity,
      pricePerUnit: farmerEarnings.pricePerUnit,
      grossAmount: farmerEarnings.grossAmount,
      serviceFee: farmerEarnings.serviceFee,
      iponContribution: farmerEarnings.iponContribution,
      netAmount: farmerEarnings.netAmount,
      status: farmerEarnings.status,
      payoutId: farmerEarnings.payoutId,
      iponReleaseId: farmerEarnings.iponReleaseId,
      eligibleAt: farmerEarnings.eligibleAt,
      paidAt: farmerEarnings.paidAt,
    })
    .from(farmerEarnings)
    .innerJoin(users, eq(farmerEarnings.farmerId, users.id))
    .innerJoin(receivingRecords, eq(farmerEarnings.receivingId, receivingRecords.id))
    .innerJoin(orders, eq(farmerEarnings.orderId, orders.id))
    .innerJoin(products, eq(farmerEarnings.productId, products.id))
    .innerJoin(classifications, eq(farmerEarnings.classificationId, classifications.id))
    .orderBy(desc(farmerEarnings.createdAt));
}

function groupAvailable(rows: Awaited<ReturnType<typeof settlementRows>>) {
  const grouped = new Map<
    string,
    {
      farmerId: string;
      farmerName: string;
      receivingId: string;
      receivedAt: Date;
      lines: typeof rows;
    }
  >();
  for (const row of rows.filter((entry) => entry.status === "available")) {
    const key = `${row.farmerId}:${row.receivingId}`;
    const group = grouped.get(key) ?? {
      farmerId: row.farmerId,
      farmerName: row.farmerName,
      receivingId: row.receivingId,
      receivedAt: row.receivedAt,
      lines: [],
    };
    group.lines.push(row);
    grouped.set(key, group);
  }
  return [...grouped.values()].map((group) => ({ ...group, ...totals(group.lines) }));
}

async function payoutHistory(farmerId?: string) {
  const { db } = await import("@/db/client.server");
  const { farmerEarnings, farmerPayouts, receivingRecords, users } = await import("@/db/schema");
  const rows = await db
    .select({
      id: farmerPayouts.id,
      payoutNumber: farmerPayouts.payoutNumber,
      farmerId: farmerPayouts.farmerId,
      farmerName: users.displayName,
      receivingId: farmerPayouts.receivingId,
      receivedAt: receivingRecords.receivedAt,
      grossAmount: farmerPayouts.grossAmount,
      serviceFee: farmerPayouts.serviceFee,
      iponContribution: farmerPayouts.iponContribution,
      netAmount: farmerPayouts.netAmount,
      method: farmerPayouts.method,
      releasedAt: farmerPayouts.releasedAt,
    })
    .from(farmerPayouts)
    .innerJoin(users, eq(farmerPayouts.farmerId, users.id))
    .innerJoin(receivingRecords, eq(farmerPayouts.receivingId, receivingRecords.id))
    .where(farmerId ? eq(farmerPayouts.farmerId, farmerId) : undefined)
    .orderBy(desc(farmerPayouts.releasedAt));
  const lines = await settlementRows();
  return rows.map((row) => ({
    ...row,
    grossAmount: amount(row.grossAmount),
    serviceFee: amount(row.serviceFee),
    iponContribution: amount(row.iponContribution),
    netAmount: amount(row.netAmount),
    lines: lines.filter((line) => line.payoutId === row.id),
  }));
}

async function iponHistory(farmerId?: string) {
  const { db } = await import("@/db/client.server");
  const { farmerIponReleases, users } = await import("@/db/schema");
  const rows = await db
    .select({
      id: farmerIponReleases.id,
      releaseNumber: farmerIponReleases.releaseNumber,
      farmerId: farmerIponReleases.farmerId,
      farmerName: users.displayName,
      amount: farmerIponReleases.amount,
      method: farmerIponReleases.method,
      releasedAt: farmerIponReleases.releasedAt,
    })
    .from(farmerIponReleases)
    .innerJoin(users, eq(farmerIponReleases.farmerId, users.id))
    .where(farmerId ? eq(farmerIponReleases.farmerId, farmerId) : undefined)
    .orderBy(desc(farmerIponReleases.releasedAt));
  return rows.map((row) => ({ ...row, amount: amount(row.amount) }));
}

export const getFarmerSettlementWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("@/services/auth/auth-server");
  const farmer = await requireRole("Farmer");
  const rows = (await settlementRows()).filter((row) => row.farmerId === farmer.id);
  const eligibleIpon = rows.filter((row) => row.status !== "pending_payment" && !row.iponReleaseId);
  const { db } = await import("@/db/client.server");
  const { farmerEarnings } = await import("@/db/schema");
  const [iponRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${farmerEarnings.iponContribution}), 0)` })
    .from(farmerEarnings)
    .where(
      and(
        eq(farmerEarnings.farmerId, farmer.id),
        inArray(farmerEarnings.status, ["available", "paid"]),
        isNull(farmerEarnings.iponReleaseId),
      ),
    );
  return {
    available: groupAvailable(rows),
    availableTotal: totals(rows.filter((row) => row.status === "available")).netAmount,
    iponBalance: amount(iponRow?.total),
    payouts: await payoutHistory(farmer.id),
    iponReleases: await iponHistory(farmer.id),
    policy: {
      serviceFeePerKilogram: FARMER_SERVICE_FEE_PER_KILOGRAM,
      iponPerKilogram: FARMER_IPON_PER_KILOGRAM,
      totalDeductionPerKilogram: FARMER_TOTAL_DEDUCTION_PER_KILOGRAM,
    },
    hasEligibleIpon: eligibleIpon.length > 0,
  };
});

export const getAccountingFarmerSettlements = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireRole } = await import("@/services/auth/auth-server");
    await requireRole("Accounting");
    const rows = await settlementRows();
    const { db } = await import("@/db/client.server");
    const { farmerEarnings, users } = await import("@/db/schema");
    const iponBalances = await db
      .select({
        farmerId: farmerEarnings.farmerId,
        farmerName: users.displayName,
        balance: sql<string>`COALESCE(SUM(${farmerEarnings.iponContribution}), 0)`,
      })
      .from(farmerEarnings)
      .innerJoin(users, eq(farmerEarnings.farmerId, users.id))
      .where(
        and(
          inArray(farmerEarnings.status, ["available", "paid"]),
          isNull(farmerEarnings.iponReleaseId),
        ),
      )
      .groupBy(farmerEarnings.farmerId, users.displayName);
    return {
      available: groupAvailable(rows),
      payouts: await payoutHistory(),
      iponBalances: iponBalances.map((row) => ({ ...row, balance: amount(row.balance) })),
      iponReleases: await iponHistory(),
      isDecember:
        new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", month: "2-digit" }).format(
          new Date(),
        ) === "12",
    };
  },
);

export const releaseFarmerCashPayout = createServerFn({ method: "POST" })
  .validator(payoutInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const accountant = await requireRole("Accounting");
    const { db } = await import("@/db/client.server");
    const { farmerEarnings, farmerPayouts, users } = await import("@/db/schema");
    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(farmerEarnings)
        .where(
          and(
            eq(farmerEarnings.farmerId, data.farmerId),
            eq(farmerEarnings.receivingId, data.receivingId),
            eq(farmerEarnings.status, "available"),
          ),
        );
      if (!rows.length)
        throw new Error("This Farmer has no available cash payout for this delivery.");
      const [farmer] = await tx
        .select({ name: users.displayName })
        .from(users)
        .where(eq(users.id, data.farmerId));
      if (!farmer) throw new Error("The Farmer account could not be found.");
      const payoutId = crypto.randomUUID();
      const payoutNumber = `FPO-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const values = totals(rows);
      const now = new Date();
      await tx.insert(farmerPayouts).values({
        id: payoutId,
        payoutNumber,
        farmerId: data.farmerId,
        receivingId: data.receivingId,
        grossAmount: values.grossAmount.toFixed(2),
        serviceFee: values.serviceFee.toFixed(2),
        iponContribution: values.iponContribution.toFixed(2),
        netAmount: values.netAmount.toFixed(2),
        method: "cash",
        releasedById: accountant.id,
        releasedAt: now,
      });
      const [updated] = await tx
        .update(farmerEarnings)
        .set({ status: "paid", payoutId, paidAt: now })
        .where(
          and(
            eq(farmerEarnings.farmerId, data.farmerId),
            eq(farmerEarnings.receivingId, data.receivingId),
            eq(farmerEarnings.status, "available"),
          ),
        );
      if (updated.affectedRows !== rows.length) {
        throw new Error("The available payout changed. Refresh and try again.");
      }
      await writeAuditLog(accountant.id, "farmer_payout.release", "farmer_payout", payoutId, {
        payoutNumber,
        farmerId: data.farmerId,
        receivingId: data.receivingId,
        amount: values.netAmount,
      });
      return {
        payoutId,
        payoutNumber,
        farmerId: data.farmerId,
        farmerName: farmer.name,
        ...values,
      };
    });
    const { notifyUser } = await import("@/services/messaging/notification-server");
    await notifyUser(result.farmerId, {
      title: "Farmer earnings released",
      message: `${result.payoutNumber}: ₱${result.netAmount.toFixed(2)} was released in cash by Accounting.`,
      target: "/farmer/earnings",
    });
    return result;
  });

export const releaseFarmerIpon = createServerFn({ method: "POST" })
  .validator(iponInput)
  .handler(async ({ data }) => {
    const month = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Manila",
      month: "2-digit",
    }).format(new Date());
    if (month !== "12") throw new Error("IPON can only be released during December.");
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const accountant = await requireRole("Accounting");
    const { db } = await import("@/db/client.server");
    const { farmerEarnings, farmerIponReleases, users } = await import("@/db/schema");
    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(farmerEarnings)
        .where(
          and(
            eq(farmerEarnings.farmerId, data.farmerId),
            inArray(farmerEarnings.status, ["available", "paid"]),
            isNull(farmerEarnings.iponReleaseId),
          ),
        );
      if (!rows.length) throw new Error("This Farmer has no IPON balance to release.");
      const [farmer] = await tx
        .select({ name: users.displayName })
        .from(users)
        .where(eq(users.id, data.farmerId));
      if (!farmer) throw new Error("The Farmer account could not be found.");
      const releaseId = crypto.randomUUID();
      const releaseNumber = `IPON-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const iponAmount = rows.reduce((sum, row) => sum + amount(row.iponContribution), 0);
      const now = new Date();
      await tx.insert(farmerIponReleases).values({
        id: releaseId,
        releaseNumber,
        farmerId: data.farmerId,
        amount: iponAmount.toFixed(2),
        method: "cash",
        releasedById: accountant.id,
        releasedAt: now,
      });
      const [updated] = await tx
        .update(farmerEarnings)
        .set({ iponReleaseId: releaseId })
        .where(
          and(
            eq(farmerEarnings.farmerId, data.farmerId),
            inArray(farmerEarnings.status, ["available", "paid"]),
            isNull(farmerEarnings.iponReleaseId),
          ),
        );
      if (updated.affectedRows !== rows.length) {
        throw new Error("The IPON balance changed. Refresh and try again.");
      }
      await writeAuditLog(accountant.id, "farmer_ipon.release", "farmer_ipon", releaseId, {
        releaseNumber,
        farmerId: data.farmerId,
        amount: iponAmount,
      });
      return {
        releaseId,
        releaseNumber,
        farmerId: data.farmerId,
        farmerName: farmer.name,
        amount: iponAmount,
      };
    });
    const { notifyUser } = await import("@/services/messaging/notification-server");
    await notifyUser(result.farmerId, {
      title: "IPON released",
      message: `${result.releaseNumber}: ₱${result.amount.toFixed(2)} IPON was released in cash.`,
      target: "/farmer/earnings",
    });
    return result;
  });

export const getManagementFarmerSettlementSummary = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireRole } = await import("@/services/auth/auth-server");
    await requireRole("Management");
    const { db } = await import("@/db/client.server");
    const { farmerEarnings, farmerPayouts } = await import("@/db/schema");
    const [available] = await db
      .select({ total: sql<string>`COALESCE(SUM(${farmerEarnings.netAmount}), 0)` })
      .from(farmerEarnings)
      .where(eq(farmerEarnings.status, "available"));
    const [ipon] = await db
      .select({ total: sql<string>`COALESCE(SUM(${farmerEarnings.iponContribution}), 0)` })
      .from(farmerEarnings)
      .where(
        and(
          inArray(farmerEarnings.status, ["available", "paid"]),
          isNull(farmerEarnings.iponReleaseId),
        ),
      );
    const [released] = await db
      .select({ total: sql<string>`COALESCE(SUM(${farmerPayouts.netAmount}), 0)` })
      .from(farmerPayouts);
    return {
      availableEarnings: amount(available?.total),
      iponLiability: amount(ipon?.total),
      releasedEarnings: amount(released?.total),
    };
  },
);
