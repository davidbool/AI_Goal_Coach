import test from "node:test";
import assert from "node:assert/strict";

import {
  PUSH_TOKEN_OUTCOME,
  hasGrantedNotificationPermission,
  syncPushTokenRegistrationCore
} from "../mobile/src/services/pushTokenServiceCore.js";

function createCoreOptions(overrides = {}) {
  return {
    apiBaseUrl: "http://127.0.0.1:3000",
    userId: "mobile-push-user",
    hasPushToken: false,
    promptForPermission: false,
    deviceIsPhysical: true,
    provisionalStatus: 3,
    getPermissionsAsync: async () => ({ granted: false, ios: { status: 0 } }),
    requestPermissionsAsync: async () => ({ granted: false, ios: { status: 1 } }),
    getDevicePushTokenAsync: async () => ({ type: "ios", data: "apns-token-1" }),
    registerNotificationToken: async () => {},
    ...overrides
  };
}

test("notification permission helper treats granted and provisional iOS access as enabled", () => {
  assert.equal(hasGrantedNotificationPermission({ granted: true }), true);
  assert.equal(hasGrantedNotificationPermission({ granted: false, ios: { status: 3 } }), true);
  assert.equal(hasGrantedNotificationPermission({ granted: false, ios: { status: 1 } }), false);
});

test("push token registration short-circuits when the backend already has a token", async () => {
  const result = await syncPushTokenRegistrationCore(
    createCoreOptions({
      hasPushToken: true
    })
  );

  assert.equal(result.outcome, PUSH_TOKEN_OUTCOME.ALREADY_REGISTERED);
});

test("push token registration explains that simulators cannot provide a live token", async () => {
  const result = await syncPushTokenRegistrationCore(
    createCoreOptions({
      deviceIsPhysical: false
    })
  );

  assert.equal(result.outcome, PUSH_TOKEN_OUTCOME.UNSUPPORTED_DEVICE);
  assert.match(result.message, /physical iphone/i);
});

test("push token registration waits for explicit permission prompting before requesting access", async () => {
  let requestedPermissions = false;

  const result = await syncPushTokenRegistrationCore(
    createCoreOptions({
      getPermissionsAsync: async () => ({ granted: false, ios: { status: 0 } }),
      requestPermissionsAsync: async () => {
        requestedPermissions = true;
        return { granted: true, ios: { status: 2 } };
      }
    })
  );

  assert.equal(result.outcome, PUSH_TOKEN_OUTCOME.PERMISSION_REQUIRED);
  assert.equal(requestedPermissions, false);
});

test("push token registration prompts, fetches the device token, and syncs it with the backend", async () => {
  const registeredTokens = [];

  const result = await syncPushTokenRegistrationCore(
    createCoreOptions({
      promptForPermission: true,
      getPermissionsAsync: async () => ({ granted: false, ios: { status: 0 } }),
      requestPermissionsAsync: async () => ({ granted: true, ios: { status: 2 } }),
      getDevicePushTokenAsync: async () => ({ type: "ios", data: " apns-token-42 " }),
      registerNotificationToken: async (token, platform) => {
        registeredTokens.push({ token, platform });
      }
    })
  );

  assert.equal(result.outcome, PUSH_TOKEN_OUTCOME.REGISTERED);
  assert.equal(result.token, "apns-token-42");
  assert.equal(result.platform, "ios");
  assert.deepEqual(registeredTokens, [
    { token: "apns-token-42", platform: "ios" }
  ]);
});

test("push token registration reports when the user denies the permission prompt", async () => {
  const result = await syncPushTokenRegistrationCore(
    createCoreOptions({
      promptForPermission: true,
      requestPermissionsAsync: async () => ({ granted: false, ios: { status: 1 } })
    })
  );

  assert.equal(result.outcome, PUSH_TOKEN_OUTCOME.PERMISSION_DENIED);
  assert.match(result.message, /ios settings/i);
});

test("push token registration reports Expo Go and similar unsupported runtimes without crashing", async () => {
  const result = await syncPushTokenRegistrationCore(
    createCoreOptions({
      promptForPermission: true,
      getPermissionsAsync: async () => ({ granted: true, ios: { status: 2 } }),
      getDevicePushTokenAsync: async () => {
        throw new Error("Remote push notifications are not available in Expo Go");
      }
    })
  );

  assert.equal(result.outcome, PUSH_TOKEN_OUTCOME.UNSUPPORTED_RUNTIME);
  assert.match(result.message, /development build/i);
});
