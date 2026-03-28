import express from "express";
import { ZodError } from "zod";

import { parseApiRequest, parseApiResponse } from "./contracts/schemas.js";
import { notFound } from "./contracts/validators.js";
import { TaskDifficulty, TaskState } from "./contracts/constants.js";
import { triggerFullAdaptation } from "./modules/m4/adaptationService.js";
import { confirmMilestoneForActiveGoal } from "./modules/m4/milestoneService.js";
import { buildProgressScreenModel, getActiveGoalProgress, recalculateStreak } from "./modules/m4/progressService.js";
import { registerPushToken, sendReminderIfEligible, updateReminderPreferences } from "./modules/m5/notificationService.js";
import { createInMemoryStore } from "./repositories/inMemoryStore.js";
import { GoalService } from "./services/goalService.js";
import { GoalSpecificityService } from "./services/goalSpecificityService.js";
import { MockAiClient } from "./services/mockAiClient.js";
import { PlanService } from "./services/planService.js";
import { toLocalDateKey } from "./utils/dateTime.js";

function resolveUserId(req, defaultUserId) {
  return String(req.query.user_id ?? req.query.userId ?? defaultUserId);
}

function findUser(store, userId) {
  const user = store.getUser(userId);

  if (!user) {
    throw notFound(`User ${userId} not found`);
  }

  return user;
}

function findActiveGoal(store, userId) {
  const goal = store.getActiveGoal(userId);

  if (!goal) {
    throw notFound("No active goal found");
  }

  return goal;
}

function findTask(store, taskId) {
  const task = store.getTask(taskId);

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

export function createApp(overrides = {}) {
  const defaultUserId = overrides.defaultUserId ?? "demo-user";
  const store =
    overrides.store ??
    createInMemoryStore({
      defaultUserId
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

  app.post("/v1/goals", (req, res, next) => {
    try {
      const rawBody = req.body ?? {};
      const { body } = parseApiRequest("create_goal", {
        body: {
          user_id: rawBody.user_id ?? defaultUserId,
          title: rawBody.title
        }
      });

      const result = goalService.createGoal(body);
      respond(res, "create_goal", 201, result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/goals", (req, res, next) => {
    try {
      const userId = resolveUserId(req, defaultUserId);
      const goals = goalService.listGoals(userId);
      respond(res, "list_goals", 200, { goals });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/v1/goals/:goalId/status", (req, res, next) => {
    try {
      const { params, body } = parseApiRequest("patch_goal_status", {
        params: req.params,
        body: req.body ?? {}
      });

      const goal = goalService.patchGoalStatus(params.goalId, body.status);
      respond(res, "patch_goal_status", 200, { goal });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/:goalId/activate", (req, res, next) => {
    try {
      const { params } = parseApiRequest("activate_goal", {
        params: req.params,
        body: req.body ?? {}
      });

      const goal = goalService.activateGoal(params.goalId);
      respond(res, "activate_goal", 200, { goal });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/:goalId/clarifications", (req, res, next) => {
    try {
      const { params, body } = parseApiRequest("submit_clarifications", {
        params: req.params,
        body: req.body ?? {}
      });

      const result = goalService.submitClarifications(params.goalId, body.answers);
      respond(res, "submit_clarifications", 200, result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/:goalId/assessment", (req, res, next) => {
    try {
      const { params, body } = parseApiRequest("submit_assessment", {
        params: req.params,
        body: req.body ?? {}
      });

      const assessment = goalService.submitAssessment(params.goalId, body);
      respond(res, "submit_assessment", 200, { assessment });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/:goalId/plans/generate", (req, res, next) => {
    try {
      const { params, body } = parseApiRequest("generate_plan", {
        params: req.params,
        body: req.body ?? {}
      });

      const result = planService.triggerGeneration(params.goalId, body.force);
      respond(res, "generate_plan", 202, result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/goals/:goalId/plans/status", (req, res, next) => {
    try {
      const { params } = parseApiRequest("plan_status", {
        params: req.params,
        body: {}
      });

      const status = planService.getStatus(params.goalId);
      respond(res, "plan_status", 200, status);
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/goals/active/tasks/today", (req, res, next) => {
    try {
      const userId = resolveUserId(req, defaultUserId);
      const user = findUser(store, userId);
      const activeGoal = findActiveGoal(store, userId);
      const now = nowProvider();
      const localDateKey = toLocalDateKey(now, user.timezone);
      const plan = store.getActivePlan(activeGoal.id);
      const tasks = store
        .listTasksForLocalDate(activeGoal.id, localDateKey)
        .map((task) => mapTask(task, store.getCompletion(task.id)));

      respond(res, "today_tasks", 200, {
        date: localDateKey,
        goal_id: activeGoal.id,
        planVersion: plan?.version ?? 1,
        feedback: "You are set for today. Small steps are enough.",
        tasks
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/tasks/:taskId/complete", (req, res, next) => {
    try {
      const { params, body } = parseApiRequest("complete_task", {
        params: req.params,
        body: req.body ?? {}
      });
      const task = findTask(store, params.taskId);
      const now = nowProvider();
      const completion = store.upsertCompletion(task.id, {
        state: TaskState.COMPLETED,
        actual_minutes: body.actual_minutes ?? task.est_minutes,
        completed_at: now.toISOString()
      });
      const goal = store.getGoal(task.goal_id);
      const user = goal ? store.getUser(goal.user_id) : null;

      if (goal && user) {
        recalculateStreak(store, goal.id, now, user.timezone);
      }

      respond(res, "complete_task", 200, {
        task: mapTask(task, completion),
        completion
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/tasks/:taskId/skip", (req, res, next) => {
    try {
      const { params } = parseApiRequest("skip_task", {
        params: req.params,
        body: req.body ?? {}
      });
      const task = findTask(store, params.taskId);
      const completion = store.upsertCompletion(task.id, {
        state: TaskState.SKIPPED,
        actual_minutes: null,
        completed_at: nowProvider().toISOString()
      });

      respond(res, "skip_task", 200, {
        task: mapTask(task, completion),
        completion
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/v1/tasks/:taskId", (req, res, next) => {
    try {
      const { params, body } = parseApiRequest("edit_task", {
        params: req.params,
        body: req.body ?? {}
      });
      const task = findTask(store, params.taskId);

      if (body.title !== undefined) {
        task.title = body.title;
      }

      if (body.est_minutes !== undefined) {
        task.est_minutes = body.est_minutes;
      }

      if (body.estMinutes !== undefined) {
        task.est_minutes = body.estMinutes;
      }

      if (body.difficulty !== undefined) {
        task.difficulty = body.difficulty;
      }

      if (body.required !== undefined) {
        task.required = body.required;
      }

      task.manual_lock = true;
      task.source = "manual";
      task.adjustment_source = "plan";

      respond(res, "edit_task", 200, {
        task: mapTask(task, store.getCompletion(task.id))
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/active/soft-adjust", (req, res, next) => {
    try {
      parseApiRequest("soft_adjust", { params: {}, body: req.body ?? {} });

      const userId = resolveUserId(req, defaultUserId);
      const user = findUser(store, userId);
      const activeGoal = findActiveGoal(store, userId);
      const activePlan = store.getActivePlan(activeGoal.id);
      const localDateKey = toLocalDateKey(nowProvider(), user.timezone);
      const todayTasks = store.listTasksForLocalDate(activeGoal.id, localDateKey);

      for (const task of todayTasks) {
        const completion = store.getCompletion(task.id);
        const isPending = !completion || completion.state === TaskState.PENDING;

        if (!isPending || task.manual_lock) {
          continue;
        }

        task.est_minutes = Math.max(5, Math.round(task.est_minutes * 0.75));
        task.difficulty = lowerDifficulty(taskDifficultyAsLabel(task.difficulty));
        task.adjustment_source = "same_day_soft";
        task.source = "adapted";
      }

      const pendingAdjusted = todayTasks
        .filter((task) => {
          const completion = store.getCompletion(task.id);
          return !completion || completion.state === TaskState.PENDING;
        })
        .map((task) => mapTask(task, store.getCompletion(task.id)));

      respond(res, "soft_adjust", 200, {
        tasks: pendingAdjusted,
        adjustmentSource: "same_day_soft",
        planVersion: activePlan?.version ?? 1,
        feedback: "We lightened today to keep your momentum."
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/goals/active/progress", (req, res, next) => {
    try {
      parseApiRequest("progress", { params: {}, body: {} });
      const userId = resolveUserId(req, defaultUserId);
      const progress = getActiveGoalProgress(store, userId, nowProvider());

      respond(res, "progress", 200, {
        progress,
        screen: buildProgressScreenModel(progress)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/milestones/:milestoneId/confirm", (req, res, next) => {
    try {
      const { params } = parseApiRequest("confirm_milestone", {
        params: req.params,
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      const milestone = confirmMilestoneForActiveGoal(store, userId, params.milestoneId, nowProvider());

      respond(res, "confirm_milestone", 200, { milestone });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/goals/active/adapt", (req, res, next) => {
    try {
      const { body } = parseApiRequest("adapt_goal", {
        params: {},
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      const result = triggerFullAdaptation(store, userId, nowProvider(), body.triggered_by ?? "manual");

      respond(res, "adapt_goal", 202, result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/notifications/token", (req, res, next) => {
    try {
      const { body } = parseApiRequest("register_notification_token", {
        params: {},
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      store.ensureUser?.(userId);
      const token = registerPushToken(store, userId, body.token, body.platform, nowProvider());

      respond(res, "register_notification_token", 200, { token });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/v1/notifications/preferences", (req, res, next) => {
    try {
      const { body } = parseApiRequest("update_notification_preferences", {
        params: {},
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      store.ensureUser?.(userId);
      const preference = updateReminderPreferences(store, userId, body);

      respond(res, "update_notification_preferences", 200, { preference });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/notifications/reminders/send", (req, res, next) => {
    try {
      const { body } = parseApiRequest("send_reminder", {
        params: {},
        body: req.body ?? {}
      });
      const userId = resolveUserId(req, defaultUserId);
      const activeGoal = store.getActiveGoal(userId);
      const goalId = body.goal_id ?? activeGoal?.id;

      if (!goalId) {
        throw notFound("Goal not found");
      }

      const result = sendReminderIfEligible(store, userId, goalId, body.reason ?? "daily_reminder", nowProvider());
      respond(res, "send_reminder", 200, result);
    } catch (error) {
      next(error);
    }
  });

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
