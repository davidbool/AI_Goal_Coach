import test from "node:test";
import assert from "node:assert/strict";
import { createMockStore } from "../src/mocks/inMemoryStore.js";
import { confirmMilestoneForActiveGoal } from "../src/modules/m4/milestoneService.js";

test("milestone confirmation sets status and timestamp", async () => {
  const store = createMockStore();
  const now = new Date("2026-03-26T12:30:00.000Z");

  const milestone = await confirmMilestoneForActiveGoal(store, "user-1", "ms-1", now);

  assert.equal(milestone.status, "confirmed");
  assert.equal(milestone.user_confirmed_at, now.toISOString());
});

test("milestone confirmation is idempotent for already-confirmed milestone", async () => {
  const store = createMockStore();
  const now = new Date("2026-03-26T12:30:00.000Z");

  await confirmMilestoneForActiveGoal(store, "user-1", "ms-1", now);
  const sameMilestone = await confirmMilestoneForActiveGoal(
    store,
    "user-1",
    "ms-1",
    new Date("2026-03-26T14:00:00.000Z")
  );

  assert.equal(sameMilestone.status, "confirmed");
  assert.equal(sameMilestone.user_confirmed_at, now.toISOString());
});
