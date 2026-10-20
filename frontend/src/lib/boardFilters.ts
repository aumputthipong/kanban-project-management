import type { Card } from "@/types/board";
import { UNASSIGNED_FILTER } from "@/store/useBoardStore";

export interface BoardFilters {
  assigneeId?: string | null;
  priorities?: string[];
  tagIds?: string[];
}

export function hasBoardFilters({ assigneeId, priorities, tagIds }: BoardFilters): boolean {
  return assigneeId != null || (priorities?.length ?? 0) > 0 || (tagIds?.length ?? 0) > 0;
}

export function matchesBoardFilters(card: Card, { assigneeId, priorities, tagIds }: BoardFilters): boolean {
  if (assigneeId != null) {
    const want = assigneeId === UNASSIGNED_FILTER ? null : assigneeId;
    if ((card.assignee_id ?? null) !== want) return false;
  }
  if (priorities?.length && !priorities.includes(card.priority ?? "")) return false;
  if (tagIds?.length && !(card.tags?.some((t) => tagIds.includes(t.id)) ?? false)) return false;
  return true;
}
