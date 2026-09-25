import { spawn } from "node:child_process";

const port = "4173";
const server = spawn(process.execPath, [".output/server/index.mjs"], {
  env: { ...process.env, NITRO_PORT: port, PORT: port },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (chunk) => (output += chunk));
server.stderr.on("data", (chunk) => (output += chunk));
try {
  let response;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      response = await fetch(`http://127.0.0.1:${port}/`);
      break;
    } catch {
      // The Node server is still starting.
    }
  }
  if (!response?.ok) throw new Error(`Production smoke test failed. ${output}`);
  console.log(`Production smoke test passed (${response.status}).`);
} finally {
  server.kill();
}
