import { toLocalDateKey } from "../utils/dateTime.js";

function makeIdGenerator(prefix) {
  let index = 1;

  return () => {
    const id = `${prefix}-${index}`;
    index += 1;
    return id;
  };
}

export function createMockStore(overrides = {}) {
  const user = {
    id: "user-1",
    timezone: "Asia/Jerusalem",
    locale: "en-US"
  };

  const goals = [
    {
      id: "goal-1",
      user_id: user.id,
      title: "Ship my goal coach MVP",
      status: "active",
      plan_state: "ready",
      specificity_state: "specific",
      active_at: "2026-03-20T08:00:00.000Z",
      active_plan_id: "plan-1-v1"
    }
  ];

  const plans = [
    {
      id: "plan-1-v1",
      goal_id: "goal-1",
      version: 1,
      frame_type: "project_outcome",
      estimate_min_weeks: 8,
      estimate_max_weeks: 12,
      confidence: 0.78,
      created_at: "2026-03-20T08:05:00.000Z"
    }
  ];

  const milestones = [
    {
      id: "ms-1",
      plan_id: "plan-1-v1",
      title: "Core backend endpoints",
      target_week: 2,
      success_criteria: "All core API endpoints respond with contract-safe payloads",
      status: "pending",
      user_confirmed_at: null
    },
    {
      id: "ms-2",
      plan_id: "plan-1-v1",
      title: "Integration tests passing",
      target_week: 4,
      success_criteria: "Green CI on module integration suite",
      status: "pending",
      user_confirmed_at: null
    }
  ];

  const tasks = [
    {
      id: "task-1",
      plan_id: "plan-1-v1",
      goal_id: "goal-1",
      scheduled_date: "2026-03-24",
      title: "Write progress API contract test",
      est_minutes: 45,
      difficulty: "medium",
      required: true,
      dimension_tag: "quality",
      source: "plan",
      manual_lock: false,
      adjustment_source: null
    },
    {
      id: "task-2",
      plan_id: "plan-1-v1",
      goal_id: "goal-1",
      scheduled_date: "2026-03-25",
      title: "Implement adherence metric",
      est_minutes: 35,
      difficulty: "medium",
      required: true,
      dimension_tag: "execution",
      source: "plan",
      manual_lock: false,
      adjustment_source: null
    },
    {
      id: "task-3",
      plan_id: "plan-1-v1",
      goal_id: "goal-1",
      scheduled_date: "2026-03-26",
      title: "Wire milestone confirmation flow",
      est_minutes: 40,
      difficulty: "medium",
      required: true,
      dimension_tag: "execution",
      source: "plan",
      manual_lock: false,
      adjustment_source: null
    },
    {
      id: "task-4",
      plan_id: "plan-1-v1",
      goal_id: "goal-1",
      scheduled_date: "2026-03-26",
      title: "Set up reminder eligibility checks",
      est_minutes: 30,
      difficulty: "low",
      required: true,
      dimension_tag: "consistency",
      source: "plan",
      manual_lock: false,
      adjustment_source: null
    }
  ];

  const taskCompletions = [
    {
      id: "tc-1",
      task_id: "task-1",
      state: "completed",
      actual_minutes: 43,
      completed_at: "2026-03-24T18:10:00.000Z"
    },
    {
      id: "tc-2",
      task_id: "task-2",
      state: "completed",
      actual_minutes: 38,
      completed_at: "2026-03-25T19:05:00.000Z"
    }
  ];

  const streaks = [
    {
      id: "streak-1",
      goal_id: "goal-1",
      current_days: 2,
      longest_days: 2,
      last_success_date: "2026-03-25"
    }
  ];

  const notificationPreferences = [
    {
      id: "notif-pref-1",
      user_id: user.id,
      reminder_time_local: "20:00",
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      max_push_per_day: 2
    }
  ];

  const pushTokens = [];
  const remindersSent = [];
  const adaptJobs = [];

  const nextId = {
    completion: makeIdGenerator("tc"),
    plan: makeIdGenerator("plan-generated"),
    token: makeIdGenerator("push-token"),
    reminder: makeIdGenerator("reminder"),
    adapt: makeIdGenerator("adapt-job")
  };

  const state = {
    user,
    goals,
    plans,
    milestones,
    tasks,
    taskCompletions,
    streaks,
    notificationPreferences,
    pushTokens,
    remindersSent,
    adaptJobs,
    ...overrides
  };

  function getUser(userId) {
    if (state.user.id !== userId) {
      return null;
    }

    return state.user;
  }

  function getActiveGoal(userId) {
    return state.goals.find((goal) => goal.user_id === userId && goal.status === "active") ?? null;
  }

  function getGoal(goalId) {
    return state.goals.find((goal) => goal.id === goalId) ?? null;
  }

  function getPlan(planId) {
    return state.plans.find((plan) => plan.id === planId) ?? null;
  }

  function getActivePlan(goalId) {
    const goal = getGoal(goalId);

    if (!goal) {
      return null;
    }

    return getPlan(goal.active_plan_id);
  }

  function getMilestones(planId) {
    return state.milestones.filter((milestone) => milestone.plan_id === planId);
  }

  function getMilestone(milestoneId) {
    return state.milestones.find((milestone) => milestone.id === milestoneId) ?? null;
  }

  function confirmMilestone(milestoneId, confirmedAt) {
    const milestone = getMilestone(milestoneId);

    if (!milestone) {
      return null;
    }

    milestone.status = "confirmed";
    milestone.user_confirmed_at = confirmedAt.toISOString();

    return milestone;
  }

  function listTasks(goalId) {
    return state.tasks.filter((task) => task.goal_id === goalId);
  }

  function listTasksForLocalDate(goalId, localDateKey) {
    return state.tasks.filter((task) => task.goal_id === goalId && task.scheduled_date === localDateKey);
  }

  function getTask(taskId) {
    return state.tasks.find((task) => task.id === taskId) ?? null;
  }

  function getCompletion(taskId) {
    return state.taskCompletions.find((completion) => completion.task_id === taskId) ?? null;
  }

  function listCompletionsForGoal(goalId) {
    const taskIds = new Set(listTasks(goalId).map((task) => task.id));
    return state.taskCompletions.filter((completion) => taskIds.has(completion.task_id));
  }

  function upsertCompletion(taskId, payload) {
    const existing = getCompletion(taskId);

    if (existing) {
      Object.assign(existing, payload);
      return existing;
    }

    const created = {
      id: nextId.completion(),
      task_id: taskId,
      ...payload
    };

    state.taskCompletions.push(created);
    return created;
  }

  function getStreak(goalId) {
    return state.streaks.find((streak) => streak.goal_id === goalId) ?? null;
  }

  function upsertStreak(goalId, payload) {
    const existing = getStreak(goalId);

    if (existing) {
      Object.assign(existing, payload);
      return existing;
    }

    const created = {
      id: `streak-${state.streaks.length + 1}`,
      goal_id: goalId,
      ...payload
    };

    state.streaks.push(created);
    return created;
  }

  function createNextPlanVersion(goalId, basePlan, now, patch = {}) {
    const created = {
      ...basePlan,
      ...patch,
      id: nextId.plan(),
      goal_id: goalId,
      version: basePlan.version + 1,
      created_at: now.toISOString()
    };

    state.plans.push(created);

    const goal = getGoal(goalId);
    if (goal) {
      goal.active_plan_id = created.id;
      goal.plan_state = "ready";
    }

    return created;
  }

  function createAdaptJob(goalId, userId, planId, planVersion, now) {
    const job = {
      id: nextId.adapt(),
      endpoint: "/adapt",
      goal_id: goalId,
      user_id: userId,
      active_plan_id: planId,
      active_plan_version: planVersion,
      requested_at: now.toISOString(),
      status: "queued"
    };

    state.adaptJobs.push(job);
    return job;
  }

  function getNotificationPreference(userId) {
    return state.notificationPreferences.find((pref) => pref.user_id === userId) ?? null;
  }

  function upsertNotificationPreference(userId, patch) {
    const existing = getNotificationPreference(userId);

    if (existing) {
      Object.assign(existing, patch);
      return existing;
    }

    const created = {
      id: `notif-pref-${state.notificationPreferences.length + 1}`,
      user_id: userId,
      reminder_time_local: "20:00",
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      max_push_per_day: 2,
      ...patch
    };

    state.notificationPreferences.push(created);
    return created;
  }

  function upsertPushToken(userId, token, platform, now) {
    const existing = state.pushTokens.find((item) => item.user_id === userId && item.token === token);

    if (existing) {
      existing.platform = platform;
      existing.updated_at = now.toISOString();
      return existing;
    }

    const created = {
      id: nextId.token(),
      user_id: userId,
      token,
      platform,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    state.pushTokens.push(created);
    return created;
  }

  function hasPushToken(userId) {
    return state.pushTokens.some((token) => token.user_id === userId);
  }

  function listRemindersForDate(userId, localDateKey) {
    return state.remindersSent.filter((reminder) => reminder.user_id === userId && reminder.local_date_key === localDateKey);
  }

  function createReminder(userId, goalId, reason, now, localDateKey) {
    const reminder = {
      id: nextId.reminder(),
      user_id: userId,
      goal_id: goalId,
      reason,
      sent_at: now.toISOString(),
      local_date_key: localDateKey
    };

    state.remindersSent.push(reminder);
    return reminder;
  }

  function markTaskCompleted(taskId, completedAt = new Date()) {
    const task = getTask(taskId);

    if (!task) {
      return null;
    }

    return upsertCompletion(taskId, {
      state: "completed",
      actual_minutes: task.est_minutes,
      completed_at: completedAt.toISOString()
    });
  }

  function countIncompleteRequiredTasks(goalId, localDateKey) {
    const todayTasks = listTasksForLocalDate(goalId, localDateKey).filter((task) => task.required);

    return todayTasks.filter((task) => {
      const completion = getCompletion(task.id);
      return !completion || completion.state !== "completed";
    }).length;
  }

  function getStateSnapshot(now = new Date()) {
    const localDateKey = toLocalDateKey(now, state.user.timezone);

    return {
      localDateKey,
      user: state.user,
      goals: state.goals,
      plans: state.plans,
      milestones: state.milestones,
      tasks: state.tasks,
      taskCompletions: state.taskCompletions,
      streaks: state.streaks,
      notificationPreferences: state.notificationPreferences,
      pushTokens: state.pushTokens,
      remindersSent: state.remindersSent,
      adaptJobs: state.adaptJobs
    };
  }

  return {
    state,
    getUser,
    getActiveGoal,
    getGoal,
    getPlan,
    getActivePlan,
    getMilestones,
    getMilestone,
    confirmMilestone,
    listTasks,
    listTasksForLocalDate,
    getTask,
    getCompletion,
    listCompletionsForGoal,
    upsertCompletion,
    getStreak,
    upsertStreak,
    createNextPlanVersion,
    createAdaptJob,
    getNotificationPreference,
    upsertNotificationPreference,
    upsertPushToken,
    hasPushToken,
    listRemindersForDate,
    createReminder,
    markTaskCompleted,
    countIncompleteRequiredTasks,
    getStateSnapshot
  };
}
