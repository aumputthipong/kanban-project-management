import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBoardStore } from "@/store/useBoardStore";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { makeCard, makeColumn } from "@/test/factories";
import {
  cardDueLabel,
  daysOverdue,
  formatRelativeDueDate,
  formatThaiDate,
  formatThaiShortDate,
  getDaysRemainingText,
  getOverdueText,
  parseDueDate,
} from "@/utils/date_helper";

// A zone behind UTC is where date-only strings parsed as UTC land on the previous day.
const originalTZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Los_Angeles";
});
afterAll(() => {
  process.env.TZ = originalTZ;
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 18, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("date-only due dates in a zone behind UTC", () => {
  it("counts days overdue from the local calendar day", () => {
    expect(daysOverdue("2026-11-18")).toBe(0);
    expect(daysOverdue("2026-11-17")).toBe(1);
    expect(getOverdueText("2026-11-17")).toBe("Overdue by 1 day");
  });

  it("labels a card due today as today, not late", () => {
    expect(cardDueLabel("2026-11-18", false)).toEqual({ text: "วันนี้", tone: "today" });
  });

  it("labels tomorrow as tomorrow", () => {
    expect(formatRelativeDueDate("2026-11-19")).toBe("Tomorrow");
    expect(getDaysRemainingText("2026-11-19")).toBe("Due tomorrow");
  });

  it("formats the stored day, not the day before", () => {
    expect(formatThaiDate("2026-11-20")).toContain("20");
    expect(formatThaiShortDate("2026-11-20")).toContain("20");
  });

  it("buckets dashboard cards by the local day", () => {
    useBoardStore.setState({
      columns: [
        makeColumn({
          id: "todo",
          cards: [
            makeCard({ id: "today", column_id: "todo", due_date: "2026-11-18" }),
            makeCard({ id: "tomorrow", column_id: "todo", due_date: "2026-11-19" }),
          ],
        }),
      ],
    });
    const stats = renderHook(() => useDashboardStats()).result.current;
    expect(stats.overdueCards.map((c) => c.id)).toEqual([]);
    expect(stats.todayCards.map((c) => c.id)).toEqual(["today"]);
    expect(stats.tomorrowCards.map((c) => c.id)).toEqual(["tomorrow"]);
  });

  it("rejects a rolled-over date instead of shifting it", () => {
    expect(Number.isNaN(parseDueDate("2026-02-30").getTime())).toBe(true);
    expect(daysOverdue("2026-02-30")).toBe(0);
    expect(getOverdueText("2026-02-30")).toBe("");
    expect(getDaysRemainingText("2026-02-30")).toBe("");
    expect(cardDueLabel("2026-02-30", false)).toBeNull();
  });
});
