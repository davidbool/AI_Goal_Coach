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

function normalizeTask(rawTask) {
  return {
    id: String(rawTask.id),
    title: rawTask.title,
    estMinutes: Number(rawTask.estMinutes ?? rawTask.est_minutes ?? 0),
    difficulty: rawTask.difficulty ?? "medium",
    required: Boolean(rawTask.required),
    state: rawTask.state ?? "pending",
    manualLock: Boolean(rawTask.manualLock ?? rawTask.manual_lock),
    adjustmentSource: rawTask.adjustmentSource ?? rawTask.adjustment_source ?? "plan",
    syncState: rawTask.syncState ?? "synced"
  };
}

function extractTaskFromMutation(payload) {
  if (!payload) {
    return null;
  }

  if (payload.task && typeof payload.task === "object") {
    return payload.task;
  }

  if (payload.id) {
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
      const incomingTasks = Array.isArray(payload.tasks) ? payload.tasks : [];

      this.state.date = payload.date ?? null;
      this.state.tasks = incomingTasks.map(normalizeTask);
      this.state.planVersion = Number.isInteger(payload.planVersion) ? payload.planVersion : null;
      this.state.lastSyncedAt = this.now().toISOString();
      this.#pushFeedback(payload.feedback ?? "Your plan is ready. Small steps are enough.");
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
      this.#assertPlanVersionStable(payload.planVersion);

      const adjustedTasks = Array.isArray(payload.tasks) ? payload.tasks.map(normalizeTask) : [];
      const completedOrSkipped = previousTasks.filter((task) => task.state !== "pending");

      this.state.tasks = [...completedOrSkipped, ...adjustedTasks];
      this.state.lastSyncedAt = this.now().toISOString();
      this.#pushFeedback(payload.feedback ?? FALLBACK_SUCCESS_MESSAGES.softAdjust);

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
    const taskIndex = this.state.tasks.findIndex((task) => task.id === taskId);
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
      this.#pushFeedback(FALLBACK_SUCCESS_MESSAGES[mutationType]);
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
