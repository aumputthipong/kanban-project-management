import type { BoardMember, Card, Column } from "@/types/board";

export function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    column_id: "col-1",
    title: "Test Card",
    position: 65536,
    description: null,
    due_date: null,
    assignee_id: null,
    assignee_name: null,
    priority: null,
    estimated_hours: null,
    is_done: false,
    completed_at: null,
    created_at: null,
    created_by: null,
    total_subtasks: 0,
    completed_subtasks: 0,
    ...overrides,
  };
}

export function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: "col-1",
    title: "To Do",
    position: 65536,
    category: "TODO",
    color: null,
    cards: [],
    ...overrides,
  };
}

export function makeMember(overrides: Partial<BoardMember> = {}): BoardMember {
  return {
    id: "m-1",
    role: "member",
    user_id: "u-1",
    email: "u1@example.com",
    full_name: "User One",
    ...overrides,
  };
}
