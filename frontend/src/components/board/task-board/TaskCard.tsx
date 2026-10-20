"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { Check } from "lucide-react";
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
import { CardMetaRow, CardTags, SubtaskBar } from "./TaskCardParts";

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
        className={`group relative px-3 py-2.5 rounded-lg border flex flex-col gap-2 transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          isDragging
            ? "opacity-0 pointer-events-none"
            : card.is_done
              ? "bg-emerald-50 border-emerald-200 cursor-pointer active:cursor-grabbing hover:border-emerald-300"
              : "bg-white border-slate-200 cursor-pointer active:cursor-grabbing hover:border-slate-400"
        } ${isHighlighted ? "ring-2 ring-primary border-primary" : ""}`}
      >
        {/* Done = check icon, never strikethrough (design.md) */}
        <div className="flex items-start gap-1.5">
          {card.is_done && (
            <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-emerald-700 text-white grid place-items-center">
              <Check size={10} strokeWidth={3} />
            </span>
          )}
          <p
            className={`text-sm font-medium leading-snug line-clamp-2 ${
              card.is_done ? "text-emerald-900" : "text-slate-900"
            }`}
          >
            {card.title}
          </p>
        </div>

        {card.tags && card.tags.length > 0 && <CardTags tags={card.tags} />}
        {totalSubtasks > 0 && <SubtaskBar done={completedSubtasks} total={totalSubtasks} />}
        <CardMetaRow card={card} />
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
