import express from "express";
import { ZodError } from "zod";

import { parseApiRequest, parseApiResponse } from "./contracts/schemas.js";
import { badRequest, notFound } from "./contracts/validators.js";
import { TaskDifficulty, TaskState } from "./contracts/constants.js";
import { triggerFullAdaptation } from "./modules/m4/adaptationService.js";
import { confirmMilestoneForActiveGoal } from "./modules/m4/milestoneService.js";
import { buildProgressScreenModel, getActiveGoalProgress, recalculateStreak } from "./modules/m4/progressService.js";
import {
  getNotificationSettingsSnapshot,
  registerPushToken,
  sendReminderIfEligible,
  updateReminderPreferences
} from "./modules/m5/notificationService.js";
import { createConfiguredStore } from "./repositories/storeFactory.js";
import { createObservability } from "./observability/observability.js";
import { createAuthMiddleware } from "./server/auth.js";
import { createConfiguredAiClient } from "./services/aiClientFactory.js";
import { bootstrapDevSession, resetDevSession } from "./services/devSessionService.js";
import { GoalService } from "./services/goalService.js";
import { GoalSpecificityService } from "./services/goalSpecificityService.js";
import { PlanService } from "./services/planService.js";
import { toLocalDateKey } from "./utils/dateTime.js";

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

async function findGoalForUser(store, goalId, userId) {
  const goal = await store.getGoal(goalId);

  if (!goal || goal.user_id !== userId) {
    throw notFound(`Goal ${goalId} not found`);
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

async function findTaskForUser(store, taskId, userId) {
  const task = await findTask(store, taskId);
  const goal = await store.getGoal(task.goal_id);

  if (!goal || goal.user_id !== userId) {
    throw notFound(`Task ${taskId} not found`);
  }

  return { task, goal };
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

async function buildTodayTasksPayload(store, user, activeGoal, now) {
  const localDateKey = toLocalDateKey(now, user.timezone);
  const plan = await store.getActivePlan(activeGoal.id);
  const taskRecords = await store.listTasksForLocalDate(activeGoal.id, localDateKey);
  const tasks = await Promise.all(
    taskRecords.map(async (task) => mapTask(task, await store.getCompletion(task.id)))
  );

  return {
    date: localDateKey,
    goal_id: activeGoal.id,
    planVersion: plan?.version ?? 1,
    feedback: "You are set for today. Small steps are enough.",
    tasks
  };
}

async function buildAppBootstrapPayload(store, userId, now) {
  const user = await findUser(store, userId);
  const localDateKey = toLocalDateKey(now, user.timezone);
  const [goals, activeGoal, notifications] = await Promise.all([
    store.listGoalsForUser(userId),
    store.getActiveGoal(userId),
    getNotificationSettingsSnapshot(store, userId)
  ]);

  if (!activeGoal) {
    return {
      user,
      local_date_key: localDateKey,
      goals,
      notifications,
      active_goal: null,
      today: null,
      progress: null
    };
  }

  const today = await buildTodayTasksPayload(store, user, activeGoal, now);
  const activePlan = await store.getActivePlan(activeGoal.id);
  const progress = activePlan ? await getActiveGoalProgress(store, userId, now) : null;

  return {
    user,
    local_date_key: localDateKey,
    goals,
    notifications,
    active_goal: activeGoal,
    today,
    progress
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

function getAuthenticatedUserId(req) {
  return req.auth?.userId;
}

function getObservedRoute(req) {
  return req.route?.path ?? req.path;
}

function getMockAiScenario(req) {
  const scenario = req.get("x-mock-ai-scenario");

  if (typeof scenario !== "string") {
    return null;
  }

  const normalized = scenario.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function createApp(overrides = {}) {
  const defaultUserId = overrides.defaultUserId ?? "demo-user";
  const authMode = overrides.authMode ?? process.env.GOAL_COACH_AUTH_MODE ?? "dev";
  const store =
    overrides.store ??
    createConfiguredStore({
      defaultUserId,
      storeMode: overrides.storeMode,
      seedDemoData: overrides.seedDemoData ?? false,
      defaultUser: overrides.defaultUser,
      prisma: overrides.prisma
    });
  const aiClient =
    overrides.aiClient ??
    createConfiguredAiClient({
      aiProvider: overrides.aiProvider
    });
  const clock = overrides.clock ?? Date;
  const nowProvider = overrides.nowProvider ?? (() => new clock());
  const observability =
    overrides.observability ?? createObservability({ logger: overrides.logger, clock });

  const specificityService =
    overrides.specificityService ?? new GoalSpecificityService({ aiClient });

  const goalService =
    overrides.goalService ?? new GoalService({ store, specificityService, clock });

  const planService =
    overrides.planService ?? new PlanService({ store, goalService, aiClient, observability, clock });

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const headerRequestId = req.get("x-request-id");
    const requestId =
      typeof headerRequestId === "string" && headerRequestId.trim().length > 0
        ? headerRequestId.trim()
        : observability.nextRequestId();
    const startedAt = process.hrtime.bigint();

    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      observability.recordRequest({
        request_id: requestId,
        method: req.method,
        route: getObservedRoute(req),
        status: res.statusCode,
        duration_ms: Number(durationMs.toFixed(2)),
        auth_source: req.auth?.source ?? "unauthenticated",
        user_id: req.auth?.userId ?? null
      });
    });

    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/v1", createAuthMiddleware({
    defaultUserId: authMode === "required" ? null : defaultUserId,
    requireAuth: authMode === "required"
  }));

  app.get("/v1/ops/metrics", route(async (_req, res) => {
    res.status(200).json(observability.snapshot(nowProvider()));
  }));

  app.get("/v1/app/bootstrap", route(async (req, res) => {
    parseApiRequest("app_bootstrap", { params: {}, body: {} });
    const userId = getAuthenticatedUserId(req);
    const payload = await buildAppBootstrapPayload(store, userId, nowProvider());

    respond(res, "app_bootstrap", 200, payload);
  }));

  app.post("/v1/dev/bootstrap", route(async (req, res) => {
    const { body } = parseApiRequest("dev_bootstrap", {
      params: {},
      body: req.body ?? {}
    });
    const userId = getAuthenticatedUserId(req);
    const session = await bootstrapDevSession(
      store,
      userId,
      body.scenario,
      nowProvider()
    );

    respond(res, "dev_bootstrap", 200, session);
  }));

  app.post("/v1/dev/reset", route(async (req, res) => {
    parseApiRequest("dev_reset", {
      params: {},
      body: req.body ?? {}
    });
    const userId = getAuthenticatedUserId(req);
    const session = await resetDevSession(store, userId, nowProvider());

    respond(res, "dev_reset", 200, session);
  }));

  app.post("/v1/goals", route(async (req, res) => {
    const rawBody = req.body ?? {};
    const authenticatedUserId = getAuthenticatedUserId(req);

    if (rawBody.user_id !== undefined && typeof rawBody.user_id === "string" && rawBody.user_id !== authenticatedUserId) {
      throw badRequest("user_id must match authenticated user");
    }

    const { body } = parseApiRequest("create_goal", {
      body: {
        user_id: rawBody.user_id ?? authenticatedUserId,
        title: rawBody.title
      }
    });

    const result = await goalService.createGoal(body);
    respond(res, "create_goal", 201, result);
  }));

  app.get("/v1/goals", route(async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const goals = await goalService.listGoals(userId);
    respond(res, "list_goals", 200, { goals });
  }));

  app.patch("/v1/goals/:goalId/status", route(async (req, res) => {
      const { params, body } = parseApiRequest("patch_goal_status", {
        params: req.params,
        body: req.body ?? {}
      });
      const userId = getAuthenticatedUserId(req);
      await findGoalForUser(store, params.goalId, userId);

      const goal = await goalService.patchGoalStatus(params.goalId, body.status);
      respond(res, "patch_goal_status", 200, { goal });
  }));

  app.post("/v1/goals/:goalId/activate", route(async (req, res) => {
      const { params } = parseApiRequest("activate_goal", {
        params: req.params,
        body: req.body ?? {}
      });
      const userId = getAuthenticatedUserId(req);
      await findGoalForUser(store, params.goalId, userId);

      const goal = await goalService.activateGoal(params.goalId);
      respond(res, "activate_goal", 200, { goal });
  }));

  app.post("/v1/goals/:goalId/clarifications", route(async (req, res) => {
      const { params, body } = parseApiRequest("submit_clarifications", {
        params: req.params,
        body: req.body ?? {}
      });
      const userId = getAuthenticatedUserId(req);
      await findGoalForUser(store, params.goalId, userId);

      const result = await goalService.submitClarifications(params.goalId, body.answers);
      respond(res, "submit_clarifications", 200, result);
  }));

  app.post("/v1/goals/:goalId/assessment", route(async (req, res) => {
      const { params, body } = parseApiRequest("submit_assessment", {
        params: req.params,
        body: req.body ?? {}
      });
      const userId = getAuthenticatedUserId(req);
      await findGoalForUser(store, params.goalId, userId);

      const assessment = await goalService.submitAssessment(params.goalId, body);
      respond(res, "submit_assessment", 200, { assessment });
  }));

  app.post("/v1/goals/:goalId/plans/generate", route(async (req, res) => {
      const { params, body } = parseApiRequest("generate_plan", {
        params: req.params,
        body: req.body ?? {}
      });
      const userId = getAuthenticatedUserId(req);
      await findGoalForUser(store, params.goalId, userId);

      const result = await planService.triggerGeneration(params.goalId, {
        force: body.force,
        mockScenario: getMockAiScenario(req)
      });
      respond(res, "generate_plan", 202, result);
  }));

  app.get("/v1/goals/:goalId/plans/status", route(async (req, res) => {
      const { params } = parseApiRequest("plan_status", {
        params: req.params,
        body: {}
      });
      const userId = getAuthenticatedUserId(req);
      await findGoalForUser(store, params.goalId, userId);

      const status = await planService.getStatus(params.goalId);
      respond(res, "plan_status", 200, status);
  }));

  app.get("/v1/goals/active/tasks/today", route(async (req, res) => {
      const userId = getAuthenticatedUserId(req);
      const user = await findUser(store, userId);
      const activeGoal = await findActiveGoal(store, userId);
      const payload = await buildTodayTasksPayload(store, user, activeGoal, nowProvider());

      respond(res, "today_tasks", 200, payload);
  }));

  app.post("/v1/tasks/:taskId/complete", route(async (req, res) => {
      const { params, body } = parseApiRequest("complete_task", {
        params: req.params,
        body: req.body ?? {}
      });
      const userId = getAuthenticatedUserId(req);
      const { task, goal } = await findTaskForUser(store, params.taskId, userId);
      const now = nowProvider();
      const completion = await store.upsertCompletion(task.id, {
        state: TaskState.COMPLETED,
        actual_minutes: body.actual_minutes ?? task.est_minutes,
        completed_at: now.toISOString()
      });
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
      const userId = getAuthenticatedUserId(req);
      const { task } = await findTaskForUser(store, params.taskId, userId);
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
      const userId = getAuthenticatedUserId(req);
      const { task } = await findTaskForUser(store, params.taskId, userId);

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

      const userId = getAuthenticatedUserId(req);
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
      const userId = getAuthenticatedUserId(req);
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
      const userId = getAuthenticatedUserId(req);
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
      const userId = getAuthenticatedUserId(req);
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
      const userId = getAuthenticatedUserId(req);
      await store.ensureUser?.(userId);
      const token = await registerPushToken(store, userId, body.token, body.platform, nowProvider());

      respond(res, "register_notification_token", 200, { token });
  }));

  app.patch("/v1/notifications/preferences", route(async (req, res) => {
      const { body } = parseApiRequest("update_notification_preferences", {
        params: {},
        body: req.body ?? {}
      });
      const userId = getAuthenticatedUserId(req);
      await store.ensureUser?.(userId);
      const preference = await updateReminderPreferences(store, userId, body);

      respond(res, "update_notification_preferences", 200, { preference });
  }));

  app.post("/v1/notifications/reminders/send", route(async (req, res) => {
      const { body } = parseApiRequest("send_reminder", {
        params: {},
        body: req.body ?? {}
      });
      const userId = getAuthenticatedUserId(req);
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
      observability.recordReminder(result, {
        reason: body.reason ?? "daily_reminder",
        goal_id: goalId,
        user_id: userId
      });
      respond(res, "send_reminder", 200, result);
  }));

  app.use((req, _res, next) => {
    next(notFound(`Route not found: ${req.method} ${req.path}`));
  });

  app.use((error, req, res, _next) => {
    const status = classifyStatus(error);
    observability.recordError({
      request_id: req.requestId ?? null,
      method: req.method,
      route: getObservedRoute(req),
      status,
      message: error?.message ?? "Internal server error",
      user_id: req.auth?.userId ?? null
    });
    res.status(status).json({
      error: {
        message: error?.message ?? "Internal server error",
        request_id: req.requestId ?? null
      }
    });
  });

  return { app, services: { goalService, planService, specificityService }, store, observability };
}
