import { describe, it, expect, vi, afterEach } from "vitest";
import { useToastStore } from "@/store/useToastStore";

afterEach(() => vi.useRealTimers());

describe("useToastStore", () => {
  it("adds a toast with a 5s default duration and returns its id", () => {
    const id = useToastStore.getState().show({ message: "บันทึกแล้ว" });
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ id, message: "บันทึกแล้ว", duration: 5000 }),
    ]);
  });

  it("auto-dismisses after its duration", () => {
    vi.useFakeTimers();
    useToastStore.getState().show({ message: "a", duration: 1000 });
    vi.advanceTimersByTime(999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("keeps a sticky toast (duration 0) until dismissed", () => {
    vi.useFakeTimers();
    const id = useToastStore.getState().show({ message: "a", duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("dismisses only the matching toast", () => {
    const first = useToastStore.getState().show({ message: "a", duration: 0 });
    useToastStore.getState().show({ message: "b", duration: 0 });
    useToastStore.getState().dismiss(first);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(["b"]);
  });

  it("keeps the undo action on the toast", () => {
    const onAction = vi.fn();
    useToastStore.getState().show({ message: "ลบแล้ว", actionLabel: "เลิกทำ", onAction });
    useToastStore.getState().toasts[0].onAction?.();
    expect(onAction).toHaveBeenCalledOnce();
  });
});
