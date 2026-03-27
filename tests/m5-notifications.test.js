import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateReminderEligibility,
  registerPushToken,
  sendReminderIfEligible,
  updateReminderPreferences
} from "../src/modules/m5/notificationService.js";
import { markTaskCompletedAndRefreshStreak } from "../src/modules/m4/progressService.js";

function createMockStore() {
  const state = {
    user: { id: "user-1", timezone: "Asia/Jerusalem" },
    users: [{ id: "user-1", timezone: "Asia/Jerusalem" }],
    goals: [{ id: "goal-1", user_id: "user-1", active_plan_id: "plan-1", status: "active" }],
    plans: [{ id: "plan-1", goal_id: "goal-1", version: 1, status: "active" }],
    tasks: [
      { id: "task-1", goal_id: "goal-1", plan_id: "plan-1", required: true, scheduled_date: "2026-03-24" },
      { id: "task-2", goal_id: "goal-1", plan_id: "plan-1", required: true, scheduled_date: "2026-03-25" },
      { id: "task-3", goal_id: "goal-1", plan_id: "plan-1", required: true, scheduled_date: "2026-03-26" },
      { id: "task-4", goal_id: "goal-1", plan_id: "plan-1", required: true, scheduled_date: "2026-03-26" }
    ],
    completions: [
      { id: "comp-1", task_id: "task-1", goal_id: "goal-1", state: "completed", completed_at: "2026-03-24T12:00:00.000Z" },
      { id: "comp-2", task_id: "task-2", goal_id: "goal-1", state: "completed", completed_at: "2026-03-25T12:00:00.000Z" }
    ],
    streaks: [],
    pushTokens: [],
    reminders: [],
    notificationPreferences: {
      "user-1": {
        reminder_time_local: "09:00",
        quiet_hours_start: "23:00",
        quiet_hours_end: "07:00",
        max_push_per_day: 1
      }
    }
  };

  return {
    state,
    getUser(userId) {
      return state.users.find((user) => user.id === userId) ?? null;
    },
    getGoal(goalId) {
      return state.goals.find((goal) => goal.id === goalId) ?? null;
    },
    getActiveGoal(userId) {
      return state.goals.find((goal) => goal.user_id === userId && goal.status === "active") ?? null;
    },
    getActivePlan(goalId) {
      const goal = state.goals.find((item) => item.id === goalId);
      if (!goal) {
        return null;
      }

      return state.plans.find((plan) => plan.id === goal.active_plan_id) ?? null;
    },
    upsertPushToken(userId, token, platform, now) {
      const pushToken = {
        id: `push-${state.pushTokens.length + 1}`,
        user_id: userId,
        token,
        platform,
        created_at: now.toISOString()
      };
      state.pushTokens = state.pushTokens.filter((item) => item.user_id !== userId || item.token !== token);
      state.pushTokens.push(pushToken);
      return pushToken;
    },
    hasPushToken(userId) {
      return state.pushTokens.some((token) => token.user_id === userId);
    },
    upsertNotificationPreference(userId, patch) {
      const current = state.notificationPreferences[userId] ?? {
        reminder_time_local: "09:00",
        quiet_hours_start: "23:00",
        quiet_hours_end: "07:00",
        max_push_per_day: 1
      };
      const next = { ...current, ...patch };
      state.notificationPreferences[userId] = next;
      return next;
    },
    getNotificationPreference(userId) {
      return state.notificationPreferences[userId] ?? null;
    },
    countIncompleteRequiredTasks(goalId, localDateKey) {
      return state.tasks
        .filter((task) => task.goal_id === goalId && task.required && task.scheduled_date <= localDateKey)
        .filter((task) => {
          const completion = state.completions.find((item) => item.task_id === task.id);
          return completion?.state !== "completed";
        }).length;
    },
    listRemindersForDate(userId, localDateKey) {
      return state.reminders.filter((reminder) => reminder.user_id === userId && reminder.local_date_key === localDateKey);
    },
    createReminder(userId, goalId, reason, now, localDateKey) {
      const reminder = {
        id: `reminder-${state.reminders.length + 1}`,
        user_id: userId,
        goal_id: goalId,
        reason,
        created_at: now.toISOString(),
        local_date_key: localDateKey
      };
      state.reminders.push(reminder);
      return reminder;
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
    }
  };
}

test("register push token and update preferences", () => {
  const store = createMockStore();

  const token = registerPushToken(store, "user-1", "expo-token-1", "ios", new Date("2026-03-26T09:00:00.000Z"));
  const preferences = updateReminderPreferences(store, "user-1", {
    max_push_per_day: 1,
    quiet_hours_start: "23:00",
    quiet_hours_end: "06:00"
  });

  assert.equal(token.token, "expo-token-1");
  assert.equal(preferences.max_push_per_day, 1);
  assert.equal(preferences.quiet_hours_start, "23:00");
});

test("reminders send only when tasks remain, within limits, and outside quiet hours", () => {
  const store = createMockStore();
  registerPushToken(store, "user-1", "expo-token-1", "ios", new Date("2026-03-26T09:00:00.000Z"));
  updateReminderPreferences(store, "user-1", {
    max_push_per_day: 1,
    quiet_hours_start: "22:00",
    quiet_hours_end: "07:00"
  });

  const daytimeSend = sendReminderIfEligible(
    store,
    "user-1",
    "goal-1",
    "daily_reminder",
    new Date("2026-03-26T16:00:00.000Z")
  );
  assert.equal(daytimeSend.sent, true);

  const blockedByCap = sendReminderIfEligible(
    store,
    "user-1",
    "goal-1",
    "daily_reminder",
    new Date("2026-03-26T17:00:00.000Z")
  );
  assert.equal(blockedByCap.sent, false);
  assert.equal(blockedByCap.blocked_reason, "daily_cap_reached");

  updateReminderPreferences(store, "user-1", { max_push_per_day: 2 });
  const blockedByQuietHours = sendReminderIfEligible(
    store,
    "user-1",
    "goal-1",
    "daily_reminder",
    new Date("2026-03-26T21:30:00.000Z")
  );
  assert.equal(blockedByQuietHours.sent, false);
  assert.equal(blockedByQuietHours.blocked_reason, "quiet_hours");

  markTaskCompletedAndRefreshStreak(store, "task-3", new Date("2026-03-26T10:00:00.000Z"));
  markTaskCompletedAndRefreshStreak(store, "task-4", new Date("2026-03-26T10:05:00.000Z"));

  const blockedNoTasks = evaluateReminderEligibility(
    store,
    "user-1",
    "goal-1",
    new Date("2026-03-27T11:00:00.000Z")
  );

  assert.equal(blockedNoTasks.eligible, false);
  assert.equal(blockedNoTasks.blocked_reason, "no_tasks_remaining");
});
