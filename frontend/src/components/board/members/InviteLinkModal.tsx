"use client";

import { useEffect, useState } from "react";
import { Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { inviteApi, type InviteLink } from "@/lib/inviteApi";
import { useToastStore } from "@/store/useToastStore";
import { BUTTON_PRIMARY, ModalHeader, ModalShell } from "@/components/ui/Modal";
import { FIELD_INPUT } from "@/components/board/card-modal/modalParts";

export function InviteLinkModal({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const showToast = useToastStore((s) => s.show);
  const [link, setLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await inviteApi.getActive(boardId);
        const l = existing ?? (await inviteApi.create(boardId));
        if (!cancelled) setLink(l);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const fullUrl =
    link && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${link.token}`
      : "";

  const regenerate = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setLink(await inviteApi.create(boardId));
    } catch {
      showToast({ message: "สร้างลิงก์ใหม่ไม่สำเร็จ", duration: 4000 });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast({ message: "คัดลอกไม่สำเร็จ", duration: 3000 });
    }
  };

  const expiryLabel = link
    ? new Date(link.expires_at).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <ModalShell label="Invite link" onClose={onClose} className="max-w-md">
      <ModalHeader title="Invite link" onClose={onClose} />

      <div className="px-6 py-5">
        <p className="mb-3 text-sm text-slate-600">
          ใครมีลิงก์นี้และล็อกอินอยู่ จะเข้าร่วม Project เป็นสมาชิกได้
        </p>

        {loading ? (
          <Skeleton className="h-10 rounded-md" />
        ) : failed ? (
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />}
            โหลดลิงก์ไม่สำเร็จ · ลองใหม่
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                aria-label="Invite link"
                value={fullUrl}
                onFocus={(e) => e.currentTarget.select()}
                className={`min-w-0 flex-1 ${FIELD_INPUT} text-slate-600`}
              />
              <button type="button" onClick={copy} className={`shrink-0 ${BUTTON_PRIMARY}`}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
              <span>ลิงก์หมดอายุ {expiryLabel}</span>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={regenerate}
                disabled={busy}
                className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-primary disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                New link
              </button>
            </p>
          </>
        )}
      </div>
    </ModalShell>
  );
}
