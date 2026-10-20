"use client";

import { UserX } from "lucide-react";
import type { BoardMember } from "@/types/board";
import { getAvatarColor } from "@/utils/avatar";

const CHIP =
  "inline-flex items-center gap-1.5 h-8 pl-1 pr-2.5 max-w-40 rounded-full border text-xs font-medium transition-colors";
const CHIP_ON = "bg-surface-tint border-primary text-slate-900";
const CHIP_OFF = "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900";

function Chip({
  active,
  label,
  avatar,
  onClick,
}: {
  active: boolean;
  label: string;
  avatar: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
    >
      {avatar}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Initial({ userId, name }: { userId: string; name?: string }) {
  return (
    <span
      className={`grid place-items-center w-6 h-6 rounded-full text-white text-xs font-semibold shrink-0 ${getAvatarColor(userId)}`}
    >
      {name?.charAt(0).toUpperCase() ?? "?"}
    </span>
  );
}

interface AssigneeChipsProps {
  members: BoardMember[];
  currentUserId: string | null;
  value: string | null;
  onChange: (userId: string | null) => void;
}

export function AssigneeChips({ members, currentUserId, value, onChange }: AssigneeChipsProps) {
  const me = members.find((m) => m.user_id === currentUserId);
  const others = members.filter((m) => m?.user_id && m.user_id !== currentUserId);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Assignee">
      {currentUserId && (
        <Chip
          active={value === currentUserId}
          label="Me"
          avatar={<Initial userId={currentUserId} name={me?.full_name} />}
          onClick={() => onChange(currentUserId)}
        />
      )}
      {others.map((m) => (
        <Chip
          key={m.user_id}
          active={value === m.user_id}
          label={m.full_name}
          avatar={<Initial userId={m.user_id} name={m.full_name} />}
          onClick={() => onChange(m.user_id)}
        />
      ))}
      <Chip
        active={value === null}
        label="Unassigned"
        avatar={
          <span className="grid place-items-center w-6 h-6 rounded-full border border-dashed border-slate-400 text-slate-600 shrink-0">
            <UserX size={12} />
          </span>
        }
        onClick={() => onChange(null)}
      />
    </div>
  );
}
