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

type PromoteOutcome =
  | { kind: "sent" }
  | { kind: "already" | "refused"; message: string }
  | { kind: "failed" | "stop" };

const THAI = /[\u0E00-\u0E7F]/;
const thaiOr = (message: string, fallback: string) => (THAI.test(message) ? message : fallback);

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

  // 409 = already on the board; 422 = the server's actionable reason (planning_handler.go).
  const promoteOnce = useCallback(
    async (item: PlanningItem): Promise<PromoteOutcome> => {
      try {
        const res = await planningApi.promoteItem(item.id);
        setItems((prev) => prev.map((cur) => (cur.id === item.id ? res.item : cur)));
        return { kind: "sent" };
      } catch (err) {
        const fallback = `ส่งเข้า Board ไม่ได้: ${item.title}`;
        if (err instanceof ApiError && err.status === 409) {
          setItems((prev) =>
            prev.map((cur) => (cur.id === item.id ? { ...cur, status: "promoted" } : cur)),
          );
          return { kind: "already", message: thaiOr(err.message, "Note นี้ส่งเข้า Board ไปแล้ว") };
        }
        if (err instanceof ApiError && err.status === 422) {
          return { kind: "refused", message: thaiOr(err.message, fallback) };
        }
        toastFailure(err, fallback);
        return { kind: isHandledByApiClient(err) ? "stop" : "failed" };
      }
    },
    [],
  );

  const promoteOne = useCallback(
    async (item: PlanningItem) => {
      const outcome = await promoteOnce(item);
      if (outcome.kind === "sent") showToast({ message: "ส่งเข้า Board แล้ว", duration: 2500 });
      if (outcome.kind === "already" || outcome.kind === "refused") {
        showToast({ message: outcome.message, duration: 5000 });
      }
    },
    [promoteOnce, showToast],
  );

  const promoteMany = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const chosen = items.filter((it) => idSet.has(it.id) && it.status !== "promoted");
      const targets = chosen.filter((it) => it.status !== "dropped");
      const skipped = chosen.length - targets.length;
      if (targets.length === 0) {
        if (skipped > 0) {
          showToast({ message: "Note ที่เลือกถูกพักไว้ทั้งหมด เอากลับมาก่อนแล้วค่อยส่ง", duration: 4000 });
        }
        return;
      }
      // Sequential to keep board card positions stable.
      let onBoard = 0;
      let lastRefusal: string | null = null;
      for (const it of targets) {
        const outcome = await promoteOnce(it);
        if (outcome.kind === "sent" || outcome.kind === "already") onBoard++;
        if (outcome.kind === "stop") break;
        if (outcome.kind === "refused") {
          // The same reason twice in a row is board-wide (no TODO column), not per Note.
          if (outcome.message === lastRefusal) break;
          showToast({ message: outcome.message, duration: 5000 });
          lastRefusal = outcome.message;
        }
      }
      if (onBoard > 0) {
        const skippedNote = skipped > 0 ? ` · ข้าม ${skipped} รายการที่พักไว้` : "";
        showToast({ message: `ส่งเข้า Board แล้ว ${onBoard} รายการ${skippedNote}`, duration: 3000 });
      }
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
