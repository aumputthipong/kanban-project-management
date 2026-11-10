import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { createCard, getColumns, uniq } from "./helpers/api";

const column = (page: Page, title: string) => page.getByRole("region", { name: title });
const card = (page: Page, title: string) =>
  page.getByRole("button", { name: title }).and(page.locator('[aria-roledescription="การ์ด"]'));

test("create a card from the column header", async ({ page, board }) => {
  const title = uniq("new card");
  await page.goto(`/board/${board.id}/tasks`);

  await column(page, "To Do").getByTitle("Add card").click();
  const dialog = page.getByRole("dialog", { name: "New Task" });
  await dialog.getByLabel("Title").fill(title);
  const created = page.waitForResponse((r) => r.url().endsWith("/api/cards") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create Task" }).click();
  expect((await created).status()).toBe(201);

  await page.reload();
  await expect(card(page, title)).toBeVisible();
  await expect(column(page, "To Do").getByText(title)).toBeVisible();
});

test("rename a card in the detail modal", async ({ page, user, board }) => {
  const original = await createCard(user.api, board.columns[0].id);
  const renamed = uniq("renamed");
  await page.goto(`/board/${board.id}/tasks`);

  await card(page, original.title).click();
  await expect(page.getByRole("dialog", { name: original.title })).toBeVisible();
  // The dialog's name tracks the title as it is typed, so don't scope by name past this point.
  const titleInput = page.getByRole("dialog").getByLabel("Title");
  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/cards/${original.id}`) && r.request().method() === "PATCH",
  );
  await titleInput.fill(renamed);
  await titleInput.press("Enter");
  expect((await saved).ok()).toBe(true);

  await page.reload();
  await expect(card(page, renamed)).toBeVisible();
  await expect(card(page, original.title)).toHaveCount(0);
});

test("delete a card after confirming", async ({ page, user, board }) => {
  const doomed = await createCard(user.api, board.columns[0].id);
  await page.goto(`/board/${board.id}/tasks`);

  await card(page, doomed.title).click();
  await page.getByRole("dialog", { name: doomed.title }).getByRole("button", { name: "Delete" }).click();
  const deleted = page.waitForResponse(
    (r) => r.url().endsWith(`/api/cards/${doomed.id}`) && r.request().method() === "DELETE",
  );
  await page.getByRole("dialog", { name: "Delete task" }).getByRole("button", { name: "Delete" }).click();
  expect((await deleted).ok()).toBe(true);

  await page.reload();
  await expect(column(page, "To Do")).toBeVisible();
  await expect(card(page, doomed.title)).toHaveCount(0);
});

test("move a card to the next column with the keyboard", async ({ page, user, board }) => {
  const [todo, inProgress] = board.columns;
  const moving = await createCard(user.api, todo.id);
  await page.goto(`/board/${board.id}/tasks`);

  // Each key waits for dnd-kit's live announcement; pressing ahead of it drops the card in place.
  const announced = (text: string) => expect(page.getByRole("status").filter({ hasText: text })).toBeAttached();
  await card(page, moving.title).focus();
  await page.keyboard.press("Space");
  await announced(`อยู่ที่คอลัมน์ ${todo.title}`);
  await page.keyboard.press("ArrowRight");
  await announced(`อยู่ที่คอลัมน์ ${inProgress.title}`);
  const moved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/cards/${moving.id}/move`) && r.request().method() === "PATCH",
  );
  await page.keyboard.press("Space");
  expect((await moved).ok()).toBe(true);

  await page.reload();
  await expect(column(page, inProgress.title).getByText(moving.title)).toBeVisible();

  const columns = await getColumns(user.api, board.id);
  const where = columns.find((c) => c.cards.some((k) => k.id === moving.id));
  expect(where?.id).toBe(inProgress.id);
});
