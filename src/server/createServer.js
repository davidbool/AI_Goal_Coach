import http from "node:http";

import { createApp } from "../app.js";
import { createInMemoryStore } from "../repositories/inMemoryStore.js";

export function createServer(overrides = {}) {
  const defaultUserId = overrides.defaultUserId ?? "user-1";
  const store =
    overrides.store ??
    createInMemoryStore({
      seedDemoData: true,
      defaultUserId
    });

  const { app, services } = createApp({
    ...overrides,
    defaultUserId,
    store
  });

  const server = http.createServer(app);

  return {
    app,
    server,
    services,
    store
  };
}
