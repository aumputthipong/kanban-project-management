import type {
  Announcements,
  KeyboardCodes,
  ScreenReaderInstructions,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { useBoardStore } from "@/store/useBoardStore";

// Enter is left free on a resting card so it can open the card modal.
export const BOARD_KEYBOARD_CODES: KeyboardCodes = {
  start: ["Space"],
  cancel: ["Escape"],
  end: ["Space", "Enter"],
};

export const BOARD_SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "กด Enter เพื่อเปิดการ์ด หรือกด Space เพื่อหยิบการ์ด ใช้ลูกศรเพื่อย้าย แล้วกด Space อีกครั้งเพื่อวาง กด Esc เพื่อยกเลิก",
};

function cardTitle(id: UniqueIdentifier): string {
  const card = useBoardStore
    .getState()
    .columns.flatMap((c) => c.cards)
    .find((c) => c.id === id);
  return card ? `"${card.title}"` : "การ์ด";
}

function columnTitle(overId: UniqueIdentifier): string | null {
  const columns = useBoardStore.getState().columns;
  const column =
    columns.find((c) => c.id === overId) ??
    columns.find((c) => c.cards.some((card) => card.id === overId));
  return column?.title ?? null;
}

export const boardAnnouncements: Announcements = {
  onDragStart: ({ active }) =>
    `หยิบการ์ด ${cardTitle(active.id)} แล้ว ใช้ลูกศรเพื่อย้าย กด Space เพื่อวาง`,
  onDragOver: ({ active, over }) => {
    const target = over ? columnTitle(over.id) : null;
    return target
      ? `การ์ด ${cardTitle(active.id)} อยู่ที่คอลัมน์ ${target}`
      : `การ์ด ${cardTitle(active.id)} ไม่ได้อยู่บนคอลัมน์ใด`;
  },
  onDragEnd: ({ active, over }) => {
    const target = over ? columnTitle(over.id) : null;
    return target
      ? `วางการ์ด ${cardTitle(active.id)} ในคอลัมน์ ${target} แล้ว`
      : `วางการ์ด ${cardTitle(active.id)} แล้ว`;
  },
  onDragCancel: ({ active }) => `ยกเลิกการย้ายการ์ด ${cardTitle(active.id)}`,
};
