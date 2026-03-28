function addDays(days) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function formatLocalDatePrefix(localDateKey) {
  return localDateKey ? `Local date: ${localDateKey}. ` : "";
}

const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  reminderTimeLocal: "20:00",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  maxPushPerDay: 2,
  hasPushToken: false
});

function isValidTimeHHMM(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return false;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDefaultNotifications() {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS
  };
}

export function normalizeNotifications(notifications = {}) {
  return {
    reminderTimeLocal:
      notifications.reminder_time_local ??
      notifications.reminderTimeLocal ??
      DEFAULT_NOTIFICATION_SETTINGS.reminderTimeLocal,
    quietHoursStart:
      notifications.quiet_hours_start ??
      notifications.quietHoursStart ??
      DEFAULT_NOTIFICATION_SETTINGS.quietHoursStart,
    quietHoursEnd:
      notifications.quiet_hours_end ??
      notifications.quietHoursEnd ??
      DEFAULT_NOTIFICATION_SETTINGS.quietHoursEnd,
    maxPushPerDay:
      notifications.max_push_per_day ??
      notifications.maxPushPerDay ??
      DEFAULT_NOTIFICATION_SETTINGS.maxPushPerDay,
    hasPushToken:
      notifications.has_push_token ??
      notifications.hasPushToken ??
      DEFAULT_NOTIFICATION_SETTINGS.hasPushToken
  };
}

export function createNotificationDraft(notifications = {}) {
  const normalized = normalizeNotifications(notifications);

  return {
    reminderTimeLocal: normalized.reminderTimeLocal,
    quietHoursStart: normalized.quietHoursStart,
    quietHoursEnd: normalized.quietHoursEnd,
    maxPushPerDay: normalized.maxPushPerDay
  };
}

export function notificationDraftMatchesSettings(draft, notifications) {
  const normalized = normalizeNotifications(notifications);

  return (
    draft.reminderTimeLocal === normalized.reminderTimeLocal &&
    draft.quietHoursStart === normalized.quietHoursStart &&
    draft.quietHoursEnd === normalized.quietHoursEnd &&
    draft.maxPushPerDay === normalized.maxPushPerDay
  );
}

export function validateNotificationDraft(draft) {
  if (
    !isValidTimeHHMM(draft.reminderTimeLocal) ||
    !isValidTimeHHMM(draft.quietHoursStart) ||
    !isValidTimeHHMM(draft.quietHoursEnd)
  ) {
    return "Use HH:MM time values like 20:00 or 07:30 for reminders and quiet hours.";
  }

  if (draft.maxPushPerDay !== 1 && draft.maxPushPerDay !== 2) {
    return "Daily cap must stay set to 1 or 2 pushes per day.";
  }

  return null;
}

export function buildNotificationPreferencesPayload(draft) {
  return {
    reminder_time_local: draft.reminderTimeLocal.trim(),
    quiet_hours_start: draft.quietHoursStart.trim(),
    quiet_hours_end: draft.quietHoursEnd.trim(),
    max_push_per_day: draft.maxPushPerDay
  };
}

export function createEmptySnapshot() {
  return {
    user: null,
    localDateKey: null,
    goals: [],
    activeGoal: null,
    today: null,
    progress: null,
    notifications: createDefaultNotifications()
  };
}

export function normalizeBootstrap(bootstrap = {}) {
  return {
    user: bootstrap.user ?? null,
    localDateKey: bootstrap.local_date_key ?? null,
    goals: bootstrap.goals ?? [],
    activeGoal: bootstrap.active_goal ?? null,
    today: bootstrap.today ?? null,
    progress: bootstrap.progress ?? null,
    notifications: normalizeNotifications(bootstrap.notifications)
  };
}

export function createDefaultAssessment() {
  return {
    currentLevel: "beginner",
    weeklyMinutesAvailable: "180",
    targetDate: addDays(84)
  };
}

export function createEmptyComposer() {
  return {
    stage: "idle",
    title: "",
    goalId: null,
    specificity: null,
    clarificationFields: [],
    assessment: createDefaultAssessment(),
    planState: "idle",
    plan: null,
    timeline: []
  };
}

export function toClarificationFields(questions = []) {
  return questions.map((questionText, index) => ({
    id: `clarification-${index + 1}`,
    questionText,
    answerText: ""
  }));
}

export function pushTimeline(timeline, nextValue) {
  if (!nextValue) {
    return timeline;
  }

  if (timeline[timeline.length - 1] === nextValue) {
    return timeline;
  }

  return [...timeline, nextValue];
}

export function createGenerationComposerState(composer, goalId, planState) {
  return {
    ...composer,
    stage: "generating",
    goalId,
    planState,
    plan: null,
    timeline: [planState]
  };
}

export function syncComposerWithPlanStatus(composer, status) {
  const nextTimeline = pushTimeline(composer.timeline, status.plan_state);

  if (status.plan_state === "ready") {
    return {
      ...composer,
      stage: "plan_ready",
      planState: status.plan_state,
      plan: status.plan,
      timeline: nextTimeline
    };
  }

  if (status.plan_state === "failed") {
    return {
      ...composer,
      stage: "generation_failed",
      planState: status.plan_state,
      plan: null,
      timeline: nextTimeline
    };
  }

  return {
    ...composer,
    stage: "generating",
    planState: status.plan_state,
    plan: status.plan ?? composer.plan,
    timeline: nextTimeline
  };
}

export function humanizeToken(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

export function formatEstimate(estimate) {
  if (!estimate) {
    return "Custom pacing";
  }

  return `${estimate.min_weeks}-${estimate.max_weeks} weeks`;
}

export function getTaskMinutes(task) {
  return task.est_minutes ?? task.estMinutes ?? 0;
}

export function isGoalActivatable(goal) {
  return goal?.specificity_state === "specific" && goal?.status !== "active" && goal?.status !== "archived";
}

export function createGoalSummary(goal) {
  const goalStatus = humanizeToken(goal.status);
  const planStatus = goal.plan_state ? humanizeToken(goal.plan_state) : "No plan yet";
  const specificity = goal.specificity_state === "specific" ? "Specific" : "Needs clarity";

  return `${goalStatus} · ${planStatus} · ${specificity}`;
}

export function getFlowSurface(snapshot, composer) {
  if (composer.stage !== "idle") {
    return composer.stage === "intake" ? "goal_studio" : composer.stage;
  }

  if (snapshot.activeGoal) {
    return "dashboard";
  }

  return "goal_studio";
}

export function getGoalStudioPresentation(hasActiveGoal) {
  if (hasActiveGoal) {
    return {
      heroCopy:
        "Your current active goal stays in place until you choose to switch. Draft another coaching track without disturbing today's focus.",
      libraryCopy: "Pick up an existing goal, switch focus, or reuse wording from an older draft.",
      emptyLibraryCopy: "No other saved goals yet. Drafts and paused goals will appear here as you build them."
    };
  }

  return {
    heroCopy:
      "Pick a goal with an outcome and a timeframe. If it is still fuzzy, the app will coach it into focus before building a plan.",
    libraryCopy: "Pick up an existing goal or reuse wording from an older draft.",
    emptyLibraryCopy: "No saved goals yet. Your first goal will show up here as soon as you create it."
  };
}

const generationStateContent = {
  generating: {
    title: "Building your first plan",
    heroCopy: "We are turning your goal into a realistic weekly path and a gentle first day.",
    detailCopy:
      "We are generating milestones, a pacing estimate, and the first tasks for this goal."
  },
  delayed: {
    title: "Still building your plan",
    heroCopy:
      "The first draft is taking longer than usual. You can keep checking from here, and the saved goal will stay ready for you either way.",
    detailCopy:
      "The backend has moved into a delayed state, so this screen should be treated like a calm waiting room instead of a blocker."
  },
  ready: {
    title: "Your first coaching arc is ready.",
    heroCopy:
      "Review the first weeks, then activate the plan when you are ready to make it your active focus.",
    detailCopy:
      "The first pass is ready to review, including milestones, a timeline estimate, and the opening tasks."
  },
  failed: {
    title: "We hit a snag building this draft.",
    heroCopy:
      "We could not finish this draft. Your goal and assessment are still saved, so you can try again without losing work.",
    detailCopy:
      "Nothing from the intake flow was lost. Retry when you want another attempt with the same inputs."
  }
};

export function getGenerationStateContent(planState) {
  return generationStateContent[planState] ?? generationStateContent.generating;
}

export function getDashboardPresentation({ localDateKey, today }) {
  const prefix = formatLocalDatePrefix(localDateKey);

  if (!today) {
    return {
      state: "bootstrap_pending",
      heroCopy: `${prefix}Today's task surface is still syncing from the latest snapshot.`,
      emptyTitle: "Today's focus is still loading",
      emptyCopy:
        "Refresh to pull a fresh snapshot. This can happen right after activation or while the bootstrap response catches up.",
      refreshLabel: "Refresh today"
    };
  }

  if ((today.tasks ?? []).length === 0) {
    return {
      state: "no_tasks_today",
      heroCopy: `${prefix}Today is intentionally clear, so recovery can count as progress too.`,
      emptyTitle: "Today is intentionally clear",
      emptyCopy:
        "Rest counts too. You can refresh for a newer snapshot or soften the plan again if you want extra breathing room.",
      refreshLabel: "Refresh today"
    };
  }

  return {
    state: "tasks_ready",
    heroCopy: `${prefix}Focus on the next few actions, not the entire mountain.`,
    emptyTitle: "",
    emptyCopy: "",
    refreshLabel: "Refresh"
  };
}
