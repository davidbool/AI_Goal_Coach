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

function countIncompleteRequiredTasks(store, goalId, localDateKey) {
  if (typeof store.countIncompleteRequiredTasks === "function") {
    return store.countIncompleteRequiredTasks(goalId, localDateKey);
  }

  if (typeof store.listTasks === "function" && typeof store.getCompletion === "function") {
    return store
      .listTasks(goalId)
      .filter((task) => task.required && task.scheduled_date <= localDateKey)
      .filter((task) => store.getCompletion(task.id)?.state !== "completed").length;
  }

  return 0;
}

function hasPushToken(store, userId) {
  if (typeof store.hasPushToken === "function") {
    return store.hasPushToken(userId);
  }

  if (Array.isArray(store.state?.pushTokens)) {
    return store.state.pushTokens.some((token) => token.user_id === userId);
  }

  return false;
}

function listRemindersForDate(store, userId, localDateKey) {
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

export function registerPushToken(store, userId, token, platform, now = new Date()) {
  if (!token || typeof token !== "string") {
    throw new Error("token is required");
  }

  if (!store.getUser(userId)) {
    throw new Error("User not found");
  }

  const resolvedPlatform = platform ?? "unknown";

  return store.upsertPushToken(userId, token, resolvedPlatform, now);
}

export function updateReminderPreferences(store, userId, patch) {
  if (!store.getUser(userId)) {
    throw new Error("User not found");
  }

  requirePatchObject(patch);
  validatePreferencesPatch(patch);
  return store.upsertNotificationPreference(userId, patch);
}

export function evaluateReminderEligibility(store, userId, goalId, now = new Date()) {
  const user = store.getUser(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const goal = store.getGoal(goalId);

  if (!goal || goal.user_id !== userId) {
    throw new Error("Goal not found");
  }

  const preference = store.getNotificationPreference(userId);

  if (!preference) {
    throw new Error("Notification preference not found");
  }

  const localDateKey = toLocalDateKey(now, user.timezone);
  const localParts = getLocalDateParts(now, user.timezone);
  const incompleteRequiredTasks = countIncompleteRequiredTasks(store, goalId, localDateKey);

  if (!hasPushToken(store, userId)) {
    return {
      eligible: false,
      blocked_reason: "no_push_token",
      local_date_key: localDateKey,
      incomplete_required_tasks: incompleteRequiredTasks
    };
  }

  if (incompleteRequiredTasks <= 0) {
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

  const sentToday = listRemindersForDate(store, userId, localDateKey).length;

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

export function sendReminderIfEligible(store, userId, goalId, reason = "daily_reminder", now = new Date()) {
  const eligibility = evaluateReminderEligibility(store, userId, goalId, now);

  if (!eligibility.eligible) {
    return {
      sent: false,
      blocked_reason: eligibility.blocked_reason,
      local_date_key: eligibility.local_date_key,
      incomplete_required_tasks: eligibility.incomplete_required_tasks
    };
  }

  const reminder = store.createReminder(userId, goalId, reason, now, eligibility.local_date_key);

  return {
    sent: true,
    blocked_reason: null,
    local_date_key: eligibility.local_date_key,
    incomplete_required_tasks: eligibility.incomplete_required_tasks,
    reminder
  };
}
