"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { completeMyTask, fetchMyWork, snoozeCardDueDate } from "@/lib/myWorkApi";
import { isHandledByApiClient, toastFailure } from "@/lib/apiClient";
import { shiftCounts, shortTitle } from "@/lib/myWorkCounts";
import { useToastStore } from "@/store/useToastStore";
import type { MyWorkCard, MyWorkCounts, MyWorkGroup, MyWorkResponse } from "@/types/myWork";

// Delayed commit: a DONE move has no clean server-side undo.
const COMPLETE_UNDO_MS = 5000;

interface PendingCompletion {
  card: MyWorkCard;
  timer: ReturnType<typeof setTimeout>;
  committing: boolean;
}

interface UseMyWorkActionsArgs {
  data: MyWorkResponse | null;
  setData: Dispatch<SetStateAction<MyWorkResponse | null>>;
  setCounts: Dispatch<SetStateAction<MyWorkCounts | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

export function useMyWorkActions({ data, setData, setCounts, setError }: UseMyWorkActionsArgs) {
  const showToast = useToastStore((s) => s.show);

  // Session-local: the API has no "done today".
  const [doneToday, setDoneToday] = useState(0);
  // Kept until the commit settles, so a refetch can't resurrect the card.
  const pendingCompletions = useRef<Map<string, PendingCompletion>>(new Map());

  const reportFailure = useCallback(
    (err: unknown, message: string) => {
      if (!isHandledByApiClient(err)) setError(message);
    },
    [setError],
  );

  const filterPending = useCallback((cards: MyWorkCard[]) => {
    const pending = pendingCompletions.current;
    return pending.size > 0 ? cards.filter((c) => !pending.has(c.id)) : cards;
  }, []);

  const adjustCounts = useCallback(
    (group: MyWorkGroup, delta: number) => {
      setCounts((c) => (c ? shiftCounts(c, group, delta) : c));
    },
    [setCounts],
  );

  // The server still counts pending cards as open; take them out.
  const applyRefresh = useCallback(
    (res: MyWorkResponse) => {
      const pending = pendingCompletions.current;
      const hidden = res.cards.filter((c) => pending.has(c.id));
      setData({ ...res, cards: filterPending(res.cards) });
      setCounts(hidden.reduce((c, card) => shiftCounts(c, card.group, -1), res.counts));
    },
    [filterPending, setCounts, setData],
  );

  const refreshQuietly = useCallback(async () => {
    try {
      applyRefresh(await fetchMyWork({}));
    } catch {
      // The change is saved; the optimistic list stands until the next load.
    }
  }, [applyRefresh]);

  const restoreCard = useCallback(
    (card: MyWorkCard) => {
      setData((prev) => (prev ? { ...prev, cards: [...prev.cards, card] } : prev));
      adjustCounts(card.group, +1);
    },
    [adjustCounts, setData],
  );

  const commitComplete = useCallback(
    async (cardId: string) => {
      const entry = pendingCompletions.current.get(cardId);
      if (!entry || entry.committing) return;
      entry.committing = true;
      try {
        await completeMyTask(cardId);
        setError(null);
      } catch (err) {
        restoreCard(entry.card);
        if (entry.card.group === "today") setDoneToday((n) => Math.max(0, n - 1));
        reportFailure(err, "ทำเครื่องหมายเสร็จไม่สำเร็จ");
      } finally {
        pendingCompletions.current.delete(cardId);
      }
    },
    [reportFailure, restoreCard, setError],
  );

  const undoComplete = useCallback(
    (cardId: string) => {
      const entry = pendingCompletions.current.get(cardId);
      if (!entry || entry.committing) return;
      clearTimeout(entry.timer);
      pendingCompletions.current.delete(cardId);
      restoreCard(entry.card);
      if (entry.card.group === "today") setDoneToday((n) => Math.max(0, n - 1));
    },
    [restoreCard],
  );

  const handleComplete = useCallback(
    (cardId: string) => {
      if (!data || pendingCompletions.current.has(cardId)) return;
      const card = data.cards.find((c) => c.id === cardId);
      if (!card) return;

      setData({ ...data, cards: data.cards.filter((c) => c.id !== cardId) });
      adjustCounts(card.group, -1);
      if (card.group === "today") setDoneToday((n) => n + 1);

      const timer = setTimeout(() => void commitComplete(cardId), COMPLETE_UNDO_MS);
      pendingCompletions.current.set(cardId, { card, timer, committing: false });

      showToast({
        message: `ทำ "${shortTitle(card.title)}" เสร็จแล้ว`,
        actionLabel: "ย้อนกลับ",
        onAction: () => undoComplete(cardId),
        duration: COMPLETE_UNDO_MS,
      });
    },
    [data, adjustCounts, setData, showToast, commitComplete, undoComplete],
  );

  // The page is gone, so only a toast can report a failure.
  useEffect(() => {
    const pending = pendingCompletions.current;
    return () => {
      for (const [cardId, entry] of pending) {
        if (entry.committing) continue;
        clearTimeout(entry.timer);
        completeMyTask(cardId).catch((err) => toastFailure(err, "ทำเครื่องหมายเสร็จไม่สำเร็จ"));
      }
      pending.clear();
    };
  }, []);

  // "" clears the date on the backend — restores a card that had none.
  const undoSnooze = useCallback(
    async (cardId: string, originalDueDate: string) => {
      try {
        await snoozeCardDueDate(cardId, originalDueDate);
      } catch (err) {
        reportFailure(err, "ย้อนกลับไม่สำเร็จ");
        return;
      }
      setError(null);
      await refreshQuietly();
    },
    [refreshQuietly, reportFailure, setError],
  );

  const handleSnooze = useCallback(
    async (cardId: string, dueDate: string, label: string) => {
      const card = data?.cards.find((c) => c.id === cardId);
      if (!card) return;
      setData((prev) => (prev ? { ...prev, cards: prev.cards.filter((c) => c.id !== cardId) } : prev));
      adjustCounts(card.group, -1);
      try {
        await snoozeCardDueDate(cardId, dueDate);
      } catch (err) {
        restoreCard(card);
        reportFailure(err, "เลื่อนวันไม่สำเร็จ");
        return;
      }
      setError(null);
      showToast({
        message: `เลื่อนไป${label}แล้ว`,
        actionLabel: "ย้อนกลับ",
        onAction: () => undoSnooze(cardId, card.due_date ?? ""),
        duration: 5000,
      });
      await refreshQuietly();
    },
    [data, adjustCounts, refreshQuietly, reportFailure, restoreCard, setData, setError, showToast, undoSnooze],
  );

  return { doneToday, filterPending, handleComplete, handleSnooze };
}
