import { test as base, expect } from "@playwright/test";
import { createBoard, getColumns, registerUser, type ColumnData, type TestUser } from "../helpers/api";

interface Fixtures {
  /** A freshly registered user whose session cookies are already on `page`. */
  user: TestUser;
  /** A board owned by `user`, with the default columns. */
  board: { id: string; title: string; columns: ColumnData[] };
}

export const test = base.extend<Fixtures>({
  user: async ({ context }, use) => {
    const user = await registerUser();
    const { cookies } = await user.api.storageState();
    await context.addCookies(cookies);
    await use(user);
    await user.api.dispose();
  },
  board: async ({ user }, use) => {
    const board = await createBoard(user.api);
    const columns = await getColumns(user.api, board.id);
    await use({ ...board, columns });
  },
});

export { expect };
