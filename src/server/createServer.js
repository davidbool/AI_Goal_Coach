import http from "node:http";

import { createApp } from "../app.js";
import { createConfiguredStore } from "../repositories/storeFactory.js";

export function createServer(overrides = {}) {
  const defaultUserId = overrides.defaultUserId ?? "user-1";
  const store =
    overrides.store ??
    createConfiguredStore({
      seedDemoData: true,
      defaultUserId,
      storeMode: overrides.storeMode,
      defaultUser: overrides.defaultUser,
      prisma: overrides.prisma
    });

  const { app, services } = createApp({
    ...overrides,
    defaultUserId,
    store
  });

  const server = http.createServer(app);
  server.on("close", () => {
    void store.disconnect?.();
  });

  return {
    app,
    server,
    services,
    store
  };
}
