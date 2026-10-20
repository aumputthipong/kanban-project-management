import type { ReactNode } from "react";
import { BoardBackground } from "@/components/board/task-board/BoardBackground";
import { ColumnsArt, MoveArt, TeamArt } from "./StepArt";

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
                className="relative ml-7 md:ml-0 grid h-40 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 select-none md:col-span-4"
              >
                <BoardBackground />
                <div className="relative">{step.art}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
