import { useState, useEffect } from "react";
import type { BoardMember } from "@/types/board";
import { ApiError, apiClient, isHandledByApiClient, toastFailure } from "@/lib/apiClient";
import { useBoardStore } from "@/store/useBoardStore";

/** `message` is null when apiClient already told the user (403). */
export type AddMemberResult = { ok: true } | { ok: false; message: string | null };

// Statuses AddBoardMember returns for these cases (member_handler.go).
const ADD_MEMBER_ERRORS: Record<number, string> = {
  400: "อีเมลไม่ถูกต้อง",
  404: "ไม่พบผู้ใช้ที่มีอีเมลนี้",
  409: "ผู้ใช้นี้เป็นสมาชิกบอร์ดอยู่แล้ว",
};

const isGone = (err: unknown) => err instanceof ApiError && err.status === 404;

export async function fetchBoardMembers(boardId: string): Promise<BoardMember[]> {
  const rows = await apiClient<BoardMember[]>(`/boards/${boardId}/members`);
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

// Reads the board store, which BOARD_MEMBERS_UPDATED keeps live, so the page never lists someone already gone.
export function useBoardMembers(boardId: string) {
  const members = useBoardStore((s) => s.boardMembers);
  const setBoardMembers = useBoardStore((s) => s.setBoardMembers);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const update = (fn: (prev: BoardMember[]) => BoardMember[]) =>
    setBoardMembers(fn(useBoardStore.getState().boardMembers));
  const drop = (userId: string) => update((prev) => prev.filter((m) => m.user_id !== userId));

  useEffect(() => {
    let cancelled = false;
    fetchBoardMembers(boardId)
      .then((rows) => {
        if (!cancelled) setBoardMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, setBoardMembers]);

  const addMember = async (email: string, role: string): Promise<AddMemberResult> => {
    setIsAdding(true);
    try {
      await apiClient(`/boards/${boardId}/members`, { data: { email, role } });
    } catch (err) {
      setIsAdding(false);
      if (isHandledByApiClient(err)) return { ok: false, message: null };
      const known = err instanceof ApiError ? ADD_MEMBER_ERRORS[err.status] : undefined;
      return { ok: false, message: known ?? "เพิ่มสมาชิกไม่สำเร็จ" };
    }
    try {
      setBoardMembers(await fetchBoardMembers(boardId));
    } catch (err) {
      toastFailure(err, "เพิ่มสมาชิกแล้ว แต่โหลดรายชื่อใหม่ไม่ได้ ลองรีเฟรชหน้า");
    }
    setIsAdding(false);
    return { ok: true };
  };

  const removeMember = async (userId: string) => {
    setLoadingId(userId);
    try {
      await apiClient(`/boards/${boardId}/members/${userId}`, { method: "DELETE" });
      drop(userId);
    } catch (err) {
      // 404: someone else already removed them; the goal is met.
      if (isGone(err)) drop(userId);
      else toastFailure(err, "นำสมาชิกออกไม่สำเร็จ");
    } finally {
      setLoadingId(null);
    }
  };

  const changeRole = async (userId: string, role: string) => {
    setLoadingId(userId);
    try {
      await apiClient(`/boards/${boardId}/members/${userId}`, { method: "PATCH", data: { role } });
      update((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role: role as BoardMember["role"] } : m))
      );
    } catch (err) {
      if (isGone(err)) {
        drop(userId);
        toastFailure(err, "สมาชิกคนนี้ไม่ได้อยู่ใน Project แล้ว");
      } else {
        toastFailure(err, "เปลี่ยน role ไม่สำเร็จ");
      }
    } finally {
      setLoadingId(null);
    }
  };

  const leaveBoard = async () => {
    try {
      await apiClient(`/boards/${boardId}/members/me`, { method: "DELETE" });
      return true;
    } catch (err) {
      toastFailure(err, "ออกจาก Project ไม่สำเร็จ");
      return false;
    }
  };

  return {
    members,
    isLoading,
    isAdding,
    loadingId,
    loadFailed,
    addMember,
    removeMember,
    changeRole,
    leaveBoard,
  };
}
