import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sdk = vi.hoisted(() => {
  const scope = { setExtras: vi.fn() };
  return {
    scope,
    init: vi.fn(),
    captureException: vi.fn(),
    withScope: vi.fn((fn: (s: typeof scope) => void) => fn(scope)),
  };
});
vi.mock("@sentry/browser", () => sdk);

// The DSN is read at import time, so each test loads a fresh copy of the module.
async function loadSentry(dsn?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn ?? "");
  return import("../sentry");
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("sentry", () => {
  it("does nothing without a DSN and never loads the SDK", async () => {
    const { captureException, sentryEnabled } = await loadSentry();
    captureException(new Error("boom"));
    await flush();
    expect(sentryEnabled).toBe(false);
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it("initialises once and reports errors when a DSN is set", async () => {
    const { captureException, sentryEnabled } = await loadSentry("https://key@sentry.test/1");
    const err = new Error("boom");
    captureException(err);
    captureException(err);
    await flush();

    expect(sentryEnabled).toBe(true);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: "https://key@sentry.test/1", tracesSampleRate: 0 }));
    expect(sdk.captureException).toHaveBeenCalledTimes(2);
  });

  it("attaches context as extras on a scope", async () => {
    const { captureException } = await loadSentry("https://key@sentry.test/1");
    captureException(new Error("boom"), { boardId: "b1" });
    await flush();
    expect(sdk.scope.setExtras).toHaveBeenCalledWith({ boardId: "b1" });
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
  });

  it("swallows an SDK init failure instead of throwing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    sdk.init.mockImplementationOnce(() => {
      throw new Error("bad dsn");
    });
    const { captureException } = await loadSentry("https://key@sentry.test/1");
    expect(() => captureException(new Error("boom"))).not.toThrow();
    await flush();
    expect(sdk.captureException).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });
});
