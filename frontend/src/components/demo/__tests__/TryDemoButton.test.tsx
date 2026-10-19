import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TryDemoButton } from "@/components/demo/TryDemoButton";
import { ApiError, apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/store/useToastStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  apiClient: vi.fn(),
}));

const mockedApi = vi.mocked(apiClient);

beforeEach(() => {
  push.mockReset();
  mockedApi.mockReset();
  useToastStore.setState({ toasts: [] });
});

describe("TryDemoButton", () => {
  it("navigates to the demo board on success", async () => {
    mockedApi.mockResolvedValue({ board_id: "b1" });
    render(<TryDemoButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/board/b1/tasks"));
  });

  it("sends one request when clicked twice while pending", async () => {
    mockedApi.mockReturnValue(new Promise(() => {}));
    render(<TryDemoButton />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });

  it("offers a retry action when the server fails", async () => {
    mockedApi.mockRejectedValue(new ApiError(500, "boom"));
    render(<TryDemoButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(useToastStore.getState().toasts[0].actionLabel).toBe("ลองใหม่");
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("does not offer retry when rate limited", async () => {
    mockedApi.mockRejectedValue(new ApiError(429, "too many"));
    render(<TryDemoButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(useToastStore.getState().toasts[0].actionLabel).toBeUndefined();
  });

  it("leaves the 403 toast to apiClient", async () => {
    mockedApi.mockRejectedValue(new ApiError(403, "forbidden"));
    render(<TryDemoButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
