import { DEFAULT_NOTIFICATION_PREFERENCES, ReminderReason } from "../../contracts/constants.js";
import { getLocalDateParts, isWithinQuietHours, parseTimeHHMM, toLocalDateKey } from "../../utils/dateTime.js";

function requirePatchObject(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("patch must be an object");
  }
}

function validatePreferencesPatch(patch) {
  if (patch.reminder_time_local !== undefined) {
    parseTimeHHMM(patch.reminder_time_local);
  }

  if (patch.quiet_hours_start !== undefined) {
    parseTimeHHMM(patch.quiet_hours_start);
  }

  if (patch.quiet_hours_end !== undefined) {
    parseTimeHHMM(patch.quiet_hours_end);
  }

  if (patch.max_push_per_day !== undefined) {
    if (!Number.isInteger(patch.max_push_per_day) || patch.max_push_per_day < 1 || patch.max_push_per_day > 2) {
      throw new Error("max_push_per_day must be an integer between 1 and 2");
    }
  }
}

async function countIncompleteRequiredTasks(store, goalId, localDateKey) {
  if (typeof store.countIncompleteRequiredTasks === "function") {
    return store.countIncompleteRequiredTasks(goalId, localDateKey);
  }

  if (typeof store.listTasks === "function" && typeof store.getCompletion === "function") {
    const tasks = await store.listTasks(goalId);
    let incompleteCount = 0;

    for (const task of tasks) {
      if (!task.required || task.scheduled_date > localDateKey) {
        continue;
      }

      const completion = await store.getCompletion(task.id);

      if (completion?.state !== "completed") {
        incompleteCount += 1;
      }
    }

    return incompleteCount;
  }

  return 0;
}

async function hasPushToken(store, userId) {
  if (typeof store.hasPushToken === "function") {
    return store.hasPushToken(userId);
  }

  if (Array.isArray(store.state?.pushTokens)) {
    return store.state.pushTokens.some((token) => token.user_id === userId);
  }

  return false;
}

async function listRemindersForDate(store, userId, localDateKey) {
  if (typeof store.listRemindersForDate === "function") {
    return store.listRemindersForDate(userId, localDateKey);
  }

  if (Array.isArray(store.state?.remindersSent)) {
    return store.state.remindersSent.filter((reminder) => reminder.user_id === userId && reminder.local_date_key === localDateKey);
  }

  if (Array.isArray(store.state?.reminders)) {
    return store.state.reminders.filter((reminder) => reminder.user_id === userId && reminder.local_date_key === localDateKey);
  }

  return [];
}

async function hasReminderBeenSent(store, userId, goalId, reason) {
  if (typeof store.hasReminderBeenSent === "function") {
    return store.hasReminderBeenSent(userId, goalId, reason);
  }

  if (Array.isArray(store.state?.remindersSent)) {
    return store.state.remindersSent.some((reminder) => (
      reminder.user_id === userId &&
      reminder.goal_id === goalId &&
      reminder.reason === reason
    ));
  }

  if (Array.isArray(store.remindersSent)) {
    return store.remindersSent.some((reminder) => (
      reminder.user_id === userId &&
      reminder.goal_id === goalId &&
      reminder.reason === reason
    ));
  }

  return false;
}

export function getEffectiveNotificationPreferences(preference = null) {
  return {
    reminder_time_local: preference?.reminder_time_local ?? DEFAULT_NOTIFICATION_PREFERENCES.reminder_time_local,
    quiet_hours_start: preference?.quiet_hours_start ?? DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_start,
    quiet_hours_end: preference?.quiet_hours_end ?? DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_end,
    max_push_per_day: preference?.max_push_per_day ?? DEFAULT_NOTIFICATION_PREFERENCES.max_push_per_day
  };
}

export async function getNotificationSettingsSnapshot(store, userId) {
  const [preference, registered] = await Promise.all([
    typeof store.getNotificationPreference === "function"
      ? store.getNotificationPreference(userId)
      : null,
    hasPushToken(store, userId)
  ]);

  return {
    ...getEffectiveNotificationPreferences(preference),
    has_push_token: Boolean(registered)
  };
}

export async function registerPushToken(store, userId, token, platform, now = new Date()) {
  if (!token || typeof token !== "string") {
    throw new Error("token is required");
  }

  if (!(await store.getUser(userId))) {
    throw new Error("User not found");
  }

  const resolvedPlatform = platform ?? "unknown";

  return store.upsertPushToken(userId, token, resolvedPlatform, now);
}

export async function updateReminderPreferences(store, userId, patch) {
  if (!(await store.getUser(userId))) {
    throw new Error("User not found");
  }

  requirePatchObject(patch);
  validatePreferencesPatch(patch);
  return store.upsertNotificationPreference(userId, patch);
}

export async function evaluateReminderEligibility(
  store,
  userId,
  goalId,
  now = new Date(),
  reason = ReminderReason.DAILY_REMINDER
) {
  const user = await store.getUser(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const goal = await store.getGoal(goalId);

  if (!goal || goal.user_id !== userId) {
    throw new Error("Goal not found");
  }

  const preference = await store.getNotificationPreference(userId);

  if (!preference) {
    return {
      eligible: false,
      blocked_reason: "notification_preference_not_found",
      local_date_key: toLocalDateKey(now, user.timezone),
      incomplete_required_tasks: 0
    };
  }

  const localDateKey = toLocalDateKey(now, user.timezone);
  const localParts = getLocalDateParts(now, user.timezone);
  const incompleteRequiredTasks = await countIncompleteRequiredTasks(store, goalId, localDateKey);

  if (!(await hasPushToken(store, userId))) {
    return {
      eligible: false,
      blocked_reason: "no_push_token",
      local_date_key: localDateKey,
      incomplete_required_tasks: incompleteRequiredTasks
    };
  }

  if (
    reason === ReminderReason.DELAYED_PLAN_READY &&
    await hasReminderBeenSent(store, userId, goalId, reason)
  ) {
    return {
      eligible: false,
      blocked_reason: "already_sent",
      local_date_key: localDateKey,
      incomplete_required_tasks: incompleteRequiredTasks
    };
  }

  if (
    reason === ReminderReason.DAILY_REMINDER &&
    incompleteRequiredTasks <= 0
  ) {
    return {
      eligible: false,
      blocked_reason: "no_tasks_remaining",
      local_date_key: localDateKey,
      incomplete_required_tasks: 0
    };
  }

  if (isWithinQuietHours(localParts.hour, localParts.minute, preference.quiet_hours_start, preference.quiet_hours_end)) {
    return {
      eligible: false,
      blocked_reason: "quiet_hours",
      local_date_key: localDateKey,
      incomplete_required_tasks: incompleteRequiredTasks
    };
  }

  const sentToday = (await listRemindersForDate(store, userId, localDateKey)).length;

  if (sentToday >= preference.max_push_per_day) {
    return {
      eligible: false,
      blocked_reason: "daily_cap_reached",
      local_date_key: localDateKey,
      incomplete_required_tasks: incompleteRequiredTasks
    };
  }

  return {
    eligible: true,
    blocked_reason: null,
    local_date_key: localDateKey,
    incomplete_required_tasks: incompleteRequiredTasks
  };
}

export async function sendReminderIfEligible(store, userId, goalId, reason = "daily_reminder", now = new Date()) {
  const eligibility = await evaluateReminderEligibility(store, userId, goalId, now, reason);

  if (!eligibility.eligible) {
    return {
      sent: false,
      blocked_reason: eligibility.blocked_reason,
      local_date_key: eligibility.local_date_key,
      incomplete_required_tasks: eligibility.incomplete_required_tasks
    };
  }

  const reminder = await store.createReminder(userId, goalId, reason, now, eligibility.local_date_key);

  return {
    sent: true,
    blocked_reason: null,
    local_date_key: eligibility.local_date_key,
    incomplete_required_tasks: eligibility.incomplete_required_tasks,
    reminder
  };
}

export async function sendDelayedPlanReadyIfEligible(store, userId, goalId, now = new Date()) {
  return sendReminderIfEligible(store, userId, goalId, ReminderReason.DELAYED_PLAN_READY, now);
}
