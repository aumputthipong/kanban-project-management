"use client";
import { useEffect } from "react";
import { apiClient } from "@/lib/apiClient";
import type { Activity } from "@/types/activity";
import { useActivityStore } from "@/store/useActivityStore";

export function useActivityFeed(boardId: string | undefined, limit = 30) {
  const activities = useActivityStore((s) => s.activities);
  const loading = useActivityStore((s) => s.loading);
  const error = useActivityStore((s) => s.error);

  useEffect(() => {
    if (!boardId) return;
    const store = useActivityStore.getState();
    store.reset();
    store.setLoading(true);

    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient<Activity[]>(`/boards/${boardId}/activities?limit=${limit}`);
        if (cancelled) return;
        useActivityStore.getState().setActivities(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        useActivityStore.getState().setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) useActivityStore.getState().setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [boardId, limit]);

  return { activities, loading, error };
}
