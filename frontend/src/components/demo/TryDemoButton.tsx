"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/store/useToastStore";
import type { DemoSession } from "@/types/demo";

type Variant = "hero" | "quiet";

const SLOW_START_TOAST_DELAY_MS = 1500;

const STYLES: Record<Variant, string> = {
  hero: "w-full sm:w-auto justify-center bg-primary text-white hover:bg-primary-hover shadow-sm px-6 py-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  quiet:
    "w-full justify-center border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg",
};

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
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowToastId = useRef<string | null>(null);

  const clearSlowNotice = useCallback(() => {
    if (slowTimer.current) clearTimeout(slowTimer.current);
    slowTimer.current = null;
    if (slowToastId.current) dismissToast(slowToastId.current);
    slowToastId.current = null;
  }, [dismissToast]);

  // Cold-start notice stays up until the board route unmounts this page.
  useEffect(() => clearSlowNotice, [clearSlowNotice]);

  const start = async () => {
    setIsStarting(true);
    slowTimer.current = setTimeout(() => {
      slowToastId.current = showToast({
        message: "กำลังเปิดระบบและเตรียมข้อมูลตัวอย่าง",
        duration: 0,
      });
    }, SLOW_START_TOAST_DELAY_MS);
    try {
      const session = await apiClient<DemoSession>("/auth/demo", { method: "POST" });
      // /board/[boardId] has no page; /tasks is the board.
      router.push(`/board/${session.board_id}/tasks`);
      router.refresh();
    } catch {
      clearSlowNotice();
      // apiClient toasts 403/5xx itself; this covers the rate limit.
      showToast({ message: "เปิดโหมดทดลองไม่สำเร็จ ลองใหม่อีกครั้งในอีกสักครู่" });
      setIsStarting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={isStarting}
      className={`inline-flex items-center gap-2 font-semibold text-sm transition-colors disabled:opacity-50 ${STYLES[variant]}`}
    >
      {isStarting ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          กำลังเตรียมบอร์ด...
        </>
      ) : (
        <>
          <Play size={16} />
          {label}
        </>
      )}
    </button>
  );
}
