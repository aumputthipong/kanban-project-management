"use client";

import { useState } from "react";
import { Calendar, SlidersHorizontal } from "lucide-react";
import { QUICK_DATE_OPTIONS, QUICK_HOURS_OPTIONS } from "@/utils/quickSelect";
import { formatThaiShortDate, isoDateFromToday } from "@/utils/date_helper";
import { FIELD_INPUT } from "./modalParts";

const CHIP =
  "inline-flex items-center gap-1 h-6 px-2.5 text-xs font-medium tracking-wide rounded-full border transition-colors";
const CHIP_ON = "bg-surface-tint border-transparent text-primary";
const CHIP_OFF = "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900";

interface QuickPickProps {
  label: string;
  chips: { label: string; active: boolean; onClick: () => void }[];
  custom: { label: string; icon: React.ReactNode; active: boolean };
  children: React.ReactNode;
}

/** Quick chips first; the exact-value input stays behind the last chip. */
function QuickPick({ label, chips, custom, children }: QuickPickProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={c.active}
            onClick={c.onClick}
            className={`${CHIP} ${c.active ? CHIP_ON : CHIP_OFF}`}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`${CHIP} ${custom.active || open ? CHIP_ON : CHIP_OFF}`}
        >
          {custom.icon}
          {custom.label}
        </button>
      </div>
      {open && children}
    </div>
  );
}

export function DueDatePick({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const quick = QUICK_DATE_OPTIONS.map((o) => ({ ...o, value: isoDateFromToday(o.days) }));
  const isQuick = quick.some((o) => o.value === value);

  return (
    <QuickPick
      label="Due date"
      chips={quick.map((o) => ({
        label: o.label,
        active: value === o.value,
        onClick: () => onChange(value === o.value ? "" : o.value),
      }))}
      custom={{
        label: value && !isQuick ? formatThaiShortDate(value) : "Pick date",
        icon: <Calendar size={12} />,
        active: !!value && !isQuick,
      }}
    >
      <input
        type="date"
        autoFocus
        aria-label="Due date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_INPUT}
      />
    </QuickPick>
  );
}

interface HoursPickProps {
  value: string;
  onPick: (value: string) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInputBlur: () => void;
}

export function HoursPick({ value, onPick, onInputChange, onInputBlur }: HoursPickProps) {
  const hasValue = value !== "" && Number(value) > 0;
  const isQuick = QUICK_HOURS_OPTIONS.some((o) => o.value === value);

  return (
    <QuickPick
      label="Est. hours"
      chips={QUICK_HOURS_OPTIONS.map((o) => ({
        label: o.label,
        active: value === o.value,
        onClick: () => onPick(value === o.value ? "" : o.value),
      }))}
      custom={{
        label: hasValue && !isQuick ? `${value}h` : "Custom",
        icon: <SlidersHorizontal size={12} />,
        active: hasValue && !isQuick,
      }}
    >
      <input
        type="number"
        autoFocus
        aria-label="Est. hours"
        min="0"
        step="0.5"
        value={value}
        onChange={onInputChange}
        onBlur={onInputBlur}
        placeholder="0"
        className={FIELD_INPUT}
      />
    </QuickPick>
  );
}
