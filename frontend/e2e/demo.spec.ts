import { test, expect } from "@playwright/test";

test("Try demo opens a seeded sandbox board", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Try demo/ }).click();

  await expect(page).toHaveURL(/\/board\/[0-9a-f-]+\/tasks$/, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "To Do" })).toBeVisible();
  await expect(page.locator('[aria-roledescription="การ์ด"]').first()).toBeVisible();
});
