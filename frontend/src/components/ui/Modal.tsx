"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export const BUTTON_PRIMARY =
  "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const BUTTON_OUTLINE =
  "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md border border-slate-200 text-slate-900 hover:bg-slate-50 transition-colors";

export const BUTTON_DANGER =
  "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md bg-danger text-white hover:bg-danger-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const BUTTON_DANGER_TEXT =
  "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md text-danger hover:bg-red-100 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors";

interface ModalShellProps {
  label: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

/** Backdrop + centered dialog panel shared by the board modals. */
export function ModalShell({ label, onClose, className = "max-w-lg", children }: ModalShellProps) {
  useEscapeKey(true, onClose);

  return createPortal(
    <>
      {/* No backdrop-blur: it costs a GPU composite every frame. */}
      <div className="fixed inset-0 z-9998 bg-slate-900/45" onClick={onClose} />
      <div className="fixed inset-0 z-9999 flex items-center justify-center pointer-events-none px-4 py-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={`pointer-events-auto w-full max-h-full flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xl ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-200">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิด"
        className="w-7 h-7 grid place-items-center rounded-md text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <X size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-6 py-3.5 border-t border-slate-200 shrink-0">
      {children}
    </div>
  );
}
