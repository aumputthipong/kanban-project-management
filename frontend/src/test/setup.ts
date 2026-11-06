import { afterAll, afterEach, beforeAll, vi } from "vitest";
import "@testing-library/jest-dom";
import { server } from "./server";

// Every store built with zustand's `create` resets after each test (__mocks__/zustand.ts).
vi.mock("zustand");

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
