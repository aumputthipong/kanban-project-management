import { describe, it, expect } from "vitest";
import {
  activityCategory,
  activityNodeKind,
  describeActivity,
  eventBadge,
} from "@/components/board/overview/activityFormat";
import { Pencil } from "lucide-react";
import type { Activity } from "@/types/activity";

// Mirrors the AGENTS.md "Activity event types" table; add a row here with every new event.
const EVENT_TYPES = [
  "card.created",
  "card.moved",
  "card.updated",
  "card.deleted",
  "card.done_toggled",
  "card.subtasks_completed",
  "column.created",
  "column.deleted",
  "column.renamed",
  "member.added",
  "member.removed",
  "member.left",
  "member.role_changed",
  "planning.session_created",
  "planning.session_updated",
  "planning.session_deleted",
  "planning.item_created",
  "planning.item_updated",
  "planning.item_deleted",
  "planning.item_promoted",
  "planning.comment_created",
  "planning.comment_edited",
  "planning.comment_deleted",
  "planning.item_claimed",
  "planning.item_released",
  "planning.claim_auto_released_on_promote",
] as const;

function activity(event_type: string, payload: Record<string, unknown> = {}): Activity {
  return {
    id: "a-1", board_id: "b-1", actor_id: "u-1", actor_name: "Alice",
    event_type, entity_type: "card", entity_id: null, payload,
    created_at: "2026-09-17T10:00:00Z",
  };
}

describe("activity feed event coverage", () => {
  it.each(EVENT_TYPES)("describeActivity renders %s as prose, not the raw event type", (type) => {
    const { action } = describeActivity(activity(type, { title: "Thing" }), new Map());
    expect(action).not.toBe(type);
    expect(action).not.toMatch(/^\w+\.\w+/);
  });

  it.each(EVENT_TYPES)("eventBadge gives %s a dedicated badge, not the fallback", (type) => {
    const { Icon, bg } = eventBadge(type, {});
    expect(Icon === Pencil && bg === "bg-slate-400").toBe(false);
  });

  // The feed's node icon and its "สร้าง / ลบ" filter must read planning's "_created" like card's ".created".
  it.each([
    ["card.created", "create"],
    ["planning.session_created", "create"],
    ["planning.comment_created", "create"],
    ["column.deleted", "delete"],
    ["planning.item_deleted", "delete"],
    ["planning.session_deleted", "delete"],
    ["card.moved", "move"],
    ["planning.item_promoted", "move"],
    ["planning.session_updated", "edit"],
  ] as const)("shows %s as a %s node", (type, kind) => {
    expect(activityNodeKind(type)).toBe(kind);
  });

  it.each([
    "planning.session_created", "planning.item_deleted", "planning.comment_deleted", "card.created", "member.left",
  ])("files %s under create / remove", (type) => {
    expect(activityCategory(type)).toBe("addremove");
  });

  it("falls through to the raw string for an unknown type", () => {
    expect(describeActivity(activity("planning.foo_bar"), new Map()).action).toBe("planning.foo_bar");
  });
});
