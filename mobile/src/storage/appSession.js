import AsyncStorage from "@react-native-async-storage/async-storage";

export const APP_SESSION_KEY = "goal_coach_app_session_v2";
export const LEGACY_GUEST_SESSION_KEY = "goal_coach_guest_session_v1";
export const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";

function buildGuestId() {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `guest-${timePart}-${randomPart}`;
}

function normalizeApiBaseUrl(apiBaseUrl) {
  return String(apiBaseUrl ?? "").trim() || DEFAULT_API_BASE_URL;
}

function normalizeGuestSession(session) {
  if (!session?.userId) {
    return null;
  }

  return {
    kind: "guest",
    userId: session.userId,
    apiBaseUrl: normalizeApiBaseUrl(session.apiBaseUrl),
    createdAt: session.createdAt ?? null
  };
}

function normalizeFirebaseSession(session) {
  if (!session?.userId) {
    return null;
  }

  return {
    kind: "firebase",
    userId: session.userId,
    email: session.email ?? null,
    apiBaseUrl: normalizeApiBaseUrl(session.apiBaseUrl),
    createdAt: session.createdAt ?? null
  };
}

function normalizeStoredSession(session) {
  if (!session || typeof session !== "object") {
    return null;
  }

  if (session.kind === "firebase") {
    return normalizeFirebaseSession(session);
  }

  if (session.kind === "guest") {
    return normalizeGuestSession(session);
  }

  if (session.userId) {
    return normalizeGuestSession(session);
  }

  return null;
}

export function createGuestSession(apiBaseUrl = DEFAULT_API_BASE_URL) {
  return {
    kind: "guest",
    userId: buildGuestId(),
    apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
    createdAt: new Date().toISOString()
  };
}

export function createFirebaseSession(user, apiBaseUrl = DEFAULT_API_BASE_URL) {
  return {
    kind: "firebase",
    userId: user.uid,
    email: user.email ?? null,
    apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
    createdAt: new Date().toISOString()
  };
}

export function isFirebaseSession(session) {
  return session?.kind === "firebase";
}

export async function readAppSession() {
  const rawValue =
    (await AsyncStorage.getItem(APP_SESSION_KEY)) ??
    (await AsyncStorage.getItem(LEGACY_GUEST_SESSION_KEY));

  if (!rawValue) {
    return null;
  }

  try {
    return normalizeStoredSession(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export async function writeAppSession(session) {
  await AsyncStorage.setItem(APP_SESSION_KEY, JSON.stringify(session));
  await AsyncStorage.removeItem(LEGACY_GUEST_SESSION_KEY);
}

export async function clearAppSession() {
  await AsyncStorage.removeItem(APP_SESSION_KEY);
  await AsyncStorage.removeItem(LEGACY_GUEST_SESSION_KEY);
}
