import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { M3ApiClient } from "../src/m3/api.js";
import { DailyExecutionLoop } from "../src/m3/dailyExecutionLoop.js";
import { createMockM3Api } from "../src/m3/mockApi.js";
import { renderTodayScreen } from "../src/m3/todayScreen.js";

test("today screen fetches active goal tasks and displays them", async () => {
  let requestedPath = null;
  let authorizationHeader = null;

  const fetchImpl = async (url, init) => {
    requestedPath = new URL(url, "https://goalcoach.local").pathname;
    authorizationHeader = init.headers.Authorization;
    return new Response(
      JSON.stringify({
        date: "2026-03-26",
        tasks: [
          {
            id: "t-1",
            title: "Write 150 words",
            estMinutes: 15,
            difficulty: "medium",
            required: true,
            state: "pending"
          }
        ],
        planVersion: 7
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  };

  const api = new M3ApiClient({ baseUrl: "/v1", fetchImpl, authToken: "user-1" });
  const loop = new DailyExecutionLoop({ api });

  await loop.loadToday();

  assert.equal(requestedPath, "/v1/goals/active/tasks/today");
  assert.equal(authorizationHeader, "Bearer user-1");
  const screen = renderTodayScreen(loop.getState());
  assert.match(screen, /Write 150 words/);
});

test("complete uses optimistic state and then syncs", async () => {
  let completeResolved = false;

  const api = {
    async fetchTodayTasks() {
      return {
        date: "2026-03-26",
        planVersion: 3,
        tasks: [
          {
            id: "t-1",
            title: "Morning practice",
            estMinutes: 20,
            difficulty: "medium",
            required: true,
            state: "pending"
          }
        ]
      };
    },
    completeTask: async () => {
      await delay(35);
      completeResolved = true;
      return {
        task: {
          id: "t-1",
          title: "Morning practice",
          estMinutes: 20,
          difficulty: "medium",
          required: true,
          state: "completed"
        }
      };
    },
    skipTask: async () => {
      throw new Error("not used");
    },
    editTask: async () => {
      throw new Error("not used");
    },
    softAdjust: async () => {
      throw new Error("not used");
    }
  };

  const loop = new DailyExecutionLoop({ api });
  await loop.loadToday();

  const completionPromise = loop.completeTask("t-1");

  const optimisticTask = loop.getState().tasks[0];
  assert.equal(optimisticTask.state, "completed");
  assert.equal(optimisticTask.syncState, "syncing");
  assert.equal(completeResolved, false);

  await completionPromise;
  const syncedTask = loop.getState().tasks[0];
  assert.equal(syncedTask.state, "completed");
  assert.equal(syncedTask.syncState, "synced");
});

test("failed optimistic mutation rolls back and keeps a gentle message", async () => {
  const api = {
    async fetchTodayTasks() {
      return {
        date: "2026-03-26",
        tasks: [
          {
            id: "t-9",
            title: "Stretch for 10 minutes",
            estMinutes: 10,
            difficulty: "low",
            required: false,
            state: "pending"
          }
        ]
      };
    },
    completeTask: async () => {
      throw new Error("network down");
    },
    skipTask: async () => {
      throw new Error("not used");
    },
    editTask: async () => {
      throw new Error("not used");
    },
    softAdjust: async () => {
      throw new Error("not used");
    }
  };

  const loop = new DailyExecutionLoop({ api });
  await loop.loadToday();

  await assert.rejects(() => loop.completeTask("t-9"), /network down/);
  const taskAfterFailure = loop.getState().tasks[0];

  assert.equal(taskAfterFailure.state, "pending");
  assert.equal(taskAfterFailure.syncState, "synced");
  assert.match(loop.getState().feedback.at(-1), /No stress/);
});

test("same-day soft adjustment only updates remaining tasks and keeps plan version", async () => {
  const api = createMockM3Api({
    planVersion: 5,
    tasks: [
      {
        id: "t-1",
        title: "Deep work session",
        estMinutes: 40,
        difficulty: "high",
        required: true,
        state: "completed",
        manualLock: false
      },
      {
        id: "t-2",
        title: "Read two pages",
        estMinutes: 20,
        difficulty: "medium",
        required: false,
        state: "pending",
        manualLock: false
      }
    ],
    latencyMs: 0
  });

  const loop = new DailyExecutionLoop({ api });
  await loop.loadToday();
  await loop.softAdjust();

  const state = loop.getState();
  const completedTask = state.tasks.find((task) => task.id === "t-1");
  const adjustedTask = state.tasks.find((task) => task.id === "t-2");

  assert.equal(completedTask.state, "completed");
  assert.equal(adjustedTask.state, "pending");
  assert.equal(adjustedTask.adjustmentSource, "same_day_soft");
  assert.equal(adjustedTask.estMinutes, 15);
});

test("soft adjustment rejects plan version bumps", async () => {
  const api = {
    async fetchTodayTasks() {
      return {
        date: "2026-03-26",
        planVersion: 4,
        tasks: [
          {
            id: "a",
            title: "Task A",
            estMinutes: 30,
            difficulty: "medium",
            required: true,
            state: "pending"
          }
        ]
      };
    },
    completeTask: async () => {
      throw new Error("not used");
    },
    skipTask: async () => {
      throw new Error("not used");
    },
    editTask: async () => {
      throw new Error("not used");
    },
    softAdjust: async () => {
      return {
        planVersion: 5,
        tasks: [
          {
            id: "a",
            title: "Task A (lighter)",
            estMinutes: 20,
            difficulty: "low",
            required: true,
            state: "pending"
          }
        ]
      };
    }
  };

  const loop = new DailyExecutionLoop({ api });
  await loop.loadToday();

  await assert.rejects(() => loop.softAdjust(), /Soft adjustment changed plan version/);
  assert.equal(loop.getState().tasks[0].title, "Task A");
});

test("daily loop accepts snake_case and envelope-style payloads", async () => {
  const api = {
    async fetchTodayTasks() {
      return {
        date: "2026-03-26",
        plan_version: 9,
        tasks: [
          {
            task_id: "t-snake",
            title: "Walk ten minutes",
            est_minutes: 10,
            difficulty: "low",
            required: 1,
            status: "pending",
            manual_lock: 0,
            adjustment_source: "plan"
          }
        ],
        coach_message: "Day starts simple."
      };
    },
    async completeTask() {
      return {
        data: {
          updated_task: {
            task_id: "t-snake",
            title: "Walk ten minutes",
            est_minutes: "10",
            difficulty: "low",
            required: true,
            status: "done",
            manual_lock: 1,
            adjustment_source: "plan"
          }
        },
        coach_message: "Great consistency."
      };
    },
    async skipTask() {
      throw new Error("not used");
    },
    async editTask() {
      throw new Error("not used");
    },
    async softAdjust() {
      return {
        plan_version: "9",
        remaining_tasks: [
          {
            task_id: "t-snake",
            title: "Walk ten minutes",
            est_minutes: 8,
            difficulty: "low",
            required: true,
            status: "pending",
            manual_lock: true,
            adjustment_source: "same_day_soft"
          }
        ],
        coach_message: "We lightened the remaining load."
      };
    }
  };

  const loop = new DailyExecutionLoop({ api });
  await loop.loadToday();
  assert.equal(loop.getState().planVersion, 9);
  assert.equal(loop.getState().tasks[0].id, "t-snake");
  assert.equal(loop.getState().tasks[0].required, true);

  await loop.completeTask("t-snake");
  assert.equal(loop.getState().tasks[0].state, "completed");
  assert.equal(loop.getState().tasks[0].manualLock, true);
  assert.match(loop.getState().feedback.at(-1), /Great consistency/);

  await loop.softAdjust();
  assert.equal(loop.getState().planVersion, 9);
  assert.equal(loop.getState().tasks[0].estMinutes, 8);
  assert.equal(loop.getState().tasks[0].adjustmentSource, "same_day_soft");
  assert.match(loop.getState().feedback.at(-1), /lightened/);
});

test("daily loop can complete in under ten seconds", async () => {
  const api = createMockM3Api({ latencyMs: 0 });
  const loop = new DailyExecutionLoop({ api });

  const start = Date.now();

  await loop.loadToday();
  await loop.completeTask("task-1");
  await loop.editTask("task-2", { title: "Review one key insight", estMinutes: 8 });
  await loop.skipTask("task-3");
  await loop.softAdjust();

  const elapsedMs = Date.now() - start;
  assert.ok(elapsedMs < 10000, `Expected under 10s, got ${elapsedMs}ms`);

  const state = loop.getState();
  assert.equal(state.tasks.find((task) => task.id === "task-1")?.state, "completed");
  assert.equal(state.tasks.find((task) => task.id === "task-2")?.title, "Review one key insight");
  assert.equal(state.tasks.find((task) => task.id === "task-2")?.manualLock, true);
  assert.equal(state.tasks.find((task) => task.id === "task-3")?.state, "skipped");
});
