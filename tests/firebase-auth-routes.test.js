import test from "node:test";
import assert from "node:assert/strict";

import { parseApiResponse } from "../src/contracts/schemas.js";
import { createServer } from "../src/server/createServer.js";
import { startServer } from "./helpers/httpTestClient.js";

test("firebase auth mode verifies tokens and provisions a missing user before bootstrap", async (t) => {
  const now = new Date("2026-03-29T09:00:00.000Z");
  const { server } = createServer({
    nowProvider: () => now,
    authMode: "firebase",
    storeMode: "memory",
    tokenVerifier: async (token) => {
      assert.equal(token, "header.payload.signature");

      return {
        userId: "firebase-user-1",
        claims: {
          sub: "firebase-user-1"
        },
        source: "firebase"
      };
    }
  });
  const client = await startServer(server, { authUserId: null });

  t.after(async () => {
    await client.stop();
  });

  const bootstrap = await client.request("/v1/app/bootstrap", {
    method: "GET",
    headers: {
      authorization: "Bearer header.payload.signature",
      "x-user-timezone": "Asia/Jerusalem",
      "x-user-locale": "he-IL"
    }
  });

  assert.equal(bootstrap.status, 200);
  parseApiResponse("app_bootstrap", bootstrap.body);
  assert.equal(bootstrap.body.user.id, "firebase-user-1");
  assert.equal(bootstrap.body.user.timezone, "Asia/Jerusalem");
  assert.equal(bootstrap.body.user.locale, "he-IL");
  assert.deepEqual(bootstrap.body.goals, []);
  assert.equal(bootstrap.body.active_goal, null);
});

test("firebase auth mode rejects raw bearer user ids", async (t) => {
  const now = new Date("2026-03-29T09:00:00.000Z");
  const { server } = createServer({
    nowProvider: () => now,
    authMode: "firebase",
    storeMode: "memory",
    tokenVerifier: async () => ({
      userId: "firebase-user-2",
      claims: {
        sub: "firebase-user-2"
      },
      source: "firebase"
    })
  });
  const client = await startServer(server, { authUserId: null });

  t.after(async () => {
    await client.stop();
  });

  const response = await client.request("/v1/goals", {
    method: "GET",
    headers: {
      authorization: "Bearer plain-user-id"
    }
  });

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /Firebase ID token is required/i);
});
