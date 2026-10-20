import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEscapeKey } from "../useEscapeKey";

const pressEscape = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

describe("useEscapeKey", () => {
  it("closes only the most recently opened layer", () => {
    const closeModal = vi.fn();
    const closeConfirm = vi.fn();
    const modal = renderHook(() => useEscapeKey(true, closeModal));
    const confirm = renderHook(() => useEscapeKey(true, closeConfirm));

    pressEscape();
    expect(closeConfirm).toHaveBeenCalledTimes(1);
    expect(closeModal).not.toHaveBeenCalled();

    confirm.unmount();
    pressEscape();
    expect(closeModal).toHaveBeenCalledTimes(1);
    modal.unmount();
  });

  it("ignores inactive layers and other keys", () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(false, onEscape));
    pressEscape();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onEscape).not.toHaveBeenCalled();
    unmount();
  });

  it("calls the latest callback without re-registering", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ cb }) => useEscapeKey(true, cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    pressEscape();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
  });
});
