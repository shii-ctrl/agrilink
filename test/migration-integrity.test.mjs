import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("fresh production migration is empty and explicit development seed creates demo data", () => {
  if (
    !process.env.TEST_DATABASE_ADMIN_URL ||
    !process.env.TEST_DATABASE_PREFIX ||
    process.env.TEST_DATABASE_ENVIRONMENT !== "disposable"
  ) {
    throw new Error(
      "Integration database configuration missing: set TEST_DATABASE_ADMIN_URL, TEST_DATABASE_PREFIX, and TEST_DATABASE_ENVIRONMENT=disposable.",
    );
  }
  const result = execFileSync(process.execPath, ["scripts/verify-fresh-migrations.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.match(
    result,
    /Fresh production migration and explicit development seed verification passed/,
  );
});
