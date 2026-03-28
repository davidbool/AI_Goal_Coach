export const DEMO_SCENARIOS = [
  { id: "starter", label: "Clean Start", description: "Empty account, ready for onboarding." },
  { id: "active_goal_ready", label: "Active Goal", description: "Ready plan with tasks for today." },
  { id: "no_active_goal", label: "No Active Goal", description: "Goals exist, but nothing is active." },
  { id: "no_tasks_today", label: "No Tasks Today", description: "Active goal exists, but today is clear." }
];

export const GENERATION_SCENARIOS = [
  { id: "ready", label: "Ready" },
  { id: "delay", label: "Delay" },
  { id: "fail", label: "Fail" }
];

export const LEVEL_OPTIONS = [
  { id: "beginner", label: "Beginner" },
  { id: "novice", label: "Novice" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" }
];

export const GOAL_PROMPTS = [
  "Learn React by building 2 projects by 2026-10-01",
  "Run 5km 3 times per week by 2026-12-01",
  "Speak conversational Hebrew by practicing 25 minutes a day for 5 months"
];
