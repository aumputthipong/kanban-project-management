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
      exclude: ["src/**/__tests__/**", "src/test/**", "src/types/**", "src/**/*.d.ts"],
      reporter: ["text-summary", "html"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
