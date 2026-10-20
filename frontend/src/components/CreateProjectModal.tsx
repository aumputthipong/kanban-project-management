"use client";

import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { BoardAppearancePicker } from "@/components/board/settings/BoardAppearancePicker";
import { FIELD_INPUT, FieldLabel } from "@/components/board/card-modal/modalParts";
import {
  BUTTON_OUTLINE,
  BUTTON_PRIMARY,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from "@/components/ui/Modal";
import {
  DEFAULT_BOARD_COLOR,
  DEFAULT_BOARD_ICON,
  type BoardIconKey,
} from "@/lib/boardAppearance";

interface CreateProjectModalProps {
  onClose: () => void;
}

export function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_BOARD_COLOR);
  const [icon, setIcon] = useState<BoardIconKey>(DEFAULT_BOARD_ICON);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (isCreating) return;
    onClose();
  };

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("กรุณาใส่ชื่อ Project");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const newBoard = await apiClient<{ id: string }>("/boards", {
        data: {
          title: trimmedTitle,
          description: description.trim(),
          color,
          icon,
        },
      });
      router.push(`/board/${newBoard.id}/tasks`);
      // The project layout (sidebar list) persists across the push, so refresh it.
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้าง Project ไม่สำเร็จ");
      setIsCreating(false);
    }
  };

  return (
    <ModalShell label="New Project" onClose={handleClose} className="max-w-md">
      <ModalHeader title="New Project" onClose={handleClose} />

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <label htmlFor="project-name">
              <FieldLabel>Project name</FieldLabel>
            </label>
            <input
              ref={inputRef}
              id="project-name"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              disabled={isCreating}
              aria-invalid={!!error}
              placeholder="ใส่ชื่อ Project ของคุณ"
              className={`${FIELD_INPUT} disabled:opacity-50 ${error ? "border-danger" : ""}`}
            />
            {error && <p className="text-xs font-medium text-danger">{error}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="project-desc">
              <FieldLabel>Description</FieldLabel>
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              rows={2}
              maxLength={160}
              placeholder="อธิบาย Project สั้น ๆ (ไม่บังคับ)"
              className={`${FIELD_INPUT} resize-none disabled:opacity-50`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel>Appearance</FieldLabel>
            <BoardAppearancePicker
              name={title}
              color={color}
              icon={icon}
              canManage={!isCreating}
              saving={null}
              onPickColor={setColor}
              onPickIcon={setIcon}
            />
          </div>
        </div>

        <ModalFooter>
          <button type="button" onClick={handleClose} disabled={isCreating} className={`ml-auto ${BUTTON_OUTLINE}`}>
            Cancel
          </button>
          <button type="submit" disabled={isCreating || !title.trim()} className={BUTTON_PRIMARY}>
            {isCreating && <Loader2 size={14} className="animate-spin" />}
            {isCreating ? "Creating…" : "Create Project"}
          </button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
