"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { BUTTON_DANGER, BUTTON_OUTLINE, ModalShell } from "@/components/ui/Modal";
import { FIELD_INPUT } from "@/components/board/card-modal/modalParts";

interface TypeToConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmPhrase: string;
  inputLabel: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TypeToConfirmDialog({
  open,
  title,
  description,
  confirmPhrase,
  inputLabel,
  confirmLabel = "Delete permanently",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: TypeToConfirmDialogProps) {
  const [value, setValue] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Reset on closed→open during render (setState-during-render pattern).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue("");
  }

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const matched = value === confirmPhrase;
  const canConfirm = matched && !loading;

  const close = () => {
    if (!loading) onCancel();
  };

  return (
    <ModalShell label={title} onClose={close} className="max-w-md">
      <div className="flex items-start gap-3 px-6 pt-5">
        <span className="shrink-0 w-9 h-9 rounded-lg bg-red-100 text-danger flex items-center justify-center">
          <AlertTriangle size={18} />
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <div className="text-sm text-slate-600 leading-relaxed">{description}</div>}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-6 pt-4">
        <label htmlFor={inputId} className="text-xs font-medium text-slate-600">
          {inputLabel}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canConfirm) onConfirm();
          }}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
          className={`${FIELD_INPUT} disabled:opacity-60`}
        />
      </div>

      <div className="flex justify-end gap-2 px-6 pt-5 pb-5">
        <button type="button" onClick={close} disabled={loading} className={BUTTON_OUTLINE}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} disabled={!canConfirm} className={BUTTON_DANGER}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
