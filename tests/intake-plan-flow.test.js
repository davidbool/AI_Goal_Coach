import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

async function withServer(run) {
  const { app } = createApp();
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run({ baseUrl });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(baseUrl, path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function patchJson(baseUrl, path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollReadyStatus(baseUrl, goalId, timeoutMs = 3500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const statusRes = await getJson(baseUrl, `/v1/goals/${goalId}/plans/status`);

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
    });

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
    });

    assert.equal(clarify.status, 200);
    assert.equal(clarify.body.goal.specificity_state, "specific");

    const assessment = await postJson(baseUrl, `/v1/goals/${goalId}/assessment`, {
      current_level: "beginner",
      weekly_minutes_available: 180,
      target_date: "2026-08-01"
    });

    assert.equal(assessment.status, 200);
    assert.equal(assessment.body.assessment.weekly_minutes_available, 180);

    const generate = await postJson(baseUrl, `/v1/goals/${goalId}/plans/generate`, {});
    assert.equal(generate.status, 202);
    assert.equal(generate.body.plan_state, "generating");

    const ready = await pollReadyStatus(baseUrl, goalId);
    assert.equal(ready.plan_state, "ready");
    assert.ok(ready.plan.estimate.min_weeks >= 4);
    assert.equal(Array.isArray(ready.plan.milestones), true);
    assert.equal(Array.isArray(ready.plan.first_tasks), true);
    assert.equal(ready.plan.first_tasks.length > 0, true);

    const activate = await postJson(baseUrl, `/v1/goals/${goalId}/activate`, {});
    assert.equal(activate.status, 200);
    assert.equal(activate.body.goal.status, "active");

    const second = await postJson(baseUrl, "/v1/goals", {
      user_id: "user-a",
      title: "Learn React by building 2 projects by 2026-10-01"
    });
    const secondGoalId = second.body.goal.id;

    await postJson(baseUrl, `/v1/goals/${secondGoalId}/assessment`, {
      current_level: "intermediate",
      weekly_minutes_available: 240,
      target_date: "2026-10-01"
    });

    const activateSecond = await postJson(baseUrl, `/v1/goals/${secondGoalId}/activate`, {});
    assert.equal(activateSecond.status, 200);
    assert.equal(activateSecond.body.goal.status, "active");

    const listed = await getJson(baseUrl, "/v1/goals?user_id=user-a");
    assert.equal(listed.status, 200);

    const firstGoal = listed.body.goals.find((goal) => goal.id === goalId);
    const secondGoal = listed.body.goals.find((goal) => goal.id === secondGoalId);

    assert.equal(firstGoal.status, "paused");
    assert.equal(secondGoal.status, "active");

    const pauseSecond = await patchJson(baseUrl, `/v1/goals/${secondGoalId}/status`, {
      status: "paused"
    });
    assert.equal(pauseSecond.status, 200);
    assert.equal(pauseSecond.body.goal.status, "paused");
  });
});

test("Plan generation reaches delayed before ready for long-running generation", async () => {
  await withServer(async ({ baseUrl }) => {
    const create = await postJson(baseUrl, "/v1/goals", {
      user_id: "user-delay",
      title: "Run 5km [mock-delay] 3 times per week by 2026-12-01"
    });

    const goalId = create.body.goal.id;

    await postJson(baseUrl, `/v1/goals/${goalId}/assessment`, {
      current_level: "novice",
      weekly_minutes_available: 150,
      target_date: "2026-12-01"
    });

    const generate = await postJson(baseUrl, `/v1/goals/${goalId}/plans/generate`, {});
    assert.equal(generate.status, 202);
    assert.equal(generate.body.plan_state, "generating");

    await sleep(450);
    const delayed = await getJson(baseUrl, `/v1/goals/${goalId}/plans/status`);
    assert.equal(delayed.status, 200);
    assert.equal(delayed.body.plan_state, "delayed");

    const ready = await pollReadyStatus(baseUrl, goalId);
    assert.equal(ready.plan_state, "ready");
    assert.ok(ready.plan.milestones.length >= 3);
  });
});

test("Plan generation surfaces failed state for failed mock AI output", async () => {
  await withServer(async ({ baseUrl }) => {
    const create = await postJson(baseUrl, "/v1/goals", {
      user_id: "user-fail",
      title: "Learn piano [mock-fail] 3 sessions per week by 2026-11-01"
    });

    const goalId = create.body.goal.id;

    await postJson(baseUrl, `/v1/goals/${goalId}/assessment`, {
      current_level: "beginner",
      weekly_minutes_available: 200,
      target_date: "2026-11-01"
    });

    await postJson(baseUrl, `/v1/goals/${goalId}/plans/generate`, {});
    await sleep(320);

    const failed = await getJson(baseUrl, `/v1/goals/${goalId}/plans/status`);
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

  const { app } = createApp({ aiClient: invalidAiClient });
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const create = await postJson(baseUrl, "/v1/goals", {
      user_id: "user-invalid",
      title: "Learn React by building 2 projects by 2026-10-01"
    });

    const goalId = create.body.goal.id;

    await postJson(baseUrl, `/v1/goals/${goalId}/assessment`, {
      current_level: "intermediate",
      weekly_minutes_available: 240,
      target_date: "2026-10-01"
    });

    const generate = await postJson(baseUrl, `/v1/goals/${goalId}/plans/generate`, {});
    assert.equal(generate.status, 202);

    await sleep(60);

    const status = await getJson(baseUrl, `/v1/goals/${goalId}/plans/status`);
    assert.equal(status.status, 200);
    assert.equal(status.body.plan_state, "failed");
    assert.equal(status.body.plan, null);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
