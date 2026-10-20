"use client";

import { ChevronsRight, CircleCheck, MoreHorizontal, Plus } from "lucide-react";

const ICON_BUTTON =
  "cursor-pointer text-slate-500 hover:text-slate-900 p-1 rounded-md hover:bg-slate-200 transition-colors";

interface ColumnHeaderProps {
  title: string;
  barColor: string;
  isDone: boolean;
  total: number;
  /** Cards left after the board filters; null when no filter is on. */
  shown: number | null;
  onAdd: () => void;
  onCollapse: () => void;
  onOptions: (() => void) | null;
}

export function ColumnHeader({ title, barColor, isDone, total, shown, onAdd, onCollapse, onOptions }: ColumnHeaderProps) {
  return (
    <div className="sticky top-0 z-10 overflow-hidden flex items-center gap-2 h-12 pl-4 pr-2 rounded-t-xl bg-slate-100 border-b border-slate-200">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.75" style={{ backgroundColor: barColor }} />
      {isDone ? (
        <CircleCheck size={14} className="shrink-0" style={{ color: barColor }} />
      ) : (
        <span className="h-1.25 w-1.25 shrink-0 rounded-full" style={{ backgroundColor: barColor }} />
      )}
      <h2 className="min-w-0 truncate text-sm font-semibold leading-tight text-slate-900">{title}</h2>
      <span
        title={shown === null ? undefined : `แสดง ${shown} จาก ${total} การ์ด`}
        className="min-w-5 shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-center text-xs font-semibold text-slate-600 tabular-nums"
      >
        {shown === null ? total : `${shown}/${total}`}
      </span>

      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        {isDone ? (
          <button onClick={onCollapse} title="ยุบคอลัมน์ที่เสร็จแล้ว" className={ICON_BUTTON}>
            <ChevronsRight size={16} />
          </button>
        ) : (
          <button onClick={onAdd} title="Add card" className={ICON_BUTTON}>
            <Plus size={16} />
          </button>
        )}
        {onOptions && (
          <button onClick={onOptions} title="Column options" className={ICON_BUTTON}>
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
