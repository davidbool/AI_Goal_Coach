import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server/createServer.js";
import { startServer } from "./helpers/httpTestClient.js";

test("M4 + M5 contract routes respond with expected payloads", async (t) => {
  const now = new Date("2026-03-26T12:00:00.000Z");
  const { server } = createServer({ nowProvider: () => now, storeMode: "memory" });
  const client = await startServer(server);

  t.after(async () => {
    await client.stop();
  });

  const progress = await client.request("/v1/goals/active/progress", { method: "GET" });
  assert.equal(progress.status, 200);
  assert.equal(progress.body.screen.header.title, "Progress");
  assert.equal(progress.body.progress.streak.current_days, 2);

  const milestone = await client.request("/v1/milestones/ms-1/confirm", { method: "POST" });
  assert.equal(milestone.status, 200);
  assert.equal(milestone.body.milestone.status, "confirmed");

  const adapt = await client.request("/v1/goals/active/adapt", {
    method: "POST",
    body: { triggered_by: "manual" }
  });
  assert.equal(adapt.status, 202);
  assert.equal(adapt.body.new_plan_version, 2);
  assert.equal(adapt.body.endpoint, "/adapt");

  const token = await client.request("/v1/notifications/token", {
    method: "POST",
    body: { token: "expo-token-http", platform: "ios" }
  });
  assert.equal(token.status, 200);
  assert.equal(token.body.token.token, "expo-token-http");

  const preference = await client.request("/v1/notifications/preferences", {
    method: "PATCH",
    body: { max_push_per_day: 1 }
  });
  assert.equal(preference.status, 200);
  assert.equal(preference.body.preference.max_push_per_day, 1);

  const reminder = await client.request("/v1/notifications/reminders/send", {
    method: "POST",
    body: { reason: "daily_reminder" }
  });
  assert.equal(reminder.status, 200);
  assert.equal(reminder.body.sent, true);
});
