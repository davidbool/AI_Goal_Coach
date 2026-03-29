import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { registerNotificationToken as registerNotificationTokenRequest } from "../api/goalCoachApi.js";
import { syncPushTokenRegistrationCore } from "./pushTokenServiceCore.js";

export async function syncPushTokenRegistration({
  apiBaseUrl,
  authContext,
  userId,
  hasPushToken = false,
  promptForPermission = false
}) {
  const effectiveAuthContext = authContext ?? userId;

  return syncPushTokenRegistrationCore({
    apiBaseUrl,
    authContext: effectiveAuthContext,
    hasPushToken,
    promptForPermission,
    deviceIsPhysical: Device.isDevice,
    getPermissionsAsync: Notifications.getPermissionsAsync,
    requestPermissionsAsync: Notifications.requestPermissionsAsync,
    getDevicePushTokenAsync: Notifications.getDevicePushTokenAsync,
    registerNotificationToken: (token, platform) =>
      registerNotificationTokenRequest(apiBaseUrl, effectiveAuthContext, token, platform),
    provisionalStatus: Notifications.IosAuthorizationStatus.PROVISIONAL
  });
}
