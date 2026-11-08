// Lazy: nothing loads until load(). See docs/ARCHITECTURE.md "Planning section".
import { useCallback, useEffect, useRef, useState } from "react";
import { planningApi } from "@/lib/planningApi";
import { toastFailure } from "@/lib/apiClient";
import type { PlanningComment } from "@/types/planning";

interface State {
  comments: PlanningComment[];
  isLoading: boolean;
  loaded: boolean;
}

const tempId = () => `__pending_${Math.random().toString(36).slice(2)}`;
const INITIAL: State = { comments: [], isLoading: false, loaded: false };

export function usePlanningComments(itemId: string, currentUserId: string | null) {
  const [state, setState] = useState<State>(INITIAL);
  // Mirrors state synchronously so callbacks stay stable and never read a stale render.
  const stateRef = useRef<State>(INITIAL);
  // Bumped by every load and every settled write; a load answering under an older value is stale.
  const generation = useRef(0);

  const update = useCallback((fn: (prev: State) => State) => {
    stateRef.current = fn(stateRef.current);
    setState(stateRef.current);
  }, []);

  const mapComment = useCallback(
    (id: string, fn: (c: PlanningComment) => PlanningComment) =>
      update((prev) => ({ ...prev, comments: prev.comments.map((c) => (c.id === id ? fn(c) : c)) })),
    [update],
  );

  const load = useCallback(async () => {
    const gen = ++generation.current;
    update((prev) => ({ ...prev, isLoading: true }));
    try {
      const rows = await planningApi.listComments(itemId);
      if (generation.current !== gen) {
        update((prev) => ({ ...prev, isLoading: false }));
        return;
      }
      update(() => ({ comments: rows, isLoading: false, loaded: true }));
    } catch (err) {
      update((prev) => ({ ...prev, isLoading: false }));
      if (generation.current === gen) toastFailure(err, "โหลดความคิดเห็นไม่ได้ ลองอีกครั้ง");
    }
  }, [itemId, update]);

  // Refetch on tab focus instead of polling.
  useEffect(() => {
    if (!state.loaded) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [state.loaded, load]);

  const create = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const placeholderId = tempId();
      const now = new Date().toISOString();
      const placeholder: PlanningComment = {
        id: placeholderId,
        item_id: itemId,
        author_id: currentUserId ?? "",
        author_name: "",
        body: trimmed,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      update((prev) => ({ ...prev, comments: [...prev.comments, placeholder] }));
      try {
        const real = await planningApi.createComment(itemId, trimmed);
        generation.current++;
        // A reload may already list it, or may have dropped the placeholder.
        update((prev) => {
          if (prev.comments.some((c) => c.id === real.id)) {
            return { ...prev, comments: prev.comments.filter((c) => c.id !== placeholderId) };
          }
          const hasPlaceholder = prev.comments.some((c) => c.id === placeholderId);
          return {
            ...prev,
            comments: hasPlaceholder
              ? prev.comments.map((c) => (c.id === placeholderId ? real : c))
              : [...prev.comments, real],
          };
        });
      } catch (err) {
        update((prev) => ({
          ...prev,
          comments: prev.comments.filter((c) => c.id !== placeholderId),
        }));
        toastFailure(err, "ส่งความคิดเห็นไม่สำเร็จ");
      }
    },
    [itemId, currentUserId, update],
  );

  const edit = useCallback(
    async (commentId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const previous = stateRef.current.comments.find((c) => c.id === commentId);
      mapComment(commentId, (c) => ({ ...c, body: trimmed, updated_at: new Date().toISOString() }));
      try {
        const updated = await planningApi.editComment(commentId, trimmed);
        generation.current++;
        mapComment(commentId, () => updated);
      } catch (err) {
        if (previous) mapComment(commentId, () => previous);
        toastFailure(err, "แก้ไม่สำเร็จ");
      }
    },
    [mapComment],
  );

  const remove = useCallback(
    async (commentId: string) => {
      const previous = stateRef.current.comments.find((c) => c.id === commentId);
      mapComment(commentId, (c) => ({ ...c, body: null, deleted_at: new Date().toISOString() }));
      try {
        await planningApi.deleteComment(commentId);
        generation.current++;
      } catch (err) {
        if (previous) mapComment(commentId, () => previous);
        toastFailure(err, "ลบไม่สำเร็จ");
      }
    },
    [mapComment],
  );

  return {
    comments: state.comments,
    isLoading: state.isLoading,
    loaded: state.loaded,
    load,
    create,
    edit,
    remove,
  };
}
