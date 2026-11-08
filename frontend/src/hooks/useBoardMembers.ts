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

export async function fetchBoardMembers(boardId: string): Promise<BoardMember[]> {
  const rows = await apiClient<BoardMember[]>(`/boards/${boardId}/members`);
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

export function useBoardMembers(boardId: string) {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const setBoardMembers = useBoardStore((s) => s.setBoardMembers);

  // The store feeds role checks, assignee pickers and transfer targets.
  const applyToBoth = (fn: (prev: BoardMember[]) => BoardMember[]) => {
    setMembers(fn);
    setBoardMembers(fn(useBoardStore.getState().boardMembers));
  };

  useEffect(() => {
    let cancelled = false;
    fetchBoardMembers(boardId)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
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
  }, [boardId]);

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
      const fresh = await fetchBoardMembers(boardId);
      applyToBoth(() => fresh);
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
      applyToBoth((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      toastFailure(err, "นำสมาชิกออกไม่สำเร็จ");
    } finally {
      setLoadingId(null);
    }
  };

  const changeRole = async (userId: string, role: string) => {
    setLoadingId(userId);
    try {
      await apiClient(`/boards/${boardId}/members/${userId}`, { method: "PATCH", data: { role } });
      applyToBoth((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role: role as BoardMember["role"] } : m))
      );
    } catch (err) {
      toastFailure(err, "เปลี่ยน role ไม่สำเร็จ");
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
