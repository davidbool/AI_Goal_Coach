const DEFAULT_BASE_URL = "/v1";

function joinPath(baseUrl, path) {
  const safeBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${safeBaseUrl}${safePath}`;
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    if (payload && typeof payload.error === "string") {
      return payload.error;
    }
    if (payload && typeof payload.message === "string") {
      return payload.message;
    }
  } catch {
    // No JSON payload returned by server.
  }

  if (typeof response.statusText === "string" && response.statusText.length > 0) {
    return response.statusText;
  }

  return `Request failed with status ${response.status}`;
}

export class M3ApiClient {
  constructor({ baseUrl = DEFAULT_BASE_URL, fetchImpl = globalThis.fetch, mockAdapter = null } = {}) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.mockAdapter = mockAdapter;

    if (!this.mockAdapter && typeof this.fetchImpl !== "function") {
      throw new Error("M3ApiClient requires fetchImpl when no mockAdapter is provided.");
    }
  }

  async fetchTodayTasks() {
    if (this.mockAdapter) {
      return this.mockAdapter.fetchTodayTasks();
    }

    return this.#request("/goals/active/tasks/today", { method: "GET" });
  }

  async completeTask(taskId) {
    if (this.mockAdapter) {
      return this.mockAdapter.completeTask(taskId);
    }

    return this.#request(`/tasks/${taskId}/complete`, { method: "POST" });
  }

  async skipTask(taskId) {
    if (this.mockAdapter) {
      return this.mockAdapter.skipTask(taskId);
    }

    return this.#request(`/tasks/${taskId}/skip`, { method: "POST" });
  }

  async editTask(taskId, patch) {
    if (this.mockAdapter) {
      return this.mockAdapter.editTask(taskId, patch);
    }

    return this.#request(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
  }

  async softAdjust() {
    if (this.mockAdapter) {
      return this.mockAdapter.softAdjust();
    }

    return this.#request("/goals/active/soft-adjust", { method: "POST" });
  }

  async #request(path, init) {
    const response = await this.fetchImpl(joinPath(this.baseUrl, path), {
      headers: {
        "Content-Type": "application/json"
      },
      ...init
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    if (response.status === 204) {
      return {};
    }

    return response.json();
  }
}

export function createM3ApiClient(options) {
  return new M3ApiClient(options);
}
