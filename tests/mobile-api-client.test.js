import test from "node:test";
import assert from "node:assert/strict";

import { parseApiResponse } from "../src/contracts/schemas.js";
import { createServer } from "../src/server/createServer.js";
import {
  bootstrapDemoSession,
  editTask,
  fetchAppBootstrap,
  triggerFullAdaptation
} from "../mobile/src/api/goalCoachApi.js";
import { startServer } from "./helpers/httpTestClient.js";

test("mobile API client fetches the initial bootstrap snapshot for an active goal", async (t) => {
  const now = new Date("2026-03-28T09:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now, authMode: "required" });
  const client = await startServer(server, { authUserId: "mobile-ui-user-1" });

  t.after(async () => {
    await client.stop();
  });

  const session = await bootstrapDemoSession(client.baseUrl, "mobile-ui-user-1", "active_goal_ready");
  assert.equal(session.scenario, "active_goal_ready");

  const bootstrap = await fetchAppBootstrap(client.baseUrl, "mobile-ui-user-1");
  parseApiResponse("app_bootstrap", bootstrap);

  assert.equal(bootstrap.goals.length, 1);
  assert.ok(bootstrap.active_goal);
  assert.ok(bootstrap.today);
  assert.equal(bootstrap.today.tasks.length, 2);
  assert.ok(bootstrap.progress);
  assert.equal(bootstrap.progress.goal_id, bootstrap.active_goal.id);
  assert.equal(bootstrap.notifications.reminder_time_local, "20:00");
  assert.equal(bootstrap.notifications.has_push_token, false);
});

test("mobile API client returns null dashboard sections when no goal is active", async (t) => {
  const now = new Date("2026-03-28T09:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now, authMode: "required" });
  const client = await startServer(server, { authUserId: "mobile-ui-user-2" });

  t.after(async () => {
    await client.stop();
  });

  const session = await bootstrapDemoSession(client.baseUrl, "mobile-ui-user-2", "no_active_goal");
  assert.equal(session.scenario, "no_active_goal");

  const bootstrap = await fetchAppBootstrap(client.baseUrl, "mobile-ui-user-2");
  parseApiResponse("app_bootstrap", bootstrap);

  assert.equal(bootstrap.active_goal, null);
  assert.equal(bootstrap.today, null);
  assert.equal(bootstrap.progress, null);
  assert.equal(bootstrap.goals.length > 0, true);
  assert.equal(bootstrap.notifications.max_push_per_day, 2);
});

test("mobile API client exposes effective notifications even before a preference record exists", async (t) => {
  const now = new Date("2026-03-28T09:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now, authMode: "required" });
  const client = await startServer(server, { authUserId: "mobile-ui-user-3" });

  t.after(async () => {
    await client.stop();
  });

  const session = await bootstrapDemoSession(client.baseUrl, "mobile-ui-user-3", "starter");
  assert.equal(session.scenario, "starter");

  const bootstrap = await fetchAppBootstrap(client.baseUrl, "mobile-ui-user-3");
  parseApiResponse("app_bootstrap", bootstrap);

  assert.equal(bootstrap.active_goal, null);
  assert.equal(bootstrap.today, null);
  assert.equal(bootstrap.progress, null);
  assert.deepEqual(bootstrap.notifications, {
    reminder_time_local: "20:00",
    quiet_hours_start: "22:00",
    quiet_hours_end: "07:00",
    max_push_per_day: 2,
    has_push_token: false
  });
});

test("mobile API client edits pending tasks and refreshes into the next adapted plan version", async (t) => {
  const now = new Date("2026-03-28T09:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now, authMode: "required" });
  const client = await startServer(server, { authUserId: "mobile-ui-user-4" });

  t.after(async () => {
    await client.stop();
  });

  await bootstrapDemoSession(client.baseUrl, "mobile-ui-user-4", "active_goal_ready");

  const bootstrap = await fetchAppBootstrap(client.baseUrl, "mobile-ui-user-4");
  parseApiResponse("app_bootstrap", bootstrap);

  const pendingTask = bootstrap.today.tasks.find((task) => task.state === "pending");
  assert.ok(pendingTask);

  const edited = await editTask(client.baseUrl, "mobile-ui-user-4", pendingTask.id, {
    title: "Trim the mobile dashboard gap",
    est_minutes: 25,
    difficulty: "high",
    required: false
  });
  parseApiResponse("edit_task", edited);

  assert.equal(edited.task.title, "Trim the mobile dashboard gap");
  assert.equal(edited.task.est_minutes, 25);
  assert.equal(edited.task.difficulty, "high");
  assert.equal(edited.task.required, false);
  assert.equal(edited.task.manual_lock, true);
  assert.equal(edited.task.source, "manual");

  const adapted = await triggerFullAdaptation(client.baseUrl, "mobile-ui-user-4", {
    triggered_by: "manual"
  });
  parseApiResponse("adapt_goal", adapted);

  assert.equal(adapted.new_plan_version, 2);

  const refreshed = await fetchAppBootstrap(client.baseUrl, "mobile-ui-user-4");
  parseApiResponse("app_bootstrap", refreshed);

  assert.equal(refreshed.progress.plan_version, 2);
  const preservedTask = refreshed.today.tasks.find((task) => task.title === "Trim the mobile dashboard gap");

  assert.ok(preservedTask);
  assert.equal(preservedTask.manual_lock, true);
  assert.equal(preservedTask.source, "manual");
});
