"use client";

import { ArrowDown, Crown, Link2, Plus, Users } from "lucide-react";
import { Dot, PRIORITY_DOT, PRIORITY_LABEL } from "@/components/board/card-modal/modalParts";
import { getAvatarColor } from "@/utils/avatar";
import { MEMBER, OWNER } from "./demoBoard";

const DEFAULT_COLUMNS = ["To Do", "In Progress", "Review", "Done"];

function Avatar({ name }: { name: string }) {
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${getAvatarColor(name)}`}
    >
      {name.charAt(0)}
    </span>
  );
}

export function ColumnsArt() {
  return (
    <div className="grid w-56 grid-cols-2 gap-2">
      {DEFAULT_COLUMNS.map((title) => (
        <span
          key={title}
          className="relative overflow-hidden rounded-lg border border-slate-200 bg-white px-3 pb-1.5 pt-2 text-xs font-semibold text-slate-700 shadow-sm"
        >
          <span className="absolute inset-x-0 top-0 h-0.75 bg-slate-500" />
          {title}
        </span>
      ))}
      <span className="col-span-2 inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-primary/40 bg-surface-tint px-3 py-1.5 text-xs font-semibold text-primary">
        <Plus size={12} /> Add column
      </span>
    </div>
  );
}

export function MoveArt() {
  return (
    <div className="grid w-52 [&>*]:col-start-1 [&>*]:row-start-1">
      <div className="mt-6 flex h-20 items-end justify-center rounded-lg border-2 border-dashed border-primary/40 bg-surface-tint/60 pb-1.5 text-xs font-semibold text-primary">
        <span className="inline-flex items-center gap-1">
          <ArrowDown size={12} /> Drop here
        </span>
      </div>
      <div className="mx-3 flex -rotate-3 flex-col gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
        <span className="text-sm font-medium text-slate-900">Build auth service</span>
        <div className="flex items-center gap-3 text-xs font-medium text-slate-900">
          <span className="inline-flex items-center gap-1.5">
            <Dot className={PRIORITY_DOT.high} />
            {PRIORITY_LABEL.high}
          </span>
          <span className="ml-auto">
            <Avatar name={OWNER} />
          </span>
        </div>
      </div>
    </div>
  );
}

const ROLES = [
  { name: OWNER, label: "Owner", Icon: Crown, className: "bg-indigo-50 text-blue-800" },
  { name: MEMBER, label: "Member", Icon: Users, className: "bg-slate-100 text-slate-600" },
];

export function TeamArt() {
  return (
    <div className="w-60 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {ROLES.map(({ name, label, Icon, className }) => (
        <div key={name} className="flex items-center gap-2 px-3 py-2">
          <Avatar name={name} />
          <span className="flex-1 truncate text-xs font-semibold text-slate-700">{name}</span>
          <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold ${className}`}>
            <Icon size={11} /> {label}
          </span>
        </div>
      ))}
      <div lang="th" className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-800">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-indigo-50 text-primary">
          <Link2 size={13} />
        </span>
        เชิญด้วยลิงก์
      </div>
    </div>
  );
}
