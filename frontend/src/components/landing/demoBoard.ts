// Mirrors the demo sandbox fixture (backend/internal/service/demo_fixture.go).
export const OWNER = "Demo Visitor";
export const MEMBER = "Team Member";
export const DEMO_BOARD = { title: "Product Launch", color: "#2563EB" };

export interface DemoTask {
  title: string;
  priority: "high" | "medium" | "low";
  dueInDays: number | null;
  assignee: string | null;
}

export const DEMO_COLUMNS: { title: string; tasks: DemoTask[] }[] = [
  {
    title: "To Do",
    tasks: [
      { title: "Design onboarding flow", priority: "high", dueInDays: 2, assignee: OWNER },
      { title: "Write API documentation", priority: "medium", dueInDays: 5, assignee: MEMBER },
      { title: "Set up product analytics", priority: "low", dueInDays: null, assignee: null },
    ],
  },
  {
    title: "In Progress",
    tasks: [
      { title: "Build auth service", priority: "high", dueInDays: 0, assignee: OWNER },
      { title: "Realtime WebSocket sync", priority: "high", dueInDays: 1, assignee: OWNER },
    ],
  },
  {
    title: "Done",
    tasks: [
      { title: "Project scaffolding", priority: "medium", dueInDays: null, assignee: OWNER },
      { title: "CI pipeline", priority: "medium", dueInDays: null, assignee: OWNER },
    ],
  },
];
