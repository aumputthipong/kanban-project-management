import type { PlanningItem, PlanningSessionDetail } from "@/types/planning";

export function buildMarkdown(
  session: PlanningSessionDetail,
  items: PlanningItem[],
  task: string,
  opts: { includeDropped: boolean; includeQuestions: boolean; includePromoted: boolean },
): string {
  const live = (t: PlanningItem["type"]) =>
    items.filter((it) => it.type === t && it.status !== "dropped");
  const reqs = live("REQ");
  const decs = live("DEC");
  const qs = items.filter((it) => it.type === "Q" && it.status !== "dropped");
  const dropped = items.filter((it) => it.status === "dropped");
  const promoted = items.filter((it) => it.status === "promoted");

  const lines: string[] = [];
  lines.push(`# ${session.title}`);
  if (session.label) lines.push(`**Label:** ${session.label}`);
  const when = session.meeting_at ?? session.created_at;
  lines.push(`**Date:** ${new Date(when).toLocaleString()}`);
  lines.push("");

  if (reqs.length > 0) {
    lines.push("## Requirements");
    reqs.forEach((r, i) => lines.push(`- REQ-${i + 1}: ${r.title}`));
    lines.push("");
  }
  if (decs.length > 0) {
    lines.push("## Decisions");
    decs.forEach((d, i) => lines.push(`- DEC-${i + 1}: ${d.title}`));
    lines.push("");
  }
  if (opts.includeQuestions && qs.length > 0) {
    lines.push("## Open questions");
    qs.forEach((q, i) => lines.push(`- Q-${i + 1}: ${q.title}`));
    lines.push("");
  }
  if (opts.includeDropped && dropped.length > 0) {
    lines.push("## Not doing");
    dropped.forEach((d) => lines.push(`- ~~${d.title}~~`));
    lines.push("");
  }
  if (opts.includePromoted && promoted.length > 0) {
    lines.push("## Already promoted to board");
    promoted.forEach((p) => lines.push(`- ${p.title}`));
    lines.push("");
  }

  lines.push("---");
  lines.push(`**Task:** ${task}`);
  return lines.join("\n");
}
