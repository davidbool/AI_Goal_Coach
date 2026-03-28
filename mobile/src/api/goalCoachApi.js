function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "")
    .trim()
    .replace(/\/+$/, "");
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

export async function request(baseUrl, userId, path, options = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    throw new Error("API base URL is required");
  }

  const headers = {
    accept: "application/json",
    authorization: `Bearer ${userId}`,
    ...(options.headers ?? {})
  };
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

export function bootstrapDemoSession(baseUrl, userId, scenario = "starter") {
  return request(baseUrl, userId, "/v1/dev/bootstrap", {
    method: "POST",
    body: { scenario }
  });
}

export function resetDemoSession(baseUrl, userId) {
  return request(baseUrl, userId, "/v1/dev/reset", {
    method: "POST",
    body: {}
  });
}

export function fetchGoals(baseUrl, userId) {
  return request(baseUrl, userId, "/v1/goals");
}

export function fetchTodayTasks(baseUrl, userId) {
  return request(baseUrl, userId, "/v1/goals/active/tasks/today");
}

export function fetchProgress(baseUrl, userId) {
  return request(baseUrl, userId, "/v1/goals/active/progress");
}

export function createGoal(baseUrl, userId, title) {
  return request(baseUrl, userId, "/v1/goals", {
    method: "POST",
    body: { title }
  });
}

export function submitAssessment(baseUrl, userId, goalId, payload) {
  return request(baseUrl, userId, `/v1/goals/${goalId}/assessment`, {
    method: "POST",
    body: payload
  });
}

export function generatePlan(baseUrl, userId, goalId, mockScenario = "ready") {
  return request(baseUrl, userId, `/v1/goals/${goalId}/plans/generate`, {
    method: "POST",
    body: {},
    headers:
      mockScenario && mockScenario !== "ready"
        ? { "x-mock-ai-scenario": mockScenario }
        : {}
  });
}

export function fetchPlanStatus(baseUrl, userId, goalId) {
  return request(baseUrl, userId, `/v1/goals/${goalId}/plans/status`);
}
