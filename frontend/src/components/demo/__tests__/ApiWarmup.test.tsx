import { describe, it, expect, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ApiWarmup } from "@/components/demo/ApiWarmup";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiWarmup", () => {
  it("pings the health endpoint once and renders nothing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<ApiWarmup />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/health");
    expect(container).toBeEmptyDOMElement();
  });

  it("swallows a failed ping", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    render(<ApiWarmup />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});
