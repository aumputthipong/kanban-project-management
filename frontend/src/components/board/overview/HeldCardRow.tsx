"use client";

import type { Card } from "@/types/board";
import { daysOverdue } from "@/utils/date_helper";

interface HeldCardRowProps {
  card: Card;
  columnTitle: string;
  onSelect: (card: Card) => void;
}

function dueLabel(card: Card): { text: string; overdue: boolean } | null {
  if (!card.due_date) return null;
  const days = daysOverdue(card.due_date);
  if (days > 0) return { text: `เลย ${days} วัน`, overdue: true };
  return {
    text: new Date(card.due_date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
    }),
    overdue: false,
  };
}

export function HeldCardRow({ card, columnTitle, onSelect }: HeldCardRowProps) {
  const due = dueLabel(card);
  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      className="group flex w-full items-center gap-2.5 rounded py-1.5 pl-1 pr-2 text-left transition-colors hover:bg-white"
    >
      <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-sm bg-slate-400" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700 group-hover:text-slate-900">
        {card.title}
      </span>
      {columnTitle && (
        <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
          {columnTitle}
        </span>
      )}
      {due && (
        <span
          className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
            due.overdue
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "text-slate-400"
          }`}
        >
          {due.text}
        </span>
      )}
    </button>
  );
}
