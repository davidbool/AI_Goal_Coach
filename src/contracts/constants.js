export const GoalStatus = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived"
});

export const SpecificityState = Object.freeze({
  SPECIFIC: "specific",
  NEEDS_CLARIFICATION: "needs_clarification"
});

export const PlanState = Object.freeze({
  NEEDS_CLARIFICATION: "needs_clarification",
  GENERATING: "generating",
  DELAYED: "delayed",
  READY: "ready",
  FAILED: "failed"
});

export const PlanningFrame = Object.freeze({
  SKILL_MASTERY: "skill_mastery",
  FITNESS_PERFORMANCE: "fitness_performance",
  PROJECT_OUTCOME: "project_outcome"
});

export const Feasibility = Object.freeze({
  REALISTIC: "realistic",
  STRETCHED: "stretched",
  UNREALISTIC: "unrealistic"
});

export const MilestoneStatus = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed"
});

export const TaskDifficulty = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high"
});

export const TaskState = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  SKIPPED: "skipped",
  PARTIAL: "partial"
});

export const TaskSource = Object.freeze({
  PLAN: "plan",
  GENERATED: "generated",
  ADAPTED: "adapted",
  MANUAL: "manual"
});

export const AdjustmentSource = Object.freeze({
  PLAN: "plan",
  SAME_DAY_SOFT: "same_day_soft",
  FULL_ADAPT: "full_adapt",
  FULL_ADAPTATION: "full_adaptation"
});

export const AdaptTrigger = Object.freeze({
  DAILY_SCHEDULER: "daily_scheduler",
  MANUAL: "manual"
});

export const ReminderReason = Object.freeze({
  DAILY_REMINDER: "daily_reminder",
  DELAYED_PLAN_READY: "delayed_plan_ready"
});

export const NotificationPlatform = Object.freeze({
  IOS: "ios",
  ANDROID: "android",
  UNKNOWN: "unknown"
});

export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  reminder_time_local: "20:00",
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  max_push_per_day: 2
});

export const JobType = Object.freeze({
  GENERATE_PLAN: "generate_plan",
  ADAPT_PLAN: "adapt_plan",
  SEND_REMINDER: "send_reminder"
});

export const VALID_GOAL_STATUSES = new Set(Object.values(GoalStatus));
export const VALID_SPECIFICITY_STATES = new Set(Object.values(SpecificityState));
export const VALID_PLAN_STATES = new Set(Object.values(PlanState));
export const VALID_PLANNING_FRAMES = new Set(Object.values(PlanningFrame));
export const VALID_FEASIBILITY = new Set(Object.values(Feasibility));
export const VALID_MILESTONE_STATUSES = new Set(Object.values(MilestoneStatus));
export const VALID_TASK_DIFFICULTIES = new Set(Object.values(TaskDifficulty));
export const VALID_TASK_STATES = new Set(Object.values(TaskState));
export const VALID_TASK_SOURCES = new Set(Object.values(TaskSource));
export const VALID_ADJUSTMENT_SOURCES = new Set(Object.values(AdjustmentSource));
export const VALID_ADAPT_TRIGGERS = new Set(Object.values(AdaptTrigger));
export const VALID_REMINDER_REASONS = new Set(Object.values(ReminderReason));
export const VALID_NOTIFICATION_PLATFORMS = new Set(Object.values(NotificationPlatform));
export const VALID_JOB_TYPES = new Set(Object.values(JobType));
