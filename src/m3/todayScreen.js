const STATUS_LABEL = {
  pending: "[ ]",
  completed: "[x]",
  skipped: "[~]"
};

function formatTask(task) {
  const flags = [];
  if (task.required) {
    flags.push("required");
  }
  if (task.manualLock) {
    flags.push("edited");
  }

  const details = [`${task.estMinutes}m`, task.difficulty];
  if (flags.length > 0) {
    details.push(flags.join(", "));
  }

  return `${STATUS_LABEL[task.state] ?? "[ ]"} ${task.title} (${details.join(" | ")})`;
}

export function renderTodayScreen(state) {
  const completedCount = state.tasks.filter((task) => task.state === "completed").length;
  const pendingCount = state.tasks.filter((task) => task.state === "pending").length;

  const lines = [
    `Today ${state.date ?? ""}`.trim(),
    `${completedCount} done, ${pendingCount} left`,
    ""
  ];

  for (const task of state.tasks) {
    lines.push(formatTask(task));
  }

  const latestFeedback = state.feedback.at(-1);
  if (latestFeedback) {
    lines.push("");
    lines.push(`Coach: ${latestFeedback}`);
  }

  if (state.loading) {
    lines.push("");
    lines.push("Loading today tasks...");
  }

  if (state.softAdjusting) {
    lines.push("");
    lines.push("Adjusting remaining tasks...");
  }

  return lines.join("\n");
}

export function createTodayScreenController(loop) {
  return {
    async load() {
      await loop.loadToday();
      return renderTodayScreen(loop.getState());
    },

    async complete(taskId) {
      await loop.completeTask(taskId);
      return renderTodayScreen(loop.getState());
    },

    async skip(taskId) {
      await loop.skipTask(taskId);
      return renderTodayScreen(loop.getState());
    },

    async edit(taskId, patch) {
      await loop.editTask(taskId, patch);
      return renderTodayScreen(loop.getState());
    },

    async softAdjust() {
      await loop.softAdjust();
      return renderTodayScreen(loop.getState());
    },

    render() {
      return renderTodayScreen(loop.getState());
    }
  };
}
