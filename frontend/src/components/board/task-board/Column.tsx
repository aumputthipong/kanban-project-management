"use client";

import { memo, useState, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { ColumnHeader } from "./ColumnHeader";
import { CollapsedColumnStrip } from "./CollapsedColumnStrip";
import { ColumnEmptyHint } from "./ColumnEmptyHint";
import { CreateTaskModal } from "./CreateTaskModal";
import type { Card, Column } from "@/types/board";
import { FormState } from "../card-modal/CardDetailModal";
import {
  ColumnOptionsModal,
  getColumnColorHex,
  columnAccentColor,
  columnBarColor,
} from "./ColumnOptionsModal";
import { useCanManageBoard } from "@/hooks/useBoardRole";
import { useColumnCollapsed } from "@/hooks/useColumnCollapsed";
import { hasBoardFilters, matchesBoardFilters } from "@/lib/boardFilters";

interface ColumnProps {
  id: string;
  title: string;
  category: Column["category"];
  color?: string | null;
  boardId: string;
  cards: Card[];
  onAddCard: (
    columnId: string,
    title: string,
    opts?: {
      assigneeId: string | null;
      priority: string | null;
      dueDate: string | null;
      description?: string | null;
      subtasks?: string[];
    },
  ) => void;
  onDeleteCard: (cardId: string) => void;
  onSaveCard: (cardId: string, form: FormState, field: keyof FormState) => void;
  onDeleteColumn: (columnId: string) => void;
  onUpdateColumn: (
    columnId: string,
    title: string,
    category: "TODO" | "DONE",
    color: string | null,
  ) => void;
  filterAssigneeId?: string | null;
  filterPriorities?: string[];
  filterTagIds?: string[];
  dropIndicatorBeforeId?: string | null;
}

const DropIndicator = () => (
  <div className="h-0.5 bg-primary rounded-full mx-1 my-0.5" />
);

export const KanbanColumn = memo(function KanbanColumn({
  id,
  boardId,
  title,
  category,
  color,
  cards,
  onAddCard,
  onDeleteCard,
  onSaveCard,
  onDeleteColumn,
  onUpdateColumn,
  filterAssigneeId,
  filterPriorities,
  filterTagIds,
  dropIndicatorBeforeId,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [topAddOpen, setTopAddOpen] = useState(false);
  const canManage = useCanManageBoard();

  const isDone = category === "DONE";
  const [collapsed, setCollapsedPersisted] = useColumnCollapsed(boardId, id);

  const filters = useMemo(
    () => ({ assigneeId: filterAssigneeId, priorities: filterPriorities, tagIds: filterTagIds }),
    [filterAssigneeId, filterPriorities, filterTagIds],
  );
  const visibleCards = useMemo(
    () => cards.filter((card) => matchesBoardFilters(card, filters)),
    [cards, filters],
  );
  const filtered = hasBoardFilters(filters);

  // Bar formula lives in ColumnOptionsModal so its preview matches.
  const barColor = columnBarColor(
    columnAccentColor(getColumnColorHex(color), isDone),
  );

  return (
    <>
      {isDone && collapsed ? (
        <CollapsedColumnStrip
          dropRef={setNodeRef}
          title={title}
          count={cards.length}
          barColor={barColor}
          isOver={isOver}
          onExpand={() => setCollapsedPersisted(false)}
        />
      ) : (
        <div
          ref={setNodeRef}
          className="w-72 shrink-0 flex flex-col snap-start rounded-xl bg-slate-100 transition-shadow duration-200"
          style={isOver ? { boxShadow: `inset 0 0 0 2px ${barColor}` } : undefined}
        >
          <ColumnHeader
            title={title}
            barColor={barColor}
            isDone={isDone}
            total={cards.length}
            shown={filtered ? visibleCards.length : null}
            onAdd={() => setTopAddOpen(true)}
            onCollapse={() => setCollapsedPersisted(true)}
            onOptions={canManage ? () => setOptionsOpen(true) : null}
          />

          <SortableContext
            items={cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="px-2.5 pt-2.5 pb-4 flex flex-col gap-2 flex-1">
              {visibleCards.map((card) => (
                <div key={card.id}>
                  {dropIndicatorBeforeId === card.id && <DropIndicator />}
                  <TaskCard
                    boardId={boardId}
                    card={card}
                    onDeleteCard={onDeleteCard}
                    onSaveCard={onSaveCard}
                  />
                </div>
              ))}
              {dropIndicatorBeforeId === null && <DropIndicator />}
              {visibleCards.length === 0 && !isOver && (
                <ColumnEmptyHint
                  isDone={isDone}
                  filtered={filtered && cards.length > 0}
                  onAdd={() => setTopAddOpen(true)}
                />
              )}
            </div>
          </SortableContext>
        </div>
      )}

      {topAddOpen && (
        <CreateTaskModal
          defaultColumnId={id}
          onCreate={onAddCard}
          onClose={() => setTopAddOpen(false)}
        />
      )}

      {/* `key` remounts per column so state starts fresh. */}
      <ColumnOptionsModal
        key={`${id}-${optionsOpen}`}
        open={optionsOpen}
        initialTitle={title}
        initialCategory={category}
        initialColor={color ?? null}
        cardCount={cards.length}
        onSave={(t, cat, col) => onUpdateColumn(id, t, cat, col)}
        onDelete={() => onDeleteColumn(id)}
        onClose={() => setOptionsOpen(false)}
      />
    </>
  );
});
