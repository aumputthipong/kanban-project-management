"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const CHIP =
  "cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const CHIP_OFF = "bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900";
const CHIP_ON = "bg-surface-tint border-transparent text-primary";

/** design.md chip-filter: outline at rest, surface-tint + primary when a filter is on. */
export function filterChipClass(active: boolean) {
  return `${CHIP} ${active ? CHIP_ON : CHIP_OFF}`;
}

/** Open state for a filter dropdown: closes on outside click and Esc. */
export function useFilterMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEscapeKey(open, () => setOpen(false));

  return { open, setOpen, ref };
}

interface FilterTriggerProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  open: boolean;
  count?: number;
  onClick: () => void;
}

export function FilterTrigger({ label, icon, active, open, count, onClick }: FilterTriggerProps) {
  return (
    <button type="button" onClick={onClick} aria-haspopup="true" aria-expanded={open} className={filterChipClass(active)}>
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="grid place-items-center min-w-4 h-4 px-1 rounded-full bg-primary text-white text-xs font-semibold leading-none tabular-nums">
          {count}
        </span>
      )}
      <ChevronDown size={12} className={`transition-transform ${active ? "text-primary" : "text-slate-500"} ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

export function FilterMenuPanel({ children, width = "w-48" }: { children: React.ReactNode; width?: string }) {
  return (
    <div className={`absolute top-full left-0 mt-1.5 z-50 ${width} bg-white border border-slate-200 rounded-lg shadow-lg py-1 overflow-hidden`}>
      {children}
    </div>
  );
}

export function FilterMenuItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`cursor-pointer flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors ${
        selected ? "bg-surface-tint text-primary font-medium" : "text-slate-900 hover:bg-slate-50"
      }`}
    >
      {children}
      {selected && <Check size={14} className="ml-auto shrink-0 text-primary" />}
    </button>
  );
}

export function FilterMenuClear({ onClick }: { onClick: () => void }) {
  return (
    <>
      <div className="my-1 border-t border-slate-200" />
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer flex items-center w-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
      >
        Clear filter
      </button>
    </>
  );
}
