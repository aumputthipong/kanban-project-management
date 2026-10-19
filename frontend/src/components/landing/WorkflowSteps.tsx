import { ArrowRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { getAvatarColor } from "@/utils/avatar";
import { MEMBER, OWNER } from "./demoBoard";

function ColumnsArt() {
  return (
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-12 w-8 rounded-md border border-slate-200 bg-white" />
      ))}
      <span className="h-12 w-8 rounded-md border-2 border-dashed border-primary/40 bg-surface-tint" />
    </div>
  );
}

function MoveArt() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-12 place-items-center rounded-md border border-slate-200 bg-white">
        <span className="h-1 w-6 rounded-full bg-slate-200" />
      </span>
      <ArrowRight size={16} className="text-primary" />
      <span className="grid h-9 w-12 place-items-center rounded-md border border-primary bg-surface-tint">
        <span className="h-1 w-6 rounded-full bg-primary" />
      </span>
    </div>
  );
}

function TeamArt() {
  return (
    <div className="flex items-center -space-x-2">
      {[OWNER, MEMBER].map((name) => (
        <span
          key={name}
          className={`grid size-9 place-items-center rounded-full text-sm font-bold text-white ring-2 ring-slate-50 ${getAvatarColor(name)}`}
        >
          {name.charAt(0)}
        </span>
      ))}
      <span className="grid size-9 place-items-center rounded-full border-2 border-dashed border-primary/40 bg-surface-tint text-primary">
        <Plus size={14} />
      </span>
    </div>
  );
}

const STEPS: { title: string; body: string; art: ReactNode }[] = [
  {
    title: "Set up your project",
    body: "เริ่มจาก To Do, In Progress, Review และ Done แล้วเพิ่มหรือเปลี่ยนชื่อคอลัมน์ให้ตรงกับวิธีทำงานของทีม",
    art: <ColumnsArt />,
  },
  {
    title: "Move tasks together, live",
    body: "ย้าย Task ข้ามคอลัมน์ กำหนดคนรับผิดชอบ priority และวันครบกำหนด ทุกการเปลี่ยนแปลงขึ้นบนจอของเพื่อนร่วมทีมทันที",
    art: <MoveArt />,
  },
  {
    title: "Invite your team",
    body: "ส่งลิงก์เชิญให้เพื่อนร่วมทีม แล้วกำหนดบทบาท Owner, Manager หรือ Member ให้แต่ละคนในแต่ละ Project",
    art: <TeamArt />,
  },
];

export function WorkflowSteps() {
  return (
    <section lang="th" className="px-6 md:px-12 py-20 md:py-24">
      <div className="max-w-5xl mx-auto">
        <h2 lang="en" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-8">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="grid gap-6 border-t border-slate-200 py-10 md:grid-cols-12 md:items-center md:gap-12"
            >
              <div className="flex gap-3 md:col-span-8">
                <span aria-hidden className="w-4 shrink-0 text-xl font-semibold leading-7 tabular-nums text-slate-400">
                  {i + 1}
                </span>
                <div>
                  <h3 lang="en" className="text-xl font-semibold leading-7 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-prose text-base leading-relaxed text-slate-600">{step.body}</p>
                </div>
              </div>
              <div
                aria-hidden
                className="ml-7 md:ml-0 grid h-24 md:h-28 place-items-center rounded-2xl border border-slate-200 bg-slate-50 md:col-span-4"
              >
                {step.art}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
