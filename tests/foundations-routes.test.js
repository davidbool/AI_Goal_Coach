import test from "node:test";
import assert from "node:assert/strict";

import { ApiContracts, parseApiResponse } from "../src/contracts/schemas.js";
import { createServer } from "../src/server/createServer.js";
import { startServer } from "./helpers/httpTestClient.js";

async function waitForReadyPlan(client, goalId, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await client.request(`/v1/goals/${goalId}/plans/status`, { method: "GET" });

    if (status.body.plan_state === "ready") {
      return status;
    }

    if (status.body.plan_state === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  throw new Error(`Timed out waiting for ready plan for ${goalId}`);
}

test("all MVP routes exist and return contract-safe mock payloads", async (t) => {
  const now = new Date("2026-03-26T12:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now });
  const client = await startServer(server);

  t.after(async () => {
    await client.stop();
  });

  const listGoals = await client.request("/v1/goals", { method: "GET" });
  assert.equal(listGoals.status, 200);
  parseApiResponse("list_goals", listGoals.body);

  const appBootstrap = await client.request("/v1/app/bootstrap", { method: "GET" });
  assert.equal(appBootstrap.status, 200);
  parseApiResponse("app_bootstrap", appBootstrap.body);
  assert.equal(appBootstrap.body.active_goal.id, "goal-1");
  assert.equal(appBootstrap.body.today.tasks.length > 0, true);
  assert.equal(appBootstrap.body.progress.goal_id, "goal-1");
  assert.equal(appBootstrap.body.notifications.max_push_per_day, 2);
  assert.equal(appBootstrap.body.notifications.has_push_token, false);

  const createGoal = await client.request("/v1/goals", {
    method: "POST",
    body: {
      title: "Run 5km three times per week by 2026-10-01"
    }
  });
  assert.equal(createGoal.status, 201);
  parseApiResponse("create_goal", createGoal.body);
  const createdGoalId = createGoal.body.goal.id;

  const activateBeforePlan = await client.request(`/v1/goals/${createdGoalId}/activate`, {
    method: "POST",
    body: {}
  });
  assert.equal(activateBeforePlan.status, 409);
  assert.match(activateBeforePlan.body.error.message, /ready plan/i);

  const patchStatus = await client.request(`/v1/goals/${createdGoalId}/status`, {
    method: "PATCH",
    body: { status: "active" }
  });
  assert.equal(patchStatus.status, 409);
  assert.match(patchStatus.body.error.message, /ready plan/i);

  const clarifications = await client.request(`/v1/goals/${createdGoalId}/clarifications`, {
    method: "POST",
    body: {
      answers: [
        {
          question_text: "What measurable target proves success?",
          answer_text: "Run 5km in under 30 minutes"
        }
      ]
    }
  });
  assert.equal(clarifications.status, 200);
  parseApiResponse("submit_clarifications", clarifications.body);

  const assessment = await client.request(`/v1/goals/${createdGoalId}/assessment`, {
    method: "POST",
    body: {
      current_level: "beginner",
      weekly_minutes_available: 180,
      target_date: "2026-10-01"
    }
  });
  assert.equal(assessment.status, 200);
  parseApiResponse("submit_assessment", assessment.body);

  const generate = await client.request(`/v1/goals/${createdGoalId}/plans/generate`, {
    method: "POST",
    body: {}
  });
  assert.equal(generate.status, 202);
  parseApiResponse("generate_plan", generate.body);

  const status = await waitForReadyPlan(client, createdGoalId);
  assert.equal(status.status, 200);
  parseApiResponse("plan_status", status.body);

  const activate = await client.request(`/v1/goals/${createdGoalId}/activate`, { method: "POST", body: {} });
  assert.equal(activate.status, 200);
  parseApiResponse("activate_goal", activate.body);

  const patchStatusReady = await client.request(`/v1/goals/${createdGoalId}/status`, {
    method: "PATCH",
    body: { status: "active" }
  });
  assert.equal(patchStatusReady.status, 200);
  parseApiResponse("patch_goal_status", patchStatusReady.body);

  const activateSeedGoal = await client.request("/v1/goals/goal-1/activate", {
    method: "POST",
    body: {}
  });
  assert.equal(activateSeedGoal.status, 200);
  parseApiResponse("activate_goal", activateSeedGoal.body);

  const todayTasks = await client.request("/v1/goals/active/tasks/today", { method: "GET" });
  assert.equal(todayTasks.status, 200);
  parseApiResponse("today_tasks", todayTasks.body);
  assert.ok(todayTasks.body.tasks.length > 0);
  const [firstTask, secondTask] = todayTasks.body.tasks;

  const complete = await client.request(`/v1/tasks/${firstTask.id}/complete`, {
    method: "POST",
    body: {
      actual_minutes: firstTask.est_minutes
    }
  });
  assert.equal(complete.status, 200);
  parseApiResponse("complete_task", complete.body);

  const skip = await client.request(`/v1/tasks/${(secondTask ?? firstTask).id}/skip`, {
    method: "POST",
    body: {}
  });
  assert.equal(skip.status, 200);
  parseApiResponse("skip_task", skip.body);

  const edit = await client.request(`/v1/tasks/${firstTask.id}`, {
    method: "PATCH",
    body: {
      title: "Edited title",
      est_minutes: 20
    }
  });
  assert.equal(edit.status, 200);
  parseApiResponse("edit_task", edit.body);

  const softAdjust = await client.request("/v1/goals/active/soft-adjust", {
    method: "POST",
    body: {}
  });
  assert.equal(softAdjust.status, 200);
  parseApiResponse("soft_adjust", softAdjust.body);

  const milestone = await client.request("/v1/milestones/ms-1/confirm", {
    method: "POST",
    body: {}
  });
  assert.equal(milestone.status, 200);
  parseApiResponse("confirm_milestone", milestone.body);

  const adapt = await client.request("/v1/goals/active/adapt", {
    method: "POST",
    body: { triggered_by: "manual" }
  });
  assert.equal(adapt.status, 202);
  parseApiResponse("adapt_goal", adapt.body);

  const progress = await client.request("/v1/goals/active/progress", { method: "GET" });
  assert.equal(progress.status, 200);
  parseApiResponse("progress", progress.body);

  const registerToken = await client.request("/v1/notifications/token", {
    method: "POST",
    body: {
      token: "expo-token-foundation",
      platform: "ios"
    }
  });
  assert.equal(registerToken.status, 200);
  parseApiResponse("register_notification_token", registerToken.body);

  const preferences = await client.request("/v1/notifications/preferences", {
    method: "PATCH",
    body: {
      max_push_per_day: 1
    }
  });
  assert.equal(preferences.status, 200);
  parseApiResponse("update_notification_preferences", preferences.body);

  const refreshedBootstrap = await client.request("/v1/app/bootstrap", { method: "GET" });
  assert.equal(refreshedBootstrap.status, 200);
  parseApiResponse("app_bootstrap", refreshedBootstrap.body);
  assert.equal(refreshedBootstrap.body.notifications.max_push_per_day, 1);
  assert.equal(refreshedBootstrap.body.notifications.has_push_token, true);

  const reminder = await client.request("/v1/notifications/reminders/send", {
    method: "POST",
    body: {
      reason: "daily_reminder"
    }
  });
  assert.equal(reminder.status, 200);
  parseApiResponse("send_reminder", reminder.body);

  assert.equal(Object.keys(ApiContracts).length >= 19, true);
});

test("goal and task routes reject resource access for another user", async (t) => {
  const now = new Date("2026-03-26T12:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now });
  const client = await startServer(server);

  t.after(async () => {
    await client.stop();
  });

  const foreignGoal = await client.request("/v1/goals/goal-1/activate", {
    method: "POST",
    body: {},
    authUserId: "user-2"
  });
  assert.equal(foreignGoal.status, 404);
  assert.match(foreignGoal.body.error.message, /Goal goal-1 not found/);

  const mismatchedCreate = await client.request("/v1/goals", {
    method: "POST",
    authUserId: "user-1",
    body: {
      user_id: "user-2",
      title: "Ship onboarding improvements by 2026-09-01"
    }
  });
  assert.equal(mismatchedCreate.status, 400);
  assert.match(mismatchedCreate.body.error.message, /user_id must match authenticated user/);

  const todayTasks = await client.request("/v1/goals/active/tasks/today", { method: "GET" });
  assert.equal(todayTasks.status, 200);
  const firstTask = todayTasks.body.tasks[0];

  const foreignTask = await client.request(`/v1/tasks/${firstTask.id}/complete`, {
    method: "POST",
    body: {
      actual_minutes: firstTask.est_minutes
    },
    authUserId: "user-2"
  });
  assert.equal(foreignTask.status, 404);
  assert.match(foreignTask.body.error.message, new RegExp(`Task ${firstTask.id} not found`));
});

test("required auth mode rejects missing or malformed authorization headers", async (t) => {
  const now = new Date("2026-03-26T12:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now, authMode: "required" });
  const client = await startServer(server, { authUserId: null });

  t.after(async () => {
    await client.stop();
  });

  const missingAuth = await client.request("/v1/goals", { method: "GET" });
  assert.equal(missingAuth.status, 401);
  assert.match(missingAuth.body.error.message, /Authorization header is required/);

  const malformedAuth = await client.request("/v1/goals", {
    method: "GET",
    headers: {
      authorization: "Token user-1"
    }
  });
  assert.equal(malformedAuth.status, 401);
  assert.match(malformedAuth.body.error.message, /Authorization header must use Bearer token/);
});
