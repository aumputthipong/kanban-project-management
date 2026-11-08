"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, HelpCircle, Plus } from "lucide-react";
import { planningApi } from "@/lib/planningApi";
import { ApiError, toastFailure } from "@/lib/apiClient";
import type { PlanningSessionSummary } from "@/types/planning";
import { SessionRow } from "./SessionRow";
import {
  EmptyState,
  ListSkeleton,
  LoadFailedState,
  StatPill,
  loadFailureOf,
  type LoadFailure,
} from "./SessionListParts";

interface Props {
  boardId: string;
}

export function SessionListView({ boardId }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<PlanningSessionSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);

  useEffect(() => {
    let cancelled = false;
    planningApi
      .listSessions(boardId)
      .then((rows) => {
        if (cancelled) return;
        setLoadFailure(null);
        setSessions(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadFailure(loadFailureOf(err instanceof ApiError ? err.status : undefined));
        setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const createSession = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const sess = await planningApi.createSession(boardId, {
        title: defaultSessionTitle(),
      });
      router.push(`/board/${boardId}/planning/${sess.id}`);
    } catch (err) {
      toastFailure(err, "สร้างบันทึกใหม่ไม่ได้");
      setCreating(false);
    }
  }, [boardId, creating, router]);

  const handleRename = async (id: string, title: string) => {
    const prevTitle = sessions?.find((s) => s.id === id)?.title ?? "";
    if (title === prevTitle) return;
    setSessions((cur) =>
      cur ? cur.map((s) => (s.id === id ? { ...s, title } : s)) : cur,
    );
    try {
      await planningApi.updateSession(id, { title });
    } catch (err) {
      toastFailure(err, "เปลี่ยนชื่อบันทึกไม่สำเร็จ");
      setSessions((cur) =>
        cur ? cur.map((s) => (s.id === id ? { ...s, title: prevTitle } : s)) : cur,
      );
    }
  };

  if (sessions === null) {
    return <ListSkeleton />;
  }

  const openQuestions = sessions.reduce((sum, s) => sum + s.q_count, 0);
  const promoted = sessions.reduce((sum, s) => sum + s.promoted_count, 0);

  const grouped = groupSessions(sessions);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Planning
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            บันทึกไอเดียที่คุย แล้วเลือกไปทำต่อบน Board ได้ทันที
          </p>
        </div>
        <button
          type="button"
          onClick={createSession}
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          <Plus size={14} />
          New Note
        </button>
      </div>

      {loadFailure ? (
        <LoadFailedState reason={loadFailure} />
      ) : sessions.length === 0 ? (
        <EmptyState onCreate={createSession} creating={creating} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <StatPill icon={<FileText size={14} />}>
              <strong className="font-bold text-slate-800">
                {sessions.length}
              </strong>{" "}
              Notes
            </StatPill>
            <StatPill
              icon={<HelpCircle size={14} />}
              variant={openQuestions > 0 ? "alert" : "neutral"}
            >
              <strong className="font-bold">{openQuestions}</strong> คำถามค้าง ·
              รอตอบ
            </StatPill>
            <StatPill icon={<ArrowRight size={14} />} variant="ok">
              <strong className="font-bold">{promoted}</strong> ส่งเข้า Board แล้ว
            </StatPill>
          </div>

          {grouped.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              <div className="flex flex-col gap-2">
                {group.sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    boardId={boardId}
                    session={s}
                    onRename={handleRename}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// Keep in sync with SessionRow.isAutoTitle.
function defaultSessionTitle() {
  const d = new Date();
  return `Note ${d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function groupSessions(sessions: PlanningSessionSummary[]) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const buckets: Record<string, PlanningSessionSummary[]> = {
    สัปดาห์นี้: [],
    เดือนนี้: [],
    ก่อนหน้า: [],
  };

  for (const s of sessions) {
    const when = new Date(s.meeting_at ?? s.updated_at);
    if (when >= weekAgo) buckets["สัปดาห์นี้"].push(s);
    else if (when >= monthStart) buckets["เดือนนี้"].push(s);
    else buckets["ก่อนหน้า"].push(s);
  }

  return Object.entries(buckets)
    .filter(([, v]) => v.length > 0)
    .map(([label, ss]) => ({ label, sessions: ss }));
}
