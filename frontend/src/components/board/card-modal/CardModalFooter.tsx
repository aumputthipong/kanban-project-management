"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BUTTON_DANGER_TEXT, BUTTON_OUTLINE } from "@/components/ui/Modal";

interface CardModalFooterProps {
  canEdit: boolean;
  canDelete: boolean;
  cardTitle: string;
  onDelete: () => void;
  onClose: () => void;
}

export function CardModalFooter({
  canEdit,
  canDelete,
  cardTitle,
  onDelete,
  onClose,
}: CardModalFooterProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 px-6 py-3.5 border-t border-slate-200 shrink-0">
        {canDelete && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={BUTTON_DANGER_TEXT}
          >
            <Trash2 size={14} />
            Delete
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {canEdit && <span className="text-xs text-slate-600">บันทึกอัตโนมัติ</span>}
          <button
            type="button"
            onClick={onClose}
            className={BUTTON_OUTLINE}
          >
            Close
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete task"
        description={`"${cardTitle}" จะถูกลบถาวรและกู้คืนไม่ได้`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          onDelete();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
