function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "")
    .trim()
    .replace(/\/+$/, "");
}

function readClientContext() {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions?.() ?? {};
    const timezone = typeof resolved.timeZone === "string" ? resolved.timeZone.trim() : "";
    const locale = typeof resolved.locale === "string" ? resolved.locale.trim() : "";

    return {
      timezone,
      locale
    };
  } catch {
    return {
      timezone: "",
      locale: ""
    };
  }
}

async function resolveAuthorizationHeader(authContext) {
  if (typeof authContext === "string") {
    const trimmed = authContext.trim();

    if (!trimmed) {
      throw new Error("Auth context is required");
    }

    return `Bearer ${trimmed}`;
  }

  if (typeof authContext?.getAuthorizationValue === "function") {
    const value = await authContext.getAuthorizationValue();
    const trimmed = String(value ?? "").trim();

    if (!trimmed) {
      throw new Error("Auth context is required");
    }

    return /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
  }

  if (typeof authContext?.token === "string" && authContext.token.trim().length > 0) {
    return `Bearer ${authContext.token.trim()}`;
  }

  if (typeof authContext?.userId === "string" && authContext.userId.trim().length > 0) {
    return `Bearer ${authContext.userId.trim()}`;
  }

  throw new Error("Auth context is required");
}

async function parseResponse(response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

function createApiError(status, body) {
  const message =
    body?.error?.message ??
    (typeof body === "string" && body.length > 0 ? body : `Request failed with status ${status}`);
  const error = new Error(message);
  error.status = status;
  error.body = body;
  return error;
}

export async function request(baseUrl, authContext, path, options = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    throw new Error("API base URL is required");
  }

  const authorization = await resolveAuthorizationHeader(authContext);
  const clientContext = readClientContext();
  const headers = {
    accept: "application/json",
    authorization,
    ...(options.headers ?? {})
  };

  if (clientContext.timezone) {
    headers["x-user-timezone"] = clientContext.timezone;
  }

  if (clientContext.locale) {
    headers["x-user-locale"] = clientContext.locale;
  }

  const hasBody = options.body !== undefined;

  if (hasBody) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${normalizedBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw createApiError(response.status, payload);
  }

  return payload;
}

export function bootstrapDemoSession(baseUrl, authContext, scenario = "starter") {
  return request(baseUrl, authContext, "/v1/dev/bootstrap", {
    method: "POST",
    body: { scenario }
  });
}

export function resetDemoSession(baseUrl, authContext) {
  return request(baseUrl, authContext, "/v1/dev/reset", {
    method: "POST",
    body: {}
  });
}

export function fetchGoals(baseUrl, authContext) {
  return request(baseUrl, authContext, "/v1/goals");
}

export function fetchAppBootstrap(baseUrl, authContext) {
  return request(baseUrl, authContext, "/v1/app/bootstrap");
}

export function fetchTodayTasks(baseUrl, authContext) {
  return request(baseUrl, authContext, "/v1/goals/active/tasks/today");
}

export function fetchProgress(baseUrl, authContext) {
  return request(baseUrl, authContext, "/v1/goals/active/progress");
}

export function createGoal(baseUrl, authContext, title) {
  return request(baseUrl, authContext, "/v1/goals", {
    method: "POST",
    body: { title }
  });
}

export function activateGoal(baseUrl, authContext, goalId) {
  return request(baseUrl, authContext, `/v1/goals/${goalId}/activate`, {
    method: "POST",
    body: {}
  });
}

export function updateGoalStatus(baseUrl, authContext, goalId, status) {
  return request(baseUrl, authContext, `/v1/goals/${goalId}/status`, {
    method: "PATCH",
    body: { status }
  });
}

export function submitClarifications(baseUrl, authContext, goalId, answers) {
  return request(baseUrl, authContext, `/v1/goals/${goalId}/clarifications`, {
    method: "POST",
    body: { answers }
  });
}

export function submitAssessment(baseUrl, authContext, goalId, payload) {
  return request(baseUrl, authContext, `/v1/goals/${goalId}/assessment`, {
    method: "POST",
    body: payload
  });
}

export function generatePlan(baseUrl, authContext, goalId, mockScenario = "ready") {
  return request(baseUrl, authContext, `/v1/goals/${goalId}/plans/generate`, {
    method: "POST",
    body: {},
    headers:
      mockScenario && mockScenario !== "ready"
        ? { "x-mock-ai-scenario": mockScenario }
        : {}
  });
}

export function fetchPlanStatus(baseUrl, authContext, goalId) {
  return request(baseUrl, authContext, `/v1/goals/${goalId}/plans/status`);
}

export function completeTask(baseUrl, authContext, taskId, payload = {}) {
  return request(baseUrl, authContext, `/v1/tasks/${taskId}/complete`, {
    method: "POST",
    body: payload
  });
}

export function skipTask(baseUrl, authContext, taskId, payload = {}) {
  return request(baseUrl, authContext, `/v1/tasks/${taskId}/skip`, {
    method: "POST",
    body: payload
  });
}

export function editTask(baseUrl, authContext, taskId, payload) {
  return request(baseUrl, authContext, `/v1/tasks/${taskId}`, {
    method: "PATCH",
    body: payload
  });
}

export function softAdjustActiveGoal(baseUrl, authContext) {
  return request(baseUrl, authContext, "/v1/goals/active/soft-adjust", {
    method: "POST",
    body: {}
  });
}

export function triggerFullAdaptation(baseUrl, authContext, payload = {}) {
  return request(baseUrl, authContext, "/v1/goals/active/adapt", {
    method: "POST",
    body: payload
  });
}

export function confirmMilestone(baseUrl, authContext, milestoneId) {
  return request(baseUrl, authContext, `/v1/milestones/${milestoneId}/confirm`, {
    method: "POST",
    body: {}
  });
}

export function registerNotificationToken(baseUrl, authContext, token, platform = "ios") {
  return request(baseUrl, authContext, "/v1/notifications/token", {
    method: "POST",
    body: { token, platform }
  });
}

export function updateNotificationPreferences(baseUrl, authContext, payload) {
  return request(baseUrl, authContext, "/v1/notifications/preferences", {
    method: "PATCH",
    body: payload
  });
}
