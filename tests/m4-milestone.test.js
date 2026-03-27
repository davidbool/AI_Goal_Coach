import test from "node:test";
import assert from "node:assert/strict";
import { confirmMilestoneForActiveGoal } from "../src/modules/m4/milestoneService.js";

function createMockStore() {
  const state = {
    goals: [{ id: "goal-1", user_id: "user-1", active_plan_id: "plan-1" }],
    plans: [{ id: "plan-1", goal_id: "goal-1", version: 1, status: "active" }],
    milestones: [
      {
        id: "ms-1",
        plan_id: "plan-1",
        title: "First week complete",
        target_week: 1,
        success_criteria: "Finish daily tasks",
        status: "pending",
        user_confirmed_at: null
      }
    ]
  };

  return {
    getActiveGoal(userId) {
      return state.goals.find((goal) => goal.user_id === userId) ?? null;
    },
    getActivePlan(goalId) {
      const goal = state.goals.find((item) => item.id === goalId);
      if (!goal) {
        return null;
      }

      return state.plans.find((plan) => plan.id === goal.active_plan_id) ?? null;
    },
    getMilestone(milestoneId) {
      return state.milestones.find((milestone) => milestone.id === milestoneId) ?? null;
    },
    confirmMilestone(milestoneId, now) {
      const milestone = state.milestones.find((item) => item.id === milestoneId);
      if (!milestone) {
        return null;
      }

      milestone.status = "confirmed";
      milestone.user_confirmed_at = now.toISOString();
      return milestone;
    }
  };
}

test("milestone confirmation sets status and timestamp", () => {
  const store = createMockStore();
  const now = new Date("2026-03-26T12:30:00.000Z");

  const milestone = confirmMilestoneForActiveGoal(store, "user-1", "ms-1", now);

  assert.equal(milestone.status, "confirmed");
  assert.equal(milestone.user_confirmed_at, now.toISOString());
});

test("milestone confirmation is idempotent for already-confirmed milestone", () => {
  const store = createMockStore();
  const now = new Date("2026-03-26T12:30:00.000Z");

  confirmMilestoneForActiveGoal(store, "user-1", "ms-1", now);
  const sameMilestone = confirmMilestoneForActiveGoal(store, "user-1", "ms-1", new Date("2026-03-26T14:00:00.000Z"));

  assert.equal(sameMilestone.status, "confirmed");
  assert.equal(sameMilestone.user_confirmed_at, now.toISOString());
});
