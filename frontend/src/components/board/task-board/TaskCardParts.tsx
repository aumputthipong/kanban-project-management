"use client";

import { Fragment } from "react";
import { AlarmClock, Calendar, Clock, UserRound } from "lucide-react";
import type { Card } from "@/types/board";
import { cardDueLabel, formatThaiDate } from "@/utils/date_helper";
import { getAvatarColor } from "@/utils/avatar";
import { Dot, PRIORITY_DOT, PRIORITY_LABEL } from "@/components/board/card-modal/modalParts";
import { getColumnColorHex } from "./ColumnOptionsModal";

const MAX_TAGS = 3;

export function CardTags({ tags }: { tags: NonNullable<Card["tags"]> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-600">
      {tags.slice(0, MAX_TAGS).map((tag) => (
        <span key={tag.id} className="inline-flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="w-1.25 h-1.25 rounded-full shrink-0"
            style={{ backgroundColor: getColumnColorHex(tag.color) ?? "#94a3b8" }}
          />
          <span className="truncate max-w-28">{tag.name}</span>
        </span>
      ))}
      {tags.length > MAX_TAGS && <span className="text-slate-500">+{tags.length - MAX_TAGS}</span>}
    </div>
  );
}

export function SubtaskBar({ done, total }: { done: number; total: number }) {
  const complete = done === total;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-0.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${complete ? "bg-emerald-700" : "bg-primary"}`}
          style={{ width: `${Math.round((done / total) * 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums ${complete ? "text-emerald-700" : "text-slate-600"}`}>
        {done}/{total}
      </span>
    </div>
  );
}

function Assignee({ card }: { card: Card }) {
  if (card.assignee_name && card.assignee_id) {
    return (
      <span
        title={card.assignee_name}
        className={`ml-auto w-4.5 h-4.5 rounded-full grid place-items-center text-white text-xs font-semibold shrink-0 ${getAvatarColor(card.assignee_id)}`}
      >
        {card.assignee_name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span
      title="Unassigned"
      className="ml-auto w-4.5 h-4.5 rounded-full grid place-items-center border border-dashed border-slate-400 shrink-0"
    >
      <UserRound size={10} className="text-slate-500" />
    </span>
  );
}

/** One line of plain-text facts: due, priority, estimate, then the assignee. */
export function CardMetaRow({ card }: { card: Card }) {
  const due = card.due_date ? cardDueLabel(card.due_date, card.is_done) : null;
  const items: React.ReactNode[] = [];

  if (due) {
    const tone =
      due.tone === "overdue"
        ? "text-red-700 font-semibold"
        : due.tone === "today"
          ? "text-slate-900 font-semibold"
          : "text-slate-600";
    items.push(
      <span key="due" title={formatThaiDate(card.due_date!)} className={`inline-flex items-center gap-1 ${tone}`}>
        {due.tone === "overdue" ? <AlarmClock size={12} /> : <Calendar size={12} />}
        {due.text}
      </span>,
    );
  }
  if (card.priority && !card.is_done) {
    items.push(
      <span key="priority" className="inline-flex items-center gap-1.5 text-slate-900">
        <Dot className={PRIORITY_DOT[card.priority]} />
        {PRIORITY_LABEL[card.priority]}
      </span>,
    );
  }
  if (card.estimated_hours) {
    items.push(
      <span key="hours" className="inline-flex items-center gap-1">
        <Clock size={12} />
        {card.estimated_hours}h
      </span>,
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-h-4.5 text-xs font-medium text-slate-600 whitespace-nowrap">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden className="text-slate-300">·</span>}
          {item}
        </Fragment>
      ))}
      <Assignee card={card} />
    </div>
  );
}
