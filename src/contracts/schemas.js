import { z } from "zod";

import {
  AdaptTrigger,
  AdjustmentSource,
  Feasibility,
  GoalStatus,
  MilestoneStatus,
  NotificationPlatform,
  PlanState,
  PlanningFrame,
  ReminderReason,
  SpecificityState,
  TaskDifficulty,
  TaskSource,
  TaskState
} from "./constants.js";

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const GoalStatusSchema = z.enum(Object.values(GoalStatus));
export const SpecificityStateSchema = z.enum(Object.values(SpecificityState));
export const PlanStateSchema = z.enum(Object.values(PlanState));
export const PlanningFrameSchema = z.enum(Object.values(PlanningFrame));
export const FeasibilitySchema = z.enum(Object.values(Feasibility));
export const MilestoneStatusSchema = z.enum(Object.values(MilestoneStatus));
export const TaskDifficultySchema = z.enum(Object.values(TaskDifficulty));
export const TaskStateSchema = z.enum(Object.values(TaskState));
export const TaskSourceSchema = z.enum(Object.values(TaskSource));
export const AdjustmentSourceSchema = z.enum(Object.values(AdjustmentSource));
export const AdaptTriggerSchema = z.enum(Object.values(AdaptTrigger));
export const ReminderReasonSchema = z.enum(Object.values(ReminderReason));
export const NotificationPlatformSchema = z.enum(Object.values(NotificationPlatform));

export const GoalSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    title: z.string(),
    status: GoalStatusSchema,
    specificity_state: SpecificityStateSchema,
    specificity_score: z.number().min(0).max(1).optional(),
    plan_state: PlanStateSchema.nullable(),
    active_at: IsoDateTimeSchema.nullable(),
    active_plan_id: z.string().nullable().optional(),
    created_at: IsoDateTimeSchema.optional(),
    updated_at: IsoDateTimeSchema.optional()
  })
  .strict();

export const ClarificationSchema = z
  .object({
    id: z.string(),
    goal_id: z.string(),
    question_text: z.string(),
    answer_text: z.string(),
    created_at: IsoDateTimeSchema
  })
  .strict();

export const AssessmentSchema = z
  .object({
    id: z.string(),
    goal_id: z.string(),
    current_level: z.string(),
    weekly_minutes_available: z.number().int().min(30).max(1260),
    target_date: IsoDateSchema.nullable(),
    created_at: IsoDateTimeSchema
  })
  .strict();

export const PlanEstimateSchema = z
  .object({
    min_weeks: z.number().int().min(1),
    max_weeks: z.number().int().min(1),
    confidence: z.number().min(0).max(1)
  })
  .strict();

export const PlanMilestoneSchema = z
  .object({
    title: z.string(),
    target_week: z.number().int().min(1),
    success_criteria: z.string()
  })
  .strict();

export const PlanTaskSchema = z
  .object({
    title: z.string(),
    est_minutes: z.number().int().min(1),
    difficulty: z.union([z.number().int().min(1).max(3), TaskDifficultySchema]),
    required: z.boolean()
  })
  .strict();

export const PlanDisplaySchema = z
  .object({
    plan_id: z.string(),
    version: z.number().int().min(1),
    frame_type: PlanningFrameSchema,
    feasibility: FeasibilitySchema,
    estimate: PlanEstimateSchema,
    milestones: z.array(PlanMilestoneSchema),
    first_tasks: z.array(PlanTaskSchema)
  })
  .strict();

export const TaskSchema = z
  .object({
    id: z.string(),
    plan_id: z.string().nullable().optional(),
    goal_id: z.string().nullable().optional(),
    scheduled_date: IsoDateSchema.optional(),
    title: z.string(),
    est_minutes: z.number().int().min(1).optional(),
    estMinutes: z.number().int().min(1).optional(),
    difficulty: TaskDifficultySchema,
    required: z.boolean(),
    state: TaskStateSchema.optional(),
    dimension_tag: z.string().nullable().optional(),
    source: TaskSourceSchema.optional(),
    manual_lock: z.boolean().optional(),
    manualLock: z.boolean().optional(),
    adjustment_source: AdjustmentSourceSchema.optional(),
    adjustmentSource: AdjustmentSourceSchema.optional()
  })
  .strict();

export const TaskCompletionSchema = z
  .object({
    id: z.string(),
    task_id: z.string(),
    state: TaskStateSchema,
    actual_minutes: z.number().int().min(1).nullable(),
    completed_at: IsoDateTimeSchema.nullable()
  })
  .strict();

export const ProgressSchema = z
  .object({
    goal_id: z.string(),
    plan_id: z.string(),
    plan_version: z.number().int().min(1),
    generated_at: IsoDateTimeSchema,
    adherence_7d: z.number().min(0).max(1),
    adherence: z
      .object({
        completion_rate_7d: z.number().min(0).max(1),
        tasks_completed_7d: z.number().int().min(0),
        tasks_total_7d: z.number().int().min(0)
      })
      .strict(),
    streak: z
      .object({
        current_days: z.number().int().min(0),
        longest_days: z.number().int().min(0),
        last_success_date: IsoDateSchema.nullable()
      })
      .strict(),
    milestones_done: z.number().int().min(0),
    milestones: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          target_week: z.number().int().min(1),
          success_criteria: z.string(),
          status: MilestoneStatusSchema,
          user_confirmed_at: IsoDateTimeSchema.nullable()
        })
        .strict()
    )
  })
  .strict();

export const MilestoneSchema = z
  .object({
    id: z.string(),
    plan_id: z.string(),
    title: z.string(),
    target_week: z.number().int().min(1),
    success_criteria: z.string(),
    status: MilestoneStatusSchema,
    user_confirmed_at: IsoDateTimeSchema.nullable()
  })
  .strict();

export const NotificationPreferenceSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    reminder_time_local: z.string(),
    quiet_hours_start: z.string(),
    quiet_hours_end: z.string(),
    max_push_per_day: z.number().int().min(1).max(2)
  })
  .strict();

export const PushTokenSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    token: z.string(),
    platform: z.string(),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema
  })
  .strict();

export const SpecificityEvaluationSchema = z
  .object({
    state: SpecificityStateSchema,
    score: z.number().min(0).max(1),
    missing_elements: z.array(z.string()),
    clarification_questions: z.array(z.string())
  })
  .strict();

const EmptySchema = z.object({}).strict();

export const ApiContracts = {
  create_goal: {
    method: "POST",
    path: "/v1/goals",
    params: EmptySchema,
    body: z
      .object({
        user_id: z.string().optional(),
        title: z.string().min(1)
      })
      .strict(),
    response: z
      .object({
        goal: GoalSchema,
        specificity: SpecificityEvaluationSchema.optional()
      })
      .strict()
  },
  list_goals: {
    method: "GET",
    path: "/v1/goals",
    params: EmptySchema,
    body: EmptySchema,
    response: z
      .object({
        goals: z.array(GoalSchema)
      })
      .strict()
  },
  activate_goal: {
    method: "POST",
    path: "/v1/goals/:goalId/activate",
    params: z.object({ goalId: z.string() }).strict(),
    body: EmptySchema,
    response: z
      .object({
        goal: GoalSchema
      })
      .strict()
  },
  patch_goal_status: {
    method: "PATCH",
    path: "/v1/goals/:goalId/status",
    params: z.object({ goalId: z.string() }).strict(),
    body: z
      .object({
        status: GoalStatusSchema
      })
      .strict(),
    response: z
      .object({
        goal: GoalSchema
      })
      .strict()
  },
  submit_clarifications: {
    method: "POST",
    path: "/v1/goals/:goalId/clarifications",
    params: z.object({ goalId: z.string() }).strict(),
    body: z
      .object({
        answers: z
          .array(
            z
              .object({
                question_text: z.string().min(1),
                answer_text: z.string().min(1)
              })
              .strict()
          )
          .min(1)
      })
      .strict(),
    response: z
      .object({
        goal: GoalSchema.optional(),
        persisted_answers: z.array(ClarificationSchema).optional(),
        specificity: SpecificityEvaluationSchema.optional()
      })
      .strict()
  },
  submit_assessment: {
    method: "POST",
    path: "/v1/goals/:goalId/assessment",
    params: z.object({ goalId: z.string() }).strict(),
    body: z
      .object({
        current_level: z.string().min(1),
        weekly_minutes_available: z.number().int().min(30).max(1260),
        target_date: IsoDateSchema.optional()
      })
      .strict(),
    response: z
      .object({
        assessment: AssessmentSchema
      })
      .strict()
  },
  generate_plan: {
    method: "POST",
    path: "/v1/goals/:goalId/plans/generate",
    params: z.object({ goalId: z.string() }).strict(),
    body: z.object({ force: z.boolean().optional() }).strict(),
    response: z
      .object({
        goal_id: z.string(),
        plan_state: PlanStateSchema,
        started_at: IsoDateTimeSchema,
        delayed_after_ms: z.number().int().positive()
      })
      .strict()
  },
  plan_status: {
    method: "GET",
    path: "/v1/goals/:goalId/plans/status",
    params: z.object({ goalId: z.string() }).strict(),
    body: EmptySchema,
    response: z
      .object({
        goal_id: z.string(),
        plan_state: PlanStateSchema.nullable(),
        plan: PlanDisplaySchema.nullable()
      })
      .strict()
  },
  today_tasks: {
    method: "GET",
    path: "/v1/goals/active/tasks/today",
    params: EmptySchema,
    body: EmptySchema,
    response: z
      .object({
        date: IsoDateSchema,
        goal_id: z.string().optional(),
        planVersion: z.number().int().min(1).optional(),
        feedback: z.string().optional(),
        tasks: z.array(TaskSchema)
      })
      .strict()
  },
  complete_task: {
    method: "POST",
    path: "/v1/tasks/:taskId/complete",
    params: z.object({ taskId: z.string() }).strict(),
    body: z
      .object({
        actual_minutes: z.number().int().min(1).optional()
      })
      .strict(),
    response: z
      .object({
        task: TaskSchema,
        completion: TaskCompletionSchema.optional()
      })
      .strict()
  },
  skip_task: {
    method: "POST",
    path: "/v1/tasks/:taskId/skip",
    params: z.object({ taskId: z.string() }).strict(),
    body: z
      .object({
        reason: z.string().optional()
      })
      .strict(),
    response: z
      .object({
        task: TaskSchema,
        completion: TaskCompletionSchema.optional()
      })
      .strict()
  },
  edit_task: {
    method: "PATCH",
    path: "/v1/tasks/:taskId",
    params: z.object({ taskId: z.string() }).strict(),
    body: z
      .object({
        title: z.string().min(1).optional(),
        est_minutes: z.number().int().min(1).optional(),
        estMinutes: z.number().int().min(1).optional(),
        difficulty: TaskDifficultySchema.optional(),
        required: z.boolean().optional()
      })
      .strict(),
    response: z
      .object({
        task: TaskSchema
      })
      .strict()
  },
  soft_adjust: {
    method: "POST",
    path: "/v1/goals/active/soft-adjust",
    params: EmptySchema,
    body: EmptySchema,
    response: z
      .object({
        tasks: z.array(TaskSchema),
        adjustmentSource: AdjustmentSourceSchema.optional(),
        adjustment_source: AdjustmentSourceSchema.optional(),
        planVersion: z.number().int().min(1).optional(),
        feedback: z.string().optional()
      })
      .strict()
  },
  adapt_goal: {
    method: "POST",
    path: "/v1/goals/active/adapt",
    params: EmptySchema,
    body: z
      .object({
        triggered_by: AdaptTriggerSchema.optional()
      })
      .strict(),
    response: z
      .object({
        endpoint: z.literal("/adapt"),
        adapt_job_id: z.string(),
        goal_id: z.string(),
        previous_plan_id: z.string(),
        previous_plan_version: z.number().int().min(1),
        new_plan_id: z.string(),
        new_plan_version: z.number().int().min(1),
        tasks_cloned: z.number().int().min(0)
      })
      .strict()
  },
  confirm_milestone: {
    method: "POST",
    path: "/v1/milestones/:milestoneId/confirm",
    params: z.object({ milestoneId: z.string() }).strict(),
    body: EmptySchema,
    response: z
      .object({
        milestone: MilestoneSchema
      })
      .strict()
  },
  progress: {
    method: "GET",
    path: "/v1/goals/active/progress",
    params: EmptySchema,
    body: EmptySchema,
    response: z
      .object({
        progress: ProgressSchema,
        screen: z.object({}).passthrough()
      })
      .strict()
  },
  register_notification_token: {
    method: "POST",
    path: "/v1/notifications/token",
    params: EmptySchema,
    body: z
      .object({
        token: z.string().min(1),
        platform: NotificationPlatformSchema.or(z.string().min(1)).optional()
      })
      .strict(),
    response: z
      .object({
        token: PushTokenSchema
      })
      .strict()
  },
  update_notification_preferences: {
    method: "PATCH",
    path: "/v1/notifications/preferences",
    params: EmptySchema,
    body: z
      .object({
        reminder_time_local: z.string().optional(),
        quiet_hours_start: z.string().optional(),
        quiet_hours_end: z.string().optional(),
        max_push_per_day: z.number().int().min(1).max(2).optional()
      })
      .strict(),
    response: z
      .object({
        preference: NotificationPreferenceSchema
      })
      .strict()
  },
  send_reminder: {
    method: "POST",
    path: "/v1/notifications/reminders/send",
    params: EmptySchema,
    body: z
      .object({
        goal_id: z.string().optional(),
        reason: ReminderReasonSchema.optional()
      })
      .strict(),
    response: z
      .object({
        sent: z.boolean(),
        blocked_reason: z.string().nullable().optional(),
        local_date_key: IsoDateSchema,
        incomplete_required_tasks: z.number().int().min(0),
        reminder: z
          .object({
            id: z.string(),
            user_id: z.string(),
            goal_id: z.string(),
            reason: ReminderReasonSchema.or(z.string()),
            sent_at: IsoDateTimeSchema,
            local_date_key: IsoDateSchema
          })
          .strict()
          .optional()
      })
      .strict()
  }
};

export const JobPayloadSchemas = {
  generate_plan: z
    .object({
      schema_version: z.literal("1.0"),
      job_type: z.literal("generate_plan"),
      job_id: z.string(),
      idempotency_key: z.string(),
      requested_at: IsoDateTimeSchema,
      user_id: z.string(),
      goal_id: z.string(),
      goal_text: z.string(),
      specificity_state: z.literal("specific"),
      frame_type: PlanningFrameSchema,
      assessment: z
        .object({
          current_level: z.string(),
          weekly_minutes_available: z.number().int().min(30).max(1260),
          target_date: IsoDateSchema.optional()
        })
        .strict()
    })
    .strict(),
  adapt_plan: z
    .object({
      schema_version: z.literal("1.0"),
      job_type: z.literal("adapt_plan"),
      job_id: z.string(),
      idempotency_key: z.string(),
      requested_at: IsoDateTimeSchema,
      user_id: z.string(),
      goal_id: z.string(),
      triggered_by: AdaptTriggerSchema,
      active_plan_id: z.string(),
      active_plan_version: z.number().int().min(1),
      adherence: z
        .object({
          completion_rate_7d: z.number().min(0).max(1),
          tasks_completed_7d: z.number().int().min(0),
          tasks_total_7d: z.number().int().min(1),
          manual_edits_14d: z.number().int().min(0).optional()
        })
        .strict(),
      constraints: z
        .object({
          weekly_minutes_available: z.number().int().min(30).max(1260),
          locked_task_horizon_days: z.literal(7)
        })
        .strict(),
      policy_version: z.literal("mvp-v1").optional()
    })
    .strict(),
  send_reminder: z
    .object({
      schema_version: z.literal("1.0"),
      job_type: z.literal("send_reminder"),
      job_id: z.string(),
      idempotency_key: z.string(),
      requested_at: IsoDateTimeSchema,
      user_id: z.string(),
      goal_id: z.string(),
      notification_preference_id: z.string(),
      reason: ReminderReasonSchema,
      scheduled_for_utc: IsoDateTimeSchema,
      scheduled_for_local: z.string().optional(),
      reminder_context: z
        .object({
          plan_state: PlanStateSchema,
          incomplete_required_tasks: z.number().int().min(0),
          today_completion_count: z.number().int().min(0).optional()
        })
        .strict(),
      caps: z
        .object({
          max_push_per_day: z.number().int().min(1).max(2),
          quiet_hours_start: z.string(),
          quiet_hours_end: z.string()
        })
        .strict()
    })
    .strict()
};

export function parseApiRequest(contractKey, payload) {
  const contract = ApiContracts[contractKey];

  if (!contract) {
    throw new Error(`Unknown API contract: ${contractKey}`);
  }

  return {
    params: contract.params.parse(payload.params ?? {}),
    body: contract.body.parse(payload.body ?? {})
  };
}

export function parseApiResponse(contractKey, payload) {
  const contract = ApiContracts[contractKey];

  if (!contract) {
    throw new Error(`Unknown API contract: ${contractKey}`);
  }

  return contract.response.parse(payload);
}
