import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Playwright owns the e2e/ folder — keep vitest out of it.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/__tests__/**",
        "src/test/**",
        "src/types/**",
        "src/**/*.d.ts",
        // Skeleton markup and the Next.js root error boundary: no logic to test.
        "src/app/**/loading.tsx",
        "src/app/global-error.tsx",
      ],
      reporter: ["text-summary", "html"],
      // Floors sit just under the measured numbers; raise them in the PR that adds tests (docs/CODE-NOTES.md).
      thresholds: {
        statements: 69,
        branches: 60,
        functions: 65,
        lines: 69,
        "src/store/**": { statements: 93, lines: 95 },
        "src/hooks/**": { statements: 84, lines: 85 },
        "src/lib/**": { statements: 77, lines: 78 },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
