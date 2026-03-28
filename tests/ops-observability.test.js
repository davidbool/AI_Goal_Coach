import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { createServer } from "../src/server/createServer.js";
import { startServer } from "./helpers/httpTestClient.js";

async function waitForReady(client, goalId, timeoutMs = 3500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await client.request(`/v1/goals/${goalId}/plans/status`, { method: "GET" });

    if (status.body.plan_state === "ready") {
      return status;
    }

    if (status.body.plan_state === "failed") {
      return status;
    }

    await delay(120);
  }

  throw new Error(`Timed out waiting for ready plan state for ${goalId}`);
}

test("ops metrics expose request, error, plan, and reminder instrumentation", async (t) => {
  const logEntries = [];
  const logger = {
    info(message) {
      logEntries.push({ level: "info", message });
    },
    error(message) {
      logEntries.push({ level: "error", message });
    }
  };

  const now = new Date("2026-03-26T12:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now, logger });
  const client = await startServer(server);

  t.after(async () => {
    await client.stop();
  });

  const token = await client.request("/v1/notifications/token", {
    method: "POST",
    body: {
      token: "expo-token-ops",
      platform: "ios"
    }
  });
  assert.equal(token.status, 200);

  const preferences = await client.request("/v1/notifications/preferences", {
    method: "PATCH",
    body: {
      max_push_per_day: 2,
      quiet_hours_start: "23:00",
      quiet_hours_end: "06:00"
    }
  });
  assert.equal(preferences.status, 200);

  const reminder = await client.request("/v1/notifications/reminders/send", {
    method: "POST",
    body: {
      reason: "daily_reminder"
    }
  });
  assert.equal(reminder.status, 200);
  assert.equal(reminder.body.sent, true);

  const createGoal = await client.request("/v1/goals", {
    method: "POST",
    body: {
      title: "Run 5km three times per week by 2026-10-01"
    }
  });
  assert.equal(createGoal.status, 201);
  const goalId = createGoal.body.goal.id;

  const assessment = await client.request(`/v1/goals/${goalId}/assessment`, {
    method: "POST",
    body: {
      current_level: "beginner",
      weekly_minutes_available: 180,
      target_date: "2026-10-01"
    }
  });
  assert.equal(assessment.status, 200);

  const generate = await client.request(`/v1/goals/${goalId}/plans/generate`, {
    method: "POST",
    body: {}
  });
  assert.equal(generate.status, 202);

  const status = await waitForReady(client, goalId);
  assert.equal(status.status, 200);
  assert.equal(status.body.plan_state, "ready");

  const notFound = await client.request("/v1/does-not-exist", { method: "GET" });
  assert.equal(notFound.status, 404);
  assert.ok(typeof notFound.body.error.request_id === "string");

  const metrics = await client.request("/v1/ops/metrics", { method: "GET" });
  assert.equal(metrics.status, 200);
  assert.equal(metrics.body.requests.total >= 8, true);
  assert.equal(metrics.body.errors.total >= 1, true);
  assert.equal(metrics.body.auth.by_source.authorization >= 1, true);
  assert.equal(metrics.body.plan_generation.by_state.generating, 1);
  assert.equal(metrics.body.plan_generation.by_state.ready, 1);
  assert.equal(metrics.body.reminders.by_reason.daily_reminder.sent, 1);
  assert.equal(metrics.body.requests.by_route["GET /v1/goals/:goalId/plans/status"].count >= 1, true);
  assert.equal(
    logEntries.some((entry) => entry.level === "info" && entry.message.includes("\"event\":\"request_completed\"")),
    true
  );
  assert.equal(
    logEntries.some((entry) => entry.level === "error" && entry.message.includes("\"event\":\"request_failed\"")),
    true
  );
});
