import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProgressScreenModel,
  getActiveGoalProgress,
  markTaskCompletedAndRefreshStreak
} from "../src/modules/m4/progressService.js";

function createMockStore() {
  const state = {
    user: { id: "user-1", timezone: "Asia/Jerusalem" },
    users: [{ id: "user-1", timezone: "Asia/Jerusalem" }],
    goals: [{ id: "goal-1", user_id: "user-1", active_plan_id: "plan-1", status: "active" }],
    plans: [{ id: "plan-1", goal_id: "goal-1", version: 1, status: "active" }],
    tasks: [
      { id: "task-1", goal_id: "goal-1", plan_id: "plan-1", required: true, scheduled_date: "2026-03-23" },
      { id: "task-2", goal_id: "goal-1", plan_id: "plan-1", required: true, scheduled_date: "2026-03-24" },
      { id: "task-3", goal_id: "goal-1", plan_id: "plan-1", required: true, scheduled_date: "2026-03-26" },
      { id: "task-4", goal_id: "goal-1", plan_id: "plan-1", required: true, scheduled_date: "2026-03-26" }
    ],
    completions: [
      { id: "comp-1", task_id: "task-1", goal_id: "goal-1", state: "completed", completed_at: "2026-03-24T12:00:00.000Z" },
      { id: "comp-2", task_id: "task-2", goal_id: "goal-1", state: "completed", completed_at: "2026-03-25T12:00:00.000Z" }
    ],
    milestones: [
      {
        id: "ms-1",
        plan_id: "plan-1",
        title: "Week 1",
        target_week: 1,
        success_criteria: "Hit baseline consistency",
        status: "confirmed",
        user_confirmed_at: "2026-03-25T12:00:00.000Z"
      },
      {
        id: "ms-2",
        plan_id: "plan-1",
        title: "Week 2",
        target_week: 2,
        success_criteria: "Keep streak alive",
        status: "pending",
        user_confirmed_at: null
      }
    ],
    streaks: []
  };

  return {
    state,
    getUser(userId) {
      return state.users.find((user) => user.id === userId) ?? null;
    },
    getActiveGoal(userId) {
      return state.goals.find((goal) => goal.user_id === userId && goal.status === "active") ?? null;
    },
    getGoal(goalId) {
      return state.goals.find((goal) => goal.id === goalId) ?? null;
    },
    getActivePlan(goalId) {
      const goal = state.goals.find((item) => item.id === goalId);
      if (!goal) {
        return null;
      }

      return state.plans.find((plan) => plan.id === goal.active_plan_id) ?? null;
    },
    listCompletionsForGoal(goalId) {
      return state.completions.filter((completion) => completion.goal_id === goalId);
    },
    upsertStreak(goalId, values) {
      let streak = state.streaks.find((item) => item.goal_id === goalId);
      if (!streak) {
        streak = { goal_id: goalId, current_days: 0, longest_days: 0, last_success_date: null };
        state.streaks.push(streak);
      }

      Object.assign(streak, values);
      return streak;
    },
    markTaskCompleted(taskId, now) {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) {
        return null;
      }

      let completion = state.completions.find((item) => item.task_id === taskId);
      if (!completion) {
        completion = {
          id: `comp-${state.completions.length + 1}`,
          task_id: task.id,
          goal_id: task.goal_id,
          state: "completed",
          completed_at: now.toISOString()
        };
        state.completions.push(completion);
      } else {
        completion.state = "completed";
        completion.completed_at = now.toISOString();
      }

      return completion;
    },
    getTask(taskId) {
      return state.tasks.find((task) => task.id === taskId) ?? null;
    },
    listTasks(goalId) {
      return state.tasks.filter((task) => task.goal_id === goalId);
    },
    getCompletion(taskId) {
      return state.completions.find((completion) => completion.task_id === taskId) ?? null;
    },
    getMilestones(planId) {
      return state.milestones.filter((milestone) => milestone.plan_id === planId);
    }
  };
}

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
