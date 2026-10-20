import { useState } from "react";

// DONE columns default to expanded; a collapse is saved per board + column.
const collapseKey = (boardId: string, columnId: string) =>
  `turtask:col-collapsed:${boardId}:${columnId}`;

function readCollapsed(boardId: string, columnId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(collapseKey(boardId, columnId)) === "1";
  } catch {
    return false;
  }
}

export function useColumnCollapsed(boardId: string, columnId: string) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(boardId, columnId));

  const setPersisted = (next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(collapseKey(boardId, columnId), next ? "1" : "0");
    } catch {
      /* localStorage unavailable (private mode) */
    }
  };

  return [collapsed, setPersisted] as const;
}
