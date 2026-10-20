"use client";

import { useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import {
  BUTTON_OUTLINE,
  BUTTON_PRIMARY,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from "@/components/ui/Modal";
import {
  ClearFieldButton,
  FIELD_BOX,
  FIELD_INPUT,
  FieldLabel,
  PRIORITY_OPTIONS,
  SegmentedControl,
} from "@/components/board/card-modal/modalParts";
import { AssigneeChips } from "./AssigneeChips";
import { SubtaskDraftList } from "./SubtaskDraftList";
import { DueDatePick } from "@/components/board/card-modal/QuickPick";

interface Props {
  onClose: () => void;
  onCreate: (
    columnId: string,
    title: string,
    opts: {
      assigneeId: string | null;
      priority: string | null;
      dueDate: string | null;
      description: string | null;
      subtasks: string[];
    },
  ) => void;
  defaultColumnId?: string;
}

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {action}
      </div>
      {children}
    </div>
  );
}

export function CreateTaskModal({ onClose, onCreate, defaultColumnId }: Props) {
  const columns = useBoardStore((s) => s.columns);
  const boardMembers = useBoardStore((s) => s.boardMembers);
  const currentUserId = useBoardStore((s) => s.currentUserId);
  const todoColumns = columns.filter((c) => c.category !== "DONE");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [columnId, setColumnId] = useState(() => defaultColumnId ?? todoColumns[0]?.id ?? "");
  // Defaults to the creator; "unassigned" is always a deliberate click.
  const [assigneeId, setAssigneeId] = useState<string | null>(currentUserId);
  const [priority, setPriority] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");

  const canSubmit = title.trim().length > 0 && columnId !== "";
  const submit = () => {
    if (!canSubmit) return;
    onCreate(columnId, title.trim(), {
      assigneeId,
      priority,
      dueDate: dueDate || null,
      description: description.trim() || null,
      subtasks: subtasks.map((t) => t.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <ModalShell label="New Task" onClose={onClose}>
      <ModalHeader title="New Task" onClose={onClose} />

      <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
        <input
          autoFocus
          aria-label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Task title"
          className={`w-full ${FIELD_BOX} text-base font-medium`}
        />
        <textarea
          aria-label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="เพิ่มรายละเอียด (ไม่บังคับ)"
          rows={2}
          className={`w-full resize-none ${FIELD_INPUT}`}
        />

        <SubtaskDraftList items={subtasks} onChange={setSubtasks} />

        <div className="flex flex-col gap-4 pt-4 border-t border-slate-200">
          <Field label="Assignee">
            <AssigneeChips
              members={boardMembers}
              currentUserId={currentUserId}
              value={assigneeId}
              onChange={setAssigneeId}
            />
          </Field>

          <Field
            label="Due date"
            action={dueDate ? <ClearFieldButton field="due date" onClick={() => setDueDate("")} /> : null}
          >
            <DueDatePick value={dueDate} onChange={setDueDate} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Priority">
              <SegmentedControl
                label="Priority"
                options={PRIORITY_OPTIONS}
                value={priority}
                onChange={(p) => setPriority((cur) => (cur === p ? null : p))}
              />
            </Field>
            <Field label="Column">
              <select
                aria-label="Column"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className={`w-full ${FIELD_INPUT}`}
              >
                {todoColumns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      <ModalFooter>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onClose} className={BUTTON_OUTLINE}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit} className={BUTTON_PRIMARY}>
            Create Task
          </button>
        </div>
      </ModalFooter>
    </ModalShell>
  );
}
