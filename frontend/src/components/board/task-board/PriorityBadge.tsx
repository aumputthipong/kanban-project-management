"use client";

import {
  Dot,
  MetaChip,
  PRIORITY_DOT,
  PRIORITY_LABEL,
} from "@/components/board/card-modal/modalParts";

interface PriorityBadgeProps {
  priority: "low" | "medium" | "high";
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <MetaChip strong>
      <Dot className={PRIORITY_DOT[priority]} />
      {PRIORITY_LABEL[priority]}
    </MetaChip>
  );
}
