"use client";

import { useEffect, useState } from "react";
import { Tag as TagIcon } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { API_URL } from "@/lib/constants";
import type { Tag } from "@/types/board";
import { getColumnColorHex } from "./ColumnOptionsModal";
import { FilterMenuClear, FilterMenuItem, FilterMenuPanel, FilterTrigger, useFilterMenu } from "./FilterMenu";

interface TagFilterDropdownProps {
  boardId: string;
}

export function TagFilterDropdown({ boardId }: TagFilterDropdownProps) {
  const filterTagIds = useBoardStore((s) => s.filterTagIds);
  const toggleFilterTag = useBoardStore((s) => s.toggleFilterTag);
  const clearFilterTags = useBoardStore((s) => s.clearFilterTags);
  const [tags, setTags] = useState<Tag[]>([]);
  const { open, setOpen, ref } = useFilterMenu();
  const active = filterTagIds.length > 0;

  useEffect(() => {
    if (!boardId) return;
    fetch(`${API_URL}/boards/${boardId}/tags`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Tag[]) => setTags(Array.isArray(data) ? data : []))
      .catch(() => {
        // Non-critical: on failure the dropdown shows no tags.
      });
  }, [boardId]);

  return (
    <div className="relative" ref={ref}>
      <FilterTrigger
        label="Tags"
        icon={<TagIcon size={13} />}
        active={active}
        open={open}
        count={filterTagIds.length}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <FilterMenuPanel width="w-56">
          {tags.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-600">Board นี้ยังไม่มี Tag</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {tags.map((tag) => (
                <FilterMenuItem key={tag.id} selected={filterTagIds.includes(tag.id)} onClick={() => toggleFilterTag(tag.id)}>
                  <span
                    aria-hidden
                    className="w-1.25 h-1.25 rounded-full shrink-0"
                    style={{ backgroundColor: getColumnColorHex(tag.color) ?? "#94a3b8" }}
                  />
                  <span className="truncate">{tag.name}</span>
                </FilterMenuItem>
              ))}
            </div>
          )}
          {active && (
            <FilterMenuClear
              onClick={() => {
                clearFilterTags();
                setOpen(false);
              }}
            />
          )}
        </FilterMenuPanel>
      )}
    </div>
  );
}
