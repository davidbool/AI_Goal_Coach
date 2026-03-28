import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/app.js";
import { AiProviderConfig, createConfiguredAiClient, resolveAiProvider } from "../src/services/aiClientFactory.js";
import { MockAiClient } from "../src/services/mockAiClient.js";

function withAiProviderEnv(t, values) {
  const previousAiProvider = process.env.AI_PROVIDER;
  const previousGoalCoachAiProvider = process.env.GOAL_COACH_AI_PROVIDER;

  if (values.AI_PROVIDER === undefined) {
    delete process.env.AI_PROVIDER;
  } else {
    process.env.AI_PROVIDER = values.AI_PROVIDER;
  }

  if (values.GOAL_COACH_AI_PROVIDER === undefined) {
    delete process.env.GOAL_COACH_AI_PROVIDER;
  } else {
    process.env.GOAL_COACH_AI_PROVIDER = values.GOAL_COACH_AI_PROVIDER;
  }

  t.after(() => {
    if (previousAiProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = previousAiProvider;
    }

    if (previousGoalCoachAiProvider === undefined) {
      delete process.env.GOAL_COACH_AI_PROVIDER;
    } else {
      process.env.GOAL_COACH_AI_PROVIDER = previousGoalCoachAiProvider;
    }
  });
}

test("AI provider defaults to mock when no env or override is set", (t) => {
  withAiProviderEnv(t, {
    AI_PROVIDER: undefined,
    GOAL_COACH_AI_PROVIDER: undefined
  });

  assert.equal(resolveAiProvider(), AiProviderConfig.defaultProvider);
  assert.ok(createConfiguredAiClient() instanceof MockAiClient);
});

test("AI_PROVIDER takes precedence over GOAL_COACH_AI_PROVIDER", (t) => {
  withAiProviderEnv(t, {
    AI_PROVIDER: "mock",
    GOAL_COACH_AI_PROVIDER: "real"
  });

  assert.equal(resolveAiProvider(), "mock");
});

test("explicit aiProvider override takes precedence over env", (t) => {
  withAiProviderEnv(t, {
    AI_PROVIDER: "mock",
    GOAL_COACH_AI_PROVIDER: "mock"
  });

  assert.equal(resolveAiProvider({ aiProvider: "real" }), "real");
});

test("unsupported AI provider values fail with a clear error", (t) => {
  withAiProviderEnv(t, {
    AI_PROVIDER: "banana",
    GOAL_COACH_AI_PROVIDER: undefined
  });

  assert.throws(
    () => resolveAiProvider(),
    /Unsupported AI provider "banana"/
  );
});

test("real AI provider fails fast until it is wired", () => {
  assert.throws(
    () => createConfiguredAiClient({ aiProvider: "real" }),
    /AI provider "real" is not wired yet/
  );
});

test("createApp uses the configured AI provider seam", () => {
  const { services } = createApp({ aiProvider: "mock" });

  assert.ok(services.planService.aiClient instanceof MockAiClient);
  assert.ok(services.specificityService.aiClient instanceof MockAiClient);
});

test("createApp fails fast when real AI provider is selected too early", () => {
  assert.throws(
    () => createApp({ aiProvider: "real" }),
    /AI provider "real" is not wired yet/
  );
});
