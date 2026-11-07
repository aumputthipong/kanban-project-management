import { useBoardStore } from "@/store/useBoardStore";
import { useToastStore } from "@/store/useToastStore";
import type { Card } from "@/types/board";

export const findCard = (id: string): Card | undefined =>
  useBoardStore.getState().columns.flatMap((c) => c.cards).find((c) => c.id === id);

export const columnOf = (cardId: string): string | undefined =>
  useBoardStore.getState().columns.find((c) => c.cards.some((card) => card.id === cardId))?.id;

export const toastMessages = () => useToastStore.getState().toasts.map((t) => t.message);
