// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "auth_token=jwt" }),
  headers: async () => new Headers(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function load() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
  return import("../api");
}

describe("apiFetch (server)", () => {
  it("forwards the session cookie and returns JSON", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([{ id: "b1" }]));
    const { apiFetch } = await load();
    await expect(apiFetch("/boards")).resolves.toEqual([{ id: "b1" }]);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://api.test/api/boards");
    expect((init?.headers as Record<string, string>).Cookie).toBe("auth_token=jwt");
  });

  it("throws an ApiFetchError carrying the status, so callers can tell 401 apart", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 401 }));
    const { apiFetch, isUnauthorized } = await load();
    const err = await apiFetch("/boards").catch((e: unknown) => e);
    expect(isUnauthorized(err)).toBe(true);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));
    expect(isUnauthorized(await apiFetch("/boards").catch((e: unknown) => e))).toBe(false);
  });
});
