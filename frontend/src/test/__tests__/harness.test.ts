import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/store/useToastStore";
import { server, apiUrl } from "@/test/server";

describe("test harness", () => {
  it("routes apiClient requests to MSW handlers", async () => {
    server.use(http.get(apiUrl("/ping"), () => HttpResponse.json({ ok: true })));
    await expect(apiClient("/ping")).resolves.toEqual({ ok: true });
  });

  it("fails on requests with no handler", async () => {
    await expect(apiClient("/unhandled")).rejects.toThrow();
  });

  it("leaves a store dirty within a test", () => {
    useToastStore.getState().show({ message: "x", duration: 0 });
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("resets stores between tests", () => {
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
