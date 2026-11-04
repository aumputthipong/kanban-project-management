import { expect, request, type APIRequestContext } from "@playwright/test";

export const BACKEND_URL = "http://localhost:8080";

let counter = 0;

export function uniq(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface TestUser {
  email: string;
  password: string;
  fullName: string;
  api: APIRequestContext;
}

export interface ColumnData {
  id: string;
  title: string;
  category: string;
  cards: { id: string; title: string; column_id: string }[];
}

export async function registerUser(): Promise<TestUser> {
  const api = await request.newContext({ baseURL: BACKEND_URL });
  const id = uniq("user");
  const user = {
    email: `${id}@e2e.turtask.invalid`,
    password: "e2e-password-123",
    fullName: `E2E ${id}`,
  };
  const res = await api.post("/api/auth/register", {
    data: { email: user.email, password: user.password, full_name: user.fullName },
  });
  expect(res.status(), await res.text()).toBe(201);
  return { ...user, api };
}

export async function createBoard(api: APIRequestContext, title = uniq("board")) {
  const res = await api.post("/api/boards", { data: { title } });
  expect(res.status(), await res.text()).toBe(201);
  const { id } = (await res.json()) as { id: string };
  return { id, title };
}

export async function getColumns(api: APIRequestContext, boardId: string): Promise<ColumnData[]> {
  const res = await api.get(`/api/boards/${boardId}`);
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as ColumnData[];
}

export async function createCard(api: APIRequestContext, columnId: string, title = uniq("card")) {
  const res = await api.post("/api/cards", { data: { column_id: columnId, title } });
  expect(res.status(), await res.text()).toBe(201);
  const card = (await res.json()) as { id: string; title: string };
  return card;
}
