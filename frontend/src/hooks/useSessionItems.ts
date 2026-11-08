// Mutations are optimistic fire-and-forget — see docs/CODE-NOTES.md "Planning".
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToastStore } from "@/store/useToastStore";
import { planningApi } from "@/lib/planningApi";
import { ApiError, isHandledByApiClient, toastFailure } from "@/lib/apiClient";
import type {
  PlanningItem,
  PlanningItemStatus,
  PlanningItemType,
  PlanningSessionDetail,
} from "@/types/planning";
import type { SessionStats } from "@/components/board/planning/SessionSidebar";

export interface UseSessionItemsResult {
  detail: PlanningSessionDetail | null;
  items: PlanningItem[];
  savedAt: string;
  stats: SessionStats;
  promotedItems: PlanningItem[];
  commitNew: (title: string, type: PlanningItemType) => Promise<void>;
  patchItem: (
    id: string,
    patch: Partial<PlanningItem>,
    optimistic: Partial<PlanningItem>,
  ) => void;
  toggleStatus: (item: PlanningItem, target: PlanningItemStatus) => void;
  changeType: (item: PlanningItem, t: PlanningItemType) => void;
  removeItem: (item: PlanningItem) => Promise<void>;
  promoteMany: (ids: string[]) => Promise<void>;
  promoteOne: (item: PlanningItem) => Promise<void>;
}

type PromoteOutcome = "sent" | keyof typeof PROMOTE_MESSAGES | "failed" | "stop";

// Our wording for the promote endpoint's error codes (planning_handler.go).
const PROMOTE_MESSAGES = {
  already: "Note นี้ส่งเข้า Board ไปแล้ว",
  dropped: "Note นี้ถูกพักไว้ เอากลับมาก่อนแล้วค่อยส่งเข้า Board",
  noTodoColumn: "บอร์ดยังไม่มีคอลัมน์ TODO เพิ่มคอลัมน์ก่อนแล้วค่อยส่งเข้า Board",
} as const;

function batchSummary(sent: number, skipped: number): string | null {
  const skippedNote = `ข้าม ${skipped} รายการที่พักไว้`;
  if (sent > 0) return `ส่งเข้า Board แล้ว ${sent} รายการ${skipped > 0 ? ` · ${skippedNote}` : ""}`;
  return skipped > 0 ? `${skippedNote} เอากลับมาก่อนแล้วค่อยส่ง` : null;
}

export function useSessionItems(
  boardId: string,
  sessionId: string,
): UseSessionItemsResult {
  const router = useRouter();
  const [detail, setDetail] = useState<PlanningSessionDetail | null>(null);
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [savedAt, setSavedAt] = useState<string>("");
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    let cancelled = false;
    planningApi
      .getSession(sessionId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setItems(d.items);
        setSavedAt(d.updated_at);
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof ApiError && err.status === 401)) return;
        toastFailure(err, "โหลดบันทึกไม่ได้");
        router.push(`/board/${boardId}/planning`);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, boardId, router, showToast]);

  // Same NOT IN exclusion as the backend summary, or counts drift.
  const stats = useMemo<SessionStats>(() => {
    const s: SessionStats = { REQ: 0, DEC: 0, Q: 0, dropped: 0, promoted: 0, selected: 0 };
    for (const it of items) {
      if (it.status === "dropped") s.dropped++;
      else if (it.status === "promoted") s.promoted++;
      else {
        s[it.type]++;
        if (it.status === "selected") s.selected++;
      }
    }
    return s;
  }, [items]);

  const promotedItems = useMemo(
    () => items.filter((it) => it.status === "promoted"),
    [items],
  );

  const patchItem = useCallback(
    (id: string, patch: Partial<PlanningItem>, optimistic: Partial<PlanningItem>) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...optimistic } : it)));
      setSavedAt(new Date().toISOString());
      planningApi
        .updateItem(id, {
          type: patch.type,
          title: patch.title,
          description: patch.description ?? undefined,
          status: patch.status,
          position: patch.position,
          implementation_note: patch.implementation_note ?? undefined,
        })
        .catch((err: unknown) => toastFailure(err, "บันทึกไม่สำเร็จ"));
    },
    [],
  );

  const commitNew = useCallback(
    async (title: string, type: PlanningItemType) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const tempId = `__pending_${Math.random().toString(36).slice(2)}`;
      const placeholder: PlanningItem = {
        id: tempId,
        session_id: sessionId,
        type,
        title: trimmed,
        description: null,
        status: "live",
        promoted_to_card_id: null,
        position: Number.MAX_SAFE_INTEGER,
        created_at: new Date().toISOString(),
      };
      setItems((prev) => [...prev, placeholder]);
      setSavedAt(placeholder.created_at);
      try {
        const real = await planningApi.createItem(sessionId, {
          type,
          title: trimmed,
        });
        setItems((prev) => prev.map((it) => (it.id === tempId ? real : it)));
      } catch (err) {
        setItems((prev) => prev.filter((it) => it.id !== tempId));
        toastFailure(err, "เพิ่มไม่ได้ ลองอีกครั้ง");
      }
    },
    [sessionId],
  );

  const toggleStatus = useCallback(
    (item: PlanningItem, target: PlanningItemStatus) => {
      const next: PlanningItemStatus = item.status === target ? "live" : target;
      patchItem(item.id, { status: next }, { status: next });
    },
    [patchItem],
  );

  const changeType = useCallback(
    (item: PlanningItem, t: PlanningItemType) => {
      if (item.type === t) return;
      // The one PATCH the backend can reject (promoted items are frozen) — revert by hand.
      const previous = item.type;
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, type: t } : it)));
      setSavedAt(new Date().toISOString());
      planningApi
        .updateItem(item.id, { type: t })
        .then(() => {
          showToast({ message: `เปลี่ยนเป็น ${t} แล้ว`, duration: 2500 });
        })
        .catch((err: unknown) => {
          setItems((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, type: previous } : it)),
          );
          toastFailure(
            err,
            err instanceof ApiError && err.status === 400
              ? "Note นี้ส่งเข้า Board แล้ว เปลี่ยนประเภทไม่ได้"
              : "เปลี่ยนประเภทไม่ได้",
          );
        });
    },
    [showToast],
  );

  const removeItem = useCallback(
    async (item: PlanningItem) => {
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      try {
        await planningApi.deleteItem(item.id);
      } catch (err) {
        setItems((prev) => [...prev, item]);
        toastFailure(err, "ลบไม่ได้ ลองอีกครั้ง");
      }
    },
    [],
  );

  const markStatus = useCallback((id: string, status: PlanningItemStatus) => {
    setItems((prev) => prev.map((cur) => (cur.id === id ? { ...cur, status } : cur)));
  }, []);

  const promoteOnce = useCallback(
    async (item: PlanningItem): Promise<PromoteOutcome> => {
      try {
        const res = await planningApi.promoteItem(item.id);
        setItems((prev) => prev.map((cur) => (cur.id === item.id ? res.item : cur)));
        return "sent";
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        if (code === "already_promoted") {
          markStatus(item.id, "promoted");
          return "already";
        }
        if (code === "item_dropped") {
          markStatus(item.id, "dropped");
          return "dropped";
        }
        if (code === "no_todo_column") return "noTodoColumn";
        toastFailure(err, `ส่งเข้า Board ไม่ได้: ${item.title}`);
        return isHandledByApiClient(err) ? "stop" : "failed";
      }
    },
    [markStatus],
  );

  const promoteOne = useCallback(
    async (item: PlanningItem) => {
      const outcome = await promoteOnce(item);
      if (outcome === "sent") showToast({ message: "ส่งเข้า Board แล้ว", duration: 2500 });
      else if (outcome in PROMOTE_MESSAGES) {
        showToast({ message: PROMOTE_MESSAGES[outcome as keyof typeof PROMOTE_MESSAGES], duration: 5000 });
      }
    },
    [promoteOnce, showToast],
  );

  const promoteMany = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const chosen = items.filter((it) => idSet.has(it.id) && it.status !== "promoted");
      const targets = chosen.filter((it) => it.status !== "dropped");
      if (chosen.length > 0 && targets.length === 0) {
        showToast({ message: "Note ที่เลือกถูกพักไว้ทั้งหมด เอากลับมาก่อนแล้วค่อยส่ง", duration: 4000 });
        return;
      }
      // Sequential to keep board card positions stable.
      let onBoard = 0;
      let skipped = chosen.length - targets.length;
      for (const it of targets) {
        const outcome = await promoteOnce(it);
        if (outcome === "sent" || outcome === "already") onBoard++;
        if (outcome === "dropped") skipped++;
        if (outcome === "noTodoColumn") {
          showToast({ message: PROMOTE_MESSAGES.noTodoColumn, duration: 5000 });
          break;
        }
        if (outcome === "stop") break;
      }
      const summary = batchSummary(onBoard, skipped);
      if (summary) showToast({ message: summary, duration: 3000 });
    },
    [items, promoteOnce, showToast],
  );

  return {
    detail,
    items,
    savedAt,
    stats,
    promotedItems,
    commitNew,
    patchItem,
    toggleStatus,
    changeType,
    removeItem,
    promoteMany,
    promoteOne,
  };
}
