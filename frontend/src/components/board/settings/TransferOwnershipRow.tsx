"use client";

import { useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError, apiClient, toastFailure } from "@/lib/apiClient";
import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import { fetchBoardMembers } from "@/hooks/useBoardMembers";
import { DangerRow } from "./DangerRow";
import { SelectField } from "./SettingsParts";

// Statuses TransferOwnership returns for these cases (member_handler.go).
const TRANSFER_ERRORS: Record<number, string> = {
  404: "ไม่พบสมาชิกคนนี้ในบอร์ดแล้ว",
  409: "สิทธิ์ Owner ถูกเปลี่ยนไปแล้ว",
};

export function TransferOwnershipRow({ boardId }: { boardId: string }) {
  const boardMembers = useBoardStore((s) => s.boardMembers);
  const setBoardMembers = useBoardStore((s) => s.setBoardMembers);
  const showToast = useToastStore((s) => s.show);
  const candidates = boardMembers.filter((m) => m.role !== "owner");
  const [targetId, setTargetId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const target = candidates.find((m) => m.user_id === targetId);

  const reloadMembers = async () => {
    try {
      setBoardMembers(await fetchBoardMembers(boardId));
    } catch (err) {
      toastFailure(err, "โหลดรายชื่อสมาชิกใหม่ไม่ได้ ลองรีเฟรชหน้า");
    }
  };

  const transfer = async () => {
    if (!target) return;
    setTransferring(true);
    try {
      await apiClient(`/boards/${boardId}/members/transfer-ownership`, {
        data: { user_id: target.user_id },
      });
      showToast({ message: `โอนสิทธิ์ Owner ให้ ${target.full_name} แล้ว — ตอนนี้คุณเป็น Manager`, duration: 5000 });
      await reloadMembers();
    } catch (err) {
      const stale = err instanceof ApiError ? TRANSFER_ERRORS[err.status] : undefined;
      toastFailure(err, stale ?? "โอนสิทธิ์ไม่สำเร็จ");
      // The list we picked from is out of date; show the current one.
      if (stale) {
        setTargetId("");
        await reloadMembers();
      }
    } finally {
      setTransferring(false);
    }
  };

  return (
    <>
      <DangerRow
        title="โอนสิทธิ์ Owner"
        help={
          candidates.length === 0
            ? "เชิญสมาชิกเข้า Project ก่อน จึงจะโอนสิทธิ์ได้"
            : "คนที่เลือกจะเป็น Owner คนใหม่ ส่วนคุณจะกลายเป็น Manager — ทำแล้วย้อนกลับเองไม่ได้"
        }
      >
        {candidates.length > 0 && (
          <div className="flex items-center gap-2">
            <SelectField
              value={targetId}
              options={[
                { value: "", label: "เลือกสมาชิก" },
                ...candidates.map((m) => ({ value: m.user_id, label: m.full_name })),
              ]}
              onChange={setTargetId}
              disabled={transferring}
              ariaLabel="new owner"
            />
            <button
              type="button"
              disabled={!target || transferring}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 text-[13.5px] font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {transferring ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
              Transfer
            </button>
          </div>
        )}
      </DangerRow>

      <ConfirmDialog
        open={confirmOpen}
        title={`โอนสิทธิ์ Owner ให้ ${target?.full_name ?? ""}?`}
        description="คุณจะกลายเป็น Manager และจะลบหรือ Stash Project นี้ไม่ได้อีก จนกว่า Owner คนใหม่จะโอนสิทธิ์กลับมา"
        confirmLabel="Transfer"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          transfer();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
