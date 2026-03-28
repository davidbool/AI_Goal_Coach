import test from "node:test";
import assert from "node:assert/strict";
import { createMockStore } from "../src/mocks/inMemoryStore.js";
import { triggerFullAdaptation } from "../src/modules/m4/adaptationService.js";

test("full adaptation triggers /adapt and creates a new plan version", async () => {
  const store = createMockStore();
  const now = new Date("2026-03-26T13:00:00.000Z");

  const result = await triggerFullAdaptation(store, "user-1", now, "manual");

  assert.equal(result.endpoint, "/adapt");
  assert.equal(result.previous_plan_version, 1);
  assert.equal(result.new_plan_version, 2);
  assert.equal(store.state.plans.length, 2);
  assert.equal(store.state.adaptJobs.length, 1);

  const activeGoal = await store.getActiveGoal("user-1");
  assert.equal(activeGoal.active_plan_id, result.new_plan_id);
});
