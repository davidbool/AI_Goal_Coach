import { unauthorized } from "../contracts/validators.js";

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    return null;
  }

  const trimmedHeader = String(authorizationHeader).trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmedHeader);

  if (!match) {
    throw unauthorized("Authorization header must use Bearer token");
  }

  const token = match[1].trim();

  if (token.length === 0) {
    throw unauthorized("Authorization bearer token is required");
  }

  return token;
}

function looksLikeJwt(token) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(token ?? "").trim());
}

export function createAuthMiddleware({
  defaultUserId = null,
  requireAuth = false,
  tokenVerifier = null,
  allowUnverifiedBearer = true
} = {}) {
  return async (req, _res, next) => {
    try {
      const bearerToken = extractBearerToken(req.get("authorization"));
      const isAuthenticated = bearerToken !== null;
      let userId = defaultUserId;
      let source = isAuthenticated ? "authorization" : "default_user";
      let claims = null;

      if (bearerToken) {
        if (typeof tokenVerifier === "function" && looksLikeJwt(bearerToken)) {
          let verifiedToken;

          try {
            verifiedToken = await tokenVerifier(bearerToken);
          } catch (error) {
            throw unauthorized(error?.message ?? "Invalid Firebase ID token");
          }

          userId = verifiedToken?.userId ?? null;
          source = verifiedToken?.source ?? "firebase";
          claims = verifiedToken?.claims ?? null;
        } else if (allowUnverifiedBearer) {
          userId = bearerToken;
        } else {
          throw unauthorized("Firebase ID token is required");
        }
      }

      if (!userId) {
        throw unauthorized("Authorization header is required");
      }

      req.auth = {
        userId,
        isAuthenticated,
        source,
        claims
      };

      if (requireAuth && bearerToken === null) {
        throw unauthorized("Authorization header is required");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
