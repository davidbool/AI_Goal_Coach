export const PUSH_TOKEN_OUTCOME = Object.freeze({
  REGISTERED: "registered",
  ALREADY_REGISTERED: "already_registered",
  PERMISSION_REQUIRED: "permission_required",
  PERMISSION_DENIED: "permission_denied",
  UNSUPPORTED_DEVICE: "unsupported_device",
  UNSUPPORTED_RUNTIME: "unsupported_runtime",
  TOKEN_UNAVAILABLE: "token_unavailable"
});

function resolveRegistrationMessage(outcome) {
  if (outcome === PUSH_TOKEN_OUTCOME.REGISTERED) {
    return "Push is now configured for this account.";
  }

  if (outcome === PUSH_TOKEN_OUTCOME.PERMISSION_REQUIRED) {
    return "Allow notifications on this device to register a push token.";
  }

  if (outcome === PUSH_TOKEN_OUTCOME.PERMISSION_DENIED) {
    return "Notification permission is off for this app. You can enable it in iOS Settings and try again.";
  }

  if (outcome === PUSH_TOKEN_OUTCOME.UNSUPPORTED_DEVICE) {
    return "Push registration requires a physical iPhone. The simulator can still sync reminder settings.";
  }

  if (outcome === PUSH_TOKEN_OUTCOME.UNSUPPORTED_RUNTIME) {
    return "Live push token registration needs a development build on a physical iPhone. Expo Go and the simulator can still be used for the rest of the flow.";
  }

  if (outcome === PUSH_TOKEN_OUTCOME.TOKEN_UNAVAILABLE) {
    return "Notification access is enabled, but the device did not return a push token yet.";
  }

  return "";
}

export function hasGrantedNotificationPermission(status, provisionalStatus = 3) {
  return Boolean(
    status?.granted ||
      status?.ios?.status === provisionalStatus
  );
}

function normalizePushToken(pushToken) {
  if (typeof pushToken?.data !== "string") {
    return "";
  }

  return pushToken.data.trim();
}

export function mapPushTokenRegistrationError(error) {
  const message = String(error?.message ?? "");

  if (/expo go|development build|not available in expo go/i.test(message)) {
    return {
      outcome: PUSH_TOKEN_OUTCOME.UNSUPPORTED_RUNTIME,
      message: resolveRegistrationMessage(PUSH_TOKEN_OUTCOME.UNSUPPORTED_RUNTIME)
    };
  }

  return error;
}

export async function syncPushTokenRegistrationCore({
  apiBaseUrl,
  userId,
  hasPushToken = false,
  promptForPermission = false,
  deviceIsPhysical,
  getPermissionsAsync,
  requestPermissionsAsync,
  getDevicePushTokenAsync,
  registerNotificationToken,
  provisionalStatus = 3
}) {
  if (!apiBaseUrl) {
    throw new Error("API base URL is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  if (hasPushToken) {
    return {
      outcome: PUSH_TOKEN_OUTCOME.ALREADY_REGISTERED,
      message: ""
    };
  }

  if (!deviceIsPhysical) {
    return {
      outcome: PUSH_TOKEN_OUTCOME.UNSUPPORTED_DEVICE,
      message: resolveRegistrationMessage(PUSH_TOKEN_OUTCOME.UNSUPPORTED_DEVICE)
    };
  }

  let permissionStatus = await getPermissionsAsync();

  if (!hasGrantedNotificationPermission(permissionStatus, provisionalStatus)) {
    if (!promptForPermission) {
      return {
        outcome: PUSH_TOKEN_OUTCOME.PERMISSION_REQUIRED,
        message: resolveRegistrationMessage(PUSH_TOKEN_OUTCOME.PERMISSION_REQUIRED)
      };
    }

    permissionStatus = await requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true
      }
    });

    if (!hasGrantedNotificationPermission(permissionStatus, provisionalStatus)) {
      return {
        outcome: PUSH_TOKEN_OUTCOME.PERMISSION_DENIED,
        message: resolveRegistrationMessage(PUSH_TOKEN_OUTCOME.PERMISSION_DENIED)
      };
    }
  }

  let devicePushToken;

  try {
    devicePushToken = await getDevicePushTokenAsync();
  } catch (error) {
    const mappedError = mapPushTokenRegistrationError(error);

    if (mappedError !== error) {
      return mappedError;
    }

    throw error;
  }

  const token = normalizePushToken(devicePushToken);

  if (!token) {
    return {
      outcome: PUSH_TOKEN_OUTCOME.TOKEN_UNAVAILABLE,
      message: resolveRegistrationMessage(PUSH_TOKEN_OUTCOME.TOKEN_UNAVAILABLE)
    };
  }

  const platform = typeof devicePushToken?.type === "string" ? devicePushToken.type : "ios";
  await registerNotificationToken(token, platform);

  return {
    outcome: PUSH_TOKEN_OUTCOME.REGISTERED,
    message: resolveRegistrationMessage(PUSH_TOKEN_OUTCOME.REGISTERED),
    token,
    platform
  };
}
