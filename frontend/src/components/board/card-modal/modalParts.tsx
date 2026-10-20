"use client";

import { Check } from "lucide-react";

export function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-xs font-medium tracking-wide text-slate-600 ${className}`}>
      {children}
    </span>
  );
}

export function ClearFieldButton({ field, onClick }: { field: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Clear ${field}`}
      className="text-xs font-medium text-slate-600 hover:text-danger rounded-sm transition-colors"
    >
      Clear
    </button>
  );
}

export function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block w-1.25 h-1.25 rounded-full shrink-0 ${className}`} />;
}

export const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-600",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

export const PRIORITY_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const FIELD_BOX =
  "px-2.5 py-2 text-slate-900 placeholder-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 focus:outline-none focus:border-primary focus:ring-3 focus:ring-surface-tint transition-colors";

export const FIELD_INPUT = `${FIELD_BOX} text-sm`;

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; content: React.ReactNode }[];
  value: string | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-slate-200 overflow-hidden" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs border-r border-slate-200 last:border-r-0 transition-colors ${
            value === o.value
              ? "bg-surface-tint text-slate-900 font-semibold"
              : "text-slate-600 font-medium hover:bg-slate-50"
          }`}
        >
          {o.content}
        </button>
      ))}
    </div>
  );
}

export const PRIORITY_OPTIONS = (["low", "medium", "high"] as const).map((p) => ({
  value: p,
  content: (
    <>
      <Dot className={PRIORITY_DOT[p]} />
      {PRIORITY_LABEL[p]}
    </>
  ),
}));

export function MetaChip({
  children,
  strong = false,
  overdue = false,
  title,
}: {
  children: React.ReactNode;
  strong?: boolean;
  overdue?: boolean;
  title?: string;
}) {
  const tone = overdue
    ? "border-red-200 bg-red-100 text-red-700 font-semibold"
    : `border-slate-200 bg-white font-medium ${strong ? "text-slate-900" : "text-slate-600"}`;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-xs tracking-wide whitespace-nowrap ${tone}`}
    >
      {children}
    </span>
  );
}

export function SubtaskProgress({ done, total, showPercent = false }: { done: number; total: number; showPercent?: boolean }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = total > 0 && done === total;
  return (
    <>
      <div className="flex items-center gap-2 mb-2.5">
        <FieldLabel>Subtasks</FieldLabel>
        {total > 0 && (
          <span
            className={`ml-auto text-xs font-semibold tracking-wide px-2 py-0.5 rounded-full ${
              complete ? "bg-emerald-100 text-emerald-700" : "bg-surface-tint text-primary"
            }`}
          >
            {done} / {total}
            {showPercent && ` · ${pct}%`}
          </span>
        )}
      </div>
      {total > 0 && (
        // No width transition: it re-lays out every frame.
        <div className="h-0.5 mb-3 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full ${complete ? "bg-emerald-700" : "bg-blue-700"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </>
  );
}

export function subtaskRowClass(isDone: boolean): string {
  return `group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md border text-sm transition-colors ${
    isDone ? "bg-emerald-100 border-transparent text-slate-900" : "bg-white border-slate-200 text-slate-900"
  }`;
}

export function SubtaskCheckbox({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`w-4 h-4 shrink-0 grid place-items-center rounded-sm border-2 bg-white transition-colors disabled:cursor-default ${
        checked
          ? "border-emerald-700 text-emerald-700"
          : "border-slate-400 text-transparent hover:border-emerald-700"
      }`}
    >
      <Check size={11} strokeWidth={3.2} />
    </button>
  );
}

export function QuickChips({ options, isActive, onPick }: {
  options: readonly { label: string }[];
  isActive: (i: number) => boolean;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o, i) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onPick(i)}
          className={`h-6 px-2.5 text-xs font-medium tracking-wide rounded-full border transition-colors ${
            isActive(i)
              ? "bg-surface-tint border-transparent text-primary"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
