const DIFFICULTY_SCALE = ["low", "medium", "high"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function lowerDifficulty(difficulty) {
  const index = DIFFICULTY_SCALE.indexOf(difficulty);
  if (index <= 0) {
    return "low";
  }

  return DIFFICULTY_SCALE[index - 1];
}

function defaultTasks() {
  return [
    {
      id: "task-1",
      title: "20 minute focused practice",
      estMinutes: 20,
      difficulty: "medium",
      required: true,
      state: "pending",
      manualLock: false,
      adjustmentSource: "plan"
    },
    {
      id: "task-2",
      title: "Review yesterday notes",
      estMinutes: 10,
      difficulty: "low",
      required: false,
      state: "pending",
      manualLock: false,
      adjustmentSource: "plan"
    },
    {
      id: "task-3",
      title: "Quick checkpoint",
      estMinutes: 5,
      difficulty: "low",
      required: true,
      state: "pending",
      manualLock: false,
      adjustmentSource: "plan"
    }
  ];
}

export class MockM3Api {
  constructor({
    tasks = defaultTasks(),
    date = "2026-03-26",
    feedback = "One step at a time. You are doing great.",
    planVersion = 1,
    latencyMs = 25
  } = {}) {
    this.tasks = clone(tasks);
    this.date = date;
    this.feedback = feedback;
    this.planVersion = planVersion;
    this.latencyMs = latencyMs;
  }

  async fetchTodayTasks() {
    await this.#delay();
    return {
      date: this.date,
      tasks: clone(this.tasks),
      planVersion: this.planVersion,
      feedback: this.feedback
    };
  }

  async completeTask(taskId) {
    await this.#delay();
    const task = this.#find(taskId);
    task.state = "completed";
    return { task: clone(task) };
  }

  async skipTask(taskId) {
    await this.#delay();
    const task = this.#find(taskId);
    task.state = "skipped";
    return { task: clone(task) };
  }

  async editTask(taskId, patch) {
    await this.#delay();
    const task = this.#find(taskId);
    this.#applyPatch(task, patch);
    task.manualLock = true;
    return { task: clone(task) };
  }

  async softAdjust() {
    await this.#delay();

    this.tasks = this.tasks.map((task) => {
      if (task.state !== "pending") {
        return task;
      }

      const nextMinutes = Math.max(5, Math.round(task.estMinutes * 0.75));
      return {
        ...task,
        estMinutes: nextMinutes,
        difficulty: lowerDifficulty(task.difficulty),
        adjustmentSource: "same_day_soft"
      };
    });

    return {
      tasks: clone(this.tasks.filter((task) => task.state === "pending")),
      adjustmentSource: "same_day_soft",
      planVersion: this.planVersion,
      feedback: "We adjusted today to protect your momentum."
    };
  }

  #find(taskId) {
    const task = this.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return task;
  }

  #applyPatch(task, patch) {
    const normalizedPatch = {
      title: patch.title,
      estMinutes: patch.estMinutes ?? patch.est_minutes,
      difficulty: patch.difficulty,
      required: patch.required ?? patch.isRequired ?? patch.is_required
    };

    for (const [key, value] of Object.entries(normalizedPatch)) {
      if (value !== undefined) {
        task[key] = value;
      }
    }

    if (patch.manualLock !== undefined || patch.manual_lock !== undefined) {
      task.manualLock = Boolean(patch.manualLock ?? patch.manual_lock);
    }
  }

  async #delay() {
    if (this.latencyMs <= 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, this.latencyMs);
    });
  }
}

export function createMockM3Api(options) {
  return new MockM3Api(options);
}
