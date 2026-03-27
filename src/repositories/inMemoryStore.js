import { randomUUID } from "node:crypto";

export function createInMemoryStore() {
  return {
    goals: new Map(),
    goalsByUser: new Map(),
    clarificationsByGoal: new Map(),
    assessmentByGoal: new Map(),
    plansByGoal: new Map(),
    planJobsByGoal: new Map()
  };
}

export function generateId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function addGoalToUserIndex(store, goal) {
  const list = store.goalsByUser.get(goal.user_id) ?? [];
  list.push(goal.id);
  store.goalsByUser.set(goal.user_id, list);
}

export function getGoalsForUser(store, userId) {
  const ids = store.goalsByUser.get(userId) ?? [];
  return ids.map((goalId) => store.goals.get(goalId)).filter(Boolean);
}

export function nowIso(clock = Date) {
  return new clock().toISOString();
}
