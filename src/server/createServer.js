import http from "node:http";
import { ZodError } from "zod";

import { createMockStore } from "../mocks/inMemoryStore.js";
import { GoalStatus, PlanState, SpecificityState, TaskDifficulty, TaskState } from "../contracts/constants.js";
import { ApiContracts, parseApiRequest, parseApiResponse } from "../contracts/schemas.js";
import { triggerFullAdaptation } from "../modules/m4/adaptationService.js";
import { confirmMilestoneForActiveGoal } from "../modules/m4/milestoneService.js";
import { buildProgressScreenModel, getActiveGoalProgress } from "../modules/m4/progressService.js";
import { registerPushToken, sendReminderIfEligible, updateReminderPreferences } from "../modules/m5/notificationService.js";
import { toLocalDateKey } from "../utils/dateTime.js";

const DEFAULT_USER_ID = "user-1";
const PLAN_DELAY_MS = 350;

function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

function withStatus(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof ZodError) {
        writeJson(res, 400, {
          error: "Invalid request payload",
          details: error.issues
        });
        return;
      }

      const statusCode =
        Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
          ? error.status
          : /not found/i.test(error?.message ?? "")
            ? 404
            : /invalid|no active|must be/i.test(error?.message ?? "")
              ? 400
              : 500;

      writeJson(res, statusCode, {
        error: error?.message ?? "Unexpected server error"
      });
    }
  };
}

function findGoal(store, goalId) {
  const goal = store.getGoal(goalId);

  if (!goal) {
    throw withStatus(`Goal ${goalId} not found`, 404);
  }

  return goal;
}

function findTask(store, taskId) {
  const task = store.getTask(taskId);

  if (!task) {
    throw withStatus(`Task ${taskId} not found`, 404);
  }

  return task;
}

function mapGoal(goal) {
  return {
    id: goal.id,
    user_id: goal.user_id,
    title: goal.title,
    status: goal.status,
    specificity_state: goal.specificity_state ?? SpecificityState.NEEDS_CLARIFICATION,
    specificity_score: goal.specificity_score ?? 0.5,
    plan_state: goal.plan_state ?? null,
    active_at: goal.active_at ?? null,
    active_plan_id: goal.active_plan_id ?? null,
    created_at: goal.created_at ?? new Date().toISOString(),
    updated_at: goal.updated_at ?? new Date().toISOString()
  };
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
  const state = completion?.state ?? task.state ?? TaskState.PENDING;

  return {
    id: task.id,
    plan_id: task.plan_id ?? null,
    goal_id: task.goal_id ?? null,
    scheduled_date: task.scheduled_date ?? toLocalDateKey(new Date(), "UTC"),
    title: task.title,
    est_minutes: task.est_minutes,
    difficulty: taskDifficultyAsLabel(task.difficulty),
    required: Boolean(task.required),
    state,
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

function evaluateGoalSpecificity(title, answers = []) {
  const combined = `${title} ${answers.map((entry) => entry.answer_text).join(" ")}`.toLowerCase();
  const hasMetric = /\d/.test(combined);
  const hasTime = /\b(day|week|month|year|by|before|date)\b/.test(combined);
  const hasAction = /\b(run|build|learn|write|train|ship|study|practice)\b/.test(combined);

  const score = Number((0.2 + (hasMetric ? 0.3 : 0) + (hasTime ? 0.25 : 0) + (hasAction ? 0.25 : 0)).toFixed(2));
  const state = score >= 0.6 ? SpecificityState.SPECIFIC : SpecificityState.NEEDS_CLARIFICATION;

  return {
    state,
    score,
    missing_elements: [
      ...(hasAction ? [] : ["action"]),
      ...(hasMetric ? [] : ["measurable_target"]),
      ...(hasTime ? [] : ["timeframe"])
    ],
    clarification_questions:
      state === SpecificityState.SPECIFIC
        ? []
        : [
            "What exact measurable result are you targeting?",
            "What timeframe should the plan optimize for?"
          ]
  };
}

function match(path, regex) {
  const result = path.match(regex);
  return result?.groups ?? null;
}

export function createServer({ store = createMockStore(), nowProvider = () => new Date() } = {}) {
  store.state.goalClarifications = store.state.goalClarifications ?? {};
  store.state.goalAssessments = store.state.goalAssessments ?? {};
  store.state.generatedPlanMeta = store.state.generatedPlanMeta ?? {};

  const handler = withErrorHandling(async (req, res) => {
    if (!req.url || !req.method) {
      writeJson(res, 400, { error: "Malformed request" });
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const path = requestUrl.pathname;
    const method = req.method.toUpperCase();
    const userId = requestUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;
    const now = nowProvider();
    const user = store.getUser(userId);

    if (!user) {
      throw withStatus(`User ${userId} not found`, 404);
    }

    if (method === "POST" && path === "/v1/goals") {
      const rawBody = await readJson(req);
      const { body } = parseApiRequest("create_goal", { body: rawBody });
      const specificity = evaluateGoalSpecificity(body.title);
      const nowIso = now.toISOString();
      const goal = {
        id: `goal-${store.state.goals.length + 1}`,
        user_id: body.user_id ?? userId,
        title: body.title.trim(),
        status: GoalStatus.DRAFT,
        specificity_state: specificity.state,
        specificity_score: specificity.score,
        plan_state: null,
        active_at: null,
        active_plan_id: null,
        created_at: nowIso,
        updated_at: nowIso
      };

      store.state.goals.push(goal);
      const response = parseApiResponse("create_goal", { goal: mapGoal(goal), specificity });
      writeJson(res, 201, response);
      return;
    }

    if (method === "GET" && path === "/v1/goals") {
      const goals = store.state.goals.filter((goal) => goal.user_id === userId).map((goal) => mapGoal(goal));
      const response = parseApiResponse("list_goals", { goals });
      writeJson(res, 200, response);
      return;
    }

    const activateParams = method === "POST" ? match(path, /^\/v1\/goals\/(?<goalId>[^/]+)\/activate$/) : null;
    if (activateParams) {
      parseApiRequest("activate_goal", { params: activateParams, body: {} });
      const target = findGoal(store, activateParams.goalId);

      for (const candidate of store.state.goals) {
        if (candidate.user_id === userId && candidate.status === GoalStatus.ACTIVE) {
          candidate.status = GoalStatus.PAUSED;
          candidate.active_at = null;
          candidate.updated_at = now.toISOString();
        }
      }

      target.status = GoalStatus.ACTIVE;
      target.active_at = now.toISOString();
      target.plan_state = target.plan_state ?? PlanState.READY;
      target.updated_at = now.toISOString();

      const response = parseApiResponse("activate_goal", { goal: mapGoal(target) });
      writeJson(res, 200, response);
      return;
    }

    const patchStatusParams = method === "PATCH" ? match(path, /^\/v1\/goals\/(?<goalId>[^/]+)\/status$/) : null;
    if (patchStatusParams) {
      const rawBody = await readJson(req);
      const { params, body } = parseApiRequest("patch_goal_status", { params: patchStatusParams, body: rawBody });
      const goal = findGoal(store, params.goalId);
      goal.status = body.status;
      goal.updated_at = now.toISOString();
      goal.active_at = body.status === GoalStatus.ACTIVE ? now.toISOString() : null;

      const response = parseApiResponse("patch_goal_status", { goal: mapGoal(goal) });
      writeJson(res, 200, response);
      return;
    }

    const clarificationsParams =
      method === "POST" ? match(path, /^\/v1\/goals\/(?<goalId>[^/]+)\/clarifications$/) : null;
    if (clarificationsParams) {
      const rawBody = await readJson(req);
      const { params, body } = parseApiRequest("submit_clarifications", {
        params: clarificationsParams,
        body: rawBody
      });
      const goal = findGoal(store, params.goalId);

      const persistedAnswers = body.answers.map((entry, index) => ({
        id: `clarification-${Date.now()}-${index + 1}`,
        goal_id: goal.id,
        question_text: entry.question_text.trim(),
        answer_text: entry.answer_text.trim(),
        created_at: now.toISOString()
      }));

      const existing = store.state.goalClarifications[goal.id] ?? [];
      store.state.goalClarifications[goal.id] = [...existing, ...persistedAnswers];
      const specificity = evaluateGoalSpecificity(goal.title, store.state.goalClarifications[goal.id]);

      goal.specificity_state = specificity.state;
      goal.specificity_score = specificity.score;
      goal.updated_at = now.toISOString();

      const response = parseApiResponse("submit_clarifications", {
        goal: mapGoal(goal),
        persisted_answers: persistedAnswers,
        specificity
      });
      writeJson(res, 200, response);
      return;
    }

    const assessmentParams = method === "POST" ? match(path, /^\/v1\/goals\/(?<goalId>[^/]+)\/assessment$/) : null;
    if (assessmentParams) {
      const rawBody = await readJson(req);
      const { params, body } = parseApiRequest("submit_assessment", { params: assessmentParams, body: rawBody });
      const goal = findGoal(store, params.goalId);
      const assessment = {
        id: `assessment-${goal.id}`,
        goal_id: goal.id,
        current_level: body.current_level,
        weekly_minutes_available: body.weekly_minutes_available,
        target_date: body.target_date ?? null,
        created_at: now.toISOString()
      };

      store.state.goalAssessments[goal.id] = assessment;
      goal.updated_at = now.toISOString();
      const response = parseApiResponse("submit_assessment", { assessment });
      writeJson(res, 200, response);
      return;
    }

    const generateParams =
      method === "POST" ? match(path, /^\/v1\/goals\/(?<goalId>[^/]+)\/plans\/generate$/) : null;
    if (generateParams) {
      const rawBody = await readJson(req);
      const { params } = parseApiRequest("generate_plan", { params: generateParams, body: rawBody });
      const goal = findGoal(store, params.goalId);

      goal.plan_state = PlanState.GENERATING;
      goal.updated_at = now.toISOString();
      store.state.generatedPlanMeta[goal.id] = {
        started_at: now.toISOString(),
        delayed_after_ms: PLAN_DELAY_MS
      };

      const response = parseApiResponse("generate_plan", {
        goal_id: goal.id,
        plan_state: goal.plan_state,
        started_at: store.state.generatedPlanMeta[goal.id].started_at,
        delayed_after_ms: PLAN_DELAY_MS
      });
      writeJson(res, 202, response);
      return;
    }

    const planStatusParams =
      method === "GET" ? match(path, /^\/v1\/goals\/(?<goalId>[^/]+)\/plans\/status$/) : null;
    if (planStatusParams) {
      const { params } = parseApiRequest("plan_status", { params: planStatusParams, body: {} });
      const goal = findGoal(store, params.goalId);
      const plan = store.getActivePlan(goal.id);
      const firstTasks = store
        .listTasks(goal.id)
        .slice(0, 3)
        .map((task) => ({
          title: task.title,
          est_minutes: task.est_minutes,
          difficulty: taskDifficultyAsLabel(task.difficulty),
          required: Boolean(task.required)
        }));

      const milestones = plan
        ? store.getMilestones(plan.id).map((milestone) => ({
            title: milestone.title,
            target_week: milestone.target_week,
            success_criteria: milestone.success_criteria
          }))
        : [];

      const response = parseApiResponse("plan_status", {
        goal_id: goal.id,
        plan_state: goal.plan_state ?? null,
        plan: plan
          ? {
              plan_id: plan.id,
              version: plan.version,
              frame_type: plan.frame_type,
              feasibility: "realistic",
              estimate: {
                min_weeks: plan.estimate_min_weeks ?? 4,
                max_weeks: plan.estimate_max_weeks ?? 8,
                confidence: plan.confidence ?? 0.7
              },
              milestones,
              first_tasks: firstTasks
            }
          : null
      });
      writeJson(res, 200, response);
      return;
    }

    if (method === "GET" && path === "/v1/goals/active/tasks/today") {
      const activeGoal = store.getActiveGoal(userId);

      if (!activeGoal) {
        throw withStatus("No active goal found", 404);
      }

      const localDateKey = toLocalDateKey(now, user.timezone);
      const plan = store.getActivePlan(activeGoal.id);
      const tasks = store.listTasksForLocalDate(activeGoal.id, localDateKey).map((task) => {
        const completion = store.getCompletion(task.id);
        return mapTask(task, completion);
      });

      const response = parseApiResponse("today_tasks", {
        date: localDateKey,
        goal_id: activeGoal.id,
        planVersion: plan?.version ?? 1,
        feedback: "You are set for today. Small steps are enough.",
        tasks
      });
      writeJson(res, 200, response);
      return;
    }

    const completeParams = method === "POST" ? match(path, /^\/v1\/tasks\/(?<taskId>[^/]+)\/complete$/) : null;
    if (completeParams) {
      const rawBody = await readJson(req);
      const { params, body } = parseApiRequest("complete_task", { params: completeParams, body: rawBody });
      const task = findTask(store, params.taskId);

      const completion = store.upsertCompletion(task.id, {
        state: TaskState.COMPLETED,
        actual_minutes: body.actual_minutes ?? task.est_minutes,
        completed_at: now.toISOString()
      });

      const response = parseApiResponse("complete_task", {
        task: mapTask(task, completion),
        completion
      });
      writeJson(res, 200, response);
      return;
    }

    const skipParams = method === "POST" ? match(path, /^\/v1\/tasks\/(?<taskId>[^/]+)\/skip$/) : null;
    if (skipParams) {
      const rawBody = await readJson(req);
      const { params } = parseApiRequest("skip_task", { params: skipParams, body: rawBody });
      const task = findTask(store, params.taskId);

      const completion = store.upsertCompletion(task.id, {
        state: TaskState.SKIPPED,
        actual_minutes: null,
        completed_at: now.toISOString()
      });

      const response = parseApiResponse("skip_task", {
        task: mapTask(task, completion),
        completion
      });
      writeJson(res, 200, response);
      return;
    }

    const editTaskParams = method === "PATCH" ? match(path, /^\/v1\/tasks\/(?<taskId>[^/]+)$/) : null;
    if (editTaskParams) {
      const rawBody = await readJson(req);
      const { params, body } = parseApiRequest("edit_task", { params: editTaskParams, body: rawBody });
      const task = findTask(store, params.taskId);

      if (body.title !== undefined) {
        task.title = body.title;
      }
      if (body.est_minutes !== undefined) {
        task.est_minutes = body.est_minutes;
      } else if (body.estMinutes !== undefined) {
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

      const completion = store.getCompletion(task.id);
      const response = parseApiResponse("edit_task", { task: mapTask(task, completion) });
      writeJson(res, 200, response);
      return;
    }

    if (method === "POST" && path === "/v1/goals/active/soft-adjust") {
      parseApiRequest("soft_adjust", { body: await readJson(req), params: {} });
      const activeGoal = store.getActiveGoal(userId);

      if (!activeGoal) {
        throw withStatus("No active goal found", 404);
      }

      const localDateKey = toLocalDateKey(now, user.timezone);
      const activePlan = store.getActivePlan(activeGoal.id);
      const todayTasks = store.listTasksForLocalDate(activeGoal.id, localDateKey);

      for (const task of todayTasks) {
        const completion = store.getCompletion(task.id);
        const isPending = !completion || completion.state === TaskState.PENDING;

        if (!isPending || task.manual_lock) {
          continue;
        }

        task.est_minutes = Math.max(5, Math.round(task.est_minutes * 0.75));
        task.difficulty = lowerDifficulty(task.difficulty);
        task.adjustment_source = "same_day_soft";
        task.source = "adapted";
      }

      const pendingAdjusted = todayTasks
        .filter((task) => {
          const completion = store.getCompletion(task.id);
          return !completion || completion.state === TaskState.PENDING;
        })
        .map((task) => mapTask(task, store.getCompletion(task.id)));

      const response = parseApiResponse("soft_adjust", {
        tasks: pendingAdjusted,
        adjustmentSource: "same_day_soft",
        planVersion: activePlan?.version ?? 1,
        feedback: "We lightened today to keep your momentum."
      });
      writeJson(res, 200, response);
      return;
    }

    if (method === "GET" && path === "/v1/goals/active/progress") {
      parseApiRequest("progress", { params: {}, body: {} });
      const progress = getActiveGoalProgress(store, userId, now);
      const response = parseApiResponse("progress", {
        progress,
        screen: buildProgressScreenModel(progress)
      });
      writeJson(res, 200, response);
      return;
    }

    const milestoneParams = method === "POST" ? match(path, /^\/v1\/milestones\/(?<milestoneId>[^/]+)\/confirm$/) : null;
    if (milestoneParams) {
      const { params } = parseApiRequest("confirm_milestone", { params: milestoneParams, body: {} });
      const milestone = confirmMilestoneForActiveGoal(store, userId, params.milestoneId, now);
      const response = parseApiResponse("confirm_milestone", { milestone });
      writeJson(res, 200, response);
      return;
    }

    if (method === "POST" && path === "/v1/goals/active/adapt") {
      const rawBody = await readJson(req);
      const { body } = parseApiRequest("adapt_goal", { params: {}, body: rawBody });
      const result = triggerFullAdaptation(store, userId, now, body.triggered_by ?? "manual");
      const response = parseApiResponse("adapt_goal", result);
      writeJson(res, 202, response);
      return;
    }

    if (method === "POST" && path === "/v1/notifications/token") {
      const rawBody = await readJson(req);
      const { body } = parseApiRequest("register_notification_token", { params: {}, body: rawBody });
      const token = registerPushToken(store, userId, body.token, body.platform, now);
      const response = parseApiResponse("register_notification_token", { token });
      writeJson(res, 200, response);
      return;
    }

    if (method === "PATCH" && path === "/v1/notifications/preferences") {
      const rawBody = await readJson(req);
      const { body } = parseApiRequest("update_notification_preferences", { params: {}, body: rawBody });
      const preference = updateReminderPreferences(store, userId, body);
      const response = parseApiResponse("update_notification_preferences", { preference });
      writeJson(res, 200, response);
      return;
    }

    if (method === "POST" && path === "/v1/notifications/reminders/send") {
      const rawBody = await readJson(req);
      const { body } = parseApiRequest("send_reminder", { params: {}, body: rawBody });
      const goal = store.getActiveGoal(userId);
      const goalId = body.goal_id ?? goal?.id;

      if (!goalId) {
        throw withStatus("Goal not found", 404);
      }

      const result = sendReminderIfEligible(store, userId, goalId, body.reason ?? "daily_reminder", now);
      const response = parseApiResponse("send_reminder", result);
      writeJson(res, 200, response);
      return;
    }

    writeJson(res, 404, {
      error: "Route not found"
    });
  });

  const server = http.createServer(handler);

  return {
    server,
    store
  };
}
