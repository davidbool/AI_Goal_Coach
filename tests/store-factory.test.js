import test from "node:test";
import assert from "node:assert/strict";

import { resolveStoreEnvironment, resolveStoreMode } from "../src/repositories/storeFactory.js";

function withStoreEnv(t, values) {
  const previousGoalCoachStore = process.env.GOAL_COACH_STORE;
  const previousGoalCoachEnv = process.env.GOAL_COACH_ENV;
  const previousNodeEnv = process.env.NODE_ENV;

  if (values.GOAL_COACH_STORE === undefined) {
    delete process.env.GOAL_COACH_STORE;
  } else {
    process.env.GOAL_COACH_STORE = values.GOAL_COACH_STORE;
  }

  if (values.GOAL_COACH_ENV === undefined) {
    delete process.env.GOAL_COACH_ENV;
  } else {
    process.env.GOAL_COACH_ENV = values.GOAL_COACH_ENV;
  }

  if (values.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = values.NODE_ENV;
  }

  t.after(() => {
    if (previousGoalCoachStore === undefined) {
      delete process.env.GOAL_COACH_STORE;
    } else {
      process.env.GOAL_COACH_STORE = previousGoalCoachStore;
    }

    if (previousGoalCoachEnv === undefined) {
      delete process.env.GOAL_COACH_ENV;
    } else {
      process.env.GOAL_COACH_ENV = previousGoalCoachEnv;
    }

    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
}

test("explicit storeMode override wins over runtime environment defaults", (t) => {
  withStoreEnv(t, {
    GOAL_COACH_STORE: undefined,
    GOAL_COACH_ENV: "production",
    NODE_ENV: "production"
  });

  assert.equal(resolveStoreMode({ storeMode: "memory" }), "memory");
});

test("GOAL_COACH_STORE env wins over derived defaults", (t) => {
  withStoreEnv(t, {
    GOAL_COACH_STORE: "memory",
    GOAL_COACH_ENV: "production",
    NODE_ENV: "production"
  });

  assert.equal(resolveStoreMode(), "memory");
});

test("missing runtime environment falls back to dev semantics", (t) => {
  withStoreEnv(t, {
    GOAL_COACH_STORE: undefined,
    GOAL_COACH_ENV: undefined,
    NODE_ENV: undefined
  });

  assert.equal(resolveStoreEnvironment(), "dev");
  assert.equal(resolveStoreMode(), "memory");
});

test("dev-like environments default to the in-memory store", (t) => {
  withStoreEnv(t, {
    GOAL_COACH_STORE: undefined,
    GOAL_COACH_ENV: "development",
    NODE_ENV: "production"
  });

  assert.equal(resolveStoreEnvironment(), "development");
  assert.equal(resolveStoreMode(), "memory");
});

test("non-dev environments default to Prisma", (t) => {
  withStoreEnv(t, {
    GOAL_COACH_STORE: undefined,
    GOAL_COACH_ENV: "staging",
    NODE_ENV: "development"
  });

  assert.equal(resolveStoreEnvironment(), "staging");
  assert.equal(resolveStoreMode(), "prisma");
});
