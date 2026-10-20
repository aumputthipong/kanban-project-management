"use client";

import { useMemo, useState } from "react";
import { Clipboard, Check as CheckIcon } from "lucide-react";
import { useToastStore } from "@/store/useToastStore";
import type { PlanningItem, PlanningSessionDetail } from "@/types/planning";
import { BUTTON_OUTLINE, BUTTON_PRIMARY, ModalFooter, ModalHeader, ModalShell } from "@/components/ui/Modal";
import { FIELD_INPUT, FieldLabel } from "@/components/board/card-modal/modalParts";
import { buildMarkdown } from "./exportMarkdown";

interface Props {
  session: PlanningSessionDetail;
  items: PlanningItem[];
  onClose: () => void;
}

const DEFAULT_TASK_KEY = "planning.exportTask";
const PRESETS: { label: string; prompt: string }[] = [
  {
    label: "Prototype this",
    prompt:
      "Generate a 1-page interactive HTML prototype focused on the requirements above. Use minimal styling. Surface open questions as TODO comments so we can decide later.",
  },
  {
    label: "Implementation plan",
    prompt:
      "Break each requirement into 1–3 implementation tasks with estimated effort (S/M/L). Flag risks tied to the open questions.",
  },
  {
    label: "Test cases",
    prompt:
      "Generate acceptance criteria for each requirement. Include happy path, edge case, and error case for each.",
  },
  {
    label: "Stakeholder summary",
    prompt:
      "Summarise the requirements and decisions in 5 bullet points for a non-technical stakeholder. End with the open questions as a list of things we need them to decide.",
  },
];

export function ExportDialog({ session, items, onClose }: Props) {
  const [task, setTask] = useState<string>(() => {
    if (typeof window === "undefined") return PRESETS[0].prompt;
    return localStorage.getItem(DEFAULT_TASK_KEY) ?? PRESETS[0].prompt;
  });
  const [includeDropped, setIncludeDropped] = useState(true);
  const [includeQuestions, setIncludeQuestions] = useState(true);
  const [includePromoted, setIncludePromoted] = useState(false);
  const [copied, setCopied] = useState(false);
  const showToast = useToastStore((s) => s.show);

  const markdown = useMemo(
    () =>
      buildMarkdown(session, items, task, {
        includeDropped,
        includeQuestions,
        includePromoted,
      }),
    [session, items, task, includeDropped, includeQuestions, includePromoted],
  );

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      if (typeof window !== "undefined") {
        localStorage.setItem(DEFAULT_TASK_KEY, task);
      }
      setCopied(true);
      showToast({ message: "คัดลอกแล้ว — ไปวางใน AI tool ได้เลย", duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({
        message: "คัดลอกอัตโนมัติไม่ได้ ลองเลือกข้อความแล้ว Ctrl+C เอง",
        duration: 4000,
      });
    }
  };

  return (
    <ModalShell label="Export" onClose={onClose} className="max-w-2xl">
      <ModalHeader title="Export" onClose={onClose} />

      <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto overscroll-contain">
        <p className="text-sm text-slate-600">
          ปรับโจทย์ด้านล่างให้ตรงกับงาน แล้วกด Copy ไปวางใน AI tool
          (Claude / ChatGPT / Cursor) ระบบจะจำโจทย์ล่าสุดไว้ให้
        </p>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={task === p.prompt}
              onClick={() => setTask(p.prompt)}
              className={`h-7 px-3 rounded-full border text-xs font-medium transition-colors ${
                task === p.prompt
                  ? "bg-surface-tint border-transparent text-primary"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-2">
          <FieldLabel>Prompt</FieldLabel>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={3}
            className={`${FIELD_INPUT} resize-y`}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2">
            <FieldLabel>Include</FieldLabel>
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-900">
            <Check label="คำถามค้าง" checked={includeQuestions} onChange={setIncludeQuestions} />
            <Check label={`ที่พักไว้ (ใส่เป็น "ไม่ทำ")`} checked={includeDropped} onChange={setIncludeDropped} />
            <Check label="ที่ส่งเข้า Board แล้ว" checked={includePromoted} onChange={setIncludePromoted} />
          </div>
        </fieldset>

        <pre className="max-h-72 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-900 whitespace-pre-wrap">
          {markdown}
        </pre>
      </div>

      <ModalFooter>
        <button type="button" onClick={onClose} className={`ml-auto ${BUTTON_OUTLINE}`}>
          Close
        </button>
        <button type="button" onClick={copyToClipboard} className={BUTTON_PRIMARY}>
          {copied ? <CheckIcon size={14} /> : <Clipboard size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary"
      />
      {label}
    </label>
  );
}
