import { useState, useCallback, useRef } from "react";
import type { Card, Tag } from "@/types/board";
import { useBoardStore } from "@/store/useBoardStore";
import type { CardSaveHandler, FormState } from "../components/board/card-modal/CardDetailModal";

function buildInitialForm(card: Card): FormState {
  return {
    title: card.title,
    description: card.description ?? "",
    due_date: card.due_date ?? "",
    assignee_id: card.assignee_id ?? "",
    priority: card.priority ?? "",
    estimated_hours: card.estimated_hours != null ? String(card.estimated_hours) : "",
    tags: card.tags ?? [],
    acceptance_criteria: card.acceptance_criteria ?? "",
    implementation_note: card.implementation_note ?? "",
  };
}

function fieldEqual(field: keyof FormState, a: FormState, b: FormState): boolean {
  if (field === "tags") {
    const ai = a.tags.map((t) => t.id).sort().join(",");
    const bi = b.tags.map((t) => t.id).sort().join(",");
    return ai === bi;
  }
  return a[field] === b[field];
}

/** Remount with `key={card.id}` to switch cards. Commits send one field — docs/adr/0009. */
export function useCardForm(
  card: Card,
  onCommit?: (form: FormState, field: keyof FormState) => ReturnType<CardSaveHandler>,
) {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(card));

  // formRef: read by same-event commits. committedRef: skips no-op writes.
  const formRef = useRef(form);
  const committedRef = useRef(form);

  // The board store's list is kept live over WS, so a removed member leaves the picker at once.
  const members = useBoardStore((s) => s.boardMembers);
  const [error, setError] = useState<string | null>(null);

  const updateForm = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    const next = { ...formRef.current, [field]: value } as FormState;
    formRef.current = next;
    setForm(next);
  }, []);

  // Deps, not refs — refs may not be written during render (react-hooks/refs).
  const commitField = useCallback((field: keyof FormState) => {
    const cur = formRef.current;
    if (field === "title" && !cur.title.trim()) {
      const reverted = { ...cur, title: card.title };
      formRef.current = reverted;
      setForm(reverted);
      setError("Title cannot be empty.");
      return;
    }
    if (fieldEqual(field, cur, committedRef.current)) return;
    const previous = committedRef.current;
    committedRef.current = { ...previous, [field]: cur[field] };
    setError(null);
    onCommit?.(cur, field)?.then((saved) => {
      if (saved) return;
      // Leave anything the user typed or committed after this attempt.
      if (fieldEqual(field, committedRef.current, cur)) {
        committedRef.current = { ...committedRef.current, [field]: previous[field] };
      }
      if (fieldEqual(field, formRef.current, cur)) {
        const reverted = { ...formRef.current, [field]: previous[field] };
        formRef.current = reverted;
        setForm(reverted);
      }
    });
  }, [card.title, onCommit]);

  // Cached per field — a fresh closure per render defeats React.memo.
  type ChangeHandler = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  const handlersRef = useRef<Partial<Record<keyof FormState, ChangeHandler>>>({});
  const handleChange = useCallback((field: keyof FormState): ChangeHandler => {
    const cached = handlersRef.current[field];
    if (cached) return cached;
    const handler: ChangeHandler = (e) => updateForm(field, e.target.value);
    handlersRef.current[field] = handler;
    return handler;
  }, [updateForm]);

  const setTags = useCallback((tags: Tag[]) => {
    updateForm("tags", tags);
  }, [updateForm]);

  const assigneeName = members.find((m) => m.user_id === form.assignee_id)?.full_name;

  return {
    form,
    members,
    error,
    assigneeName,
    handleChange,
    setTags,
    commitField,
  };
}