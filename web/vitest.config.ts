import path from "node:path";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: that file wraps the Lovable /
// TanStack Start plugin stack, which is meant for the app build and would
// pull the whole SSR toolchain into unit tests. The tests here cover pure
// modules only, so a plain config with the "@" alias is all they need.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/lovable-*.ts", "src/lib/error-*.ts"],
    },
  },
});
