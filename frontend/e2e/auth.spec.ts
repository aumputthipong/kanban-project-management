import { test, expect } from "./fixtures";
import { registerUser, uniq } from "./helpers/api";

test("register through the form lands on the dashboard", async ({ page }) => {
  const id = uniq("signup");
  await page.goto("/register");
  await page.getByLabel("Full Name").fill(`E2E ${id}`);
  await page.getByLabel("Email").fill(`${id}@e2e.turtask.invalid`);
  await page.getByLabel("Password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("sign in with valid credentials", async ({ page }) => {
  const user = await registerUser();
  await user.api.dispose();

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("wrong password shows an error and stays on login", async ({ page }) => {
  const user = await registerUser();
  await user.api.dispose();

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("not-the-password");
  const response = page.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
  await page.getByRole("button", { name: "Sign in" }).click();

  expect((await response).status()).toBe(401);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("form p")).toBeVisible();
});

test("a logged-out visit to a board redirects to login", async ({ page }) => {
  await page.goto("/board/00000000-0000-4000-8000-000000000000/tasks");
  await expect(page).toHaveURL(/\/login/);
});

test("sign out ends the session", async ({ page, user }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: user.fullName }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
