import test from "node:test";
import assert from "node:assert/strict";
import { createMockStore } from "../src/mocks/inMemoryStore.js";
import {
  buildProgressScreenModel,
  getActiveGoalProgress,
  markTaskCompletedAndRefreshStreak
} from "../src/modules/m4/progressService.js";

test("progress payload includes streak, adherence, and milestones for progress screen", () => {
  const store = createMockStore();
  const now = new Date("2026-03-26T12:00:00.000Z");

  const progress = getActiveGoalProgress(store, "user-1", now);
  const screen = buildProgressScreenModel(progress);

  assert.equal(progress.streak.current_days, 2);
  assert.equal(progress.streak.longest_days, 2);
  assert.equal(progress.adherence.tasks_completed_7d, 2);
  assert.equal(progress.adherence.tasks_total_7d, 4);
  assert.equal(progress.milestones.length, 2);

  assert.equal(screen.header.title, "Progress");
  assert.equal(screen.streak.current_days, 2);
  assert.equal(screen.adherence.completion_rate_7d, 0.5);
});

test("streak updates when a new day task is completed", () => {
  const store = createMockStore();

  markTaskCompletedAndRefreshStreak(store, "task-3", new Date("2026-03-26T18:00:00.000Z"));
  const progress = getActiveGoalProgress(store, "user-1", new Date("2026-03-26T18:05:00.000Z"));

  assert.equal(progress.streak.current_days, 3);
  assert.equal(progress.streak.longest_days, 3);
  assert.equal(progress.streak.last_success_date, "2026-03-26");
});
