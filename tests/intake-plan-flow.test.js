import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

async function withServer(run) {
  const { app, store } = createApp({ storeMode: "memory" });
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run({ baseUrl, store });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function authHeaders(userId, headers = {}) {
  if (!userId) {
    return headers;
  }

  return {
    ...headers,
    authorization: `Bearer ${userId}`
  };
}

async function postJson(baseUrl, path, payload, userId = null, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: authHeaders(userId, { "content-type": "application/json", ...headers }),
    body: JSON.stringify(payload)
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function patchJson(baseUrl, path, payload, userId = null, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: authHeaders(userId, { "content-type": "application/json", ...headers }),
    body: JSON.stringify(payload)
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function getJson(baseUrl, path, userId = null, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: authHeaders(userId, headers)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollReadyStatus(baseUrl, goalId, userId, timeoutMs = 3500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const statusRes = await getJson(baseUrl, `/v1/goals/${goalId}/plans/status`, userId);

    if (statusRes.body.plan_state === "ready") {
      return statusRes.body;
    }

    if (statusRes.body.plan_state === "failed") {
      return statusRes.body;
    }

    await sleep(120);
  }

  throw new Error(`Timed out waiting for plan readiness for ${goalId}`);
}

test("M1+M2 full happy path supports clarify, onboarding, generation, and activation", async () => {
  await withServer(async ({ baseUrl }) => {
    const create = await postJson(baseUrl, "/v1/goals", {
      user_id: "user-a",
      title: "be happier"
    }, "user-a");

    assert.equal(create.status, 201);
    assert.equal(create.body.goal.status, "draft");
    assert.equal(create.body.goal.specificity_state, "needs_clarification");
    assert.ok(create.body.specificity.clarification_questions.length > 0);

    const goalId = create.body.goal.id;

    const clarify = await postJson(baseUrl, `/v1/goals/${goalId}/clarifications`, {
      answers: [
        {
          question_text: "What measurable target will show this goal is achieved?",
          answer_text: "I will complete 4 focused journaling sessions each week"
        },
        {
          question_text: "By what date or timeframe do you want to reach it?",
          answer_text: "I will sustain this by 2026-08-01"
        }
      ]
    }, "user-a");

    assert.equal(clarify.status, 200);
    assert.equal(clarify.body.goal.specificity_state, "specific");

    const assessment = await postJson(baseUrl, `/v1/goals/${goalId}/assessment`, {
      current_level: "beginner",
      weekly_minutes_available: 180,
      target_date: "2026-08-01"
    }, "user-a");

    assert.equal(assessment.status, 200);
    assert.equal(assessment.body.assessment.weekly_minutes_available, 180);

    const generate = await postJson(baseUrl, `/v1/goals/${goalId}/plans/generate`, {}, "user-a");
    assert.equal(generate.status, 202);
    assert.equal(generate.body.plan_state, "generating");

    const ready = await pollReadyStatus(baseUrl, goalId, "user-a");
    assert.equal(ready.plan_state, "ready");
    assert.ok(ready.plan.estimate.min_weeks >= 4);
    assert.equal(Array.isArray(ready.plan.milestones), true);
    assert.equal(Array.isArray(ready.plan.first_tasks), true);
    assert.equal(ready.plan.first_tasks.length > 0, true);

    const activate = await postJson(baseUrl, `/v1/goals/${goalId}/activate`, {}, "user-a");
    assert.equal(activate.status, 200);
    assert.equal(activate.body.goal.status, "active");

    const second = await postJson(baseUrl, "/v1/goals", {
      user_id: "user-a",
      title: "Learn React by building 2 projects by 2026-10-01"
    }, "user-a");
    const secondGoalId = second.body.goal.id;

    await postJson(baseUrl, `/v1/goals/${secondGoalId}/assessment`, {
      current_level: "intermediate",
      weekly_minutes_available: 240,
      target_date: "2026-10-01"
    }, "user-a");

    const activateSecondBeforePlan = await postJson(baseUrl, `/v1/goals/${secondGoalId}/activate`, {}, "user-a");
    assert.equal(activateSecondBeforePlan.status, 409);

    await postJson(baseUrl, `/v1/goals/${secondGoalId}/plans/generate`, {}, "user-a");
    const secondReady = await pollReadyStatus(baseUrl, secondGoalId, "user-a");
    assert.equal(secondReady.plan_state, "ready");

    const activateSecond = await postJson(baseUrl, `/v1/goals/${secondGoalId}/activate`, {}, "user-a");
    assert.equal(activateSecond.status, 200);
    assert.equal(activateSecond.body.goal.status, "active");

    const listed = await getJson(baseUrl, "/v1/goals", "user-a");
    assert.equal(listed.status, 200);

    const firstGoal = listed.body.goals.find((goal) => goal.id === goalId);
    const secondGoal = listed.body.goals.find((goal) => goal.id === secondGoalId);

    assert.equal(firstGoal.status, "paused");
    assert.equal(secondGoal.status, "active");

    const repatchFirstActive = await patchJson(baseUrl, `/v1/goals/${goalId}/status`, {
      status: "active"
    }, "user-a");
    assert.equal(repatchFirstActive.status, 200);
    assert.equal(repatchFirstActive.body.goal.status, "active");
    assert.ok(repatchFirstActive.body.goal.active_at);

    const listedAfterRepatch = await getJson(baseUrl, "/v1/goals", "user-a");
    assert.equal(listedAfterRepatch.status, 200);

    const firstAfterRepatch = listedAfterRepatch.body.goals.find((goal) => goal.id === goalId);
    const secondAfterRepatch = listedAfterRepatch.body.goals.find((goal) => goal.id === secondGoalId);

    assert.equal(firstAfterRepatch.status, "active");
    assert.equal(secondAfterRepatch.status, "paused");

    const pauseSecond = await patchJson(baseUrl, `/v1/goals/${secondGoalId}/status`, {
      status: "paused"
    }, "user-a");
    assert.equal(pauseSecond.status, 200);
    assert.equal(pauseSecond.body.goal.status, "paused");
  });
});

test("Plan generation reaches delayed before ready for long-running generation", async () => {
  await withServer(async ({ baseUrl, store }) => {
    await postJson(baseUrl, "/v1/notifications/token", {
      token: "expo-token-delay",
      platform: "ios"
    }, "user-delay");

    await patchJson(baseUrl, "/v1/notifications/preferences", {
      max_push_per_day: 2,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00"
    }, "user-delay");

    const create = await postJson(baseUrl, "/v1/goals", {
      user_id: "user-delay",
      title: "Run 5km 3 times per week by 2026-12-01"
    }, "user-delay");

    const goalId = create.body.goal.id;

    await postJson(baseUrl, `/v1/goals/${goalId}/assessment`, {
      current_level: "novice",
      weekly_minutes_available: 150,
      target_date: "2026-12-01"
    }, "user-delay");

    const generate = await postJson(
      baseUrl,
      `/v1/goals/${goalId}/plans/generate`,
      {},
      "user-delay",
      { "x-mock-ai-scenario": "delay" }
    );
    assert.equal(generate.status, 202);
    assert.equal(generate.body.plan_state, "generating");

    await sleep(450);
    const delayed = await getJson(baseUrl, `/v1/goals/${goalId}/plans/status`, "user-delay");
    assert.equal(delayed.status, 200);
    assert.equal(delayed.body.plan_state, "delayed");

    const ready = await pollReadyStatus(baseUrl, goalId, "user-delay");
    assert.equal(ready.plan_state, "ready");
    assert.ok(ready.plan.milestones.length >= 3);

    const snapshot = await store.getStateSnapshot();
    const delayedReadyReminders = snapshot.remindersSent.filter((reminder) => (
      reminder.user_id === "user-delay" &&
      reminder.goal_id === goalId &&
      reminder.reason === "delayed_plan_ready"
    ));
    assert.equal(delayedReadyReminders.length, 1);

    const readyAgain = await getJson(baseUrl, `/v1/goals/${goalId}/plans/status`, "user-delay");
    assert.equal(readyAgain.status, 200);

    const snapshotAfterRepeat = await store.getStateSnapshot();
    const delayedReadyRemindersAfterRepeat = snapshotAfterRepeat.remindersSent.filter((reminder) => (
      reminder.user_id === "user-delay" &&
      reminder.goal_id === goalId &&
      reminder.reason === "delayed_plan_ready"
    ));
    assert.equal(delayedReadyRemindersAfterRepeat.length, 1);
  });
});

test("Plan generation surfaces failed state for failed mock AI output", async () => {
  await withServer(async ({ baseUrl }) => {
    const create = await postJson(baseUrl, "/v1/goals", {
      user_id: "user-fail",
      title: "Learn piano 3 sessions per week by 2026-11-01"
    }, "user-fail");

    const goalId = create.body.goal.id;

    await postJson(baseUrl, `/v1/goals/${goalId}/assessment`, {
      current_level: "beginner",
      weekly_minutes_available: 200,
      target_date: "2026-11-01"
    }, "user-fail");

    await postJson(
      baseUrl,
      `/v1/goals/${goalId}/plans/generate`,
      {},
      "user-fail",
      { "x-mock-ai-scenario": "fail" }
    );
    await sleep(320);

    const failed = await getJson(baseUrl, `/v1/goals/${goalId}/plans/status`, "user-fail");
    assert.equal(failed.status, 200);
    assert.equal(failed.body.plan_state, "failed");
    assert.equal(failed.body.plan, null);
  });
});

test("Plan generation falls back to failed when AI returns an invalid payload", async () => {
  const invalidAiClient = {
    scoreSpecificity() {
      return {
        score: 0.9,
        missing_elements: []
      };
    },
    classifyFrame() {
      return "skill_mastery";
    },
    generatePlanDraft() {
      return {
        outcome: "ready",
        resolve_ms: 20,
        payload: {
          frame_type: "skill_mastery",
          feasibility: "realistic",
          estimate: {
            min_weeks: 4,
            max_weeks: 8,
            confidence: 0.7
          },
          milestones: [],
          tasks: []
        }
      };
    }
  };

  const { app } = createApp({ aiClient: invalidAiClient, storeMode: "memory" });
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const create = await postJson(baseUrl, "/v1/goals", {
      user_id: "user-invalid",
      title: "Learn React by building 2 projects by 2026-10-01"
    }, "user-invalid");

    const goalId = create.body.goal.id;

    await postJson(baseUrl, `/v1/goals/${goalId}/assessment`, {
      current_level: "intermediate",
      weekly_minutes_available: 240,
      target_date: "2026-10-01"
    }, "user-invalid");

    const generate = await postJson(baseUrl, `/v1/goals/${goalId}/plans/generate`, {}, "user-invalid");
    assert.equal(generate.status, 202);

    await sleep(60);

    const status = await getJson(baseUrl, `/v1/goals/${goalId}/plans/status`, "user-invalid");
    assert.equal(status.status, 200);
    assert.equal(status.body.plan_state, "failed");
    assert.equal(status.body.plan, null);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
