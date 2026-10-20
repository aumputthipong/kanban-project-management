"use client";

import { ArrowDown, Calendar, CircleCheck, MoreHorizontal, Plus, UserRound } from "lucide-react";
import { BoardBackground } from "@/components/board/task-board/BoardBackground";
import { Dot, PRIORITY_DOT, PRIORITY_LABEL } from "@/components/board/card-modal/modalParts";
import { getAvatarColor } from "@/utils/avatar";
import { cardDueLabel } from "@/utils/date_helper";
import { PreviewHeader, PreviewToolbar } from "./BoardPreviewChrome";
import { DEMO_COLUMNS, type DemoTask } from "./demoBoard";

const DROP_TARGET = "In Progress";

function dueLabel(days: number, done: boolean): string {
  return cardDueLabel(new Date(Date.now() + days * 86_400_000).toISOString(), done)?.text ?? "";
}

function TaskCard({ task, done }: { task: DemoTask; done: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 flex flex-col gap-1.5 ${done ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
      <p className={`flex items-start gap-1.5 text-sm font-medium leading-snug ${done ? "text-emerald-900" : "text-slate-900"}`}>
        {done && <CircleCheck size={14} className="mt-0.5 shrink-0 text-emerald-700" />}
        {task.title}
      </p>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
        {task.dueInDays !== null && (
          <span className="hidden sm:inline-flex items-center gap-1" suppressHydrationWarning>
            <Calendar size={12} />
            {dueLabel(task.dueInDays, done)}
          </span>
        )}
        {task.dueInDays !== null && !done && <span aria-hidden className="hidden sm:inline text-slate-300">·</span>}
        {!done && (
          <span className="inline-flex items-center gap-1.5 text-slate-900">
            <Dot className={PRIORITY_DOT[task.priority]} />
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}
        {task.assignee ? (
          <span
            className={`ml-auto grid w-4.5 h-4.5 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${getAvatarColor(task.assignee)}`}
          >
            {task.assignee.charAt(0)}
          </span>
        ) : (
          <span className="ml-auto grid w-4.5 h-4.5 shrink-0 place-items-center rounded-full border border-dashed border-slate-400">
            <UserRound size={10} className="text-slate-500" />
          </span>
        )}
      </div>
    </div>
  );
}

export function BoardPreview() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm select-none">
      <PreviewHeader />
      <PreviewToolbar />
      <div className="relative flex gap-3 bg-slate-50 p-3">
        <BoardBackground />
        {DEMO_COLUMNS.map((col) => {
          const target = col.title === DROP_TARGET;
          return (
            <div
              key={col.title}
              className={`relative flex-1 min-w-0 flex-col gap-2 overflow-hidden rounded-xl border p-2 ${
                target ? "border-primary/30 bg-surface-tint" : "border-transparent bg-slate-100"
              } ${col.title === "To Do" ? "hidden sm:flex" : "flex"}`}
            >
              <span className="absolute inset-x-0 top-0 h-0.75 bg-slate-500" />
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 px-1 sm:px-1.5 py-1">
                <span className="hidden sm:block size-1.25 shrink-0 rounded-full bg-slate-500" />
                <span className={`truncate text-sm font-semibold ${target ? "text-primary" : "text-slate-900"}`}>
                  {col.title}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {col.tasks.length}
                </span>
                <span className="ml-auto hidden lg:flex items-center gap-1.5 text-slate-400">
                  <Plus size={14} />
                  <MoreHorizontal size={14} />
                </span>
              </div>
              {target && (
                <div className="flex h-14 shrink-0 items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/40 bg-white/60 text-xs font-semibold text-primary">
                  <ArrowDown size={12} /> Drop here
                </div>
              )}
              {col.tasks.map((task) => (
                <TaskCard key={task.title} task={task} done={col.title === "Done"} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
