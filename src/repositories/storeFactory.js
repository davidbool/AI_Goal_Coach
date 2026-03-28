import { createInMemoryStore } from "./inMemoryStore.js";
import { createPrismaStore } from "./prismaStore.js";

export function resolveStoreMode(options = {}) {
  return options.storeMode ?? process.env.GOAL_COACH_STORE ?? "memory";
}

export function createConfiguredStore(options = {}) {
  const storeMode = resolveStoreMode(options);

  if (storeMode === "prisma") {
    return createPrismaStore(options);
  }

  return createInMemoryStore(options);
}
