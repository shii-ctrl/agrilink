import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const exports = {};
runInNewContext(
  ts.transpileModule(await readFile("src/features/settlements/earnings-overview.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports },
);
const { earningsSummary, deliveryEarnings } = exports;
const sale = (values = {}) => ({
  receivingId: "delivery-1",
  classification: "Good",
  quantity: "2.00",
  grossAmount: "100.00",
  serviceFee: "2.50",
  iponContribution: "1.00",
  netAmount: "96.50",
  status: "pending_payment",
  ...values,
});

test("sales, IPON, cash awaiting payment and paid cash remain distinct", () => {
  const result = earningsSummary([sale(), sale({ status: "available" }), sale({ status: "paid" })]);
  assert.equal(result.grossSales, 300);
  assert.equal(result.serviceFee, 7.5);
  assert.equal(result.iponSavings, 3);
  assert.equal(result.netEarnings, 289.5);
  assert.equal(result.awaitingPayment, 96.5);
  assert.equal(result.availableCash, 96.5);
  assert.equal(result.paidCash, 96.5);
  assert.equal(result.grossSales - result.serviceFee - result.iponSavings, result.netEarnings);
  assert.equal(result.awaitingPayment + result.availableCash + result.paidCash, result.netEarnings);
});

test("received deliveries stay visible before any sale and do not show estimated income", () => {
  const [delivery] = deliveryEarnings(
    [{ id: "delivery-1" }],
    [{ receivingId: "delivery-1", classification: "Good", quantity: "5.00" }],
    [{ receivingId: "delivery-1", classification: "Good", quantity: "5.00", reserved: "2.00" }],
    [],
  );
  assert.equal(delivery.soldQuantity, 0);
  assert.equal(delivery.remainingQuantity, 5);
  assert.equal(delivery.availableQuantity, 3);
  assert.equal(delivery.reservedQuantity, 2);
  assert.equal(delivery.summary.grossSales, 0);
  assert.equal(delivery.classifications[0].receivedQuantity, 5);
  assert.equal(delivery.lines.length, 0);
});

test("partial sales are attributed once to the right delivery and classification", () => {
  const deliveries = deliveryEarnings(
    [{ id: "delivery-1" }, { id: "delivery-2" }],
    [
      { receivingId: "delivery-1", classification: "Good", quantity: 5 },
      { receivingId: "delivery-1", classification: "Semi", quantity: 4 },
    ],
    [
      { receivingId: "delivery-1", classification: "Good", quantity: 3, reserved: 1 },
      { receivingId: "delivery-1", classification: "Semi", quantity: 3, reserved: 0 },
    ],
    [
      sale(),
      sale({ classification: "Semi", quantity: 1 }),
      sale({ receivingId: "delivery-2", quantity: 3, status: "paid" }),
    ],
  );
  assert.equal(deliveries[0].soldQuantity, 3);
  assert.equal(deliveries[0].remainingQuantity, 6);
  assert.equal(deliveries[0].classifications[0].soldQuantity, 2);
  assert.equal(deliveries[0].classifications[1].soldQuantity, 1);
  assert.equal(deliveries[0].summary.grossSales, 200);
  assert.equal(deliveries[1].summary.paidCash, 96.5);
});

test("cent-level sums and fractional quantities avoid floating-point drift", () => {
  const tiny = [
    sale({ grossAmount: "0.10", serviceFee: 0, iponContribution: 0, netAmount: "0.10" }),
    sale({ grossAmount: "0.20", serviceFee: 0, iponContribution: 0, netAmount: "0.20" }),
  ];
  assert.equal(earningsSummary(tiny).grossSales, 0.3);
  const [delivery] = deliveryEarnings(
    [{ id: "delivery-1" }],
    [],
    [{ receivingId: "delivery-1", classification: "Good", quantity: 0.3, reserved: 0.1 }],
    [],
  );
  assert.equal(delivery.availableQuantity, 0.2);
  assert.equal(earningsSummary([]).grossSales, 0);
});
