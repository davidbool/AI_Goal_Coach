import test from "node:test";
import assert from "node:assert/strict";
import { triggerFullAdaptation } from "../src/modules/m4/adaptationService.js";

function createMockStore() {
  const state = {
    user: { id: "user-1", timezone: "Asia/Jerusalem" },
    users: [{ id: "user-1", timezone: "Asia/Jerusalem" }],
    goals: [{ id: "goal-1", user_id: "user-1", active_plan_id: "plan-1" }],
    plans: [{ id: "plan-1", goal_id: "goal-1", version: 1, status: "active" }],
    tasks: [
      { id: "task-1", plan_id: "plan-1", goal_id: "goal-1", scheduled_date: "2026-03-25", manual_lock: false, required: true },
      { id: "task-2", plan_id: "plan-1", goal_id: "goal-1", scheduled_date: "2026-03-26", manual_lock: false, required: true },
      { id: "task-3", plan_id: "plan-1", goal_id: "goal-1", scheduled_date: "2026-03-30", manual_lock: true, required: true }
    ],
    adaptJobs: []
  };

  return {
    state,
    getUser(userId) {
      return state.users.find((user) => user.id === userId) ?? null;
    },
    getActiveGoal(userId) {
      return state.goals.find((goal) => goal.user_id === userId) ?? null;
    },
    getActivePlan(goalId) {
      const goal = state.goals.find((item) => item.id === goalId);

      if (goal) {
        return state.plans.find((plan) => plan.id === goal.active_plan_id) ?? null;
      }

      return null;
    },
    createAdaptJob(goalId, userId, planId, planVersion, now) {
      const job = {
        id: `adapt-job-${state.adaptJobs.length + 1}`,
        goal_id: goalId,
        user_id: userId,
        plan_id: planId,
        plan_version: planVersion,
        created_at: now.toISOString()
      };
      state.adaptJobs.push(job);
      return job;
    },
    createNextPlanVersion(goalId, activePlan, now, metadata) {
      const newPlan = {
        ...activePlan,
        id: `plan-${state.plans.length + 1}`,
        version: activePlan.version + 1,
        status: "active",
        created_at: now.toISOString(),
        ...metadata
      };
      state.plans.push(newPlan);

      const goal = state.goals.find((item) => item.id === goalId);
      if (goal) {
        goal.active_plan_id = newPlan.id;
      }

      return newPlan;
    }
  };
}

test("full adaptation triggers /adapt and creates a new plan version", () => {
  const store = createMockStore();
  const now = new Date("2026-03-26T13:00:00.000Z");

  const result = triggerFullAdaptation(store, "user-1", now, "manual");

  assert.equal(result.endpoint, "/adapt");
  assert.equal(result.previous_plan_version, 1);
  assert.equal(result.new_plan_version, 2);
  assert.equal(store.state.plans.length, 2);
  assert.equal(store.state.adaptJobs.length, 1);
  assert.equal(result.tasks_cloned, 2);

  const activeGoal = store.getActiveGoal("user-1");
  assert.equal(activeGoal.active_plan_id, result.new_plan_id);
});
