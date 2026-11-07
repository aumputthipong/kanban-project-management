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

export function usePlanningComments(itemId: string, currentUserId: string | null) {
  const [state, setState] = useState<State>({ comments: [], isLoading: false, loaded: false });
  // ref, not state — a render-triggering flag here would cascade.
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++requestRef.current;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const rows = await planningApi.listComments(itemId);
      if (requestRef.current !== reqId) return;
      setState({ comments: rows, isLoading: false, loaded: true });
    } catch (err) {
      if (requestRef.current !== reqId) return;
      setState((prev) => ({ ...prev, isLoading: false }));
      toastFailure(err, "โหลดความคิดเห็นไม่ได้ ลองอีกครั้ง");
    }
  }, [itemId]);

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

  const restore = useCallback((previous: PlanningComment | undefined) => {
    if (!previous) return;
    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((c) => (c.id === previous.id ? previous : c)),
    }));
  }, []);

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
      setState((prev) => ({ ...prev, comments: [...prev.comments, placeholder] }));
      try {
        const real = await planningApi.createComment(itemId, trimmed);
        // A reload may have replaced the list (and the placeholder) meanwhile.
        setState((prev) => {
          const rest = prev.comments.filter((c) => c.id !== placeholderId && c.id !== real.id);
          const at = prev.comments.findIndex((c) => c.id === placeholderId);
          const comments = [...rest];
          comments.splice(at < 0 ? rest.length : at, 0, real);
          return { ...prev, comments };
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          comments: prev.comments.filter((c) => c.id !== placeholderId),
        }));
        toastFailure(err, "ส่งความคิดเห็นไม่สำเร็จ");
      }
    },
    [itemId, currentUserId],
  );

  const edit = useCallback(
    async (commentId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const previous = state.comments.find((c) => c.id === commentId);
      setState((prev) => ({
        ...prev,
        comments: prev.comments.map((c) =>
          c.id === commentId ? { ...c, body: trimmed, updated_at: new Date().toISOString() } : c,
        ),
      }));
      try {
        const updated = await planningApi.editComment(commentId, trimmed);
        setState((prev) => ({
          ...prev,
          comments: prev.comments.map((c) => (c.id === commentId ? updated : c)),
        }));
      } catch (err) {
        restore(previous);
        toastFailure(err, "แก้ไม่สำเร็จ");
      }
    },
    [state.comments, restore],
  );

  const remove = useCallback(
    async (commentId: string) => {
      const previous = state.comments.find((c) => c.id === commentId);
      setState((prev) => ({
        ...prev,
        comments: prev.comments.map((c) =>
          c.id === commentId ? { ...c, body: null, deleted_at: new Date().toISOString() } : c,
        ),
      }));
      try {
        await planningApi.deleteComment(commentId);
      } catch (err) {
        restore(previous);
        toastFailure(err, "ลบไม่สำเร็จ");
      }
    },
    [state.comments, restore],
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
