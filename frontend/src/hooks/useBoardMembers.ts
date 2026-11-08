import { useState, useEffect } from "react";
import type { BoardMember } from "@/types/board";
import { ApiError, apiClient, isHandledByApiClient, toastFailure } from "@/lib/apiClient";
import { useBoardStore } from "@/store/useBoardStore";

/** `null` on success; `""` when apiClient already told the user; else the reason to show. */
export type AddMemberResult = string | null;

// Statuses AddBoardMember returns for these cases (member_handler.go).
const ADD_MEMBER_ERRORS: Record<number, string> = {
  404: "ไม่พบผู้ใช้ที่มีอีเมลนี้",
  409: "ผู้ใช้นี้เป็นสมาชิกบอร์ดอยู่แล้ว",
};

const clean = (rows: unknown): BoardMember[] =>
  Array.isArray(rows) ? (rows as BoardMember[]).filter(Boolean) : [];

export function useBoardMembers(boardId: string) {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const setBoardMembers = useBoardStore((s) => s.setBoardMembers);

  useEffect(() => {
    let cancelled = false;
    apiClient(`/boards/${boardId}/members`)
      .then((rows) => {
        if (!cancelled) setMembers(clean(rows));
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
      const fresh = clean(await apiClient(`/boards/${boardId}/members`));
      setMembers(fresh);
      setBoardMembers(fresh);
      return null;
    } catch (err) {
      if (isHandledByApiClient(err)) return "";
      return (err instanceof ApiError && ADD_MEMBER_ERRORS[err.status]) || "เพิ่มสมาชิกไม่สำเร็จ";
    } finally {
      setIsAdding(false);
    }
  };

  const removeMember = async (userId: string) => {
    setLoadingId(userId);
    try {
      await apiClient(`/boards/${boardId}/members/${userId}`, { method: "DELETE" });
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
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
      setMembers((prev) =>
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
