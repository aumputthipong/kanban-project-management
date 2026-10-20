"use client";

import { AlarmClock, Calendar, Clock } from "lucide-react";
import type { BoardMember, Tag as TagType } from "@/types/board";
import { FormState } from "./CardDetailModal";
import { TagSelector } from "./TagSelector";
import { AssigneeDropdown } from "./AssigneeDropdown";
import {
  ClearFieldButton,
  Dot,
  FieldLabel,
  MetaChip,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  SegmentedControl,
} from "./modalParts";
import { daysOverdue, formatThaiDate } from "@/utils/date_helper";
import { DueDatePick, HoursPick } from "./QuickPick";
import { getAvatarColor } from "@/utils/avatar";

interface CardFormFieldsProps {
  form: FormState;
  members: BoardMember[];
  assigneeName?: string;
  boardId: string;
  onChange: (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onTagsChange: (tags: TagType[]) => void;
  onCommit: (field: keyof FormState) => void;
  error: string | null;
  canEdit: boolean;
  isDone: boolean;
}

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.75">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {action}
      </div>
      {children}
    </div>
  );
}

export function CardFormFields({ form, members, assigneeName, boardId, onChange, onTagsChange, onCommit, error, canEdit, isDone }: CardFormFieldsProps) {
  const hasHours = Number(form.estimated_hours) > 0;
  const lateDays = !isDone && form.due_date ? daysOverdue(form.due_date) : 0;

  const set = (field: keyof FormState, value: string) => {
    onChange(field)({ target: { value } } as React.ChangeEvent<HTMLInputElement>);
    onCommit(field);
  };

  return (
    <div className="flex flex-col gap-4.5">
      <Field label="Assignee">
        {canEdit ? (
          <AssigneeDropdown members={members} value={form.assignee_id} onSelect={(id) => set("assignee_id", id)} />
        ) : assigneeName ? (
          <span className="flex items-center gap-2 text-sm text-slate-900">
            <span className={`w-4.5 h-4.5 rounded-full grid place-items-center text-white text-[10px] font-semibold shrink-0 ${getAvatarColor(form.assignee_id)}`}>
              {assigneeName.charAt(0).toUpperCase()}
            </span>
            {assigneeName}
          </span>
        ) : (
          <span className="text-sm text-slate-600">ยังไม่มีผู้รับผิดชอบ</span>
        )}
      </Field>

      <Field label="Priority">
        {canEdit ? (
          <SegmentedControl
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={form.priority}
            onChange={(p) => set("priority", p)}
          />
        ) : (
          <span className="flex items-center gap-2 text-sm text-slate-900">
            {form.priority ? (
              <>
                <Dot className={PRIORITY_DOT[form.priority]} />
                {PRIORITY_LABEL[form.priority]}
              </>
            ) : "—"}
          </span>
        )}
      </Field>

      <Field
        label="Due date"
        action={canEdit && form.due_date ? <ClearFieldButton field="due date" onClick={() => set("due_date", "")} /> : null}
      >
        {canEdit ? (
          <DueDatePick value={form.due_date} onChange={(v) => set("due_date", v)} />
        ) : (
          <span className="flex items-center gap-2 text-sm text-slate-900">
            <Calendar size={13} className="text-slate-600" />
            {formatThaiDate(form.due_date) || "—"}
          </span>
        )}
        {lateDays > 0 && (
          <span>
            <MetaChip overdue>
              <AlarmClock size={12} />
              เลย {lateDays} วัน
            </MetaChip>
          </span>
        )}
      </Field>

      <Field
        label="Est. hours"
        action={canEdit && hasHours ? <ClearFieldButton field="estimate" onClick={() => set("estimated_hours", "")} /> : null}
      >
        {canEdit ? (
          <HoursPick
            value={form.estimated_hours}
            onPick={(v) => set("estimated_hours", v)}
            onInputChange={onChange("estimated_hours")}
            onInputBlur={() => onCommit("estimated_hours")}
          />
        ) : (
          <span className="flex items-center gap-2 text-sm text-slate-900">
            <Clock size={13} className="text-slate-600" />
            {hasHours ? `${form.estimated_hours} ชม.` : "—"}
          </span>
        )}
      </Field>

      <Field label="Tags">
        <TagSelector
          boardId={boardId}
          selected={form.tags}
          onChange={onTagsChange}
          onCommit={() => onCommit("tags")}
          canEdit={canEdit}
        />
      </Field>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
