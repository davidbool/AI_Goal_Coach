import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_JWKS_URL = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
);
const DEFAULT_FIREBASE_PROJECT_ID = "ai-goal-coach-7fd20";

export function resolveFirebaseProjectId(options = {}) {
  return (
    options.projectId ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GOAL_COACH_FIREBASE_PROJECT_ID ??
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ??
    DEFAULT_FIREBASE_PROJECT_ID
  );
}

export function createFirebaseTokenVerifier(options = {}) {
  const projectId = String(resolveFirebaseProjectId(options) ?? "").trim();

  if (!projectId) {
    throw new Error("Firebase project ID is required to verify ID tokens.");
  }

  const jwks = options.jwks ?? createRemoteJWKSet(options.jwksUrl ?? FIREBASE_JWKS_URL);

  return async function verifyFirebaseIdToken(idToken) {
    const { payload } = await jwtVerify(idToken, jwks, {
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`
    });

    const userId = typeof payload.sub === "string" ? payload.sub.trim() : "";

    if (!userId) {
      throw new Error("Firebase ID token subject is missing.");
    }

    return {
      userId,
      claims: payload,
      source: "firebase"
    };
  };
}
