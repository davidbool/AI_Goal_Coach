const FALLBACK_SUCCESS_MESSAGES = {
  complete: "Nice follow-through. That step counts.",
  skip: "Skipping is okay. We kept it gentle and moving.",
  edit: "Updated. You tuned the task to your day.",
  softAdjust: "Your day has been lightened without changing your plan version."
};

const FALLBACK_FAILURE_MESSAGES = {
  complete: "No stress. Completion did not sync yet, so we restored the task.",
  skip: "No stress. Skip did not sync yet, so we restored the task.",
  edit: "No problem. Edit did not sync yet, so we restored the task.",
  softAdjust: "Soft adjustment did not sync. Your remaining tasks are unchanged."
};

function firstDefined(source, keys) {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }

  return undefined;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return Boolean(value);
}

function normalizeMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed);
}

function normalizeTaskState(value) {
  const normalized = String(value ?? "pending").toLowerCase();
  if (normalized === "complete" || normalized === "done") {
    return "completed";
  }

  if (normalized === "pending" || normalized === "completed" || normalized === "skipped") {
    return normalized;
  }

  return "pending";
}

function normalizePlanVersion(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function extractDate(payload) {
  const dateValue = firstDefined(payload, ["date", "todayDate", "today_date"]);
  return typeof dateValue === "string" ? dateValue : null;
}

function extractTasks(payload) {
  const candidates = [
    firstDefined(payload, ["tasks"]),
    firstDefined(payload, ["remainingTasks", "remaining_tasks"]),
    firstDefined(payload, ["todayTasks", "today_tasks"])
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function extractPlanVersion(payload) {
  return normalizePlanVersion(firstDefined(payload, ["planVersion", "plan_version"]));
}

function extractFeedback(payload, fallbackMessage) {
  const feedbackValue = firstDefined(payload, ["feedback", "coachMessage", "coach_message", "message"]);
  if (typeof feedbackValue === "string" && feedbackValue.length > 0) {
    return feedbackValue;
  }

  return fallbackMessage;
}

function normalizeTask(rawTask = {}) {
  const taskId = firstDefined(rawTask, ["id", "taskId", "task_id"]);
  const title = firstDefined(rawTask, ["title", "name"]);
  const estMinutes = firstDefined(rawTask, ["estMinutes", "est_minutes", "estimatedMinutes"]);
  const difficulty = firstDefined(rawTask, ["difficulty"]) ?? "medium";
  const required = firstDefined(rawTask, ["required", "isRequired", "is_required"]);
  const taskState = firstDefined(rawTask, ["state", "status"]);
  const manualLock = firstDefined(rawTask, ["manualLock", "manual_lock"]);
  const adjustmentSource = firstDefined(rawTask, ["adjustmentSource", "adjustment_source"]) ?? "plan";
  const syncState = firstDefined(rawTask, ["syncState", "sync_state"]) ?? "synced";

  return {
    id: String(taskId ?? ""),
    title: String(title ?? "Untitled task"),
    estMinutes: normalizeMinutes(estMinutes),
    difficulty,
    required: normalizeBoolean(required),
    state: normalizeTaskState(taskState),
    manualLock: normalizeBoolean(manualLock),
    adjustmentSource,
    syncState
  };
}

function extractTaskFromMutation(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const taskPayload = firstDefined(payload, ["task", "updatedTask", "updated_task"]);
  if (taskPayload && typeof taskPayload === "object") {
    return taskPayload;
  }

  if (payload.data && typeof payload.data === "object") {
    const nestedTask = firstDefined(payload.data, ["task", "updatedTask", "updated_task"]);
    if (nestedTask && typeof nestedTask === "object") {
      return nestedTask;
    }
  }

  if (firstDefined(payload, ["id", "task_id"])) {
    return payload;
  }

  return null;
}

export class DailyExecutionLoop {
  constructor({ api, now = () => new Date() } = {}) {
    if (!api) {
      throw new Error("DailyExecutionLoop requires an api implementation.");
    }

    this.api = api;
    this.now = now;
    this.listeners = new Set();
    this.state = {
      date: null,
      tasks: [],
      loading: false,
      softAdjusting: false,
      feedback: [],
      lastSyncedAt: null,
      planVersion: null
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState() {
    return {
      ...this.state,
      tasks: this.state.tasks.map((task) => ({ ...task })),
      feedback: [...this.state.feedback]
    };
  }

  async loadToday() {
    this.state.loading = true;
    this.#emit();

    try {
      const payload = await this.api.fetchTodayTasks();
      const incomingTasks = extractTasks(payload);

      this.state.date = extractDate(payload);
      this.state.tasks = incomingTasks.map(normalizeTask);
      this.state.planVersion = extractPlanVersion(payload);
      this.state.lastSyncedAt = this.now().toISOString();
      this.#pushFeedback(extractFeedback(payload, "Your plan is ready. Small steps are enough."));
      return this.getState();
    } finally {
      this.state.loading = false;
      this.#emit();
    }
  }

  async completeTask(taskId) {
    return this.#mutateTask({
      taskId,
      mutationType: "complete",
      optimisticTaskPatch: { state: "completed" },
      apiCall: () => this.api.completeTask(taskId)
    });
  }

  async skipTask(taskId) {
    return this.#mutateTask({
      taskId,
      mutationType: "skip",
      optimisticTaskPatch: { state: "skipped" },
      apiCall: () => this.api.skipTask(taskId)
    });
  }

  async editTask(taskId, patch) {
    return this.#mutateTask({
      taskId,
      mutationType: "edit",
      optimisticTaskPatch: {
        ...patch,
        manualLock: true
      },
      apiCall: () => this.api.editTask(taskId, patch)
    });
  }

  async softAdjust() {
    this.state.softAdjusting = true;
    this.#emit();

    const previousTasks = this.state.tasks.map((task) => ({ ...task }));

    try {
      const payload = await this.api.softAdjust();
      const nextPlanVersion = extractPlanVersion(payload);
      this.#assertPlanVersionStable(nextPlanVersion);
      if (nextPlanVersion !== null) {
        this.state.planVersion = nextPlanVersion;
      }

      const adjustedTasks = extractTasks(payload).map(normalizeTask);
      const completedOrSkipped = previousTasks.filter((task) => task.state !== "pending");
      const adjustedTaskIds = new Set(adjustedTasks.map((task) => task.id));
      const untouchedDoneTasks = completedOrSkipped.filter((task) => !adjustedTaskIds.has(task.id));

      this.state.tasks = [...untouchedDoneTasks, ...adjustedTasks];
      this.state.lastSyncedAt = this.now().toISOString();
      this.#pushFeedback(extractFeedback(payload, FALLBACK_SUCCESS_MESSAGES.softAdjust));

      return this.getState();
    } catch (error) {
      this.state.tasks = previousTasks;
      this.#pushFeedback(FALLBACK_FAILURE_MESSAGES.softAdjust);
      throw error;
    } finally {
      this.state.softAdjusting = false;
      this.#emit();
    }
  }

  async #mutateTask({ taskId, mutationType, optimisticTaskPatch, apiCall }) {
    const normalizedTaskId = String(taskId);
    const taskIndex = this.state.tasks.findIndex((task) => task.id === normalizedTaskId);
    if (taskIndex === -1) {
      throw new Error(`Task ${taskId} not found in daily loop.`);
    }

    const previousTask = { ...this.state.tasks[taskIndex] };
    const optimisticTask = {
      ...previousTask,
      ...optimisticTaskPatch,
      syncState: "syncing"
    };

    this.state.tasks[taskIndex] = optimisticTask;
    this.#emit();

    try {
      const payload = await apiCall();
      const taskFromServer = extractTaskFromMutation(payload);

      this.state.tasks[taskIndex] = {
        ...optimisticTask,
        ...(taskFromServer ? normalizeTask(taskFromServer) : null),
        syncState: "synced"
      };

      this.state.lastSyncedAt = this.now().toISOString();
      this.#pushFeedback(extractFeedback(payload, FALLBACK_SUCCESS_MESSAGES[mutationType]));
      this.#emit();

      return this.getState();
    } catch (error) {
      this.state.tasks[taskIndex] = {
        ...previousTask,
        syncState: "synced"
      };

      this.#pushFeedback(FALLBACK_FAILURE_MESSAGES[mutationType]);
      this.#emit();
      throw error;
    }
  }

  #assertPlanVersionStable(nextPlanVersion) {
    const hasCurrentVersion = Number.isInteger(this.state.planVersion);
    const hasIncomingVersion = Number.isInteger(nextPlanVersion);

    if (hasCurrentVersion && hasIncomingVersion && nextPlanVersion !== this.state.planVersion) {
      throw new Error(
        `Soft adjustment changed plan version from ${this.state.planVersion} to ${nextPlanVersion}. This is not allowed.`
      );
    }
  }

  #pushFeedback(message) {
    this.state.feedback.push(message);
    if (this.state.feedback.length > 6) {
      this.state.feedback.shift();
    }
  }

  #emit() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
