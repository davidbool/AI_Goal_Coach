import { PrismaClient } from "@prisma/client";

import { shiftLocalDateKey, toLocalDateKey } from "../utils/dateTime.js";
import { generateId, nowIso } from "./storeUtils.js";

const DEFAULT_TIMEZONE = "Asia/Jerusalem";
const DEFAULT_LOCALE = "en-US";

const goalStatusToDb = {
  draft: "DRAFT",
  active: "ACTIVE",
  paused: "PAUSED",
  archived: "ARCHIVED"
};

const goalStatusFromDb = {
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived"
};

const specificityStateToDb = {
  specific: "SPECIFIC",
  needs_clarification: "NEEDS_CLARIFICATION"
};

const specificityStateFromDb = {
  SPECIFIC: "specific",
  NEEDS_CLARIFICATION: "needs_clarification"
};

const planStateToDb = {
  needs_clarification: "NEEDS_CLARIFICATION",
  generating: "GENERATING",
  delayed: "DELAYED",
  ready: "READY",
  failed: "FAILED"
};

const planStateFromDb = {
  NEEDS_CLARIFICATION: "needs_clarification",
  GENERATING: "generating",
  DELAYED: "delayed",
  READY: "ready",
  FAILED: "failed"
};

const planningFrameToDb = {
  skill_mastery: "SKILL_MASTERY",
  fitness_performance: "FITNESS_PERFORMANCE",
  project_outcome: "PROJECT_OUTCOME"
};

const planningFrameFromDb = {
  SKILL_MASTERY: "skill_mastery",
  FITNESS_PERFORMANCE: "fitness_performance",
  PROJECT_OUTCOME: "project_outcome"
};

const feasibilityToDb = {
  realistic: "REALISTIC",
  stretched: "STRETCHED",
  unrealistic: "UNREALISTIC"
};

const feasibilityFromDb = {
  REALISTIC: "realistic",
  STRETCHED: "stretched",
  UNREALISTIC: "unrealistic"
};

const milestoneStatusToDb = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  completed: "COMPLETED"
};

const milestoneStatusFromDb = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed"
};

const taskDifficultyToDb = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH"
};

const taskDifficultyFromDb = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high"
};

const taskSourceToDb = {
  plan: "PLAN",
  generated: "GENERATED",
  adapted: "ADAPTED",
  manual: "MANUAL"
};

const taskSourceFromDb = {
  PLAN: "plan",
  GENERATED: "generated",
  ADAPTED: "adapted",
  MANUAL: "manual"
};

const adjustmentSourceToDb = {
  plan: "PLAN",
  same_day_soft: "SAME_DAY_SOFT",
  full_adapt: "FULL_ADAPT",
  full_adaptation: "FULL_ADAPT"
};

const adjustmentSourceFromDb = {
  PLAN: "plan",
  SAME_DAY_SOFT: "same_day_soft",
  FULL_ADAPT: "full_adaptation"
};

const taskCompletionStateToDb = {
  completed: "COMPLETED",
  skipped: "SKIPPED",
  partial: "PARTIAL"
};

const taskCompletionStateFromDb = {
  COMPLETED: "completed",
  SKIPPED: "skipped",
  PARTIAL: "partial"
};

function mapEnum(value, mapping, fallback = value) {
  if (value === null || value === undefined) {
    return null;
  }

  return mapping[value] ?? fallback;
}

function localDateKeyToDate(localDateKey) {
  return new Date(`${localDateKey}T00:00:00.000Z`);
}

function dateToLocalDateKey(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function asIsoString(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function mapUserRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    timezone: record.timezone,
    locale: record.locale,
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapGoalRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    user_id: record.userId,
    title: record.title,
    status: mapEnum(record.status, goalStatusFromDb),
    plan_state: mapEnum(record.planState, planStateFromDb),
    specificity_state: mapEnum(record.specificityState, specificityStateFromDb),
    specificity_score: record.specificityScore,
    active_at: asIsoString(record.activeAt),
    active_plan_id: record.activePlanId ?? null,
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapClarificationRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    goal_id: record.goalId,
    question_text: record.questionText,
    answer_text: record.answerText,
    created_at: asIsoString(record.createdAt)
  };
}

function mapAssessmentRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    goal_id: record.goalId,
    current_level: record.currentLevel,
    weekly_minutes_available: record.weeklyMinutesAvailable,
    target_date: dateToLocalDateKey(record.targetDate),
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapMilestoneRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    plan_id: record.planId,
    title: record.title,
    target_week: record.targetWeek,
    success_criteria: record.successCriteria,
    status: mapEnum(record.status, milestoneStatusFromDb),
    user_confirmed_at: asIsoString(record.userConfirmedAt),
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapTaskRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    plan_id: record.planId,
    goal_id: record.goalId,
    scheduled_date: dateToLocalDateKey(record.scheduledDate),
    title: record.title,
    est_minutes: record.estMinutes,
    difficulty: mapEnum(record.difficulty, taskDifficultyFromDb),
    required: Boolean(record.required),
    dimension_tag: record.dimensionTag ?? null,
    source: mapEnum(record.source, taskSourceFromDb),
    manual_lock: Boolean(record.manualLock),
    adjustment_source: mapEnum(record.adjustmentSource, adjustmentSourceFromDb),
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapCompletionRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    task_id: record.taskId,
    state: mapEnum(record.state, taskCompletionStateFromDb),
    actual_minutes: record.actualMinutes ?? null,
    completed_at: asIsoString(record.completedAt),
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapStreakRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    goal_id: record.goalId,
    current_days: record.currentDays,
    longest_days: record.longestDays,
    last_success_date: dateToLocalDateKey(record.lastSuccessDate),
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapNotificationPreferenceRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    user_id: record.userId,
    reminder_time_local: record.reminderTimeLocal,
    quiet_hours_start: record.quietHoursStart,
    quiet_hours_end: record.quietHoursEnd,
    max_push_per_day: record.maxPushPerDay,
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapPushTokenRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    user_id: record.userId,
    token: record.token,
    platform: record.platform,
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapPlanRecord(record) {
  if (!record) {
    return null;
  }

  const milestones = Array.isArray(record.milestones) ? record.milestones.map(mapMilestoneRecord) : [];
  const tasks = Array.isArray(record.tasks) ? record.tasks.map(mapTaskRecord) : [];

  return {
    id: record.id,
    goal_id: record.goalId,
    version: record.version,
    frame_type: mapEnum(record.frameType, planningFrameFromDb),
    feasibility: mapEnum(record.feasibility, feasibilityFromDb),
    estimate: {
      min_weeks: record.estimateMinWeeks,
      max_weeks: record.estimateMaxWeeks,
      confidence: record.confidence
    },
    estimate_min_weeks: record.estimateMinWeeks,
    estimate_max_weeks: record.estimateMaxWeeks,
    confidence: record.confidence,
    milestones,
    tasks,
    created_at: asIsoString(record.createdAt),
    updated_at: asIsoString(record.updatedAt)
  };
}

function mapGoalPatch(patch) {
  const data = {};

  if (patch.title !== undefined) {
    data.title = patch.title;
  }

  if (patch.status !== undefined) {
    data.status = mapEnum(patch.status, goalStatusToDb);
  }

  if (patch.plan_state !== undefined) {
    data.planState = mapEnum(patch.plan_state, planStateToDb);
  }

  if (patch.specificity_state !== undefined) {
    data.specificityState = mapEnum(patch.specificity_state, specificityStateToDb);
  }

  if (patch.specificity_score !== undefined) {
    data.specificityScore = patch.specificity_score;
  }

  if (patch.active_at !== undefined) {
    data.activeAt = patch.active_at ? new Date(patch.active_at) : null;
  }

  if (patch.active_plan_id !== undefined) {
    data.activePlanId = patch.active_plan_id;
  }

  if (patch.updated_at !== undefined) {
    data.updatedAt = new Date(patch.updated_at);
  }

  return data;
}

function mapTaskPatch(patch) {
  const data = {};

  if (patch.plan_id !== undefined) {
    data.planId = patch.plan_id;
  }

  if (patch.goal_id !== undefined) {
    data.goalId = patch.goal_id;
  }

  if (patch.scheduled_date !== undefined) {
    data.scheduledDate = localDateKeyToDate(patch.scheduled_date);
  }

  if (patch.title !== undefined) {
    data.title = patch.title;
  }

  if (patch.est_minutes !== undefined) {
    data.estMinutes = patch.est_minutes;
  }

  if (patch.difficulty !== undefined) {
    data.difficulty = mapEnum(patch.difficulty, taskDifficultyToDb);
  }

  if (patch.required !== undefined) {
    data.required = patch.required;
  }

  if (patch.dimension_tag !== undefined) {
    data.dimensionTag = patch.dimension_tag;
  }

  if (patch.source !== undefined) {
    data.source = mapEnum(patch.source, taskSourceToDb);
  }

  if (patch.manual_lock !== undefined) {
    data.manualLock = patch.manual_lock;
  }

  if (patch.adjustment_source !== undefined) {
    data.adjustmentSource = mapEnum(patch.adjustment_source, adjustmentSourceToDb);
  }

  return data;
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

export function createPrismaStore(options = {}) {
  const prisma = options.prisma ?? new PrismaClient();
  const defaultUserId = options.defaultUserId ?? "demo-user";
  const defaultUser = {
    timezone: DEFAULT_TIMEZONE,
    locale: DEFAULT_LOCALE,
    ...(options.defaultUser ?? {})
  };
  const seedDemoData = Boolean(options.seedDemoData);
  const planJobsByGoal = new Map();
  const remindersSent = [];
  const adaptJobs = [];

  let initialized = null;

  async function ensureUserRecord(userId, overrides = {}) {
    const timezone = overrides.timezone ?? defaultUser.timezone ?? DEFAULT_TIMEZONE;
    const locale = overrides.locale ?? defaultUser.locale ?? DEFAULT_LOCALE;

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {
        timezone,
        locale
      },
      create: {
        id: userId,
        timezone,
        locale
      }
    });

    return mapUserRecord(user);
  }

  async function seedFoundationData() {
    const existingGoal = await prisma.goal.findUnique({ where: { id: "goal-1" } });

    if (existingGoal) {
      return;
    }

    await ensureUserRecord(defaultUserId, defaultUser);

    const nowIsoValue = "2026-03-20T08:05:00.000Z";
    const now = new Date(nowIsoValue);
    const goalCreatedAt = new Date("2026-03-20T08:00:00.000Z");

    await prisma.goal.create({
      data: {
        id: "goal-1",
        userId: defaultUserId,
        title: "Ship my goal coach MVP",
        status: "ACTIVE",
        planState: "READY",
        specificityState: "SPECIFIC",
        specificityScore: 0.92,
        activeAt: goalCreatedAt,
        activePlanId: "plan-1-v1",
        createdAt: goalCreatedAt,
        updatedAt: goalCreatedAt
      }
    });

    await prisma.goalAssessment.create({
      data: {
        id: "assessment-goal-1",
        goalId: "goal-1",
        currentLevel: "founder",
        weeklyMinutesAvailable: 240,
        targetDate: localDateKeyToDate("2026-06-01"),
        createdAt: now,
        updatedAt: now
      }
    });

    await prisma.plan.create({
      data: {
        id: "plan-1-v1",
        goalId: "goal-1",
        version: 1,
        frameType: "PROJECT_OUTCOME",
        feasibility: "REALISTIC",
        estimateMinWeeks: 8,
        estimateMaxWeeks: 12,
        confidence: 0.78,
        createdAt: now,
        updatedAt: now
      }
    });

    await prisma.milestone.createMany({
      data: [
        {
          id: "ms-1",
          planId: "plan-1-v1",
          title: "Core backend endpoints",
          targetWeek: 2,
          successCriteria: "All core API endpoints respond with contract-safe payloads",
          status: "PENDING",
          userConfirmedAt: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: "ms-2",
          planId: "plan-1-v1",
          title: "Integration tests passing",
          targetWeek: 4,
          successCriteria: "Green CI on module integration suite",
          status: "PENDING",
          userConfirmedAt: null,
          createdAt: now,
          updatedAt: now
        }
      ]
    });

    await prisma.task.createMany({
      data: [
        {
          id: "task-1",
          planId: "plan-1-v1",
          goalId: "goal-1",
          scheduledDate: localDateKeyToDate("2026-03-24"),
          title: "Write progress API contract test",
          estMinutes: 45,
          difficulty: "MEDIUM",
          required: true,
          dimensionTag: "quality",
          source: "PLAN",
          manualLock: false,
          adjustmentSource: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: "task-2",
          planId: "plan-1-v1",
          goalId: "goal-1",
          scheduledDate: localDateKeyToDate("2026-03-25"),
          title: "Implement adherence metric",
          estMinutes: 35,
          difficulty: "MEDIUM",
          required: true,
          dimensionTag: "execution",
          source: "PLAN",
          manualLock: false,
          adjustmentSource: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: "task-3",
          planId: "plan-1-v1",
          goalId: "goal-1",
          scheduledDate: localDateKeyToDate("2026-03-26"),
          title: "Wire milestone confirmation flow",
          estMinutes: 40,
          difficulty: "MEDIUM",
          required: true,
          dimensionTag: "execution",
          source: "PLAN",
          manualLock: false,
          adjustmentSource: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: "task-4",
          planId: "plan-1-v1",
          goalId: "goal-1",
          scheduledDate: localDateKeyToDate("2026-03-26"),
          title: "Set up reminder eligibility checks",
          estMinutes: 30,
          difficulty: "LOW",
          required: true,
          dimensionTag: "consistency",
          source: "PLAN",
          manualLock: false,
          adjustmentSource: null,
          createdAt: now,
          updatedAt: now
        }
      ]
    });

    await prisma.taskCompletion.createMany({
      data: [
        {
          id: "tc-1",
          taskId: "task-1",
          state: "COMPLETED",
          actualMinutes: 43,
          completedAt: new Date("2026-03-24T18:10:00.000Z"),
          createdAt: now,
          updatedAt: now
        },
        {
          id: "tc-2",
          taskId: "task-2",
          state: "COMPLETED",
          actualMinutes: 38,
          completedAt: new Date("2026-03-25T19:05:00.000Z"),
          createdAt: now,
          updatedAt: now
        }
      ]
    });

    await prisma.streak.create({
      data: {
        id: "streak-1",
        goalId: "goal-1",
        currentDays: 2,
        longestDays: 2,
        lastSuccessDate: localDateKeyToDate("2026-03-25"),
        createdAt: now,
        updatedAt: now
      }
    });

    await prisma.notificationPreference.create({
      data: {
        id: "notif-pref-1",
        userId: defaultUserId,
        reminderTimeLocal: "20:00",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        maxPushPerDay: 2,
        createdAt: now,
        updatedAt: now
      }
    });
  }

  async function initialize() {
    await prisma.$connect();
    await ensureUserRecord(defaultUserId, defaultUser);

    if (seedDemoData) {
      await seedFoundationData();
    }
  }

  async function ready() {
    if (!initialized) {
      initialized = initialize();
    }

    await initialized;
  }

  async function ensureUser(userId, overrides = {}) {
    await ready();
    return ensureUserRecord(userId, overrides);
  }

  async function getUser(userId) {
    await ready();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return mapUserRecord(user);
  }

  async function createGoalRecord(goal) {
    await ready();

    const created = await prisma.goal.create({
      data: {
        id: goal.id,
        userId: goal.user_id,
        title: goal.title,
        status: mapEnum(goal.status, goalStatusToDb),
        planState: mapEnum(goal.plan_state, planStateToDb),
        specificityState: mapEnum(goal.specificity_state, specificityStateToDb),
        specificityScore: goal.specificity_score,
        activeAt: goal.active_at ? new Date(goal.active_at) : null,
        activePlanId: goal.active_plan_id ?? null,
        createdAt: new Date(goal.created_at),
        updatedAt: new Date(goal.updated_at)
      }
    });

    return mapGoalRecord(created);
  }

  async function listGoalsForUser(userId) {
    await ready();
    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    return goals.map(mapGoalRecord);
  }

  async function getGoal(goalId) {
    await ready();
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    return mapGoalRecord(goal);
  }

  async function updateGoal(goalId, patch) {
    await ready();
    const updated = await prisma.goal.update({
      where: { id: goalId },
      data: mapGoalPatch(patch)
    });
    return mapGoalRecord(updated);
  }

  async function activateGoal(goalId, activatedAtIso) {
    await ready();
    const activatedAt = new Date(activatedAtIso);

    const activatedGoal = await prisma.$transaction(async (tx) => {
      const goal = await tx.goal.findUnique({
        where: { id: goalId }
      });

      if (!goal) {
        return null;
      }

      await tx.goal.updateMany({
        where: {
          userId: goal.userId,
          status: "ACTIVE",
          NOT: { id: goalId }
        },
        data: {
          status: "PAUSED",
          activeAt: null,
          updatedAt: activatedAt
        }
      });

      return tx.goal.update({
        where: { id: goalId },
        data: {
          status: "ACTIVE",
          activeAt: activatedAt,
          updatedAt: activatedAt
        }
      });
    });

    return mapGoalRecord(activatedGoal);
  }

  async function appendClarifications(goalId, clarifications) {
    await ready();

    if (clarifications.length === 0) {
      return [];
    }

    await prisma.goalClarification.createMany({
      data: clarifications.map((entry) => ({
        id: entry.id,
        goalId,
        questionText: entry.question_text,
        answerText: entry.answer_text,
        createdAt: new Date(entry.created_at)
      }))
    });

    return clarifications;
  }

  async function getClarifications(goalId) {
    await ready();
    const clarifications = await prisma.goalClarification.findMany({
      where: { goalId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    return clarifications.map(mapClarificationRecord);
  }

  async function upsertAssessment(goalId, assessment) {
    await ready();
    const createdAt = new Date(assessment.created_at);

    const saved = await prisma.goalAssessment.upsert({
      where: { goalId },
      update: {
        currentLevel: assessment.current_level,
        weeklyMinutesAvailable: assessment.weekly_minutes_available,
        targetDate: assessment.target_date ? localDateKeyToDate(assessment.target_date) : null,
        updatedAt: createdAt
      },
      create: {
        id: assessment.id,
        goalId,
        currentLevel: assessment.current_level,
        weeklyMinutesAvailable: assessment.weekly_minutes_available,
        targetDate: assessment.target_date ? localDateKeyToDate(assessment.target_date) : null,
        createdAt,
        updatedAt: createdAt
      }
    });

    return mapAssessmentRecord(saved);
  }

  async function getAssessment(goalId) {
    await ready();
    const assessment = await prisma.goalAssessment.findUnique({ where: { goalId } });
    return mapAssessmentRecord(assessment);
  }

  async function getPlanJob(goalId) {
    await ready();
    return planJobsByGoal.get(goalId) ?? null;
  }

  async function savePlanJob(goalId, job) {
    await ready();
    planJobsByGoal.set(goalId, { ...job });
    return planJobsByGoal.get(goalId);
  }

  async function updatePlanJob(goalId, patch) {
    await ready();
    const existing = planJobsByGoal.get(goalId) ?? null;

    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...patch };
    planJobsByGoal.set(goalId, updated);
    return updated;
  }

  async function getPlan(planId) {
    await ready();
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        milestones: {
          orderBy: [{ targetWeek: "asc" }, { id: "asc" }]
        },
        tasks: {
          orderBy: [{ scheduledDate: "asc" }, { id: "asc" }]
        }
      }
    });

    return mapPlanRecord(plan);
  }

  async function getLatestPlan(goalId) {
    await ready();
    const plan = await prisma.plan.findFirst({
      where: { goalId },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      include: {
        milestones: {
          orderBy: [{ targetWeek: "asc" }, { id: "asc" }]
        },
        tasks: {
          orderBy: [{ scheduledDate: "asc" }, { id: "asc" }]
        }
      }
    });

    return mapPlanRecord(plan);
  }

  async function getActiveGoal(userId) {
    await ready();
    const goal = await prisma.goal.findFirst({
      where: {
        userId,
        status: "ACTIVE"
      },
      orderBy: [{ activeAt: "desc" }, { updatedAt: "desc" }]
    });

    return mapGoalRecord(goal);
  }

  async function getActivePlan(goalId) {
    await ready();
    const goal = await prisma.goal.findUnique({
      where: { id: goalId }
    });

    if (!goal) {
      return null;
    }

    if (goal.activePlanId) {
      return getPlan(goal.activePlanId);
    }

    return getLatestPlan(goalId);
  }

  async function getMilestones(planId) {
    await ready();
    const milestones = await prisma.milestone.findMany({
      where: { planId },
      orderBy: [{ targetWeek: "asc" }, { id: "asc" }]
    });

    return milestones.map(mapMilestoneRecord);
  }

  async function getMilestone(milestoneId) {
    await ready();
    const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    return mapMilestoneRecord(milestone);
  }

  async function confirmMilestone(milestoneId, confirmedAt) {
    await ready();
    const milestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: "CONFIRMED",
        userConfirmedAt: confirmedAt,
        updatedAt: confirmedAt
      }
    });
    return mapMilestoneRecord(milestone);
  }

  async function listTasks(goalId) {
    await ready();
    const tasks = await prisma.task.findMany({
      where: { goalId },
      orderBy: [{ scheduledDate: "asc" }, { id: "asc" }]
    });
    return tasks.map(mapTaskRecord);
  }

  async function listTasksForPlan(planId) {
    await ready();
    const tasks = await prisma.task.findMany({
      where: { planId },
      orderBy: [{ scheduledDate: "asc" }, { id: "asc" }]
    });
    return tasks.map(mapTaskRecord);
  }

  async function listTasksForLocalDate(goalId, localDateKey) {
    await ready();
    const tasks = await prisma.task.findMany({
      where: {
        goalId,
        scheduledDate: localDateKeyToDate(localDateKey)
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    return tasks.map(mapTaskRecord);
  }

  async function countTasks() {
    await ready();
    return prisma.task.count();
  }

  async function createAdaptedTask(task) {
    await ready();
    const created = await prisma.task.create({
      data: {
        id: task.id,
        planId: task.plan_id,
        goalId: task.goal_id,
        scheduledDate: localDateKeyToDate(task.scheduled_date),
        title: task.title,
        estMinutes: task.est_minutes,
        difficulty: mapEnum(task.difficulty, taskDifficultyToDb),
        required: Boolean(task.required),
        dimensionTag: task.dimension_tag ?? null,
        source: mapEnum(task.source, taskSourceToDb),
        manualLock: Boolean(task.manual_lock),
        adjustmentSource: mapEnum(task.adjustment_source, adjustmentSourceToDb)
      }
    });
    return mapTaskRecord(created);
  }

  async function getTask(taskId) {
    await ready();
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    return mapTaskRecord(task);
  }

  async function updateTask(taskId, patch) {
    await ready();
    const task = await prisma.task.update({
      where: { id: taskId },
      data: mapTaskPatch(patch)
    });
    return mapTaskRecord(task);
  }

  async function getCompletion(taskId) {
    await ready();
    const completion = await prisma.taskCompletion.findUnique({
      where: { taskId }
    });
    return mapCompletionRecord(completion);
  }

  async function listCompletionsForGoal(goalId) {
    await ready();
    const completions = await prisma.taskCompletion.findMany({
      where: {
        task: {
          goalId
        }
      },
      orderBy: [{ completedAt: "asc" }, { createdAt: "asc" }],
      include: {
        task: false
      }
    });
    return completions.map(mapCompletionRecord);
  }

  async function upsertCompletion(taskId, payload) {
    await ready();
    const now = payload.completed_at ? new Date(payload.completed_at) : new Date();

    const completion = await prisma.taskCompletion.upsert({
      where: { taskId },
      update: {
        state: mapEnum(payload.state, taskCompletionStateToDb),
        actualMinutes: payload.actual_minutes ?? null,
        completedAt: payload.completed_at ? new Date(payload.completed_at) : null,
        updatedAt: now
      },
      create: {
        id: generateId("tc"),
        taskId,
        state: mapEnum(payload.state, taskCompletionStateToDb),
        actualMinutes: payload.actual_minutes ?? null,
        completedAt: payload.completed_at ? new Date(payload.completed_at) : null,
        createdAt: now,
        updatedAt: now
      }
    });

    return mapCompletionRecord(completion);
  }

  async function getStreak(goalId) {
    await ready();
    const streak = await prisma.streak.findUnique({ where: { goalId } });
    return mapStreakRecord(streak);
  }

  async function upsertStreak(goalId, payload) {
    await ready();
    const updatedAt = new Date();

    const streak = await prisma.streak.upsert({
      where: { goalId },
      update: {
        currentDays: payload.current_days,
        longestDays: payload.longest_days,
        lastSuccessDate: payload.last_success_date ? localDateKeyToDate(payload.last_success_date) : null,
        updatedAt
      },
      create: {
        id: generateId("streak"),
        goalId,
        currentDays: payload.current_days,
        longestDays: payload.longest_days,
        lastSuccessDate: payload.last_success_date ? localDateKeyToDate(payload.last_success_date) : null,
        createdAt: updatedAt,
        updatedAt
      }
    });

    return mapStreakRecord(streak);
  }

  async function persistGeneratedPlan(goalId, payload, clock = Date) {
    await ready();
    const createdAt = nowIso(clock);
    const createdAtDate = new Date(createdAt);
    const goal = await getGoal(goalId);
    const user = goal ? await getUser(goal.user_id) : await ensureUser(defaultUserId, defaultUser);
    const startDateKey = toLocalDateKey(new clock(), user?.timezone ?? DEFAULT_TIMEZONE);
    const existingPlan = await prisma.plan.count({
      where: { goalId }
    });
    const planId = generateId("plan");
    const nextVersion = existingPlan + 1;

    await prisma.$transaction(async (tx) => {
      await tx.plan.create({
        data: {
          id: planId,
          goalId,
          version: nextVersion,
          frameType: mapEnum(payload.frame_type, planningFrameToDb),
          feasibility: mapEnum(payload.feasibility, feasibilityToDb),
          estimateMinWeeks: payload.estimate.min_weeks,
          estimateMaxWeeks: payload.estimate.max_weeks,
          confidence: payload.estimate.confidence,
          createdAt: createdAtDate,
          updatedAt: createdAtDate
        }
      });

      if (payload.milestones.length > 0) {
        await tx.milestone.createMany({
          data: payload.milestones.map((milestone) => ({
            id: generateId("milestone"),
            planId,
            title: milestone.title,
            targetWeek: milestone.target_week,
            successCriteria: milestone.success_criteria,
            status: "PENDING",
            userConfirmedAt: null,
            createdAt: createdAtDate,
            updatedAt: createdAtDate
          }))
        });
      }

      if (payload.tasks.length > 0) {
        await tx.task.createMany({
          data: payload.tasks.map((task, index) => ({
            id: generateId("task"),
            planId,
            goalId,
            scheduledDate: localDateKeyToDate(shiftLocalDateKey(startDateKey, index)),
            title: task.title,
            estMinutes: task.est_minutes,
            difficulty: mapEnum(task.difficulty, taskDifficultyToDb),
            required: Boolean(task.required),
            dimensionTag: null,
            source: "GENERATED",
            manualLock: false,
            adjustmentSource: "PLAN",
            createdAt: createdAtDate,
            updatedAt: createdAtDate
          }))
        });
      }

      await tx.goal.update({
        where: { id: goalId },
        data: {
          activePlanId: planId,
          planState: "READY",
          updatedAt: createdAtDate
        }
      });
    });

    return getPlan(planId);
  }

  async function createNextPlanVersion(goalId, basePlan, now, patch = {}) {
    await ready();
    const estimate = getPlanEstimate(basePlan);
    const existingPlanCount = await prisma.plan.count({ where: { goalId } });
    const createdAt = now instanceof Date ? now : new Date(now);
    const planId = generateId("plan");

    await prisma.$transaction(async (tx) => {
      await tx.plan.create({
        data: {
          id: planId,
          goalId,
          version: existingPlanCount + 1,
          frameType: mapEnum(basePlan.frame_type, planningFrameToDb),
          feasibility: mapEnum(basePlan.feasibility, feasibilityToDb),
          estimateMinWeeks: estimate.min_weeks,
          estimateMaxWeeks: estimate.max_weeks,
          confidence: estimate.confidence,
          createdAt,
          updatedAt: createdAt
        }
      });

      await tx.goal.update({
        where: { id: goalId },
        data: {
          activePlanId: planId,
          planState: "READY",
          updatedAt: createdAt
        }
      });
    });

    const created = await getPlan(planId);

    return {
      ...created,
      based_on_plan_id: patch.based_on_plan_id,
      adaptation_source: patch.adaptation_source,
      triggered_by: patch.triggered_by
    };
  }

  async function createAdaptJob(goalId, userId, planId, planVersion, now) {
    await ready();
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

    adaptJobs.push(job);
    return job;
  }

  async function getNotificationPreference(userId) {
    await ready();
    const preference = await prisma.notificationPreference.findUnique({
      where: { userId }
    });
    return mapNotificationPreferenceRecord(preference);
  }

  async function upsertNotificationPreference(userId, patch) {
    await ready();

    const preference = await prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        reminderTimeLocal: patch.reminder_time_local,
        quietHoursStart: patch.quiet_hours_start,
        quietHoursEnd: patch.quiet_hours_end,
        maxPushPerDay: patch.max_push_per_day
      },
      create: {
        id: generateId("notif-pref"),
        userId,
        reminderTimeLocal: patch.reminder_time_local ?? "20:00",
        quietHoursStart: patch.quiet_hours_start ?? "22:00",
        quietHoursEnd: patch.quiet_hours_end ?? "07:00",
        maxPushPerDay: patch.max_push_per_day ?? 2
      }
    });

    return mapNotificationPreferenceRecord(preference);
  }

  async function upsertPushToken(userId, token, platform, now) {
    await ready();

    const pushToken = await prisma.pushToken.upsert({
      where: {
        userId_token: {
          userId,
          token
        }
      },
      update: {
        platform,
        updatedAt: now
      },
      create: {
        id: generateId("push-token"),
        userId,
        token,
        platform,
        createdAt: now,
        updatedAt: now
      }
    });

    return mapPushTokenRecord(pushToken);
  }

  async function hasPushToken(userId) {
    await ready();
    const count = await prisma.pushToken.count({
      where: { userId }
    });
    return count > 0;
  }

  async function listRemindersForDate(userId, localDateKey) {
    await ready();
    return remindersSent.filter((reminder) => reminder.user_id === userId && reminder.local_date_key === localDateKey);
  }

  async function hasReminderBeenSent(userId, goalId, reason) {
    await ready();
    return remindersSent.some((reminder) => (
      reminder.user_id === userId &&
      reminder.goal_id === goalId &&
      reminder.reason === reason
    ));
  }

  async function createReminder(userId, goalId, reason, now, localDateKey) {
    await ready();
    const reminder = {
      id: generateId("reminder"),
      user_id: userId,
      goal_id: goalId,
      reason,
      sent_at: now.toISOString(),
      local_date_key: localDateKey
    };

    remindersSent.push(reminder);
    return reminder;
  }

  async function markTaskCompleted(taskId, completedAt = new Date()) {
    await ready();
    const task = await getTask(taskId);

    if (!task) {
      return null;
    }

    return upsertCompletion(taskId, {
      state: "completed",
      actual_minutes: task.est_minutes,
      completed_at: completedAt.toISOString()
    });
  }

  async function countIncompleteRequiredTasks(goalId, localDateKey) {
    await ready();
    const tasks = await listTasksForLocalDate(goalId, localDateKey);

    let incomplete = 0;

    for (const task of tasks) {
      if (!task.required) {
        continue;
      }

      const completion = await getCompletion(task.id);

      if (completion?.state !== "completed") {
        incomplete += 1;
      }
    }

    return incomplete;
  }

  async function getStateSnapshot() {
    await ready();
    const [users, goals, plans, milestones, tasks, taskCompletions, streaks, notificationPreferences, pushTokens] =
      await prisma.$transaction([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.goal.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.plan.findMany({ orderBy: [{ version: "asc" }, { id: "asc" }] }),
        prisma.milestone.findMany({ orderBy: [{ targetWeek: "asc" }, { id: "asc" }] }),
        prisma.task.findMany({ orderBy: [{ scheduledDate: "asc" }, { id: "asc" }] }),
        prisma.taskCompletion.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
        prisma.streak.findMany({ orderBy: { id: "asc" } }),
        prisma.notificationPreference.findMany({ orderBy: { id: "asc" } }),
        prisma.pushToken.findMany({ orderBy: { id: "asc" } })
      ]);

    return {
      users: users.map(mapUserRecord),
      goals: goals.map(mapGoalRecord),
      plans: plans.map(mapPlanRecord),
      milestones: milestones.map(mapMilestoneRecord),
      tasks: tasks.map(mapTaskRecord),
      taskCompletions: taskCompletions.map(mapCompletionRecord),
      streaks: streaks.map(mapStreakRecord),
      notificationPreferences: notificationPreferences.map(mapNotificationPreferenceRecord),
      pushTokens: pushTokens.map(mapPushTokenRecord),
      remindersSent: [...remindersSent],
      adaptJobs: [...adaptJobs]
    };
  }

  async function disconnect() {
    await prisma.$disconnect();
  }

  return {
    prisma,
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
    getPlan,
    getLatestPlan,
    getActiveGoal,
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
    getStateSnapshot,
    disconnect
  };
}
