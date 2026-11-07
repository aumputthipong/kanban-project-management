import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import {
  apiClient,
  ApiError,
  isHandledByApiClient,
  toastFailure,
  __resetRefreshStateForTests,
} from "@/lib/apiClient";
import { useToastStore } from "@/store/useToastStore";
import { server, apiUrl } from "@/test/server";

beforeEach(() => __resetRefreshStateForTests());

describe("apiClient requests", () => {
  it("sends GET with JSON headers when no data is given", async () => {
    let seen: Request | undefined;
    server.use(
      http.get(apiUrl("/boards"), ({ request }) => {
        seen = request;
        return HttpResponse.json([{ id: "b1" }]);
      })
    );
    await expect(apiClient("/boards")).resolves.toEqual([{ id: "b1" }]);
    expect(seen?.method).toBe("GET");
    expect(seen?.headers.get("content-type")).toBe("application/json");
  });

  it("defaults to POST with a JSON body when data is given", async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl("/boards"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "b1" }, { status: 201 });
      })
    );
    await apiClient("/boards", { data: { title: "New" } });
    expect(body).toEqual({ title: "New" });
  });

  it("honours an explicit method alongside data", async () => {
    server.use(http.patch(apiUrl("/cards/c1"), () => HttpResponse.json({ ok: true })));
    await expect(
      apiClient("/cards/c1", { method: "PATCH", data: { title: "x" } })
    ).resolves.toEqual({ ok: true });
  });

  it("returns null for 204 No Content", async () => {
    server.use(http.delete(apiUrl("/cards/c1"), () => new HttpResponse(null, { status: 204 })));
    await expect(apiClient("/cards/c1", { method: "DELETE" })).resolves.toBeNull();
  });

  it("returns null when a 2xx body is not JSON", async () => {
    server.use(http.post(apiUrl("/ping"), () => HttpResponse.text("ok")));
    await expect(apiClient("/ping", { method: "POST" })).resolves.toBeNull();
  });
});

describe("apiClient errors", () => {
  it("throws ApiError with the server's error field", async () => {
    server.use(
      http.get(apiUrl("/boards/x"), () =>
        HttpResponse.json({ error: "board not found" }, { status: 404 })
      )
    );
    const err = await apiClient("/boards/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, message: "board not found" });
  });

  it("falls back to the message field", async () => {
    server.use(
      http.get(apiUrl("/boards/x"), () =>
        HttpResponse.json({ message: "bad input" }, { status: 400 })
      )
    );
    await expect(apiClient("/boards/x")).rejects.toMatchObject({ message: "bad input" });
  });

  it("falls back to statusText when the body is not JSON", async () => {
    server.use(
      http.get(apiUrl("/boards/x"), () =>
        HttpResponse.text("oops", { status: 502, statusText: "Bad Gateway" })
      )
    );
    await expect(apiClient("/boards/x")).rejects.toMatchObject({
      status: 502,
      message: "Bad Gateway",
    });
  });

  it("posts a toast on 403", async () => {
    server.use(
      http.delete(apiUrl("/cards/c1"), () =>
        HttpResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 })
      )
    );
    await expect(apiClient("/cards/c1", { method: "DELETE" })).rejects.toBeInstanceOf(ApiError);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(["ไม่มีสิทธิ์"]);
  });

  it("leaves other errors to the caller without a toast", async () => {
    server.use(
      http.get(apiUrl("/boards"), () => HttpResponse.json({ error: "boom" }, { status: 500 }))
    );
    await expect(apiClient("/boards")).rejects.toMatchObject({ status: 500 });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe("apiClient session refresh", () => {
  it("refreshes on 401 and retries the original request", async () => {
    let calls = 0;
    let refreshes = 0;
    server.use(
      http.get(apiUrl("/me"), () =>
        ++calls === 1
          ? HttpResponse.json({ error: "expired" }, { status: 401 })
          : HttpResponse.json({ id: "u1" })
      ),
      http.post(apiUrl("/auth/refresh"), () => {
        refreshes++;
        return new HttpResponse(null, { status: 204 });
      })
    );
    await expect(apiClient("/me")).resolves.toEqual({ id: "u1" });
    expect(refreshes).toBe(1);
    expect(calls).toBe(2);
  });

  it("shares one refresh across concurrent 401s", async () => {
    let refreshed = false;
    let refreshes = 0;
    const authed = () =>
      refreshed ? HttpResponse.json({ ok: true }) : HttpResponse.json({}, { status: 401 });
    server.use(
      http.get(apiUrl("/a"), authed),
      http.get(apiUrl("/b"), authed),
      http.post(apiUrl("/auth/refresh"), () => {
        refreshes++;
        refreshed = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    await Promise.all([apiClient("/a"), apiClient("/b")]);
    expect(refreshes).toBe(1);
  });

  it("throws 401 when the refresh is rejected", async () => {
    server.use(
      http.get(apiUrl("/me"), () => HttpResponse.json({ error: "expired" }, { status: 401 })),
      http.post(apiUrl("/auth/refresh"), () => HttpResponse.json({}, { status: 401 }))
    );
    await expect(apiClient("/me")).rejects.toMatchObject({ status: 401 });
  });

  it("does not refresh when the refresh call itself returns 401", async () => {
    let refreshes = 0;
    server.use(
      http.post(apiUrl("/auth/refresh"), () => {
        refreshes++;
        return HttpResponse.json({}, { status: 401 });
      })
    );
    await expect(apiClient("/auth/refresh", { method: "POST" })).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshes).toBe(1);
  });
});

describe("toastFailure", () => {
  it.each([401, 403])("stays quiet for %i, which apiClient already handled", (status) => {
    expect(isHandledByApiClient(new ApiError(status, "x"))).toBe(true);
    toastFailure(new ApiError(status, "x"), "ไม่สำเร็จ");
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it.each([new ApiError(500, "x"), new ApiError(404, "x"), new TypeError("network")])(
    "toasts the caller's message for %s",
    (err) => {
      expect(isHandledByApiClient(err)).toBe(false);
      toastFailure(err, "ไม่สำเร็จ");
      expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(["ไม่สำเร็จ"]);
    }
  );
});
