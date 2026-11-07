"use client";

import { use, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/board/task-board/KanbanBoard";
import { useCardHighlightStore } from "@/store/useCardHighlightStore";
import { useBoardActions } from "@/hooks/useBoardActions";
import { Plus, X } from "lucide-react";
import { AssigneeFilterDropdown, MyTasksToggle } from "@/components/board/task-board/AssigneeFilter";
import { PriorityFilterDropdown } from "@/components/board/task-board/PriorityFilterDropdown";
import { TagFilterDropdown } from "@/components/board/task-board/TagFilterDropdown";
import { CreateTaskModal } from "@/components/board/task-board/CreateTaskModal";
import { ColumnOptionsModal } from "@/components/board/task-board/ColumnOptionsModal";
import { useCanManageBoard } from "@/hooks/useBoardRole";
import { useBoardStore } from "@/store/useBoardStore";
import { hasBoardFilters } from "@/lib/boardFilters";
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from "@/components/ui/Modal";

interface PageProps {
  params: Promise<{ boardId: string }>;
}


function AddColumnButton({
  onAdd,
}: {
  onAdd: (title: string, category: "TODO" | "DONE", color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`cursor-pointer bg-white ${BUTTON_OUTLINE}`}>
        <Plus size={14} /> Add column
      </button>
      {open && (
        <ColumnOptionsModal
          open
          mode="create"
          initialTitle=""
          initialCategory="TODO"
          initialColor={null}
          cardCount={0}
          onSave={onAdd}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ClearFiltersButton() {
  const filterAssigneeId = useBoardStore((s) => s.filterAssigneeId);
  const filterPriorities = useBoardStore((s) => s.filterPriorities);
  const filterTagIds = useBoardStore((s) => s.filterTagIds);
  const clearFilters = useBoardStore((s) => s.clearFilters);

  if (!hasBoardFilters({ assigneeId: filterAssigneeId, priorities: filterPriorities, tagIds: filterTagIds })) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={clearFilters}
      className="cursor-pointer inline-flex items-center gap-1 h-8 px-2 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
    >
      <X size={13} /> Clear filters
    </button>
  );
}

function BoardToolbar({ boardId }: { boardId: string }) {
  const { handleAddColumn, handleAddCard } = useBoardActions(boardId);
  const canManage = useCanManageBoard();
  const [creating, setCreating] = useState(false);

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-2.5 mb-6 flex flex-wrap items-center gap-2 min-h-14 bg-slate-50 border-b border-slate-200">
      <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2">
        <MyTasksToggle />
        <AssigneeFilterDropdown />
        <PriorityFilterDropdown />
        <TagFilterDropdown boardId={boardId} />
        <ClearFiltersButton />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {canManage && <AddColumnButton onAdd={handleAddColumn} />}
        <button type="button" onClick={() => setCreating(true)} className={`cursor-pointer ${BUTTON_PRIMARY}`}>
          <Plus size={15} /> New Task
        </button>
      </div>
      {creating && (
        <CreateTaskModal
          onClose={() => setCreating(false)}
          onCreate={(columnId, title, opts) => handleAddCard(columnId, title, opts)}
        />
      )}
    </div>
  );
}

export default function KanbanPage({ params }: PageProps) {
  const { boardId } = use(params);
  const setTarget = useCardHighlightStore((s) => s.setTarget);

  // Deep link from My Work (?card=<id>): highlight once, then strip the param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get("card");
    if (!cardId) return;
    setTarget(cardId);
    params.delete("card");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
  }, [setTarget]);

  return (
    <div className="animate-in fade-in duration-200 flex flex-col">
      <BoardToolbar boardId={boardId} />
      <KanbanBoard boardId={boardId} />
    </div>
  );
}
