"use client";

import { useEffect } from "react";
import { UserRound, UserX } from "lucide-react";
import { useBoardStore, UNASSIGNED_FILTER } from "@/store/useBoardStore";
import { getAvatarColor } from "@/utils/avatar";
import { filterChipClass, FilterMenuClear, FilterMenuItem, FilterMenuPanel, FilterTrigger, useFilterMenu } from "./FilterMenu";

function Avatar({ userId, name }: { userId: string; name?: string }) {
  return (
    <span className={`grid place-items-center w-5 h-5 rounded-full text-white text-xs font-semibold shrink-0 ${getAvatarColor(userId)}`}>
      {name?.charAt(0).toUpperCase() ?? "?"}
    </span>
  );
}

function isTypingOrInDialog(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable ||
    document.querySelector('[role="dialog"]') !== null
  );
}

/** "My Tasks" toggle; M flips it when no field or dialog has the keyboard. */
export function MyTasksToggle() {
  const currentUserId = useBoardStore((s) => s.currentUserId);
  const me = useBoardStore((s) => s.boardMembers.find((m) => m?.user_id === s.currentUserId));
  const filterAssigneeId = useBoardStore((s) => s.filterAssigneeId);
  const setFilterAssigneeId = useBoardStore((s) => s.setFilterAssigneeId);
  const active = currentUserId !== null && filterAssigneeId === currentUserId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "m" && e.key !== "M") return;
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingOrInDialog(e.target)) return;
      if (!currentUserId) return;
      setFilterAssigneeId(active ? null : currentUserId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentUserId, active, setFilterAssigneeId]);

  if (!currentUserId) return null;

  return (
    <button
      type="button"
      onClick={() => setFilterAssigneeId(active ? null : currentUserId)}
      aria-pressed={active}
      title="Show only my tasks (M)"
      className={`${filterChipClass(active)} pl-1.5`}
    >
      <Avatar userId={currentUserId} name={me?.full_name} />
      My Tasks
    </button>
  );
}

/** Single-select assignee filter for everyone except the viewer (My Tasks covers them). */
export function AssigneeFilterDropdown() {
  const currentUserId = useBoardStore((s) => s.currentUserId);
  const boardMembers = useBoardStore((s) => s.boardMembers);
  const filterAssigneeId = useBoardStore((s) => s.filterAssigneeId);
  const setFilterAssigneeId = useBoardStore((s) => s.setFilterAssigneeId);
  const { open, setOpen, ref } = useFilterMenu();

  const others = boardMembers.filter((m) => m?.user_id && m.user_id !== currentUserId);
  const picked = others.find((m) => m.user_id === filterAssigneeId);
  const unassigned = filterAssigneeId === UNASSIGNED_FILTER;
  const active = unassigned || picked !== undefined;

  const pick = (id: string) => {
    setFilterAssigneeId(filterAssigneeId === id ? null : id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <FilterTrigger
        label={picked ? picked.full_name : unassigned ? "Unassigned" : "Assignee"}
        icon={
          picked ? <Avatar userId={picked.user_id} name={picked.full_name} /> : unassigned ? <UserX size={13} /> : <UserRound size={13} />
        }
        active={active}
        open={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <FilterMenuPanel width="w-52">
          <FilterMenuItem selected={unassigned} onClick={() => pick(UNASSIGNED_FILTER)}>
            <span className="grid place-items-center w-5 h-5 rounded-full border border-dashed border-slate-400 text-slate-600 shrink-0">
              <UserX size={11} />
            </span>
            Unassigned
          </FilterMenuItem>
          {others.length > 0 && <div className="my-1 border-t border-slate-200" />}
          <div className="max-h-64 overflow-y-auto">
            {others.map((m) => (
              <FilterMenuItem key={m.user_id} selected={filterAssigneeId === m.user_id} onClick={() => pick(m.user_id)}>
                <Avatar userId={m.user_id} name={m.full_name} />
                <span className="truncate">{m.full_name}</span>
              </FilterMenuItem>
            ))}
          </div>
          {active && (
            <FilterMenuClear
              onClick={() => {
                setFilterAssigneeId(null);
                setOpen(false);
              }}
            />
          )}
        </FilterMenuPanel>
      )}
    </div>
  );
}
