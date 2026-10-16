// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Render needs the standard long-running Node server output. Vercel sets the
// VERCEL environment variable during its build, where Nitro must instead emit
// Vercel Functions. NITRO_PRESET remains an explicit escape hatch for CI.
const nitroPreset = process.env["NITRO_PRESET"] ?? (process.env["VERCEL"] ? "vercel" : "node-server");

export default defineConfig({
  // This application uses mysql2 over a normal TCP connection. Deploy it to a
  // Node-compatible runtime, not a Cloudflare Worker runtime.
  nitro: { preset: nitroPreset },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
