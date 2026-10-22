"use client";

import { Plus } from "lucide-react";

interface ColumnEmptyHintProps {
  isDone: boolean;
  filtered: boolean;
  onAdd: () => void;
}

export function ColumnEmptyHint({ isDone, filtered, onAdd }: ColumnEmptyHintProps) {
  if (filtered) {
    return <p className="px-1 py-6 text-center text-xs text-slate-600">ไม่มีการ์ดที่ตรงกับตัวกรอง</p>;
  }
  if (isDone) {
    return <p className="px-1 py-6 text-center text-xs text-slate-600">ยังไม่มีงานเสร็จ ลากการ์ดมาที่นี่เพื่อปิดงาน</p>;
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex items-center justify-center gap-1.5 w-full py-6 rounded-lg border border-dashed border-slate-300 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
    >
      <Plus size={14} /> Add task
    </button>
  );
}
