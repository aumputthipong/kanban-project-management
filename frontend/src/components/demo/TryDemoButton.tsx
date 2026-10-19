"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { ApiError, apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/store/useToastStore";
import type { DemoSession } from "@/types/demo";

type Variant = "hero" | "quiet";

const SLOW_START_TOAST_DELAY_MS = 1500;
const STILL_WAKING_TOAST_DELAY_MS = 15000;
const DEMO_TIMEOUT_MS = 90000;

const STYLES: Record<Variant, string> = {
  hero: "w-full sm:w-auto justify-center bg-primary text-white hover:bg-primary-hover disabled:hover:bg-primary shadow-sm px-6 py-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  quiet:
    "w-full justify-center border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:hover:bg-white px-4 py-2.5 rounded-lg",
};

function failureMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    return "เปิดโหมดทดลองครบจำนวนที่ใช้ได้ในชั่วโมงนี้แล้ว ลองใหม่อีกครั้งในภายหลัง";
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return "server ใช้เวลาตื่นนานกว่าปกติ ลองกดอีกครั้ง";
  }
  if (err instanceof ApiError) {
    return "server มีปัญหาระหว่างเตรียมบอร์ดตัวอย่าง ลองอีกครั้ง";
  }
  return "เชื่อมต่อ server ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง";
}

// hero is the landing's one button-primary; quiet sits under the login form's own primary.
export function TryDemoButton({
  variant = "hero",
  label = "Try demo",
}: {
  variant?: Variant;
  label?: string;
}) {
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const dismissToast = useToastStore((s) => s.dismiss);
  const [isStarting, setIsStarting] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const statusToastId = useRef<string | null>(null);

  const replaceStatusToast = useCallback(
    (message: string) => {
      if (statusToastId.current) dismissToast(statusToastId.current);
      statusToastId.current = showToast({ message, duration: 0 });
    },
    [showToast, dismissToast],
  );

  const clearSlowNotice = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (statusToastId.current) dismissToast(statusToastId.current);
    statusToastId.current = null;
  }, [dismissToast]);

  // Cold-start notice stays up until the board route unmounts this page.
  useEffect(() => clearSlowNotice, [clearSlowNotice]);

  const start = async () => {
    setIsStarting(true);
    const abort = new AbortController();
    timers.current = [
      setTimeout(
        () => replaceStatusToast("กำลังเตรียมบอร์ดตัวอย่าง ถ้า server เพิ่งตื่นอาจใช้เวลาถึง 1 นาที"),
        SLOW_START_TOAST_DELAY_MS,
      ),
      setTimeout(
        () => replaceStatusToast("ยังทำงานอยู่ server กำลังตื่น โดยปกติไม่เกิน 1 นาที"),
        STILL_WAKING_TOAST_DELAY_MS,
      ),
      setTimeout(() => abort.abort(), DEMO_TIMEOUT_MS),
    ];
    try {
      const session = await apiClient<DemoSession>("/auth/demo", {
        method: "POST",
        signal: abort.signal,
      });
      // /board/[boardId] has no page; /tasks is the board.
      router.push(`/board/${session.board_id}/tasks`);
      router.refresh();
    } catch (err) {
      clearSlowNotice();
      setIsStarting(false);
      // apiClient already toasts 403.
      if (err instanceof ApiError && err.status === 403) return;
      const rateLimited = err instanceof ApiError && err.status === 429;
      showToast({
        message: failureMessage(err),
        duration: 10000,
        ...(rateLimited ? {} : { actionLabel: "ลองใหม่", onAction: start }),
      });
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={isStarting}
      aria-busy={isStarting}
      className={`inline-flex items-center font-semibold text-sm transition-colors disabled:cursor-wait ${STYLES[variant]}`}
    >
      {/* Both labels share one cell so the button keeps its width while pending. */}
      <span className="grid">
        <span
          className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${isStarting ? "invisible" : ""}`}
        >
          <Play size={16} />
          {label}
        </span>
        <span
          className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${isStarting ? "" : "invisible"}`}
        >
          <Loader2 size={16} className="animate-spin" />
          กำลังเตรียมบอร์ด
        </span>
      </span>
    </button>
  );
}
