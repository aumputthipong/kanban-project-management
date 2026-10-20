"use client";

import { useEffect, useRef } from "react";
import { BUTTON_DANGER, BUTTON_OUTLINE, BUTTON_PRIMARY, ModalShell } from "@/components/ui/Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <ModalShell label={title} onClose={onCancel} className="max-w-sm">
      <div className="flex flex-col gap-1.5 px-6 pt-5 pb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-600">{description}</p>}
      </div>
      <div className="flex justify-end gap-2 px-6 pb-5">
        <button type="button" onClick={onCancel} className={BUTTON_OUTLINE}>
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className={destructive ? BUTTON_DANGER : BUTTON_PRIMARY}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
