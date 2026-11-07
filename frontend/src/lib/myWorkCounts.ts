import type { MyWorkCounts, MyWorkGroup } from "@/types/myWork";

const GROUP_TO_COUNT: Record<MyWorkGroup, keyof Omit<MyWorkCounts, "total">> = {
  overdue: "overdue",
  today: "today",
  this_week: "this_week",
  later: "later",
  no_date: "no_date",
};

export function shiftCounts(c: MyWorkCounts, group: MyWorkGroup, delta: number): MyWorkCounts {
  const key = GROUP_TO_COUNT[group];
  return { ...c, [key]: Math.max(0, c[key] + delta), total: Math.max(0, c.total + delta) };
}

export function shortTitle(title: string, max = 40): string {
  const t = title.trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}
