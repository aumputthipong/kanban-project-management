"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import {
  AlarmClock,
  Calendar,
  Check,
  Clock,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useCardHighlightStore } from "@/store/useCardHighlightStore";
import type { Card } from "@/types/board";
import type { FormState } from "../card-modal/CardDetailModal";

const CardDetailModal = dynamic(
  () =>
    import("../card-modal/CardDetailModal").then((m) => ({
      default: m.CardDetailModal,
    })),
  { ssr: false },
);
import { useBoardActions } from "@/hooks/useBoardActions";
import { useCanEdit } from "@/hooks/useCanEdit";
import { CSS } from "@dnd-kit/utilities";
import { cardDueLabel, formatThaiDate } from "@/utils/date_helper";
import { getAvatarColor } from "@/utils/avatar";
import { PriorityBadge } from "@/components/board/task-board/PriorityBadge";
import { TagChip } from "@/components/board/task-board/TagChip";
import { MetaChip } from "@/components/board/card-modal/modalParts";

interface CardProps {
  card: Card;
  boardId: string;
  onDeleteCard: (cardId: string) => void;
  onSaveCard: (cardId: string, form: FormState, field: keyof FormState) => void;
}

export const TaskCard = memo(function TaskCard({
  card,
  boardId,
  onDeleteCard,
  onSaveCard,
}: CardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Deep-link target: scroll into view, ring briefly, then clear.
  const isHighlighted = useCardHighlightStore((s) => s.targetId === card.id);
  const clearHighlight = useCardHighlightStore((s) => s.setTarget);
  useEffect(() => {
    if (!isHighlighted) return;
    document
      .getElementById(`board-card-${card.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const t = setTimeout(() => clearHighlight(null), 2800);
    return () => clearTimeout(t);
  }, [isHighlighted, card.id, clearHighlight]);

  const { handleAddSubtask } = useBoardActions(boardId);
  const canEdit = useCanEdit(card);

  const totalSubtasks = card.total_subtasks ?? 0;
  const completedSubtasks = card.completed_subtasks ?? 0;
  const due = card.due_date ? cardDueLabel(card.due_date, card.is_done) : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { currentColumnId: card.column_id },
    attributes: { roleDescription: "การ์ด" },
  });

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(e);
    if (isDragging || e.defaultPrevented) return;
    if (e.key === "Enter") {
      e.preventDefault();
      setIsDetailOpen(true);
    }
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <div
        id={`board-card-${card.id}`}
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onKeyDown={onKeyDown}
        onClick={() => setIsDetailOpen(true)}
        className={`group relative p-4 rounded-xl border flex flex-col gap-3 transition-all duration-300 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          isDragging
            ? "opacity-0 pointer-events-none"
            : card.is_done
              ? "bg-emerald-50 border-emerald-200 shadow-sm cursor-pointer active:cursor-grabbing hover:border-emerald-300"
              : "bg-white border-slate-200 shadow-sm cursor-pointer active:cursor-grabbing hover:shadow-md hover:border-slate-300"
        } ${isHighlighted ? "ring-2 ring-primary border-primary shadow-md" : "ring-0"}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {card.tags.slice(0, 3).map((tag) => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
                {card.tags.length > 3 && (
                  <span className="text-xs font-medium text-slate-500">
                    +{card.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Done = check icon, never strikethrough (design.md) */}
            <div className="flex items-start gap-1.5">
              {card.is_done && (
                <span className="mt-px shrink-0 w-[18px] h-[18px] rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
              <p
                className={`text-sm font-semibold leading-snug transition-all line-clamp-2 ${
                  card.is_done ? "text-emerald-900" : "text-slate-900"
                }`}
              >
                {card.title}
              </p>
            </div>
          </div>
        </div>

        {totalSubtasks > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-1 overflow-hidden">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  completedSubtasks === totalSubtasks
                    ? "bg-emerald-700"
                    : "bg-blue-700"
                }`}
                style={{
                  width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%`,
                }}
              />
            </div>
            <span
              className={`text-xs font-medium tabular-nums ${
                completedSubtasks === totalSubtasks
                  ? "text-emerald-700"
                  : "text-slate-500"
              }`}
            >
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {due && (
              <MetaChip
                strong
                overdue={due.tone === "overdue"}
                title={formatThaiDate(card.due_date!)}
              >
                {due.tone === "overdue" ? <AlarmClock size={12} /> : <Calendar size={12} />}
                {due.text}
              </MetaChip>
            )}
            {card.priority && !card.is_done && (
              <PriorityBadge priority={card.priority} />
            )}
            {card.estimated_hours ? (
              <MetaChip>
                <Clock size={12} />
                {card.estimated_hours} h
              </MetaChip>
            ) : null}
          </div>

          {card.assignee_name && card.assignee_id ? (
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${getAvatarColor(card.assignee_id)}`}
              title={card.assignee_name}
            >
              {card.assignee_name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div
              className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0"
              title="Unassigned"
            >
              <UserRound size={12} className="text-slate-300" />
            </div>
          )}
        </div>
      </div>

      {isDetailOpen && (
        <CardDetailModal
          key={card.id}
          card={card}
          boardId={boardId}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onUpdated={onSaveCard}
          onDelete={(cardId) => {
            onDeleteCard(cardId);
            setIsDetailOpen(false);
          }}
          onAddSubtask={handleAddSubtask}
          canEdit={canEdit}
        />
      )}
    </>
  );
});
