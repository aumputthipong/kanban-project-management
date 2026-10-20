"use client";

import { ChevronsLeft, CircleCheck } from "lucide-react";

interface CollapsedColumnStripProps {
  dropRef: (el: HTMLElement | null) => void;
  title: string;
  count: number;
  barColor: string;
  isOver: boolean;
  onExpand: () => void;
}

/** Collapsed DONE column — still a drop target. */
export function CollapsedColumnStrip({ dropRef, title, count, barColor, isOver, onExpand }: CollapsedColumnStripProps) {
  return (
    <div
      ref={dropRef}
      className="group relative w-16 shrink-0 snap-start flex flex-col items-center overflow-hidden rounded-xl bg-slate-100 transition-shadow duration-200"
      style={isOver ? { boxShadow: `inset 0 0 0 2px ${barColor}` } : undefined}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.75" style={{ backgroundColor: barColor }} />
      <button
        onClick={onExpand}
        title="ขยายคอลัมน์ที่เสร็จแล้ว"
        className="flex h-full w-full cursor-pointer flex-col items-center pt-4 pb-3"
      >
        <CircleCheck size={16} className="shrink-0" style={{ color: barColor }} />
        <span className="mt-3 min-w-5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-center text-xs font-semibold text-slate-600">
          {count}
        </span>
        <span className="mt-3 rotate-180 text-sm font-semibold text-slate-600" style={{ writingMode: "vertical-rl" }}>
          {title}
        </span>
        <span className="mt-auto pt-3 text-slate-400 transition-colors group-hover:text-slate-600">
          <ChevronsLeft size={16} />
        </span>
      </button>
      {isOver && (
        <span
          className="pointer-events-none absolute inset-0 flex rotate-180 items-center justify-center text-xs font-semibold"
          style={{ writingMode: "vertical-rl", color: barColor }}
        >
          วางเพื่อปิดงาน
        </span>
      )}
    </div>
  );
}
