import express from "express";
import { ZodError } from "zod";

import { parseApiRequest, parseApiResponse } from "./contracts/schemas.js";
import { notFound } from "./contracts/validators.js";
import { TaskDifficulty, TaskState } from "./contracts/constants.js";
import { triggerFullAdaptation } from "./modules/m4/adaptationService.js";
import { confirmMilestoneForActiveGoal } from "./modules/m4/milestoneService.js";
import { buildProgressScreenModel, getActiveGoalProgress, recalculateStreak } from "./modules/m4/progressService.js";
import { registerPushToken, sendReminderIfEligible, updateReminderPreferences } from "./modules/m5/notificationService.js";
import { createConfiguredStore } from "./repositories/storeFactory.js";
import { GoalService } from "./services/goalService.js";
import { GoalSpecificityService } from "./services/goalSpecificityService.js";
import { MockAiClient } from "./services/mockAiClient.js";
import { PlanService } from "./services/planService.js";
import { toLocalDateKey } from "./utils/dateTime.js";

function resolveUserId(req, defaultUserId) {
  return String(req.query.user_id ?? req.query.userId ?? defaultUserId);
}

async function findUser(store, userId) {
  const user = await store.getUser(userId);

  if (!user) {
    throw notFound(`User ${userId} not found`);
  }

  return user;
}

async function findActiveGoal(store, userId) {
  const goal = await store.getActiveGoal(userId);

  if (!goal) {
    throw notFound("No active goal found");
  }

  return goal;
}

async function findTask(store, taskId) {
  const task = await store.getTask(taskId);

  if (!task) {
    throw notFound(`Task ${taskId} not found`);
  }

  return task;
}

function taskDifficultyAsLabel(difficulty) {
  if (difficulty === TaskDifficulty.LOW || difficulty === TaskDifficulty.MEDIUM || difficulty === TaskDifficulty.HIGH) {
    return difficulty;
  }

  if (typeof difficulty === "number") {
    if (difficulty <= 1) {
      return TaskDifficulty.LOW;
    }

    if (difficulty >= 3) {
      return TaskDifficulty.HIGH;
    }
  }

  return TaskDifficulty.MEDIUM;
}

function mapTask(task, completion = null) {
  return {
    id: task.id,
    plan_id: task.plan_id ?? null,
    goal_id: task.goal_id ?? null,
    scheduled_date: task.scheduled_date,
    title: task.title,
    est_minutes: task.est_minutes,
    difficulty: taskDifficultyAsLabel(task.difficulty),
    required: Boolean(task.required),
    state: completion?.state ?? TaskState.PENDING,
    dimension_tag: task.dimension_tag ?? null,
    source: task.source ?? "plan",
    manual_lock: Boolean(task.manual_lock),
    adjustment_source: task.adjustment_source ?? "plan"
  };
}

function lowerDifficulty(difficulty) {
  if (difficulty === TaskDifficulty.HIGH) {
    return TaskDifficulty.MEDIUM;
  }

  if (difficulty === TaskDifficulty.MEDIUM) {
    return TaskDifficulty.LOW;
  }

  return TaskDifficulty.LOW;
}

function respond(res, contractKey, statusCode, payload) {
  res.status(statusCode).json(parseApiResponse(contractKey, payload));
}

function classifyStatus(error) {
  if (error instanceof ZodError) {
    return 400;
  }

  if (Number.isInteger(error?.status)) {
    return error.status;
  }

  const message = error?.message ?? "";

  if (/not found/i.test(message)) {
    return 404;
  }

  if (/invalid|required|must be|cannot|quiet hours|daily cap/i.test(message)) {
    return 400;
  }

  return 500;
}

function route(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function createApp(overrides = {}) {
  const defaultUserId = overrides.defaultUserId ?? "demo-user";
  const store =
    overrides.store ??
    createConfiguredStore({
      defaultUserId,
      storeMode: overrides.storeMode,
      seedDemoData: overrides.seedDemoData ?? false,
      defaultUser: overrides.defaultUser,
      prisma: overrides.prisma
    });
  const aiClient = overrides.aiClient ?? new MockAiClient();
  const clock = overrides.clock ?? Date;
  const nowProvider = overrides.nowProvider ?? (() => new clock());

  const specificityService =
    overrides.specificityService ?? new GoalSpecificityService({ aiClient });

  const goalService =
    overrides.goalService ?? new GoalService({ store, specificityService, clock });

  const planService =
    overrides.planService ?? new PlanService({ store, goalService, aiClient, clock });

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post("/v1/goals", route(async (req, res) => {
    const rawBody = req.body ?? {};
    const { body } = parseApiRequest("create_goal", {
      body: {
        user_id: rawBody.user_id ?? defaultUserId,
        title: rawBody.title
      }
    });

    const result = await goalService.createGoal(body);
    respond(res, "create_goal", 201, result);
  }));

  app.get("/v1/goals", route(async (req, res) => {
    const userId = resolveUserId(req, defaultUserId);
    const goals = await goalService.listGoals(userId);
    respond(res, "list_goals", 200, { goals });
  }));

  app.patch("/v1/goals/:goalId/status", route(async (req, res) => {
      const { params, body } = parseApiRequest("patch_goal_status", {
        params: req.params,
        body: req.body ?? {}
      });

      const goal = await goalService.patchGoalStatus(params.goalId, body.status);
      respond(res, "patch_goal_status", 200, { goal });
  }));

  app.post("/v1/goals/:goalId/activate", route(async (req, res) => {
      const { params } = parseApiRequest("activate_goal", {
        params: req.params,
        body: req.body ?? {}
      });

      const goal = await goalService.activateGoal(params.goalId);
      respond(res, "activate_goal", 200, { goal });
  }));

  app.post("/v1/goals/:goalId/clarifications", route(async (req, res) => {
      const { params, body } = parseApiRequest("submit_clarifications", {
        params: req.params,
        body: req.body ?? {}
      });

      const result = await goalService.submitClarifications(params.goalId, body.answers);
      respond(res, "submit_clarifications", 200, result);
  }));

  app.post("/v1/goals/:goalId/assessment", route(async (req, res) => {
      const { params, body } = parseApiRequest("submit_assessment", {
        params: req.params,
        body: req.body ?? {}
      });

      const assessment = await goalService.submitAssessment(params.goalId, body);
      respond(res, "submit_assessment", 200, { assessment });
  }));

  app.post("/v1/goals/:goalId/plans/generate", route(async (req, res) => {
      const { params, body } = parseApiRequest("generate_plan", {
        params: req.params,
        body: req.body ?? {}
      });

      const result = await planService.triggerGeneration(params.goalId, body.force);
      respond(res, "generate_plan", 202, result);
  }));

  app.get("/v1/goals/:goalId/plans/status", route(async (req, res) => {
      const { params } = parseApiRequest("plan_status", {
        params: req.params,
        body: {}
      });

      const status = await planService.getStatus(params.goalId);
      respond(res, "plan_status", 200, status);
  }));

  app.get("/v1/goals/active/tasks/today", route(async (req, res) => {
      const userId = resolveUserId(req, defaultUserId);
      const user = await findUser(store, userId);
      const activeGoal = await findActiveGoal(store, userId);
      const now = nowProvider();
      const localDateKey = toLocalDateKey(now, user.timezone);
      const plan = await store.getActivePlan(activeGoal.id);
      const taskRecords = await store.listTasksForLocalDate(activeGoal.id, localDateKey);
      const tasks = await Promise.all(
        taskRecords.map(async (task) => mapTask(task, await store.getCompletion(task.id)))
      );

      respond(res, "today_tasks", 200, {
        date: localDateKey,
        goal_id: activeGoal.id,
        planVersion: plan?.version ?? 1,
        feedback: "You are set for today. Small steps are enough.",
        tasks
      });
  }));

  app.post("/v1/tasks/:taskId/complete", route(async (req, res) => {
      const { params, body } = parseApiRequest("complete_task", {
        params: req.params,
        body: req.body ?? {}
      });
      const task = await findTask(store, params.taskId);
      const now = nowProvider();
      const completion = await store.upsertCompletion(task.id, {
        state: TaskState.COMPLETED,
        actual_minutes: body.actual_minutes ?? task.est_minutes,
        completed_at: now.toISOString()
      });
      const goal = await store.getGoal(task.goal_id);
      const user = goal ? await store.getUser(goal.user_id) : null;

      if (goal && user) {
        await recalculateStreak(store, goal.id, now, user.timezone);
      }

      respond(res, "complete_task", 200, {
        task: mapTask(task, completion),
        completion
      });
  }));

  app.post("/v1/tasks/:taskId/skip", route(async (req, res) => {
      const { params } = parseApiRequest("skip_task", {
        params: req.params,
        body: req.body ?? {}
      });
      const task = await findTask(store, params.taskId);
      const completion = await store.upsertCompletion(task.id, {
        state: TaskState.SKIPPED,
        actual_minutes: null,
        completed_at: nowProvider().toISOString()
      });

      respond(res, "skip_task", 200, {
        task: mapTask(task, completion),
        completion
      });
  }));

  app.patch("/v1/tasks/:taskId", route(async (req, res) => {
      const { params, body } = parseApiRequest("edit_task", {
        params: req.params,
        body: req.body ?? {}
      });
      const task = await findTask(store, params.taskId);

      const updatedTask = await store.updateTask(task.id, {
        title: body.title ?? task.title,
        est_minutes: body.est_minutes ?? body.estMinutes ?? task.est_minutes,
        difficulty: body.difficulty ?? task.difficulty,
        required: body.required ?? task.required,
        manual_lock: true,
        source: "manual",
        adjustment_source: "plan"
      });

      respond(res, "edit_task", 200, {
        task: mapTask(updatedTask, await store.getCompletion(task.id))
      });
  }));

  app.post("/v1/goals/active/soft-adjust", route(async (req, res) => {
      parseApiRequest("soft_adjust", { params: {}, body: req.body ?? {} });

      const userId = resolveUserId(req, defaultUserId);
      const user = await findUser(store, userId);
      const activeGoal = await findActiveGoal(store, userId);
      const activePlan = await store.getActivePlan(activeGoal.id);
      const localDateKey = toLocalDateKey(nowProvider(), user.timezone);
      const todayTasks = await store.listTasksForLocalDate(activeGoal.id, localDateKey);

      for (const task of todayTasks) {
        const completion = await store.getCompletion(task.id);
        const isPending = !completion || completion.state === TaskState.PENDING;

        if (!isPending || task.manual_lock) {
          continue;
        }

        await store.updateTask(task.id, {
          est_minutes: Math.max(5, Math.round(task.est_minutes * 0.75)),
          difficulty: lowerDifficulty(taskDifficultyAsLabel(task.difficulty)),
          adjustment_source: "same_day_soft",
          source: "adapted"
        });
      }

      const refreshedTasks = await store.listTasksForLocalDate(activeGoal.id, localDateKey);
      const pendingAdjusted = [];

      for (const task of refreshedTasks) {
        const completion = await store.getCompletion(task.id);

        if (!completion || completion.state === TaskState.PENDING) {
          pendingAdjusted.push(mapTask(task, completion));
        }
      }

      respond(res, "soft_adjust", 200, {
        tasks: pendingAdjusted,
        adjustmentSource: "same_day_soft",
        planVersion: activePlan?.version ?? 1,
        feedback: "We lightened today to keep your momentum."
      });
  }));

  app.get("/v1/goals/active/progress", route(async (req, res) => {
      parseApiRequest("progress", { params: {}, body: {} });
      const userId = resolveUserId(req, defaultUserId);
      const progress = await getActiveGoalProgress(store, userId, nowProvider());

      respond(res, "progress", 200, {
        progress,
        screen: buildProgressScreenModel(progress)
      });
  }));

  app.post("/v1/milestones/:milestoneId/confirm", route(async (req, res) => {
      const { params } = parseApiRequest("confirm_milestone", {
        params: req.params,
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      const milestone = await confirmMilestoneForActiveGoal(
        store,
        userId,
        params.milestoneId,
        nowProvider()
      );

      respond(res, "confirm_milestone", 200, { milestone });
  }));

  app.post("/v1/goals/active/adapt", route(async (req, res) => {
      const { body } = parseApiRequest("adapt_goal", {
        params: {},
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      const result = await triggerFullAdaptation(
        store,
        userId,
        nowProvider(),
        body.triggered_by ?? "manual"
      );

      respond(res, "adapt_goal", 202, result);
  }));

  app.post("/v1/notifications/token", route(async (req, res) => {
      const { body } = parseApiRequest("register_notification_token", {
        params: {},
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      await store.ensureUser?.(userId);
      const token = await registerPushToken(store, userId, body.token, body.platform, nowProvider());

      respond(res, "register_notification_token", 200, { token });
  }));

  app.patch("/v1/notifications/preferences", route(async (req, res) => {
      const { body } = parseApiRequest("update_notification_preferences", {
        params: {},
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      await store.ensureUser?.(userId);
      const preference = await updateReminderPreferences(store, userId, body);

      respond(res, "update_notification_preferences", 200, { preference });
  }));

  app.post("/v1/notifications/reminders/send", route(async (req, res) => {
      const { body } = parseApiRequest("send_reminder", {
        params: {},
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      const activeGoal = await store.getActiveGoal(userId);
      const goalId = body.goal_id ?? activeGoal?.id;

      if (!goalId) {
        throw notFound("Goal not found");
      }

      const result = await sendReminderIfEligible(
        store,
        userId,
        goalId,
        body.reason ?? "daily_reminder",
        nowProvider()
      );
      respond(res, "send_reminder", 200, result);
  }));

  app.use((req, _res, next) => {
    next(notFound(`Route not found: ${req.method} ${req.path}`));
  });

  app.use((error, _req, res, _next) => {
    const status = classifyStatus(error);
    res.status(status).json({
      error: {
        message: error?.message ?? "Internal server error"
      }
    });
  });

  return { app, services: { goalService, planService, specificityService }, store };
}
