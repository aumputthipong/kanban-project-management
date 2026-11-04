import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// localhost, not 127.0.0.1: the backend's WS Origin check matches FRONTEND_URL exactly.
const FRONTEND_URL = "http://localhost:3000";
const BACKEND_URL = "http://localhost:8080";

const backendEnv = {
  DB_URL:
    process.env.E2E_DB_URL ??
    "postgres://erp_user:erp_password@localhost:5432/erp_kanban?sslmode=disable",
  JWT_SECRET: "e2e-only-secret-not-for-any-real-deployment-000",
  FRONTEND_URL,
  RATE_LIMIT_DISABLED: "true",
  TRUSTED_PROXY_COUNT: "0",
  LOG_LEVEL: "warn",
};

const frontendEnv = {
  NEXT_PUBLIC_API_URL: `${BACKEND_URL}/api`,
  NEXT_PUBLIC_WS_URL: "ws://localhost:8080/ws",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? FRONTEND_URL,
    timezoneId: "Asia/Bangkok",
    locale: "th-TH",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "go run ./cmd/api",
          cwd: "../backend",
          url: `${BACKEND_URL}/healthz`,
          env: backendEnv,
          reuseExistingServer: !isCI,
          stdout: "pipe",
          timeout: 120_000,
        },
        {
          command: isCI ? "npm run start" : "npm run dev",
          url: FRONTEND_URL,
          env: frontendEnv,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      ],
});
