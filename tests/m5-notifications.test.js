import test from "node:test";
import assert from "node:assert/strict";
import { createMockStore } from "../src/mocks/inMemoryStore.js";
import {
  evaluateReminderEligibility,
  registerPushToken,
  sendReminderIfEligible,
  updateReminderPreferences
} from "../src/modules/m5/notificationService.js";
import { markTaskCompletedAndRefreshStreak } from "../src/modules/m4/progressService.js";

test("register push token and update preferences", async () => {
  const store = createMockStore();

  const token = await registerPushToken(
    store,
    "user-1",
    "expo-token-1",
    "ios",
    new Date("2026-03-26T09:00:00.000Z")
  );
  const preferences = await updateReminderPreferences(store, "user-1", {
    max_push_per_day: 1,
    quiet_hours_start: "23:00",
    quiet_hours_end: "06:00"
  });

  assert.equal(token.token, "expo-token-1");
  assert.equal(preferences.max_push_per_day, 1);
  assert.equal(preferences.quiet_hours_start, "23:00");
});

test("reminders send only when tasks remain, within limits, and outside quiet hours", async () => {
  const store = createMockStore();
  await registerPushToken(store, "user-1", "expo-token-1", "ios", new Date("2026-03-26T09:00:00.000Z"));
  await updateReminderPreferences(store, "user-1", {
    max_push_per_day: 1,
    quiet_hours_start: "22:00",
    quiet_hours_end: "07:00"
  });

  const daytimeSend = await sendReminderIfEligible(
    store,
    "user-1",
    "goal-1",
    "daily_reminder",
    new Date("2026-03-26T16:00:00.000Z")
  );
  assert.equal(daytimeSend.sent, true);

  const blockedByCap = await sendReminderIfEligible(
    store,
    "user-1",
    "goal-1",
    "daily_reminder",
    new Date("2026-03-26T17:00:00.000Z")
  );
  assert.equal(blockedByCap.sent, false);
  assert.equal(blockedByCap.blocked_reason, "daily_cap_reached");

  await updateReminderPreferences(store, "user-1", { max_push_per_day: 2 });
  const blockedByQuietHours = await sendReminderIfEligible(
    store,
    "user-1",
    "goal-1",
    "daily_reminder",
    new Date("2026-03-26T21:30:00.000Z")
  );
  assert.equal(blockedByQuietHours.sent, false);
  assert.equal(blockedByQuietHours.blocked_reason, "quiet_hours");

  await markTaskCompletedAndRefreshStreak(store, "task-3", new Date("2026-03-26T10:00:00.000Z"));
  await markTaskCompletedAndRefreshStreak(store, "task-4", new Date("2026-03-26T10:05:00.000Z"));

  const blockedNoTasks = await evaluateReminderEligibility(
    store,
    "user-1",
    "goal-1",
    new Date("2026-03-27T11:00:00.000Z")
  );

  assert.equal(blockedNoTasks.eligible, false);
  assert.equal(blockedNoTasks.blocked_reason, "no_tasks_remaining");
});
