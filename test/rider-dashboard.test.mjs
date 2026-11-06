import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile("src/services/marketplace/marketplace-server-functions.ts", "utf8");
const start = source.indexOf("export const getRiderDeliveryStatus =");
const end = source.indexOf("export const getRiderCompletedDeliveries =", start);
const handlerSource = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test("Rider dashboard scopes all orders to its Rider and counts completed deliveries within the Manila day", async () => {
  const schema = Object.fromEntries(
    ["orders", "users", "payments", "deliverySettings"].map((name) => [
      name,
      new Proxy({}, { get: (_, field) => `${name}.${String(field)}` }),
    ]),
  );
  const queries = [];
  const fixtures = [
    {
      orderNumber: "assigned",
      fulfillmentStatus: "rider_assigned",
      assignedRiderId: "rider",
      totalAmount: "159.00",
      buyerId: "buyer",
      paymentId: null,
    },
    {
      orderNumber: "paid",
      fulfillmentStatus: "out_for_delivery",
      assignedRiderId: "rider",
      totalAmount: "259.00",
      buyerId: "buyer",
      paymentId: "paid-id",
    },
    {
      orderNumber: "today",
      fulfillmentStatus: "delivered",
      assignedRiderId: "rider",
      fulfilledAt: new Date("2026-11-06T16:00:00Z"),
    },
    {
      orderNumber: "yesterday",
      fulfillmentStatus: "delivered",
      assignedRiderId: "rider",
      fulfilledAt: new Date("2026-11-06T15:59:59Z"),
    },
    {
      orderNumber: "tomorrow",
      fulfillmentStatus: "delivered",
      assignedRiderId: "rider",
      fulfilledAt: new Date("2026-11-07T16:00:00Z"),
    },
    {
      orderNumber: "other",
      fulfillmentStatus: "delivered",
      assignedRiderId: "other-rider",
      fulfilledAt: new Date("2026-11-07T01:00:00Z"),
    },
  ].map((order) => ({ ...order, fulfillmentMethod: "delivery" }));
  const value = (row, column) => row[column.split(".")[1]];
  const db = {
    select(selection) {
      const query = {
        selection,
        from(table) {
          this.table = table;
          return this;
        },
        innerJoin() {
          return this;
        },
        leftJoin() {
          return this;
        },
        where(predicate) {
          this.predicate = predicate;
          return this;
        },
        limit() {
          return this;
        },
        orderBy() {
          return this;
        },
        then(resolve, reject) {
          queries.push(this);
          const rows = fixtures.filter(this.predicate);
          return Promise.resolve(
            this.table === schema.deliverySettings
              ? [{ flatFee: "59", deliveryEnabled: true }]
              : "count" in selection
                ? [{ count: String(rows.length) }]
                : rows,
          ).then(resolve, reject);
        },
      };
      return query;
    },
  };
  let authorized = false;
  const context = {
    exports: {},
    Date: class extends Date {
      static now() {
        return Date.parse("2026-11-06T23:30:00Z");
      }
    },
    createServerFn: () => ({ handler: (fn) => fn }),
    eq: (column, expected) => (row) => value(row, column) === expected,
    inArray: (column, expected) => (row) => expected.includes(value(row, column)),
    and:
      (...predicates) =>
      (row) =>
        predicates.every((fn) => fn(row)),
    asc: (column) => column,
    sql: (strings, ...values) =>
      strings.join("").includes("count(*)")
        ? "count"
        : (row) => value(row, values[0]) >= values[1] && value(row, values[2]) < values[3],
    require: (name) => {
      if (name.includes("auth-server"))
        return {
          requireRole: async (role) => {
            assert.equal(role, "Rider");
            authorized = true;
            return { id: "rider" };
          },
        };
      if (name.includes("client.server")) {
        assert.equal(authorized, true);
        return { db };
      }
      if (name.includes("db/schema")) return schema;
      throw new Error(`Unexpected dependency ${name}`);
    },
  };
  runInNewContext(handlerSource, context);
  const result = await context.exports.getRiderDeliveryStatus();
  assert.equal(result.completedToday, 1);
  assert.equal(result.assignments.length, 2);
  assert.equal(result.assignments[0].totalAmount, 159);
  assert.equal(result.assignments[0].buyerId, "buyer");
  assert.equal(result.assignments[0].paymentId, null);
  assert.equal(result.assignments[1].paymentId, "paid-id");
  assert.equal(queries.length, 3);
  const assignmentQuery = queries.find((query) => "orderNumber" in query.selection);
  assert.equal(assignmentQuery.selection.buyerId, "orders.buyerId");
  assert.equal(assignmentQuery.selection.paymentId, "payments.id");
});
