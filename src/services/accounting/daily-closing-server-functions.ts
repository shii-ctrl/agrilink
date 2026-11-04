import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const dateInput = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const closeInput = dateInput.extend({
  openingCash: z.number().min(0),
  actualCash: z.number().min(0),
  notes: z.string().trim().max(2000).optional(),
});
const adjustmentInput = z.object({
  closingId: z.string().uuid(),
  amount: z.number().refine((value) => Math.abs(value) >= 0.01, "Enter a non-zero amount."),
  reason: z.string().trim().min(5).max(1000),
});

const money = (value: unknown) => Number(value ?? 0);
const rounded = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const asMoney = (value: number) => rounded(value).toFixed(2);
function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 86_400_000);
  if (Number.isNaN(start.getTime())) throw new Error("Choose a valid business date.");
  return { start, end };
}

async function calculateDay(date: string, openingCash: number) {
  const { start, end } = dayRange(date);
  const { db } = await import("@/db/client.server");
  const {
    codRemittances,
    deliveryDisputes,
    farmerEarnings,
    farmerIponReleases,
    farmerPayouts,
    orders,
    payments,
  } = await import("@/db/schema");

  const paymentRows = await db
    .select({
      amount: payments.amount,
      method: payments.method,
      fulfillmentMethod: orders.fulfillmentMethod,
      deliveryFee: orders.deliveryFee,
    })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(
      and(
        inArray(payments.method, ["cash", "cash_on_delivery"]),
        gte(payments.paidAt, start),
        lt(payments.paidAt, end),
      ),
    );
  const earningRows = await db
    .select({ serviceFee: farmerEarnings.serviceFee, ipon: farmerEarnings.iponContribution })
    .from(farmerEarnings)
    .where(and(gte(farmerEarnings.eligibleAt, start), lt(farmerEarnings.eligibleAt, end)));
  const [refundRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${deliveryDisputes.refundAmount}), 0)` })
    .from(deliveryDisputes)
    .where(
      and(
        eq(deliveryDisputes.refundStatus, "processed"),
        gte(deliveryDisputes.accountingProcessedAt, start),
        lt(deliveryDisputes.accountingProcessedAt, end),
      ),
    );
  const [payoutRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${farmerPayouts.netAmount}), 0)` })
    .from(farmerPayouts)
    .where(and(gte(farmerPayouts.releasedAt, start), lt(farmerPayouts.releasedAt, end)));
  const [iponReleaseRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${farmerIponReleases.amount}), 0)` })
    .from(farmerIponReleases)
    .where(and(gte(farmerIponReleases.releasedAt, start), lt(farmerIponReleases.releasedAt, end)));
  const [payableRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${farmerEarnings.netAmount}), 0)` })
    .from(farmerEarnings)
    .where(eq(farmerEarnings.status, "available"));
  const [pendingCodRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${codRemittances.amount}), 0)` })
    .from(codRemittances)
    .where(inArray(codRemittances.status, ["collected", "submitted"]));

  const pickupCollections = paymentRows
    .filter((row) => row.fulfillmentMethod === "pickup")
    .reduce((sum, row) => sum + money(row.amount), 0);
  const codCollections = paymentRows
    .filter((row) => row.method === "cash_on_delivery")
    .reduce((sum, row) => sum + money(row.amount), 0);
  const grossSales = paymentRows.reduce((sum, row) => sum + money(row.amount), 0);
  const deliveryFees = paymentRows
    .filter((row) => row.fulfillmentMethod === "delivery")
    .reduce((sum, row) => sum + money(row.deliveryFee), 0);
  const refunds = money(refundRow?.total);
  const farmerPayoutTotal = money(payoutRow?.total);
  const iponReleases = money(iponReleaseRow?.total);
  const expectedCash = openingCash + grossSales - refunds - farmerPayoutTotal - iponReleases;

  return {
    date,
    openingCash: rounded(openingCash),
    grossSales: rounded(grossSales),
    pickupCollections: rounded(pickupCollections),
    codCollections: rounded(codCollections),
    pendingCod: rounded(money(pendingCodRow?.total)),
    deliveryFees: rounded(deliveryFees),
    refunds: rounded(refunds),
    farmerPayable: rounded(money(payableRow?.total)),
    farmerPayouts: rounded(farmerPayoutTotal),
    serviceFeeIncome: rounded(earningRows.reduce((sum, row) => sum + money(row.serviceFee), 0)),
    iponContributions: rounded(earningRows.reduce((sum, row) => sum + money(row.ipon), 0)),
    iponReleases: rounded(iponReleases),
    expectedCash: rounded(expectedCash),
  };
}

async function closingHistory() {
  const { db } = await import("@/db/client.server");
  const { dailyCashAdjustments, dailyCashClosings, users } = await import("@/db/schema");
  const rows = await db
    .select({ closing: dailyCashClosings, closedByName: users.displayName })
    .from(dailyCashClosings)
    .innerJoin(users, eq(dailyCashClosings.closedById, users.id))
    .orderBy(desc(dailyCashClosings.businessDate));
  const adjustments = await db
    .select()
    .from(dailyCashAdjustments)
    .orderBy(desc(dailyCashAdjustments.createdAt));
  return rows.map(({ closing, closedByName }) => {
    const entries = adjustments
      .filter((item) => item.closingId === closing.id)
      .map((item) => ({ ...item, amount: money(item.amount) }));
    const adjustmentTotal = entries.reduce((sum, item) => sum + item.amount, 0);
    const expectedCash = money(closing.expectedCash);
    const actualCash = money(closing.actualCash);
    return {
      ...closing,
      closedByName,
      openingCash: money(closing.openingCash),
      grossSales: money(closing.grossSales),
      pickupCollections: money(closing.pickupCollections),
      codCollections: money(closing.codCollections),
      pendingCod: money(closing.pendingCod),
      deliveryFees: money(closing.deliveryFees),
      refunds: money(closing.refunds),
      farmerPayable: money(closing.farmerPayable),
      farmerPayouts: money(closing.farmerPayouts),
      serviceFeeIncome: money(closing.serviceFeeIncome),
      iponContributions: money(closing.iponContributions),
      iponReleases: money(closing.iponReleases),
      expectedCash,
      actualCash,
      variance: money(closing.variance),
      adjustments: entries,
      adjustedExpectedCash: rounded(expectedCash + adjustmentTotal),
      adjustedVariance: rounded(actualCash - expectedCash - adjustmentTotal),
    };
  });
}

export const getDailyCashClosingPreview = createServerFn({ method: "GET" })
  .validator(dateInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("@/services/auth/auth-server");
    await requireRole("Accounting");
    const history = await closingHistory();
    const existing = history.find((item) => item.businessDate === data.date) ?? null;
    const prior = history.find((item) => item.businessDate < data.date);
    const suggestedOpeningCash = prior?.actualCash ?? 0;
    return {
      existing,
      suggestedOpeningCash,
      preview: existing ? null : await calculateDay(data.date, suggestedOpeningCash),
    };
  });

export const getDailyCashClosingHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAnyRole } = await import("@/services/auth/auth-server");
  await requireAnyRole(["Accounting", "Management"]);
  return closingHistory();
});

export const closeDailyCash = createServerFn({ method: "POST" })
  .validator(closeInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const accountant = await requireRole("Accounting");
    const { db } = await import("@/db/client.server");
    const { dailyCashClosings } = await import("@/db/schema");
    const [existing] = await db
      .select({ id: dailyCashClosings.id })
      .from(dailyCashClosings)
      .where(eq(dailyCashClosings.businessDate, data.date));
    if (existing) throw new Error("This business day is already closed and locked.");
    const totals = await calculateDay(data.date, data.openingCash);
    const variance = rounded(data.actualCash - totals.expectedCash);
    if (Math.abs(variance) >= 0.01 && !data.notes?.trim()) {
      throw new Error("Add a reason for the cash shortage or overage before closing the day.");
    }
    const id = crypto.randomUUID();
    await db.insert(dailyCashClosings).values({
      id,
      businessDate: data.date,
      openingCash: asMoney(totals.openingCash),
      grossSales: asMoney(totals.grossSales),
      pickupCollections: asMoney(totals.pickupCollections),
      codCollections: asMoney(totals.codCollections),
      pendingCod: asMoney(totals.pendingCod),
      deliveryFees: asMoney(totals.deliveryFees),
      refunds: asMoney(totals.refunds),
      farmerPayable: asMoney(totals.farmerPayable),
      farmerPayouts: asMoney(totals.farmerPayouts),
      serviceFeeIncome: asMoney(totals.serviceFeeIncome),
      iponContributions: asMoney(totals.iponContributions),
      iponReleases: asMoney(totals.iponReleases),
      expectedCash: asMoney(totals.expectedCash),
      actualCash: asMoney(data.actualCash),
      variance: asMoney(variance),
      notes: data.notes?.trim() || null,
      closedById: accountant.id,
      closedAt: new Date(),
    });
    await writeAuditLog(accountant.id, "daily_cash.close", "daily_cash_closing", id, {
      businessDate: data.date,
      expectedCash: totals.expectedCash,
      actualCash: data.actualCash,
      variance,
    });
    const { notifyRole } = await import("@/services/messaging/notification-server");
    await notifyRole("Management", {
      title: "Daily cash closing completed",
      message: `${data.date} was closed by Accounting with a ${variance === 0 ? "balanced cash count" : `₱${Math.abs(variance).toFixed(2)} ${variance > 0 ? "overage" : "shortage"}`}.`,
      target: "/management/reports",
    });
    return { success: true, id };
  });

export const addDailyCashAdjustment = createServerFn({ method: "POST" })
  .validator(adjustmentInput)
  .handler(async ({ data }) => {
    const { requireRole, writeAuditLog } = await import("@/services/auth/auth-server");
    const accountant = await requireRole("Accounting");
    const { db } = await import("@/db/client.server");
    const { dailyCashAdjustments, dailyCashClosings } = await import("@/db/schema");
    const [closing] = await db
      .select({ id: dailyCashClosings.id })
      .from(dailyCashClosings)
      .where(eq(dailyCashClosings.id, data.closingId));
    if (!closing) throw new Error("The closed day could not be found.");
    const id = crypto.randomUUID();
    await db.insert(dailyCashAdjustments).values({
      id,
      closingId: data.closingId,
      amount: asMoney(data.amount),
      reason: data.reason.trim(),
      recordedById: accountant.id,
    });
    await writeAuditLog(accountant.id, "daily_cash.adjust", "daily_cash_closing", data.closingId, {
      adjustmentId: id,
      amount: data.amount,
      reason: data.reason.trim(),
    });
    return { success: true };
  });
