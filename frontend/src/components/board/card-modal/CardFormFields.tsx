"use client";

import { useState } from "react";
import { AlarmClock, Calendar, Clock } from "lucide-react";
import type { BoardMember, Tag as TagType } from "@/types/board";
import { FormState } from "./CardDetailModal";
import { TagSelector } from "./TagSelector";
import { AssigneeDropdown } from "./AssigneeDropdown";
import {
  ClearFieldButton,
  Dot,
  FIELD_INPUT,
  FieldLabel,
  MetaChip,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  QuickChips,
  SegmentedControl,
} from "./modalParts";
import { daysOverdue, formatThaiDate } from "@/utils/date_helper";
import { QUICK_DATE_OPTIONS, QUICK_HOURS_OPTIONS } from "@/utils/quickSelect";
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

const VALUE_BOX = `flex-1 min-w-0 ${FIELD_INPUT}`;

function localISODate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
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

function QuickToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 px-2 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors"
    >
      Quick
    </button>
  );
}

export function CardFormFields({ form, members, assigneeName, boardId, onChange, onTagsChange, onCommit, error, canEdit, isDone }: CardFormFieldsProps) {
  const [showQuickDates, setShowQuickDates] = useState(false);
  const lateDays = !isDone && form.due_date ? daysOverdue(form.due_date) : 0;
  const [showQuickHours, setShowQuickHours] = useState(false);

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
          <>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="Due date"
                value={form.due_date}
                onChange={(e) => {
                  onChange("due_date")(e);
                  onCommit("due_date");
                }}
                className={VALUE_BOX}
              />
              <QuickToggle onClick={() => setShowQuickDates((v) => !v)} />
            </div>
            {showQuickDates && (
              <QuickChips
                options={QUICK_DATE_OPTIONS}
                isActive={(i) => form.due_date === localISODate(QUICK_DATE_OPTIONS[i].days)}
                onPick={(i) => set("due_date", localISODate(QUICK_DATE_OPTIONS[i].days))}
              />
            )}
          </>
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

      <Field label="Est. hours">
        {canEdit ? (
          <>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                aria-label="Est. hours"
                min="0"
                step="0.5"
                value={form.estimated_hours}
                onChange={onChange("estimated_hours")}
                onBlur={() => onCommit("estimated_hours")}
                placeholder="0"
                className={VALUE_BOX}
              />
              <QuickToggle onClick={() => setShowQuickHours((v) => !v)} />
            </div>
            {showQuickHours && (
              <QuickChips
                options={QUICK_HOURS_OPTIONS}
                isActive={(i) => form.estimated_hours === QUICK_HOURS_OPTIONS[i].value}
                onPick={(i) => set("estimated_hours", QUICK_HOURS_OPTIONS[i].value)}
              />
            )}
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-slate-900">
            <Clock size={13} className="text-slate-600" />
            {form.estimated_hours ? `${form.estimated_hours} ชม.` : "—"}
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
