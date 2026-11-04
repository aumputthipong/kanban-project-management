import { test, expect } from "@playwright/test";

test.describe("public routes render", () => {
  test("landing page shows hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/turtask/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("login page renders form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("404 page is reachable", async ({ page }) => {
    const response = await page.goto("/this-route-definitely-does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

test("backend is up and reachable", async ({ request }) => {
  const response = await request.get("http://localhost:8080/healthz");
  expect(response.ok()).toBe(true);
});
