"use client";

import { X } from "lucide-react";
import { ModalShell } from "@/components/ui/Modal";

interface Props {
  context: React.ReactNode;
  title: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export function TaskQuickModal({ context, title, onClose, footer, children }: Props) {
  return (
    <ModalShell label={title} onClose={onClose} className="max-w-md">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.75 bg-slate-900" />

      <div className="flex items-center gap-2 px-5 pt-4.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0 text-xs font-medium text-slate-600">{context}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="ml-auto w-7 h-7 grid place-items-center rounded-md text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>

      <h2 className="px-5 pt-2 pb-3.5 text-xl font-semibold tracking-tight leading-snug text-slate-900 shrink-0">
        {title}
      </h2>

      <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-t border-slate-200 shrink-0">
        {footer}
      </div>
    </ModalShell>
  );
}
