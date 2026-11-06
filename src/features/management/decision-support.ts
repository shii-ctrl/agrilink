import type { SellingUnit } from "@/features/marketplace/selling-units";

export type DecisionSupportData = {
  stock: Array<{
    id: string;
    productId: string;
    name: string;
    classification: string;
    sellingUnit: SellingUnit;
    availableKg: number;
    reservedKg: number;
    quantityKg: number;
    listingStatus: string;
    active: boolean;
    oldestReceivedAt: string | null;
  }>;
  orderLines: Array<{
    orderId: string;
    productId: string;
    name: string;
    classification: string;
    sellingUnit: SellingUnit;
    quantityKg: number;
    amount: number;
    status: string;
    createdAt: string;
    soldAt: string | null;
  }>;
  priceHistory: Array<{
    listingId: string;
    name: string;
    classification: string;
    sellingUnit: SellingUnit;
    price: number;
    priceDate: string;
  }>;
  updatedAt: string;
};

const dayMs = 86_400_000;
const rounded = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function manilaDay(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function shiftDay(day: string, offset: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + offset * dayMs).toISOString().slice(0, 10);
}

export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(`${day}T00:00:00Z`)) &&
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
  );
}

export function buildDecisionSupport(
  data: DecisionSupportData,
  filters: { start: string; end: string; unit: SellingUnit; quality: string },
) {
  if (!validDay(filters.start) || !validDay(filters.end) || filters.start > filters.end) {
    throw new Error("Choose a valid date range.");
  }
  const matches = (row: { sellingUnit: SellingUnit; classification: string }) =>
    row.sellingUnit === filters.unit &&
    (filters.quality === "all" || row.classification === filters.quality);
  const dayCount = Math.round((Date.parse(filters.end) - Date.parse(filters.start)) / dayMs) + 1;
  const previousStart = shiftDay(filters.start, -dayCount);
  const previousEnd = shiftDay(filters.start, -1);
  const today = manilaDay(data.updatedAt);
  const recentStart = shiftDay(today, -13);
  const keyOf = (row: { productId: string; classification: string; sellingUnit: string }) =>
    JSON.stringify([row.productId, row.classification, row.sellingUnit]);
  const summaries = new Map<
    string,
    {
      id: string;
      name: string;
      classification: string;
      sellingUnit: SellingUnit;
      stock: number;
      onHand: number;
      reserved: number;
      demand: number;
      sold: number;
      previousSold: number;
      sales: number;
      previousSales: number;
      recentSold: number;
      sellingDays: Set<string>;
      oldestSaleDay: string | null;
      ageDays: number | null;
      published: boolean;
    }
  >();
  const summaryFor = (row: {
    productId: string;
    name: string;
    classification: string;
    sellingUnit: SellingUnit;
  }) => {
    const key = keyOf(row);
    let summary = summaries.get(key);
    if (!summary) {
      summary = {
        id: key,
        name: row.name,
        classification: row.classification,
        sellingUnit: row.sellingUnit,
        stock: 0,
        onHand: 0,
        reserved: 0,
        demand: 0,
        sold: 0,
        previousSold: 0,
        sales: 0,
        previousSales: 0,
        recentSold: 0,
        sellingDays: new Set(),
        oldestSaleDay: null,
        ageDays: null,
        published: false,
      };
      summaries.set(key, summary);
    }
    return summary;
  };
  for (const row of data.stock.filter(matches)) {
    const summary = summaryFor(row);
    summary.stock += row.availableKg;
    summary.onHand += row.quantityKg;
    summary.reserved += row.reservedKg;
    summary.published ||= row.active && row.listingStatus === "published";
    const receivedDay = row.oldestReceivedAt ? manilaDay(row.oldestReceivedAt) : "";
    if (row.quantityKg > 0 && receivedDay && receivedDay <= today) {
      const age = Math.floor((Date.parse(today) - Date.parse(receivedDay)) / dayMs);
      summary.ageDays = Math.max(summary.ageDays ?? 0, age);
    }
  }
  let legacySales = 0;
  for (const row of data.orderLines.filter(matches)) {
    const summary = summaryFor(row);
    if (row.status === "pending" || row.status === "confirmed") summary.demand += row.quantityKg;
    if (row.status !== "sold") continue;
    const saleDay = manilaDay(row.soldAt ?? row.createdAt);
    if (!saleDay) continue;
    if (saleDay >= filters.start && saleDay <= filters.end) {
      summary.sold += row.quantityKg;
      summary.sales += row.amount;
      if (!row.soldAt) legacySales++;
    }
    if (saleDay >= previousStart && saleDay <= previousEnd) {
      summary.previousSold += row.quantityKg;
      summary.previousSales += row.amount;
    }
    if (saleDay >= recentStart && saleDay <= today && row.quantityKg > 0) {
      summary.recentSold += row.quantityKg;
      summary.sellingDays.add(saleDay);
      if (!summary.oldestSaleDay || saleDay < summary.oldestSaleDay)
        summary.oldestSaleDay = saleDay;
    }
  }
  const rows = [...summaries.values()]
    .map((summary) => {
      const observedDays = summary.oldestSaleDay
        ? Math.floor((Date.parse(today) - Date.parse(summary.oldestSaleDay)) / dayMs) + 1
        : 0;
      const dailySales = summary.recentSold / 14;
      const enoughHistory = observedDays >= 7 && summary.sellingDays.size >= 3;
      const coverage = enoughHistory && dailySales > 0 ? rounded(summary.stock / dailySales) : null;
      const shortage = rounded(Math.max(0, summary.demand - summary.onHand));
      const replenish =
        coverage !== null && coverage <= 3 ? Math.max(0, dailySales * 7 - summary.stock) : 0;
      return {
        ...summary,
        stock: rounded(summary.stock),
        onHand: rounded(summary.onHand),
        reserved: rounded(summary.reserved),
        demand: rounded(summary.demand),
        sold: rounded(summary.sold),
        previousSold: rounded(summary.previousSold),
        sales: rounded(summary.sales),
        previousSales: rounded(summary.previousSales),
        shortage,
        coverage,
        replenish: summary.sellingUnit === "kg" ? rounded(replenish) : Math.ceil(replenish),
        aging: summary.stock > 0 && (summary.ageDays ?? 0) >= 7,
        slowMoving:
          summary.stock > 0 &&
          (summary.ageDays ?? 0) >= 7 &&
          (summary.recentSold === 0 || (coverage !== null && coverage > 14)),
      };
    })
    .sort((a, b) => b.shortage - a.shortage || b.demand - a.demand || a.name.localeCompare(b.name));
  const total = (
    field: "stock" | "reserved" | "demand" | "sold" | "previousSold" | "sales" | "previousSales",
  ) => rounded(rows.reduce((sum, row) => sum + row[field], 0));
  return {
    rows,
    previousStart,
    previousEnd,
    legacySales,
    totals: {
      stock: total("stock"),
      reserved: total("reserved"),
      demand: total("demand"),
      sold: total("sold"),
      previousSold: total("previousSold"),
      sales: total("sales"),
      previousSales: total("previousSales"),
    },
  };
}
