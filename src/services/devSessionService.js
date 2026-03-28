import { badRequest } from "../contracts/validators.js";
import { toLocalDateKey } from "../utils/dateTime.js";

export const DevDemoScenario = Object.freeze({
  STARTER: "starter",
  ACTIVE_GOAL_READY: "active_goal_ready",
  NO_ACTIVE_GOAL: "no_active_goal",
  NO_TASKS_TODAY: "no_tasks_today"
});

export const DEV_DEMO_SCENARIOS = Object.freeze(Object.values(DevDemoScenario));
export const DEV_MOCK_GENERATION_SCENARIOS = Object.freeze([
  "ready",
  "delay",
  "fail",
  "invalid_payload"
]);

function ensureSupportedScenario(scenario) {
  if (!DEV_DEMO_SCENARIOS.includes(scenario)) {
    throw badRequest(
      `scenario must be one of: ${DEV_DEMO_SCENARIOS.join(", ")}`
    );
  }
}

async function buildDevSessionPayload(store, userId, scenario, now = new Date()) {
  const user = await store.getUser(userId);
  const goals = await store.listGoalsForUser(userId);
  const activeGoal = await store.getActiveGoal(userId);
  const localDateKey = toLocalDateKey(now, user.timezone);
  const todayTasks = activeGoal
    ? await store.listTasksForLocalDate(activeGoal.id, localDateKey)
    : [];

  return {
    user,
    scenario,
    available_scenarios: DEV_DEMO_SCENARIOS,
    available_mock_generation_scenarios: DEV_MOCK_GENERATION_SCENARIOS,
    local_date_key: localDateKey,
    summary: {
      goal_count: goals.length,
      active_goal_id: activeGoal?.id ?? null,
      today_task_count: todayTasks.length
    }
  };
}

export async function bootstrapDevSession(
  store,
  userId,
  scenario = DevDemoScenario.STARTER,
  now = new Date()
) {
  ensureSupportedScenario(scenario);

  if (typeof store.ensureUser !== "function") {
    throw badRequest("store must support ensureUser for dev bootstrap");
  }

  if (typeof store.resetUserState !== "function" || typeof store.seedDemoState !== "function") {
    throw badRequest("store does not support dev bootstrap/reset");
  }

  await store.ensureUser(userId);
  await store.resetUserState(userId);

  if (scenario !== DevDemoScenario.STARTER) {
    await store.seedDemoState(userId, scenario, now);
  }

  return buildDevSessionPayload(store, userId, scenario, now);
}

export async function resetDevSession(store, userId, now = new Date()) {
  return bootstrapDevSession(store, userId, DevDemoScenario.STARTER, now);
}
