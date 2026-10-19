"use client";

import { CalendarDays, ChevronDown, FileText, Kanban, LayoutTemplate, Plus, SignalHigh, User, UserX } from "lucide-react";
import { BoardGlyph } from "@/lib/boardAppearance";
import { getAvatarColor } from "@/utils/avatar";
import { DEMO_BOARD, OWNER } from "./demoBoard";

const TABS = [
  { label: "Overview", Icon: LayoutTemplate },
  { label: "Planning", Icon: FileText },
  { label: "Board", Icon: Kanban },
  { label: "Members", Icon: User },
  { label: "Calendar", Icon: CalendarDays },
];

export function PreviewHeader() {
  return (
    <div className="flex items-center border-b border-slate-200 px-4">
      <div className="flex shrink-0 items-center gap-2 py-2.5 pr-4 md:border-r md:border-slate-200">
        <span
          className="grid size-7 place-items-center rounded-lg text-white"
          style={{ background: DEMO_BOARD.color }}
        >
          <BoardGlyph size={14} />
        </span>
        <span className="text-base font-bold text-slate-800">{DEMO_BOARD.title}</span>
      </div>
      <div className="hidden md:flex items-center pl-2">
        {TABS.map(({ label, Icon }) => (
          <span
            key={label}
            className={`flex items-center gap-1.5 border-b-2 px-2.5 py-3 text-xs font-medium ${
              label === "Board" ? "border-primary text-primary" : "border-transparent text-slate-500"
            }`}
          >
            <Icon size={14} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PreviewToolbar() {
  return (
    <div className="hidden sm:flex items-center gap-2 border-b border-slate-200 px-4 py-2">
      <span className="flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-0.5 pr-2.5 text-xs font-semibold text-slate-700">
        <span className={`grid size-6 place-items-center rounded-full text-xs font-bold text-white ${getAvatarColor(OWNER)}`}>
          {OWNER.charAt(0)}
        </span>
        My Tasks
      </span>
      <span className="flex h-7 items-center rounded-full bg-slate-800 px-3 text-xs font-medium text-white">All</span>
      <span className="hidden sm:inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 text-xs font-semibold text-slate-500">
        <UserX size={12} /> Unassigned
      </span>
      <span className="hidden md:inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-600">
        <SignalHigh size={12} className="text-slate-300" /> Priority <ChevronDown size={12} />
      </span>
      <span className="ml-auto hidden md:inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700">
        <Plus size={12} /> Add column
      </span>
    </div>
  );
}
