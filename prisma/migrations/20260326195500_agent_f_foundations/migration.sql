CREATE TYPE "GoalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "SpecificityState" AS ENUM ('SPECIFIC', 'NEEDS_CLARIFICATION');
CREATE TYPE "PlanState" AS ENUM ('NEEDS_CLARIFICATION', 'GENERATING', 'DELAYED', 'READY', 'FAILED');
CREATE TYPE "FrameType" AS ENUM ('SKILL_MASTERY', 'FITNESS_PERFORMANCE', 'PROJECT_OUTCOME');
CREATE TYPE "Feasibility" AS ENUM ('REALISTIC', 'STRETCHED', 'UNREALISTIC');
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED');
CREATE TYPE "TaskDifficulty" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "TaskSource" AS ENUM ('PLAN', 'GENERATED', 'ADAPTED', 'MANUAL');
CREATE TYPE "AdjustmentSource" AS ENUM ('PLAN', 'SAME_DAY_SOFT', 'FULL_ADAPT');
CREATE TYPE "TaskCompletionState" AS ENUM ('COMPLETED', 'SKIPPED', 'PARTIAL');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goals" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "GoalStatus" NOT NULL,
  "plan_state" "PlanState",
  "specificity_state" "SpecificityState" NOT NULL,
  "specificity_score" DOUBLE PRECISION,
  "active_at" TIMESTAMP(3),
  "active_plan_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goal_clarifications" (
  "id" TEXT NOT NULL,
  "goal_id" TEXT NOT NULL,
  "question_text" TEXT NOT NULL,
  "answer_text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_clarifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goal_assessments" (
  "id" TEXT NOT NULL,
  "goal_id" TEXT NOT NULL,
  "current_level" TEXT NOT NULL,
  "weekly_minutes_available" INTEGER NOT NULL,
  "target_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goal_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plans" (
  "id" TEXT NOT NULL,
  "goal_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "frame_type" "FrameType" NOT NULL,
  "feasibility" "Feasibility" NOT NULL,
  "estimate_min_weeks" INTEGER NOT NULL,
  "estimate_max_weeks" INTEGER NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "milestones" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "target_week" INTEGER NOT NULL,
  "success_criteria" TEXT NOT NULL,
  "status" "MilestoneStatus" NOT NULL,
  "user_confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "goal_id" TEXT NOT NULL,
  "scheduled_date" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "est_minutes" INTEGER NOT NULL,
  "difficulty" "TaskDifficulty" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "dimension_tag" TEXT,
  "source" "TaskSource" NOT NULL,
  "manual_lock" BOOLEAN NOT NULL DEFAULT false,
  "adjustment_source" "AdjustmentSource",
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_completions" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "state" "TaskCompletionState" NOT NULL,
  "actual_minutes" INTEGER,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress_snapshots" (
  "id" TEXT NOT NULL,
  "goal_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "adherence_7d" DOUBLE PRECISION NOT NULL,
  "streak_current" INTEGER NOT NULL,
  "streak_longest" INTEGER NOT NULL,
  "milestones_done" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "progress_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "streaks" (
  "id" TEXT NOT NULL,
  "goal_id" TEXT NOT NULL,
  "current_days" INTEGER NOT NULL,
  "longest_days" INTEGER NOT NULL,
  "last_success_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reminder_time_local" TEXT NOT NULL,
  "quiet_hours_start" TEXT NOT NULL,
  "quiet_hours_end" TEXT NOT NULL,
  "max_push_per_day" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goal_assessments_goal_id_key" ON "goal_assessments"("goal_id");
CREATE UNIQUE INDEX "plans_goal_id_version_key" ON "plans"("goal_id", "version");
CREATE UNIQUE INDEX "task_completions_task_id_key" ON "task_completions"("task_id");
CREATE UNIQUE INDEX "progress_snapshots_goal_id_date_key" ON "progress_snapshots"("goal_id", "date");
CREATE UNIQUE INDEX "streaks_goal_id_key" ON "streaks"("goal_id");
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");
CREATE UNIQUE INDEX "push_tokens_user_id_token_key" ON "push_tokens"("user_id", "token");

CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");
CREATE INDEX "goal_clarifications_goal_id_created_at_idx" ON "goal_clarifications"("goal_id", "created_at");
CREATE INDEX "plans_goal_id_created_at_idx" ON "plans"("goal_id", "created_at");
CREATE INDEX "milestones_plan_id_target_week_idx" ON "milestones"("plan_id", "target_week");
CREATE INDEX "tasks_goal_id_scheduled_date_idx" ON "tasks"("goal_id", "scheduled_date");
CREATE INDEX "tasks_plan_id_scheduled_date_idx" ON "tasks"("plan_id", "scheduled_date");
CREATE INDEX "progress_snapshots_goal_id_date_idx" ON "progress_snapshots"("goal_id", "date");

CREATE UNIQUE INDEX "goals_one_active_per_user"
ON "goals" ("user_id")
WHERE "status" = 'ACTIVE';

ALTER TABLE "goals"
ADD CONSTRAINT "goals_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goal_clarifications"
ADD CONSTRAINT "goal_clarifications_goal_id_fkey"
FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goal_assessments"
ADD CONSTRAINT "goal_assessments_goal_id_fkey"
FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plans"
ADD CONSTRAINT "plans_goal_id_fkey"
FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "milestones"
ADD CONSTRAINT "milestones_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_goal_id_fkey"
FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_completions"
ADD CONSTRAINT "task_completions_task_id_fkey"
FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "progress_snapshots"
ADD CONSTRAINT "progress_snapshots_goal_id_fkey"
FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "streaks"
ADD CONSTRAINT "streaks_goal_id_fkey"
FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preferences"
ADD CONSTRAINT "notification_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_tokens"
ADD CONSTRAINT "push_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
