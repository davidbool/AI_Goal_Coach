import AsyncStorage from "@react-native-async-storage/async-storage";

export const GUEST_SESSION_KEY = "goal_coach_guest_session_v1";
export const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";

function buildGuestId() {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `guest-${timePart}-${randomPart}`;
}

export function createGuestSession(apiBaseUrl = DEFAULT_API_BASE_URL) {
  return {
    userId: buildGuestId(),
    apiBaseUrl,
    createdAt: new Date().toISOString()
  };
}

export async function readGuestSession() {
  const rawValue = await AsyncStorage.getItem(GUEST_SESSION_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!parsed?.userId) {
      return null;
    }

    return {
      userId: parsed.userId,
      apiBaseUrl: parsed.apiBaseUrl ?? DEFAULT_API_BASE_URL,
      createdAt: parsed.createdAt ?? null
    };
  } catch {
    return null;
  }
}

export async function writeGuestSession(session) {
  await AsyncStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
}

export async function clearGuestSession() {
  await AsyncStorage.removeItem(GUEST_SESSION_KEY);
}
