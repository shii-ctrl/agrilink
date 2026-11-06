import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = await readFile("src/features/management/decision-support.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
runInNewContext(compiled, context);
const { buildDecisionSupport, manilaDay, validDay } = context.exports;

const filters = { start: "2026-10-31", end: "2026-11-06", unit: "kg", quality: "all" };
const stock = (overrides = {}) => ({
  id: "listing-1",
  productId: "crop-1",
  name: "Ampalaya",
  classification: "Good",
  sellingUnit: "kg",
  availableKg: 6,
  reservedKg: 4,
  quantityKg: 10,
  listingStatus: "published",
  active: true,
  oldestReceivedAt: "2026-10-20T00:00:00Z",
  ...overrides,
});
const sale = (overrides = {}) => ({
  orderId: "order-1",
  productId: "crop-1",
  name: "Ampalaya",
  classification: "Good",
  sellingUnit: "kg",
  quantityKg: 2,
  amount: 100,
  status: "sold",
  createdAt: "2026-10-25T00:00:00Z",
  soldAt: "2026-11-02T00:00:00Z",
  ...overrides,
});
const data = (overrides = {}) => ({
  stock: [],
  orderLines: [],
  priceHistory: [],
  updatedAt: "2026-11-06T04:00:00Z",
  ...overrides,
});

test("decision support separates selling units, product identities, and qualities", () => {
  const input = data({
    stock: [
      stock(),
      stock({
        productId: "crop-2",
        name: "Ampalaya",
        availableKg: 3,
        quantityKg: 3,
        reservedKg: 0,
      }),
      stock({ classification: "Semi", availableKg: 5, quantityKg: 5, reservedKg: 0 }),
      stock({
        productId: "egg",
        name: "Egg",
        sellingUnit: "tray",
        availableKg: 100,
        quantityKg: 100,
      }),
    ],
  });
  const result = buildDecisionSupport(input, filters);
  assert.equal(result.rows.length, 3);
  assert.equal(result.totals.stock, 14);
  assert.equal(buildDecisionSupport(input, { ...filters, quality: "Semi" }).totals.stock, 5);
  assert.equal(buildDecisionSupport(input, { ...filters, unit: "tray" }).totals.stock, 100);
});

test("reserved quantities are not counted twice when assessing shortfall", () => {
  const input = data({
    stock: [stock()],
    orderLines: [sale({ status: "confirmed", quantityKg: 8 })],
  });
  let result = buildDecisionSupport(input, filters);
  assert.equal(result.rows[0].shortage, 0);
  assert.equal(result.totals.stock, 6);
  assert.equal(result.totals.reserved, 4);
  assert.equal(result.totals.demand, 8);
  input.orderLines.push(sale({ status: "pending", quantityKg: 3 }));
  result = buildDecisionSupport(input, filters);
  assert.equal(result.rows[0].shortage, 1);
});

test("sales use completion dates, equal previous periods, and exclude cancelled orders", () => {
  const input = data({
    orderLines: [
      sale(),
      sale({ soldAt: "2026-10-30T12:00:00Z", quantityKg: 5, amount: 250 }),
      sale({ soldAt: "2026-10-23T00:00:00Z", quantityKg: 99, amount: 9999 }),
      sale({ status: "cancelled", quantityKg: 99, amount: 9999 }),
      sale({ soldAt: null, createdAt: "2026-11-01T00:00:00Z" }),
    ],
  });
  const result = buildDecisionSupport(input, filters);
  assert.equal(result.previousStart, "2026-10-24");
  assert.equal(result.previousEnd, "2026-10-30");
  assert.equal(result.totals.sold, 4);
  assert.equal(result.totals.sales, 200);
  assert.equal(result.totals.previousSold, 5);
  assert.equal(result.legacySales, 1);
});

test("stock coverage requires history and uses recent sales independently of the sales filter", () => {
  const input = data({
    stock: [stock({ availableKg: 2, quantityKg: 2, reservedKg: 0 })],
    orderLines: ["2026-10-25", "2026-10-29", "2026-11-05"].map((day) =>
      sale({ soldAt: day + "T00:00:00Z", quantityKg: 14 }),
    ),
  });
  const result = buildDecisionSupport(input, filters).rows[0];
  assert.equal(result.coverage, 0.67);
  assert.equal(result.replenish, 19);
  assert.equal(
    buildDecisionSupport(input, { ...filters, start: "2026-11-06" }).rows[0].coverage,
    0.67,
  );
  input.orderLines.pop();
  assert.equal(buildDecisionSupport(input, filters).rows[0].coverage, null);
});

test("aging requires remaining stock and whole-unit replenishment rounds up", () => {
  const input = data({
    stock: [
      stock({ sellingUnit: "tray", availableKg: 1, quantityKg: 1, reservedKg: 0 }),
      stock({ productId: "empty", availableKg: 0, quantityKg: 0, reservedKg: 0 }),
    ],
    orderLines: ["2026-10-25", "2026-10-29", "2026-11-05"].map((day) =>
      sale({ sellingUnit: "tray", soldAt: day + "T00:00:00Z", quantityKg: 3 }),
    ),
  });
  const result = buildDecisionSupport(input, { ...filters, unit: "tray" });
  assert.equal(result.rows[0].replenish, 4);
  assert.equal(result.rows[0].aging, true);
  assert.equal(buildDecisionSupport(input, filters).rows[0].aging, false);
});

test("dates follow Philippine midnight and reject impossible or inverted ranges", () => {
  assert.equal(manilaDay("2026-11-05T16:00:00Z"), "2026-11-06");
  assert.equal(manilaDay("2026-11-05T15:59:59Z"), "2026-11-05");
  assert.equal(validDay("2026-02-30"), false);
  assert.throws(
    () => buildDecisionSupport(data(), { ...filters, start: "2026-11-07" }),
    /valid date range/,
  );
  const empty = buildDecisionSupport(data(), filters);
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.totals.sales, 0);
});
