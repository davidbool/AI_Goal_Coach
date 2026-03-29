import { createInMemoryStore } from "./inMemoryStore.js";
import { createPrismaStore } from "./prismaStore.js";

const DEV_ENVIRONMENT_ALIASES = new Set(["dev", "development"]);

export function resolveStoreEnvironment(options = {}) {
  return options.environment ?? process.env.GOAL_COACH_ENV ?? process.env.NODE_ENV ?? "dev";
}

export function isDevEnvironment(environment) {
  return DEV_ENVIRONMENT_ALIASES.has(String(environment ?? "").trim().toLowerCase());
}

export function resolveStoreMode(options = {}) {
  if (options.storeMode) {
    return options.storeMode;
  }

  if (process.env.GOAL_COACH_STORE) {
    return process.env.GOAL_COACH_STORE;
  }

  return isDevEnvironment(resolveStoreEnvironment(options)) ? "memory" : "prisma";
}

export function createConfiguredStore(options = {}) {
  const storeMode = resolveStoreMode(options);

  if (storeMode === "prisma") {
    return createPrismaStore(options);
  }

  return createInMemoryStore(options);
}
