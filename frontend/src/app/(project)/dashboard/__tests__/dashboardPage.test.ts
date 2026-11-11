import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiFetchError } from "@/lib/api";

const nav = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));
vi.mock("next/navigation", () => nav);

const api = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<object>()), apiFetch: api.apiFetch }));

import DashboardPage from "../page";

beforeEach(() => vi.clearAllMocks());

describe("Dashboard page (server)", () => {
  it("sends a rejected session through the cookie-clearing route, not straight to /login", async () => {
    api.apiFetch.mockRejectedValue(new ApiFetchError(401, "/boards"));
    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(nav.redirect).toHaveBeenCalledWith("/auth/session-expired?redirect=%2Fdashboard");
  });

  it("lets other failures reach the error boundary instead of redirecting", async () => {
    api.apiFetch.mockRejectedValue(new ApiFetchError(503, "/boards"));
    await expect(DashboardPage()).rejects.toBeInstanceOf(ApiFetchError);
    expect(nav.redirect).not.toHaveBeenCalled();
  });
});
