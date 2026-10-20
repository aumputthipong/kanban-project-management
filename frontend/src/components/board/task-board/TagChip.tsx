"use client";

import { X } from "lucide-react";
import type { Tag } from "@/types/board";
import { getColumnColorHex } from "./ColumnOptionsModal";

interface TagChipProps {
  tag: Tag;
  onRemove?: (tagId: string) => void;
  size?: "sm" | "md";
}

export function TagChip({ tag, onRemove, size = "sm" }: TagChipProps) {
  const hex = getColumnColorHex(tag.color) ?? "#94a3b8";
  const padding = size === "md" ? "px-2 py-0.5" : "px-1.5 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${padding} rounded-md bg-slate-100 border border-slate-200 text-slate-700 w-fit`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: hex }}
      />
      <span className="truncate max-w-28">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tag.id);
          }}
          className="ml-0.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X size={9} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
