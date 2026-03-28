import { unauthorized } from "../contracts/validators.js";

function extractBearerUserId(authorizationHeader) {
  if (!authorizationHeader) {
    return null;
  }

  const trimmedHeader = String(authorizationHeader).trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmedHeader);

  if (!match) {
    throw unauthorized("Authorization header must use Bearer token");
  }

  const userId = match[1].trim();

  if (userId.length === 0) {
    throw unauthorized("Authorization bearer token is required");
  }

  return userId;
}

export function createAuthMiddleware({ defaultUserId = null, requireAuth = false } = {}) {
  return (req, _res, next) => {
    try {
      const authenticatedUserId = extractBearerUserId(req.get("authorization"));
      const userId = authenticatedUserId ?? defaultUserId;

      if (!userId) {
        throw unauthorized("Authorization header is required");
      }

      req.auth = {
        userId,
        isAuthenticated: authenticatedUserId !== null,
        source: authenticatedUserId !== null ? "authorization" : "default_user"
      };

      if (requireAuth && authenticatedUserId === null) {
        throw unauthorized("Authorization header is required");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
