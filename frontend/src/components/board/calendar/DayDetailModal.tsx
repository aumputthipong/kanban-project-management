"use client";

import { format } from "date-fns";
import type { Card } from "@/types/board";
import { ModalHeader, ModalShell } from "@/components/ui/Modal";
import { TaskPill } from "./TaskPill";

interface DayDetailModalProps {
  date: Date;
  cards: Card[];
  onSelect: (card: Card) => void;
  onClose: () => void;
}

export function DayDetailModal({ date, cards, onSelect, onClose }: DayDetailModalProps) {
  const title = format(date, "EEEE, d MMMM yyyy");

  return (
    <ModalShell label={title} onClose={onClose} className="max-w-md">
      <ModalHeader title={title} onClose={onClose} />
      <div className="flex flex-col gap-3 px-6 py-5 overflow-y-auto overscroll-contain">
        <p className="text-xs font-medium text-slate-600">
          {cards.length} task{cards.length === 1 ? "" : "s"}
        </p>
        <div className="flex flex-col gap-1.5">
          {cards.map((card) => (
            <TaskPill key={card.id} card={card} onSelect={onSelect} inPopover />
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
