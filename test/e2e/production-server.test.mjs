import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";

test("production Node server returns the public landing page", async () => {
  assert.equal(existsSync(".output/server/index.mjs"), true, "run npm run build before e2e tests");
  const port = "4174";
  const child = spawn(process.execPath, [".output/server/index.mjs"], {
    env: { ...process.env, NITRO_PORT: port, PORT: port },
    stdio: "ignore",
  });
  try {
    let response;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        response = await fetch(`http://127.0.0.1:${port}/`);
        break;
      } catch {
        // Wait for the production server to boot.
      }
    }
    assert.equal(response?.status, 200);
    assert.match(await response.text(), /AgriLink/);
  } finally {
    child.kill();
  }
});
