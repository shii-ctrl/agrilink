import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const exports = {};
runInNewContext(
  ts.transpileModule(await readFile("src/features/farmer/planting-costs.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports, require: createRequire(import.meta.url), Date, Intl },
);
const { summarizePlanting, plantingInput, plantingExpenseInput, createPlantingInput } = exports;
const sale = (values = {}) => ({
  grossAmount: "10000.00",
  serviceFee: "500.00",
  iponContribution: "200.00",
  netAmount: "9300.00",
  status: "pending_payment",
  ...values,
});
test("planting costs remain expenses without showing a premature loss before any sale", () => {
  const result = summarizePlanting([{ amount: "300.00" }, { amount: "500.00" }], []);
  assert.equal(result.totalExpenses, 800);
  assert.equal(result.profit, null);
  assert.equal(result.cashAfterExpenses, null);
});
test("IPON remains Farmer savings while service fees and planting costs reduce profit", () => {
  const result = summarizePlanting([{ amount: "6000.00" }], [sale()]);
  assert.equal(result.profit, 3500);
  assert.equal(result.cashAfterExpenses, 3300);
  assert.equal(result.ipon, 200);
  assert.equal(result.awaitingBuyerPayment, 9300);
  assert.equal(result.cashReleased, 0);
});
test("paid sales and released payouts remain separate without changing profit", () => {
  const costs = [{ amount: "6000.00" }];
  const available = summarizePlanting(costs, [sale({ status: "available" })]);
  const released = summarizePlanting(costs, [sale({ status: "paid" })]);
  assert.equal(available.profit, released.profit);
  assert.equal(available.availableForPayout, 9300);
  assert.equal(released.availableForPayout, 0);
  assert.equal(released.cashReleased, 9300);
});
test("recorded losses and cent-level expense totals are calculated without rounding drift", () => {
  const result = summarizePlanting(
    [{ amount: "0.10" }, { amount: "0.20" }, { amount: "1.15" }],
    [
      sale({
        grossAmount: "1.00",
        serviceFee: "0.25",
        iponContribution: "0.10",
        netAmount: "0.65",
      }),
    ],
  );
  assert.equal(result.totalExpenses, 1.45);
  assert.equal(result.profit, -0.7);
  assert.equal(result.cashAfterExpenses, -0.8);
});
test("actual expense validation accepts dated costs before planting but rejects future or invalid values", () => {
  const id = "c7eb0635-a089-478f-8b27-22035bc08a72";
  const expense = {
    id,
    plantingId: id,
    occurredOn: "2020-10-01",
    category: "seeds",
    description: "Sitaw seeds",
    amount: 1.15,
  };
  assert.equal(plantingExpenseInput.safeParse(expense).success, true);
  for (const value of [0, -1, 0.001, Infinity, NaN])
    assert.equal(plantingExpenseInput.safeParse({ ...expense, amount: value }).success, false);
  for (const value of ["2020-02-30", "not-a-date", "2999-01-01"])
    assert.equal(plantingExpenseInput.safeParse({ ...expense, occurredOn: value }).success, false);
  assert.equal(
    plantingInput.safeParse({
      id,
      name: "Sitaw October",
      cropName: "Sitaw",
      plantedOn: "2020-10-10",
    }).success,
    true,
  );
});
test("new plantings accept initial dated expense entries and reject duplicate expense IDs", () => {
  const id = "c7eb0635-a089-478f-8b27-22035bc08a72";
  const planting = { id, name: "Sitaw October", cropName: "Sitaw", plantedOn: "2020-10-01" };
  const first = {
    id,
    occurredOn: "2020-10-01",
    category: "seeds",
    description: "Sitaw seeds",
    amount: 300,
  };
  const second = {
    ...first,
    id: "a0ba298c-fd32-46ee-a3fa-97c8811ac91c",
    occurredOn: "2020-10-10",
    category: "fertilizer",
    amount: 500,
  };
  assert.equal(createPlantingInput.parse(planting).expenses.length, 0);
  const parsed = createPlantingInput.parse({ ...planting, expenses: [first, second] });
  assert.equal(
    summarizePlanting(
      parsed.expenses.map((row) => ({ amount: row.amount.toFixed(2) })),
      [],
    ).totalExpenses,
    800,
  );
  assert.equal(
    createPlantingInput.safeParse({ ...planting, expenses: [first, first] }).success,
    false,
  );
  assert.equal(
    createPlantingInput.safeParse({ ...planting, expenses: [{ ...first, amount: 0.001 }] }).success,
    false,
  );
});
