import { z } from "zod";

export const expenseCategories = [
  "seeds",
  "fertilizer",
  "pest_control",
  "labor",
  "water",
  "equipment",
  "transport",
  "other",
] as const;
export const expenseCategoryLabels: Record<(typeof expenseCategories)[number], string> = {
  seeds: "Buto / planting materials",
  fertilizer: "Pataba",
  pest_control: "Pest control",
  labor: "Labor",
  water: "Tubig / irrigation",
  equipment: "Equipment / supplies",
  transport: "Transport",
  other: "Iba pa",
};
export function todayInManila() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
const recordedDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pumili ng wastong petsa.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value >= "1900-01-01"
    );
  }, "Choose a valid date.")
  .refine((value) => value <= todayInManila(), "Actual records cannot use a future date.");
export const plantingInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Ilagay ang pangalan ng taniman.").max(160),
  cropName: z.string().trim().min(2, "Ilagay ang pangalan ng pananim.").max(160),
  plantedOn: recordedDate,
  notes: z.string().trim().max(2000).default(""),
});
export const plantingIdInput = z.object({ plantingId: z.string().uuid() });
export const plantingExpenseInput = plantingIdInput.extend({
  id: z.string().uuid(),
  occurredOn: recordedDate,
  category: z.enum(expenseCategories),
  description: z.string().trim().min(2, "Ilagay kung ano ang pinagkagastusan.").max(255),
  amount: z
    .number()
    .finite()
    .positive("Ilagay ang halagang mas mataas sa zero.")
    .max(999999999)
    .multipleOf(0.01, "Hanggang dalawang decimal places lamang ang halaga."),
  notes: z.string().trim().max(2000).default(""),
});

type Sale = {
  grossAmount: string;
  serviceFee: string;
  iponContribution: string;
  netAmount: string;
  status: string;
};
export function summarizePlanting(expenses: { amount: string }[], sales: Sale[]) {
  const sum = <T>(rows: T[], value: (row: T) => string) =>
    rows.reduce((total, row) => total + Math.round(Number(value(row)) * 100), 0);
  const costs = sum(expenses, (row) => row.amount),
    gross = sum(sales, (row) => row.grossAmount),
    fees = sum(sales, (row) => row.serviceFee);
  return {
    totalExpenses: costs / 100,
    grossSales: gross / 100,
    serviceFee: fees / 100,
    ipon: sum(sales, (row) => row.iponContribution) / 100,
    netCashEarnings: sum(sales, (row) => row.netAmount) / 100,
    awaitingBuyerPayment:
      sum(
        sales.filter((row) => row.status === "pending_payment"),
        (row) => row.netAmount,
      ) / 100,
    availableForPayout:
      sum(
        sales.filter((row) => row.status === "available"),
        (row) => row.netAmount,
      ) / 100,
    cashReleased:
      sum(
        sales.filter((row) => row.status === "paid"),
        (row) => row.netAmount,
      ) / 100,
    // IPON is the Farmer's savings, not an expense. Expenses never change payouts.
    profit: sales.length ? (gross - fees - costs) / 100 : null,
    cashAfterExpenses: sales.length ? (sum(sales, (row) => row.netAmount) - costs) / 100 : null,
  };
}
