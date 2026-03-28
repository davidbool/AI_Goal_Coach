import test from "node:test";
import assert from "node:assert/strict";

import { parseApiResponse } from "../src/contracts/schemas.js";
import { createServer } from "../src/server/createServer.js";
import { startServer } from "./helpers/httpTestClient.js";

test("dev bootstrap seeds a deterministic active-goal scenario and reset clears it", async (t) => {
  const now = new Date("2026-03-28T09:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now, authMode: "required" });
  const client = await startServer(server, { authUserId: "guest-demo-1" });

  t.after(async () => {
    await client.stop();
  });

  const bootstrap = await client.request("/v1/dev/bootstrap", {
    method: "POST",
    body: {
      scenario: "active_goal_ready"
    }
  });

  assert.equal(bootstrap.status, 200);
  parseApiResponse("dev_bootstrap", bootstrap.body);
  assert.equal(bootstrap.body.scenario, "active_goal_ready");
  assert.equal(bootstrap.body.summary.goal_count, 1);
  assert.equal(bootstrap.body.summary.today_task_count, 2);

  const goals = await client.request("/v1/goals", { method: "GET" });
  assert.equal(goals.status, 200);
  assert.equal(goals.body.goals.length, 1);
  assert.equal(goals.body.goals[0].status, "active");

  const appBootstrap = await client.request("/v1/app/bootstrap", { method: "GET" });
  assert.equal(appBootstrap.status, 200);
  parseApiResponse("app_bootstrap", appBootstrap.body);
  assert.equal(appBootstrap.body.active_goal.id, goals.body.goals[0].id);
  assert.equal(appBootstrap.body.today.tasks.length, 2);
  assert.equal(appBootstrap.body.progress.goal_id, goals.body.goals[0].id);

  const today = await client.request("/v1/goals/active/tasks/today", { method: "GET" });
  assert.equal(today.status, 200);
  assert.equal(today.body.tasks.length, 2);

  const reset = await client.request("/v1/dev/reset", {
    method: "POST",
    body: {}
  });
  assert.equal(reset.status, 200);
  parseApiResponse("dev_reset", reset.body);
  assert.equal(reset.body.summary.goal_count, 0);
  assert.equal(reset.body.summary.active_goal_id, null);

  const goalsAfterReset = await client.request("/v1/goals", { method: "GET" });
  assert.equal(goalsAfterReset.status, 200);
  assert.equal(goalsAfterReset.body.goals.length, 0);

  const todayAfterReset = await client.request("/v1/goals/active/tasks/today", { method: "GET" });
  assert.equal(todayAfterReset.status, 404);
});

test("dev bootstrap supports no_active_goal and no_tasks_today UI states", async (t) => {
  const now = new Date("2026-03-28T09:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now, authMode: "required" });
  const client = await startServer(server, { authUserId: "guest-demo-2" });

  t.after(async () => {
    await client.stop();
  });

  const noActiveGoal = await client.request("/v1/dev/bootstrap", {
    method: "POST",
    body: {
      scenario: "no_active_goal"
    }
  });

  assert.equal(noActiveGoal.status, 200);
  assert.equal(noActiveGoal.body.summary.active_goal_id, null);

  const noActiveBootstrap = await client.request("/v1/app/bootstrap", { method: "GET" });
  assert.equal(noActiveBootstrap.status, 200);
  parseApiResponse("app_bootstrap", noActiveBootstrap.body);
  assert.equal(noActiveBootstrap.body.active_goal, null);
  assert.equal(noActiveBootstrap.body.today, null);
  assert.equal(noActiveBootstrap.body.progress, null);

  const noActiveToday = await client.request("/v1/goals/active/tasks/today", { method: "GET" });
  assert.equal(noActiveToday.status, 404);

  const noTasksToday = await client.request("/v1/dev/bootstrap", {
    method: "POST",
    body: {
      scenario: "no_tasks_today"
    }
  });

  assert.equal(noTasksToday.status, 200);
  assert.equal(noTasksToday.body.summary.active_goal_id !== null, true);
  assert.equal(noTasksToday.body.summary.today_task_count, 0);

  const noTasksBootstrap = await client.request("/v1/app/bootstrap", { method: "GET" });
  assert.equal(noTasksBootstrap.status, 200);
  parseApiResponse("app_bootstrap", noTasksBootstrap.body);
  assert.equal(noTasksBootstrap.body.active_goal !== null, true);
  assert.deepEqual(noTasksBootstrap.body.today.tasks, []);

  const emptyToday = await client.request("/v1/goals/active/tasks/today", { method: "GET" });
  assert.equal(emptyToday.status, 200);
  assert.deepEqual(emptyToday.body.tasks, []);
});
