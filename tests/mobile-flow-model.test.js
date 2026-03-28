import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyComposer,
  createEmptySnapshot,
  createGenerationComposerState,
  getDashboardPresentation,
  getFlowSurface,
  getGenerationStateContent,
  normalizeBootstrap,
  syncComposerWithPlanStatus
} from "../mobile/src/features/coachFlow/model.js";

test("flow surface uses the intake flow before falling back to the dashboard", () => {
  const snapshot = {
    ...createEmptySnapshot(),
    activeGoal: { id: "goal-1" }
  };
  const composer = {
    ...createEmptyComposer(),
    stage: "intake"
  };

  assert.equal(getFlowSurface(snapshot, composer), "goal_studio");

  const idleComposer = createEmptyComposer();
  assert.equal(getFlowSurface(snapshot, idleComposer), "dashboard");
});

test("bootstrap normalization keeps dashboard fields contract-safe", () => {
  const normalized = normalizeBootstrap({
    user: { id: "user-1" },
    local_date_key: "2026-03-28",
    goals: [{ id: "goal-1" }],
    active_goal: { id: "goal-1" },
    today: { tasks: [] },
    progress: { goal_id: "goal-1" }
  });

  assert.equal(normalized.user.id, "user-1");
  assert.equal(normalized.localDateKey, "2026-03-28");
  assert.equal(normalized.activeGoal.id, "goal-1");
  assert.equal(normalized.today.tasks.length, 0);
  assert.equal(normalized.progress.goal_id, "goal-1");
});

test("generation state copy normalizes delayed messaging for the first UI pass", () => {
  const delayed = getGenerationStateContent("delayed");
  const failed = getGenerationStateContent("failed");

  assert.equal(delayed.title, "Still building your plan");
  assert.match(delayed.detailCopy, /delayed state/i);
  assert.equal(failed.title, "We hit a snag building this draft.");
  assert.match(failed.heroCopy, /saved/i);
});

test("dashboard presentation distinguishes missing task payloads from rest days", () => {
  const waiting = getDashboardPresentation({
    localDateKey: "2026-03-28",
    today: null
  });
  const clearDay = getDashboardPresentation({
    localDateKey: "2026-03-28",
    today: { tasks: [] }
  });
  const activeDay = getDashboardPresentation({
    localDateKey: "2026-03-28",
    today: { tasks: [{ id: "task-1" }] }
  });

  assert.equal(waiting.state, "bootstrap_pending");
  assert.equal(clearDay.state, "no_tasks_today");
  assert.equal(activeDay.state, "tasks_ready");
  assert.match(clearDay.heroCopy, /intentionally clear/i);
  assert.match(activeDay.heroCopy, /Focus on the next few actions/i);
});

test("composer plan status helpers keep the flow transitions deterministic", () => {
  const baseComposer = {
    ...createEmptyComposer(),
    stage: "assessment",
    goalId: "goal-1",
    title: "Learn React"
  };

  const generating = createGenerationComposerState(baseComposer, "goal-1", "generating");
  const ready = syncComposerWithPlanStatus(generating, {
    plan_state: "ready",
    plan: { version: 1 }
  });
  const failed = syncComposerWithPlanStatus(generating, {
    plan_state: "failed"
  });

  assert.equal(generating.stage, "generating");
  assert.deepEqual(generating.timeline, ["generating"]);
  assert.equal(ready.stage, "plan_ready");
  assert.equal(ready.plan.version, 1);
  assert.equal(failed.stage, "generation_failed");
});
