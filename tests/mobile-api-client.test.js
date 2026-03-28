import test from "node:test";
import assert from "node:assert/strict";

import { parseApiResponse } from "../src/contracts/schemas.js";
import { createServer } from "../src/server/createServer.js";
import { bootstrapDemoSession, fetchAppBootstrap } from "../mobile/src/api/goalCoachApi.js";
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
});
