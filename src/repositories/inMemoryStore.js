import { DEFAULT_NOTIFICATION_PREFERENCES } from "../contracts/constants.js";
import { shiftLocalDateKey, toLocalDateKey } from "../utils/dateTime.js";
import { generateId, nowIso } from "./storeUtils.js";

const DEFAULT_TIMEZONE = "Asia/Jerusalem";
const DEFAULT_LOCALE = "en-US";

function appendToIndex(index, key, value) {
  const current = index.get(key) ?? [];

  if (!current.includes(value)) {
    current.push(value);
    index.set(key, current);
  }
}

function removeFromIndex(index, key, value) {
  const current = index.get(key) ?? [];
  const next = current.filter((entry) => entry !== value);

  if (next.length === 0) {
    index.delete(key);
    return;
  }

  index.set(key, next);
}

function getIndexedEntities(index, entities, key) {
  const ids = index.get(key) ?? [];
  return ids.map((id) => entities.get(id)).filter(Boolean);
}

function difficultyToLabel(difficulty) {
  if (difficulty === "low" || difficulty === "medium" || difficulty === "high") {
    return difficulty;
  }

  if (typeof difficulty === "number") {
    if (difficulty <= 1) {
      return "low";
    }

    if (difficulty >= 3) {
      return "high";
    }
  }

  return "medium";
}

function clonePlanForNextVersion(plan) {
  return {
    ...plan,
    estimate: plan.estimate ? { ...plan.estimate } : undefined,
    milestones: Array.isArray(plan.milestones) ? plan.milestones.map((entry) => ({ ...entry })) : [],
    tasks: Array.isArray(plan.tasks) ? plan.tasks.map((entry) => ({ ...entry })) : []
  };
}

function getPlanEstimate(plan) {
  if (plan.estimate) {
    return {
      min_weeks: plan.estimate.min_weeks,
      max_weeks: plan.estimate.max_weeks,
      confidence: plan.estimate.confidence
    };
  }

  return {
    min_weeks: plan.estimate_min_weeks ?? 4,
    max_weeks: plan.estimate_max_weeks ?? 8,
    confidence: plan.confidence ?? 0.7
  };
}

function retainEntries(array, predicate) {
  let writeIndex = 0;

  for (let readIndex = 0; readIndex < array.length; readIndex += 1) {
    const entry = array[readIndex];

    if (predicate(entry)) {
      array[writeIndex] = entry;
      writeIndex += 1;
    }
  }

  array.length = writeIndex;
}

function createUserRecord(userId, overrides = {}) {
  return {
    id: userId,
    timezone: DEFAULT_TIMEZONE,
    locale: DEFAULT_LOCALE,
    ...overrides
  };
}

function createStoreState(defaultUserId, userOverrides = {}) {
  const users = new Map();
  users.set(defaultUserId, createUserRecord(defaultUserId, userOverrides));

  return {
    users,
    goals: new Map(),
    goalsByUser: new Map(),
    clarificationsByGoal: new Map(),
    assessmentByGoal: new Map(),
    plansByGoal: new Map(),
    plansById: new Map(),
    planJobsByGoal: new Map(),
    milestones: new Map(),
    milestonesByPlan: new Map(),
    tasks: new Map(),
    tasksByGoal: new Map(),
    tasksByPlan: new Map(),
    completionsByTask: new Map(),
    streaksByGoal: new Map(),
    notificationPreferencesByUser: new Map(),
    pushTokensByUser: new Map(),
    remindersSent: [],
    adaptJobs: []
  };
}

function persistPlanRecord(store, plan) {
  const plans = store.plansByGoal.get(plan.goal_id) ?? [];
  plans.push(plan);
  store.plansByGoal.set(plan.goal_id, plans);
  store.plansById.set(plan.id, plan);
  return plan;
}

function persistMilestoneRecord(store, milestone) {
  const milestones = store.milestonesByPlan.get(milestone.plan_id) ?? [];
  milestones.push(milestone);
  store.milestonesByPlan.set(milestone.plan_id, milestones);
  store.milestones.set(milestone.id, milestone);
  return milestone;
}

function persistTaskRecord(store, task) {
  const existing = store.tasks.get(task.id);

  if (existing) {
    if (existing.goal_id !== task.goal_id) {
      removeFromIndex(store.tasksByGoal, existing.goal_id, existing.id);
    }

    if (existing.plan_id !== task.plan_id) {
      removeFromIndex(store.tasksByPlan, existing.plan_id, existing.id);
    }
  }

  store.tasks.set(task.id, task);
  appendToIndex(store.tasksByGoal, task.goal_id, task.id);
  appendToIndex(store.tasksByPlan, task.plan_id, task.id);
  return task;
}

function seedFoundationData(store, userId) {
  const user = store.getUser(userId);
  const nowIso = "2026-03-20T08:05:00.000Z";

  const goal = {
    id: "goal-1",
    user_id: user.id,
    title: "Ship my goal coach MVP",
    status: "active",
    plan_state: "ready",
    specificity_state: "specific",
    specificity_score: 0.92,
    active_at: "2026-03-20T08:00:00.000Z",
    active_plan_id: "plan-1-v1",
    created_at: "2026-03-20T08:00:00.000Z",
    updated_at: "2026-03-20T08:00:00.000Z"
  };

  store.goals.set(goal.id, goal);
  addGoalToUserIndex(store, goal);
  store.clarificationsByGoal.set(goal.id, []);

  const assessment = {
    id: "assessment-goal-1",
    goal_id: goal.id,
    current_level: "founder",
    weekly_minutes_available: 240,
    target_date: "2026-06-01",
    created_at: nowIso
  };

  store.assessmentByGoal.set(goal.id, assessment);

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

  const plan = {
    id: "plan-1-v1",
    goal_id: goal.id,
    version: 1,
    frame_type: "project_outcome",
    feasibility: "realistic",
    estimate: {
      min_weeks: 8,
      max_weeks: 12,
      confidence: 0.78
    },
    estimate_min_weeks: 8,
    estimate_max_weeks: 12,
    confidence: 0.78,
    milestones: milestones.map((milestone) => ({
      title: milestone.title,
      target_week: milestone.target_week,
      success_criteria: milestone.success_criteria
    })),
    tasks: tasks.map((task) => ({
      title: task.title,
      est_minutes: task.est_minutes,
      difficulty: task.difficulty,
      required: task.required
    })),
    created_at: nowIso
  };

  persistPlanRecord(store, plan);

  for (const milestone of milestones) {
    persistMilestoneRecord(store, milestone);
  }

  for (const task of tasks) {
    persistTaskRecord(store, task);
  }

  store.completionsByTask.set("task-1", {
    id: "tc-1",
    task_id: "task-1",
    state: "completed",
    actual_minutes: 43,
    completed_at: "2026-03-24T18:10:00.000Z"
  });

  store.completionsByTask.set("task-2", {
    id: "tc-2",
    task_id: "task-2",
    state: "completed",
    actual_minutes: 38,
    completed_at: "2026-03-25T19:05:00.000Z"
  });

  store.streaksByGoal.set(goal.id, {
    id: "streak-1",
    goal_id: goal.id,
    current_days: 2,
    longest_days: 2,
    last_success_date: "2026-03-25"
  });

  store.notificationPreferencesByUser.set(userId, {
    id: "notif-pref-1",
    user_id: userId,
    ...DEFAULT_NOTIFICATION_PREFERENCES
  });
}

export function createInMemoryStore(options = {}) {
  const {
    seedDemoData = false,
    defaultUserId = "demo-user",
    defaultUser = {}
  } = options;

  const store = createStoreState(defaultUserId, defaultUser);

  function ensureUser(userId, overrides = {}) {
    const existing = store.users.get(userId);

    if (existing) {
      Object.assign(existing, overrides);
      return existing;
    }

    const created = createUserRecord(userId, overrides);
    store.users.set(userId, created);
    return created;
  }

  function buildDemoId(userId, suffix) {
    const normalizedUserId = String(userId)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "guest";

    return `demo-${normalizedUserId}-${suffix}`;
  }

  function removeGoalGraph(goalId) {
    const goal = getGoal(goalId);

    if (!goal) {
      return;
    }

    const planIds = (store.plansByGoal.get(goalId) ?? []).map((plan) => plan.id);

    for (const planId of planIds) {
      const taskIds = (store.tasksByPlan.get(planId) ?? []).slice();

      for (const taskId of taskIds) {
        const task = store.tasks.get(taskId);

        if (!task) {
          continue;
        }

        store.tasks.delete(taskId);
        removeFromIndex(store.tasksByGoal, task.goal_id, taskId);
        removeFromIndex(store.tasksByPlan, task.plan_id, taskId);
        store.completionsByTask.delete(taskId);
      }

      store.tasksByPlan.delete(planId);

      const milestoneIds = (store.milestonesByPlan.get(planId) ?? []).slice();

      for (const milestoneId of milestoneIds) {
        store.milestones.delete(milestoneId);
      }

      store.milestonesByPlan.delete(planId);
      store.plansById.delete(planId);
    }

    store.plansByGoal.delete(goalId);
    store.tasksByGoal.delete(goalId);
    store.streaksByGoal.delete(goalId);
    store.planJobsByGoal.delete(goalId);
    store.assessmentByGoal.delete(goalId);
    store.clarificationsByGoal.delete(goalId);
    store.goals.delete(goalId);
    removeFromIndex(store.goalsByUser, goal.user_id, goalId);
    retainEntries(store.remindersSent, (entry) => entry.goal_id !== goalId);
    retainEntries(store.adaptJobs, (entry) => entry.goal_id !== goalId);
  }

  function resetUserState(userId) {
    ensureUser(userId);

    const goals = getGoalsForUser(api, userId).map((goal) => goal.id);

    for (const goalId of goals) {
      removeGoalGraph(goalId);
    }

    store.notificationPreferencesByUser.delete(userId);
    store.pushTokensByUser.delete(userId);
    retainEntries(store.remindersSent, (entry) => entry.user_id !== userId);
    retainEntries(store.adaptJobs, (entry) => entry.user_id !== userId);

    return getUser(userId);
  }

  function seedDemoState(userId, scenario, now = new Date()) {
    const user = ensureUser(userId);
    const nowIsoValue = now.toISOString();
    const todayKey = toLocalDateKey(now, user.timezone);
    const yesterdayKey = shiftLocalDateKey(todayKey, -1);
    const tomorrowKey = shiftLocalDateKey(todayKey, 1);

    if (scenario === "starter") {
      return {
        user,
        scenario
      };
    }

    const goalId = buildDemoId(userId, "goal");
    const planId = buildDemoId(userId, "plan-v1");
    const status = scenario === "no_active_goal" ? "paused" : "active";
    const goal = {
      id: goalId,
      user_id: userId,
      title: "Build my AI Goal Coach UI",
      status,
      specificity_state: "specific",
      specificity_score: 0.93,
      plan_state: "ready",
      active_at: status === "active" ? nowIsoValue : null,
      active_plan_id: planId,
      created_at: nowIsoValue,
      updated_at: nowIsoValue
    };

    createGoalRecord(goal);

    upsertAssessment(goal.id, {
      id: buildDemoId(userId, "assessment"),
      goal_id: goal.id,
      current_level: "builder",
      weekly_minutes_available: 240,
      target_date: shiftLocalDateKey(todayKey, 60),
      created_at: nowIsoValue
    });

    const milestones = [
      {
        id: buildDemoId(userId, "milestone-1"),
        plan_id: planId,
        title: "Guest auth shell live",
        target_week: 1,
        success_criteria: "Guest session persists and opens the app",
        status: "confirmed",
        user_confirmed_at: nowIsoValue
      },
      {
        id: buildDemoId(userId, "milestone-2"),
        plan_id: planId,
        title: "Daily loop preview screen",
        target_week: 2,
        success_criteria: "Today screen loads and handles empty states",
        status: "pending",
        user_confirmed_at: null
      }
    ];

    const taskDateKeys =
      scenario === "no_tasks_today"
        ? [tomorrowKey, shiftLocalDateKey(tomorrowKey, 1)]
        : [todayKey, todayKey];

    const tasks = [
      {
        id: buildDemoId(userId, "task-1"),
        plan_id: planId,
        goal_id: goal.id,
        scheduled_date: taskDateKeys[0],
        title: "Ship the guest session screen",
        est_minutes: 25,
        difficulty: "low",
        required: true,
        dimension_tag: "auth",
        source: "plan",
        manual_lock: false,
        adjustment_source: "plan"
      },
      {
        id: buildDemoId(userId, "task-2"),
        plan_id: planId,
        goal_id: goal.id,
        scheduled_date: taskDateKeys[1],
        title: "Hook demo scenarios into the UI shell",
        est_minutes: 35,
        difficulty: "medium",
        required: true,
        dimension_tag: "ui",
        source: "plan",
        manual_lock: false,
        adjustment_source: "plan"
      },
      {
        id: buildDemoId(userId, "task-3"),
        plan_id: planId,
        goal_id: goal.id,
        scheduled_date: yesterdayKey,
        title: "Lock down API contracts for onboarding",
        est_minutes: 30,
        difficulty: "medium",
        required: true,
        dimension_tag: "contracts",
        source: "plan",
        manual_lock: false,
        adjustment_source: "plan"
      }
    ];

    const plan = {
      id: planId,
      goal_id: goal.id,
      version: 1,
      frame_type: "project_outcome",
      feasibility: "realistic",
      estimate: {
        min_weeks: 4,
        max_weeks: 6,
        confidence: 0.81
      },
      estimate_min_weeks: 4,
      estimate_max_weeks: 6,
      confidence: 0.81,
      milestones: milestones.map((milestone) => ({
        title: milestone.title,
        target_week: milestone.target_week,
        success_criteria: milestone.success_criteria
      })),
      tasks: tasks.map((task) => ({
        title: task.title,
        est_minutes: task.est_minutes,
        difficulty: task.difficulty,
        required: task.required
      })),
      created_at: nowIsoValue
    };

    persistPlanRecord(store, plan);

    for (const milestone of milestones) {
      persistMilestoneRecord(store, milestone);
    }

    for (const task of tasks) {
      persistTaskRecord(store, task);
    }

    store.completionsByTask.set(buildDemoId(userId, "task-3"), {
      id: buildDemoId(userId, "completion-1"),
      task_id: buildDemoId(userId, "task-3"),
      state: "completed",
      actual_minutes: 28,
      completed_at: nowIsoValue
    });

    store.streaksByGoal.set(goal.id, {
      id: buildDemoId(userId, "streak"),
      goal_id: goal.id,
      current_days: scenario === "no_tasks_today" ? 1 : 2,
      longest_days: 3,
      last_success_date: yesterdayKey
    });

    store.notificationPreferencesByUser.set(userId, {
      id: buildDemoId(userId, "notif-pref"),
      user_id: userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES
    });

    return {
      user,
      goal,
      scenario
    };
  }

  function getUser(userId) {
    return store.users.get(userId) ?? null;
  }

  function getGoal(goalId) {
    return store.goals.get(goalId) ?? null;
  }

  function createGoalRecord(goal) {
    store.goals.set(goal.id, goal);
    addGoalToUserIndex(api, goal);
    store.clarificationsByGoal.set(goal.id, []);
    return goal;
  }

  function getActiveGoal(userId) {
    return getGoalsForUser(api, userId).find((goal) => goal.status === "active") ?? null;
  }

  function listGoalsForUser(userId) {
    return getGoalsForUser(api, userId);
  }

  function updateGoal(goalId, patch) {
    const goal = getGoal(goalId);

    if (!goal) {
      return null;
    }

    Object.assign(goal, patch);
    return goal;
  }

  function activateGoal(goalId, activatedAtIso) {
    const goal = getGoal(goalId);

    if (!goal) {
      return null;
    }

    const userGoals = getGoalsForUser(api, goal.user_id);

    for (const candidate of userGoals) {
      if (candidate.id === goal.id) {
        continue;
      }

      if (candidate.status === "active") {
        candidate.status = "paused";
        candidate.active_at = null;
        candidate.updated_at = activatedAtIso;
      }
    }

    goal.status = "active";
    goal.active_at = activatedAtIso;
    goal.updated_at = activatedAtIso;

    return goal;
  }

  function appendClarifications(goalId, clarifications) {
    const existing = store.clarificationsByGoal.get(goalId) ?? [];
    const merged = [...existing, ...clarifications];
    store.clarificationsByGoal.set(goalId, merged);
    return clarifications;
  }

  function getClarifications(goalId) {
    return store.clarificationsByGoal.get(goalId) ?? [];
  }

  function upsertAssessment(goalId, assessment) {
    store.assessmentByGoal.set(goalId, assessment);
    return assessment;
  }

  function getAssessment(goalId) {
    return store.assessmentByGoal.get(goalId) ?? null;
  }

  function getPlanJob(goalId) {
    return store.planJobsByGoal.get(goalId) ?? null;
  }

  function savePlanJob(goalId, job) {
    store.planJobsByGoal.set(goalId, job);
    return job;
  }

  function updatePlanJob(goalId, patch) {
    const job = getPlanJob(goalId);

    if (!job) {
      return null;
    }

    Object.assign(job, patch);
    return job;
  }

  function getPlan(planId) {
    return store.plansById.get(planId) ?? null;
  }

  function getLatestPlan(goalId) {
    const plans = store.plansByGoal.get(goalId) ?? [];
    return plans[plans.length - 1] ?? null;
  }

  function getActivePlan(goalId) {
    const goal = getGoal(goalId);

    if (!goal) {
      return null;
    }

    if (goal.active_plan_id) {
      return getPlan(goal.active_plan_id);
    }

    return getLatestPlan(goalId);
  }

  function getMilestones(planId) {
    return getIndexedEntities(store.milestonesByPlan, store.milestones, planId);
  }

  function getMilestone(milestoneId) {
    return store.milestones.get(milestoneId) ?? null;
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
    return getIndexedEntities(store.tasksByGoal, store.tasks, goalId);
  }

  function listTasksForPlan(planId) {
    return getIndexedEntities(store.tasksByPlan, store.tasks, planId);
  }

  function listTasksForLocalDate(goalId, localDateKey) {
    return listTasks(goalId).filter((task) => task.scheduled_date === localDateKey);
  }

  function countTasks() {
    return store.tasks.size;
  }

  function getTask(taskId) {
    return store.tasks.get(taskId) ?? null;
  }

  function updateTask(taskId, patch) {
    const task = getTask(taskId);

    if (!task) {
      return null;
    }

    Object.assign(task, patch);
    return task;
  }

  function getCompletion(taskId) {
    return store.completionsByTask.get(taskId) ?? null;
  }

  function listCompletionsForGoal(goalId) {
    return listTasks(goalId)
      .map((task) => getCompletion(task.id))
      .filter(Boolean);
  }

  function upsertCompletion(taskId, payload) {
    const existing = getCompletion(taskId);

    if (existing) {
      Object.assign(existing, payload);
      return existing;
    }

    const created = {
      id: generateId("tc"),
      task_id: taskId,
      ...payload
    };

    store.completionsByTask.set(taskId, created);
    return created;
  }

  function getStreak(goalId) {
    return store.streaksByGoal.get(goalId) ?? null;
  }

  function upsertStreak(goalId, payload) {
    const existing = getStreak(goalId);

    if (existing) {
      Object.assign(existing, payload);
      return existing;
    }

    const created = {
      id: generateId("streak"),
      goal_id: goalId,
      ...payload
    };

    store.streaksByGoal.set(goalId, created);
    return created;
  }

  function persistGeneratedPlan(goalId, payload, clock = Date) {
    const goal = getGoal(goalId);
    const planId = generateId("plan");
    const nextVersion = (store.plansByGoal.get(goalId) ?? []).length + 1;
    const createdAt = nowIso(clock);
    const user = goal ? ensureUser(goal.user_id) : ensureUser(defaultUserId);
    const startDateKey = toLocalDateKey(new clock(), user.timezone);

    const tasks = payload.tasks.map((task, index) => ({
      id: generateId("task"),
      plan_id: planId,
      goal_id: goalId,
      scheduled_date: shiftLocalDateKey(startDateKey, index),
      title: task.title,
      est_minutes: task.est_minutes,
      difficulty: difficultyToLabel(task.difficulty),
      required: Boolean(task.required),
      dimension_tag: null,
      source: "generated",
      manual_lock: false,
      adjustment_source: "plan"
    }));

    const milestones = payload.milestones.map((milestone) => ({
      id: generateId("milestone"),
      plan_id: planId,
      title: milestone.title,
      target_week: milestone.target_week,
      success_criteria: milestone.success_criteria,
      status: "pending",
      user_confirmed_at: null
    }));

    const plan = {
      id: planId,
      goal_id: goalId,
      version: nextVersion,
      frame_type: payload.frame_type,
      feasibility: payload.feasibility,
      estimate: { ...payload.estimate },
      estimate_min_weeks: payload.estimate.min_weeks,
      estimate_max_weeks: payload.estimate.max_weeks,
      confidence: payload.estimate.confidence,
      milestones: milestones.map((entry) => ({
        title: entry.title,
        target_week: entry.target_week,
        success_criteria: entry.success_criteria
      })),
      tasks: tasks.map((entry) => ({
        title: entry.title,
        est_minutes: entry.est_minutes,
        difficulty: entry.difficulty,
        required: entry.required
      })),
      created_at: createdAt
    };

    persistPlanRecord(store, plan);

    for (const milestone of milestones) {
      persistMilestoneRecord(store, milestone);
    }

    for (const task of tasks) {
      persistTaskRecord(store, task);
    }

    if (goal) {
      goal.active_plan_id = plan.id;
      goal.plan_state = "ready";
      goal.updated_at = createdAt;
    }

    return plan;
  }

  function createNextPlanVersion(goalId, basePlan, now, patch = {}) {
    const nextVersion = (store.plansByGoal.get(goalId) ?? []).length + 1;
    const estimate = getPlanEstimate(basePlan);
    const created = {
      ...clonePlanForNextVersion(basePlan),
      ...patch,
      id: generateId("plan"),
      goal_id: goalId,
      version: nextVersion,
      estimate,
      estimate_min_weeks: estimate.min_weeks,
      estimate_max_weeks: estimate.max_weeks,
      confidence: estimate.confidence,
      created_at: now.toISOString()
    };

    persistPlanRecord(store, created);

    const goal = getGoal(goalId);
    if (goal) {
      goal.active_plan_id = created.id;
      goal.plan_state = "ready";
      goal.updated_at = now.toISOString();
    }

    return created;
  }

  function createAdaptJob(goalId, userId, planId, planVersion, now) {
    const job = {
      id: generateId("adapt-job"),
      endpoint: "/adapt",
      goal_id: goalId,
      user_id: userId,
      active_plan_id: planId,
      active_plan_version: planVersion,
      requested_at: now.toISOString(),
      status: "queued"
    };

    store.adaptJobs.push(job);
    return job;
  }

  function createAdaptedTask(task) {
    return persistTaskRecord(store, task);
  }

  function getNotificationPreference(userId) {
    return store.notificationPreferencesByUser.get(userId) ?? null;
  }

  function upsertNotificationPreference(userId, patch) {
    const existing = getNotificationPreference(userId);

    if (existing) {
      Object.assign(existing, patch);
      return existing;
    }

    const created = {
      id: generateId("notif-pref"),
      user_id: userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...patch
    };

    store.notificationPreferencesByUser.set(userId, created);
    return created;
  }

  function upsertPushToken(userId, token, platform, now) {
    const existing = (store.pushTokensByUser.get(userId) ?? []).find((entry) => entry.token === token);

    if (existing) {
      existing.platform = platform;
      existing.updated_at = now.toISOString();
      return existing;
    }

    const created = {
      id: generateId("push-token"),
      user_id: userId,
      token,
      platform,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    const tokens = store.pushTokensByUser.get(userId) ?? [];
    tokens.push(created);
    store.pushTokensByUser.set(userId, tokens);
    return created;
  }

  function hasPushToken(userId) {
    return (store.pushTokensByUser.get(userId) ?? []).length > 0;
  }

  function listRemindersForDate(userId, localDateKey) {
    return store.remindersSent.filter((reminder) => reminder.user_id === userId && reminder.local_date_key === localDateKey);
  }

  function hasReminderBeenSent(userId, goalId, reason) {
    return store.remindersSent.some((reminder) => (
      reminder.user_id === userId &&
      reminder.goal_id === goalId &&
      reminder.reason === reason
    ));
  }

  function createReminder(userId, goalId, reason, now, localDateKey) {
    const reminder = {
      id: generateId("reminder"),
      user_id: userId,
      goal_id: goalId,
      reason,
      sent_at: now.toISOString(),
      local_date_key: localDateKey
    };

    store.remindersSent.push(reminder);
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
    return listTasksForLocalDate(goalId, localDateKey)
      .filter((task) => task.required)
      .filter((task) => getCompletion(task.id)?.state !== "completed").length;
  }

  function getStateSnapshot(now = new Date()) {
    const user = getUser(defaultUserId) ?? ensureUser(defaultUserId);
    const localDateKey = toLocalDateKey(now, user.timezone);

    return {
      localDateKey,
      users: Array.from(store.users.values()),
      goals: Array.from(store.goals.values()),
      plans: Array.from(store.plansById.values()),
      milestones: Array.from(store.milestones.values()),
      tasks: Array.from(store.tasks.values()),
      taskCompletions: Array.from(store.completionsByTask.values()),
      streaks: Array.from(store.streaksByGoal.values()),
      notificationPreferences: Array.from(store.notificationPreferencesByUser.values()),
      pushTokens: Array.from(store.pushTokensByUser.values()).flat(),
      remindersSent: store.remindersSent,
      adaptJobs: store.adaptJobs
    };
  }

  const api = {
    users: store.users,
    goals: store.goals,
    goalsByUser: store.goalsByUser,
    clarificationsByGoal: store.clarificationsByGoal,
    assessmentByGoal: store.assessmentByGoal,
    plansByGoal: store.plansByGoal,
    plansById: store.plansById,
    planJobsByGoal: store.planJobsByGoal,
    milestones: store.milestones,
    milestonesByPlan: store.milestonesByPlan,
    tasks: store.tasks,
    tasksByGoal: store.tasksByGoal,
    tasksByPlan: store.tasksByPlan,
    completionsByTask: store.completionsByTask,
    streaksByGoal: store.streaksByGoal,
    notificationPreferencesByUser: store.notificationPreferencesByUser,
    pushTokensByUser: store.pushTokensByUser,
    remindersSent: store.remindersSent,
    adaptJobs: store.adaptJobs,
    ensureUser,
    getUser,
    createGoalRecord,
    listGoalsForUser,
    getGoal,
    updateGoal,
    activateGoal,
    appendClarifications,
    getClarifications,
    upsertAssessment,
    getAssessment,
    getPlanJob,
    savePlanJob,
    updatePlanJob,
    getActiveGoal,
    getPlan,
    getLatestPlan,
    getActivePlan,
    getMilestones,
    getMilestone,
    confirmMilestone,
    listTasks,
    listTasksForPlan,
    listTasksForLocalDate,
    countTasks,
    createAdaptedTask,
    getTask,
    updateTask,
    getCompletion,
    listCompletionsForGoal,
    upsertCompletion,
    getStreak,
    upsertStreak,
    persistGeneratedPlan,
    createNextPlanVersion,
    createAdaptJob,
    getNotificationPreference,
    upsertNotificationPreference,
    upsertPushToken,
    hasPushToken,
    listRemindersForDate,
    hasReminderBeenSent,
    createReminder,
    markTaskCompleted,
    countIncompleteRequiredTasks,
    resetUserState,
    seedDemoState,
    getStateSnapshot,
    disconnect: async () => {}
  };

  if (seedDemoData) {
    seedFoundationData(api, defaultUserId);
  }

  return api;
}

export function addGoalToUserIndex(store, goal) {
  appendToIndex(store.goalsByUser, goal.user_id, goal.id);
}

export function getGoalsForUser(store, userId) {
  return getIndexedEntities(store.goalsByUser, store.goals, userId);
}
