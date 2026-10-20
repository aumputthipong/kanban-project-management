"use client";

import { Plus, X } from "lucide-react";
import { FIELD_INPUT, FieldLabel } from "@/components/board/card-modal/modalParts";

const GHOST_ADD =
  "inline-flex items-center gap-1.5 w-fit px-3.5 py-2 rounded-md text-sm font-medium text-slate-600 bg-white border border-dashed border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors";

interface SubtaskDraftListProps {
  items: string[];
  onChange: (next: string[]) => void;
}

/** Unsaved subtask titles typed while creating a task. */
export function SubtaskDraftList({ items, onChange }: SubtaskDraftListProps) {
  const add = () => onChange([...items, ""]);
  const update = (i: number, v: string) => onChange(items.map((t, idx) => (idx === i ? v : t)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  if (items.length === 0) {
    return (
      <button type="button" onClick={add} className={GHOST_ADD}>
        <Plus size={14} /> Add subtask
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>Subtasks</FieldLabel>
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <span aria-hidden className="w-4 h-4 rounded-sm border-2 border-slate-400 shrink-0" />
          <input
            autoFocus
            aria-label={`Subtask ${i + 1}`}
            value={t}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="รายการย่อย"
            className={`flex-1 min-w-0 ${FIELD_INPUT}`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="ลบรายการ"
            className="w-7 h-7 grid place-items-center rounded-md text-slate-600 hover:bg-slate-50 hover:text-danger transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 w-fit text-xs font-medium text-slate-600 hover:text-primary transition-colors"
      >
        <Plus size={13} /> Add item
      </button>
    </div>
  );
}
