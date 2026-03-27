import test from "node:test";
import assert from "node:assert/strict";

import { JobPayloadSchemas } from "../src/contracts/schemas.js";

test("worker job payload schemas validate canonical generate_plan/adapt_plan/send_reminder jobs", () => {
  const generatePlanPayload = {
    schema_version: "1.0",
    job_type: "generate_plan",
    job_id: "job-generate-1",
    idempotency_key: "generate-goal-1-v1",
    requested_at: "2026-03-26T12:00:00.000Z",
    user_id: "user-1",
    goal_id: "goal-1",
    goal_text: "Run 10km under 60 minutes by 2026-09-01",
    specificity_state: "specific",
    frame_type: "fitness_performance",
    assessment: {
      current_level: "beginner",
      weekly_minutes_available: 180,
      target_date: "2026-09-01"
    }
  };

  const adaptPlanPayload = {
    schema_version: "1.0",
    job_type: "adapt_plan",
    job_id: "job-adapt-1",
    idempotency_key: "adapt-goal-1-v2",
    requested_at: "2026-03-26T12:10:00.000Z",
    user_id: "user-1",
    goal_id: "goal-1",
    triggered_by: "manual",
    active_plan_id: "plan-2",
    active_plan_version: 2,
    adherence: {
      completion_rate_7d: 0.64,
      tasks_completed_7d: 9,
      tasks_total_7d: 14,
      manual_edits_14d: 2
    },
    constraints: {
      weekly_minutes_available: 180,
      locked_task_horizon_days: 7
    },
    policy_version: "mvp-v1"
  };

  const sendReminderPayload = {
    schema_version: "1.0",
    job_type: "send_reminder",
    job_id: "job-reminder-1",
    idempotency_key: "reminder-goal-1-2026-03-26",
    requested_at: "2026-03-26T12:15:00.000Z",
    user_id: "user-1",
    goal_id: "goal-1",
    notification_preference_id: "notif-pref-1",
    reason: "daily_reminder",
    scheduled_for_utc: "2026-03-26T17:00:00.000Z",
    scheduled_for_local: "2026-03-26 19:00",
    reminder_context: {
      plan_state: "ready",
      incomplete_required_tasks: 2,
      today_completion_count: 1
    },
    caps: {
      max_push_per_day: 1,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00"
    }
  };

  const parsedGenerate = JobPayloadSchemas.generate_plan.parse(generatePlanPayload);
  const parsedAdapt = JobPayloadSchemas.adapt_plan.parse(adaptPlanPayload);
  const parsedReminder = JobPayloadSchemas.send_reminder.parse(sendReminderPayload);

  assert.equal(parsedGenerate.job_type, "generate_plan");
  assert.equal(parsedAdapt.job_type, "adapt_plan");
  assert.equal(parsedReminder.job_type, "send_reminder");
});
