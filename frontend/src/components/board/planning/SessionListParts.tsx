"use client";

import { FileText, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

export function StatPill({
  icon,
  variant = "neutral",
  children,
}: {
  icon: React.ReactNode;
  variant?: "neutral" | "alert" | "ok";
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "border-slate-200 bg-white text-slate-600 [&>svg]:text-slate-400",
    alert: "border-amber-200 bg-amber-50 text-amber-700 [&>svg]:text-amber-600",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700 [&>svg]:text-emerald-600",
  }[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${styles}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

export function EmptyState({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
      <FileText size={32} className="mx-auto mb-3 text-slate-400" />
      <h3 className="text-base font-semibold text-slate-800">
        No notes yet
      </h3>
      <p className="mt-1 mb-4 text-sm text-slate-500">
        เริ่มจดไอเดียแรก · สิ่งที่ตกลงกัน · คำถามที่ค้างใจ
        <br />
        แล้วเลือกบางอันส่งเข้า Board ตอนพร้อม
      </p>
      <button
        type="button"
        onClick={onCreate}
        disabled={creating}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
      >
        <Plus size={14} />
        New Note
      </button>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div>
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-72" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

const LOAD_FAILED_MESSAGES = {
  signedOut: "เซสชันหมดอายุ เข้าสู่ระบบใหม่อีกครั้ง",
  forbidden: "คุณไม่มีสิทธิ์ดูบันทึกของบอร์ดนี้",
  notFound: "ไม่พบบอร์ดนี้ หรือคุณไม่ได้เป็นสมาชิกแล้ว",
  failed: "โหลดรายการบันทึกไม่ได้ ลองรีเฟรชหน้า",
} as const;

export type LoadFailure = keyof typeof LOAD_FAILED_MESSAGES;

export function loadFailureOf(status: number | undefined): LoadFailure {
  if (status === 401) return "signedOut";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  return "failed";
}

export function LoadFailedState({ reason }: { reason: LoadFailure }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
      {LOAD_FAILED_MESSAGES[reason]}
    </p>
  );
}
