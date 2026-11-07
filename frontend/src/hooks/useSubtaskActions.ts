import { useCallback } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import { apiClient, ApiError, toastFailure } from "@/lib/apiClient";
import type { Subtask } from "@/types/board";

const loadSubtasks = async (cardId: string) => {
  const data = await apiClient<Subtask[]>(`/cards/${cardId}/subtasks`);
  useBoardStore.getState().setSubtasksToCard(cardId, data);
};

// The caller already toasted its own failure; one message is enough.
const resyncQuietly = (cardId: string) => loadSubtasks(cardId).catch(() => {});

export function useSubtaskActions() {
  // Stable identity — consumers put this in effect deps.
  const fetchSubtasks = useCallback(async (cardId: string) => {
    try {
      await loadSubtasks(cardId);
    } catch (err) {
      toastFailure(err, "โหลด subtask ไม่สำเร็จ");
    }
  }, []);

  const handleAddSubtask = async (cardId: string, title: string) => {
    try {
      const newSubtask = await apiClient<Subtask>(`/cards/${cardId}/subtasks`, {
        method: "POST",
        data: { title },
      });

      // Re-read after the await: the broadcast may already carry it.
      const { columns, setSubtasksToCard } = useBoardStore.getState();
      const card = columns.flatMap((c) => c.cards).find((c) => c.id === cardId);
      const list = card?.subtasks ?? [];
      if (card && !list.some((st) => st.id === newSubtask.id)) {
        setSubtasksToCard(cardId, [...list, newSubtask]);
      }
    } catch (err) {
      toastFailure(err, "เพิ่ม subtask ไม่สำเร็จ");
    }
  };

  const handleToggleSubtask = async (
    cardId: string,
    subtaskId: string,
    currentStatus: boolean,
  ) => {
    const newStatus = !currentStatus;
    useBoardStore.getState().updateSubtaskInCard(cardId, subtaskId, { is_done: newStatus });

    try {
      await apiClient(`/cards/${cardId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        data: { is_done: newStatus },
      });
    } catch (err) {
      useBoardStore.getState().updateSubtaskInCard(cardId, subtaskId, { is_done: currentStatus });
      // A boolean can't tell our tick from a teammate's; ask the server.
      resyncQuietly(cardId);
      toastFailure(err, "อัปเดต subtask ไม่สำเร็จ");
    }
  };

  const handleDeleteSubtask = (cardId: string, subtaskId: string) => {
    const store = useBoardStore.getState();
    const card = store.columns
      .flatMap((c) => c.cards)
      .find((c) => c.id === cardId);
    const removed = card?.subtasks?.find((st) => st.id === subtaskId);
    if (!removed) return;

    store.deleteSubtaskFromCard(cardId, subtaskId);

    let undone = false;
    const toastId = useToastStore.getState().show({
      message: `Subtask "${removed.title}" deleted`,
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        undone = true;
        fetchSubtasks(cardId);
      },
    });

    setTimeout(async () => {
      if (undone) return;
      try {
        await apiClient(`/cards/${cardId}/subtasks/${subtaskId}`, { method: "DELETE" });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return;
        useToastStore.getState().dismiss(toastId);
        resyncQuietly(cardId);
        toastFailure(err, "ลบ subtask ไม่สำเร็จ");
      }
    }, 5000);
  };

  const handleUpdateSubtaskTitle = async (
    cardId: string,
    subtaskId: string,
    newTitle: string,
  ) => {
    if (!newTitle.trim()) return;
    useBoardStore.getState().updateSubtaskInCard(cardId, subtaskId, { title: newTitle.trim() });

    try {
      await apiClient(`/cards/${cardId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        data: { title: newTitle.trim() },
      });
    } catch (err) {
      resyncQuietly(cardId);
      toastFailure(err, "เปลี่ยนชื่อ subtask ไม่สำเร็จ");
    }
  };

  return {
    fetchSubtasks,
    handleAddSubtask,
    handleToggleSubtask,
    handleDeleteSubtask,
    handleUpdateSubtaskTitle,
  };
}
