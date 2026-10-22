"use client";

import { Flag } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { Dot, PRIORITY_DOT, PRIORITY_LABEL } from "@/components/board/card-modal/modalParts";
import { FilterMenuClear, FilterMenuItem, FilterMenuPanel, FilterTrigger, useFilterMenu } from "./FilterMenu";

const PRIORITIES = ["high", "medium", "low"] as const;

export function PriorityFilterDropdown() {
  const filterPriorities = useBoardStore((s) => s.filterPriorities);
  const toggleFilterPriority = useBoardStore((s) => s.toggleFilterPriority);
  const clearFilterPriorities = useBoardStore((s) => s.clearFilterPriorities);
  const { open, setOpen, ref } = useFilterMenu();
  const active = filterPriorities.length > 0;

  return (
    <div className="relative" ref={ref}>
      <FilterTrigger
        label="Priority"
        icon={<Flag size={13} />}
        active={active}
        open={open}
        count={filterPriorities.length}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <FilterMenuPanel width="w-40">
          {PRIORITIES.map((p) => (
            <FilterMenuItem key={p} selected={filterPriorities.includes(p)} onClick={() => toggleFilterPriority(p)}>
              <Dot className={PRIORITY_DOT[p]} />
              {PRIORITY_LABEL[p]}
            </FilterMenuItem>
          ))}
          {active && (
            <FilterMenuClear
              onClick={() => {
                clearFilterPriorities();
                setOpen(false);
              }}
            />
          )}
        </FilterMenuPanel>
      )}
    </div>
  );
}
