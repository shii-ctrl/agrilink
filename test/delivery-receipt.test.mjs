import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const exports = {};
runInNewContext(
  ts.transpileModule(await readFile("src/features/marketplace/delivery-receipt.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports, Date },
);
const { buildDeliveryReceipt } = exports;
const order = (values = {}) => ({
  orderNumber: "ORD-2026-TEST",
  buyer: "Buyer",
  recipientName: "Recipient",
  contact: "09123456789",
  deliveryAddress: "Quezon",
  preferredSchedule: "Tomorrow",
  deliveryInstructions: "Call on arrival",
  assignedRiderName: null,
  createdAt: "2026-11-20T01:00:00Z",
  totalAmount: 55,
  deliveryFee: 25,
  payment: null,
  items: [
    { name: "Sitaw", classification: "Good", sellingUnit: "kg", quantityKg: 3, pricePerKg: 10 },
  ],
  ...values,
});
const printedAt = "2026-11-20T02:00:00Z";

test("dispatch receipt uses the saved sale prices and includes delivery fee in the COD amount", () => {
  const original = order();
  const receipt = buildDeliveryReceipt(original, null, printedAt);
  assert.equal(receipt.subtotal, 30);
  assert.equal(receipt.deliveryFee, 25);
  assert.equal(receipt.total, 55);
  assert.equal(receipt.amountDue, 55);
  assert.equal(receipt.paymentStatus, "cod");
  assert.equal(receipt.items[0].unitPrice, 10);
  assert.equal(receipt.items[0].lineTotal, 30);
  assert.equal(original.payment, null);
});
test("collected COD is distinct from Accounting confirmation and does not request a second payment", () => {
  const receipt = buildDeliveryReceipt(
    order(),
    { amount: "55.00", collectedAt: printedAt },
    printedAt,
  );
  assert.equal(receipt.paymentStatus, "collected");
  assert.equal(receipt.paymentReference, null);
  assert.equal(receipt.collectedAmount, 55);
  assert.equal(receipt.amountDue, 0);
  const paid = buildDeliveryReceipt(
    order({ payment: { paymentNumber: "PAY-TEST", paidAt: printedAt } }),
    { amount: 55, collectedAt: printedAt },
    printedAt,
  );
  assert.equal(paid.paymentStatus, "paid");
  assert.equal(paid.paymentReference, "PAY-TEST");
  assert.equal(paid.amountDue, 0);
});
test("receipt balances cent rounding and preserves whole-unit products", () => {
  const receipt = buildDeliveryReceipt(
    order({
      totalAmount: 1.01,
      deliveryFee: 1,
      items: [1, 2].map(() => ({
        name: "Crop",
        classification: "Good",
        sellingUnit: "kg",
        quantityKg: 0.01,
        pricePerKg: 0.5,
      })),
    }),
    null,
    printedAt,
  );
  assert.equal(receipt.subtotal, 0.01);
  assert.equal(receipt.roundingAdjustment, -0.01);
  assert.equal(
    receipt.items.reduce((sum, item) => sum + item.lineTotal, 0) +
      receipt.roundingAdjustment +
      receipt.deliveryFee,
    receipt.total,
  );
  const tray = buildDeliveryReceipt(
    order({
      items: [
        {
          name: "Eggs",
          classification: "Good",
          sellingUnit: "tray",
          quantityKg: 2,
          pricePerKg: 15,
        },
      ],
    }),
    null,
    printedAt,
  );
  assert.equal(tray.items[0].sellingUnit, "tray");
  assert.equal(tray.items[0].quantity, 2);
});
test("receipt contains only buyer-facing fields and never copies internal order data", () => {
  const receipt = buildDeliveryReceipt(
    order({
      recipientName: null,
      deliveryOtpCode: "123456",
      farmer: "Private Farmer",
      allocations: [{ farmer: "Private Farmer" }],
      history: [{ note: "Internal" }],
    }),
    null,
    printedAt,
  );
  assert.equal(receipt.recipientName, "Buyer");
  assert.equal(receipt.printedAt, printedAt);
  for (const key of ["deliveryOtpCode", "farmer", "allocations", "history"])
    assert.ok(!(key in receipt));
});
