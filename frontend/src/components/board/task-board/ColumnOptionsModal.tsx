"use client";

import { useState } from "react";
import { Check, CircleCheck, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  BUTTON_DANGER_TEXT,
  BUTTON_OUTLINE,
  BUTTON_PRIMARY,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from "@/components/ui/Modal";
import {
  FIELD_INPUT,
  FieldLabel,
  SegmentedControl,
} from "@/components/board/card-modal/modalParts";

// Palette
export const COLUMN_COLOR_PALETTE: {
  key: string | null;
  hex: string | null;
  label: string;
}[] = [
  { key: null, hex: null, label: "Default" },
  { key: "slate", hex: "#94a3b8", label: "Slate" },
  { key: "blue", hex: "#60a5fa", label: "Blue" },
  { key: "purple", hex: "#a78bfa", label: "Purple" },
  { key: "green", hex: "#34d399", label: "Green" },
  { key: "amber", hex: "#fbbf24", label: "Amber" },
  { key: "rose", hex: "#fb7185", label: "Rose" },
  { key: "pink", hex: "#f472b6", label: "Pink" },
  { key: "cyan", hex: "#22d3ee", label: "Cyan" },
];

// Slate is dropped for columns: Default already renders the same grey.
const COLUMN_SWATCHES = COLUMN_COLOR_PALETTE.filter((c) => c.key !== "slate");

export function getColumnColorHex(key?: string | null): string | null {
  return COLUMN_COLOR_PALETTE.find((c) => c.key === (key ?? null))?.hex ?? null;
}

// Column colours — shared with Column.tsx so the preview matches.

export function columnAccentColor(hex: string | null, isDone: boolean): string {
  return hex ?? (isDone ? "#10b981" : "#94a3b8");
}

/** Darkened toward ink so a 3px bar still reads on pastels. */
export function columnBarColor(accent: string): string {
  return `color-mix(in oklab, ${accent} 68%, #0f172a)`;
}

// Props
interface ColumnOptionsModalProps {
  open: boolean;
  mode?: "edit" | "create";
  initialTitle: string;
  initialCategory: "TODO" | "DONE";
  initialColor: string | null;
  cardCount: number;
  onSave: (
    title: string,
    category: "TODO" | "DONE",
    color: string | null,
  ) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const CATEGORY_OPTIONS = [
  { value: "TODO" as const, content: "To do" },
  { value: "DONE" as const, content: "Done" },
];

const CATEGORY_HINT: Record<"TODO" | "DONE", string> = {
  TODO: "การ์ดในคอลัมน์นี้ยังนับว่ากำลังทำอยู่",
  DONE: "การ์ดที่ย้ายเข้าคอลัมน์นี้จะนับว่าเสร็จแล้ว",
};

export function ColumnOptionsModal({
  open,
  mode = "edit",
  initialTitle,
  initialCategory,
  initialColor,
  cardCount,
  onSave,
  onDelete,
  onClose,
}: ColumnOptionsModalProps) {
  const isCreate = mode === "create";
  // Column.tsx remounts this per open via `key`, so state starts fresh.
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState<"TODO" | "DONE">(initialCategory);
  const [color, setColor] = useState<string | null>(
    initialColor === "slate" ? null : initialColor,
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave(trimmed, category, color);
    onClose();
  };

  const selectedHex = getColumnColorHex(color);
  const accent = columnAccentColor(selectedHex, category === "DONE");
  const barColor = columnBarColor(accent);
  const heading = isCreate ? "New column" : "Column options";

  return (
    <>
      <ModalShell label={heading} onClose={onClose} className="max-w-sm">
        <ModalHeader title={heading} onClose={onClose} />

        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto">
          <label className="flex flex-col gap-2">
            <FieldLabel>Name</FieldLabel>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              className={FIELD_INPUT}
            />
          </label>

          <div className="flex flex-col gap-2">
            <FieldLabel>Category</FieldLabel>
            <SegmentedControl
              label="Category"
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
            />
            <p className="text-xs text-slate-600">{CATEGORY_HINT[category]}</p>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel>Color</FieldLabel>

            {/* Preview */}
            <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-0.75"
                style={{ backgroundColor: barColor }}
              />
              <div className="flex items-center gap-2 px-3 h-9 border-b border-slate-200">
                {category === "DONE" ? (
                  <CircleCheck size={14} className="shrink-0" style={{ color: barColor }} />
                ) : (
                  <span
                    className="h-1.25 w-1.25 shrink-0 rounded-full"
                    style={{ backgroundColor: barColor }}
                  />
                )}
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-900">
                  {title.trim() || "ชื่อคอลัมน์"}
                </span>
                <span className="min-w-5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-center text-xs font-semibold text-slate-600">
                  {cardCount}
                </span>
              </div>
              <div className="px-3 py-2.5">
                <div className="h-2 w-2/3 rounded-sm bg-white" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
              {COLUMN_SWATCHES.map(({ key, hex, label }) => {
                const isSel = color === key;
                return (
                  <button
                    key={String(key)}
                    type="button"
                    onClick={() => setColor(key)}
                    title={key ? label : "Default — สีตามประเภทคอลัมน์"}
                    aria-label={label}
                    aria-pressed={isSel}
                    className={`w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-offset-2 ring-offset-white transition ${
                      isSel ? "ring-slate-700" : "ring-transparent hover:ring-slate-300"
                    }`}
                    style={{
                      backgroundColor: columnAccentColor(hex, category === "DONE"),
                    }}
                  >
                    {isSel && <Check size={13} strokeWidth={3} className="text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {!isCreate && cardCount > 0 && (
            <p className="text-xs text-slate-600">
              ย้ายการ์ด {cardCount} ใบออกจากคอลัมน์นี้ก่อน จึงจะลบคอลัมน์ได้
            </p>
          )}
        </div>

        <ModalFooter>
          {!isCreate && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={cardCount > 0}
              className={BUTTON_DANGER_TEXT}
            >
              <Trash2 size={14} /> Delete column
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className={BUTTON_OUTLINE}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim()}
              className={BUTTON_PRIMARY}
            >
              {isCreate ? "Create" : "Save"}
            </button>
          </div>
        </ModalFooter>
      </ModalShell>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete column?"
        description="คอลัมน์นี้ว่างอยู่ และจะถูกลบถาวร"
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onClose();
          onDelete?.();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
