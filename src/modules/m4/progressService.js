function toLocalDateKey(date, timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to resolve local date key");
  }

  return `${year}-${month}-${day}`;
}

function shiftLocalDateKey(dateKey, dayDelta) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + dayDelta);
  return shifted.toISOString().slice(0, 10);
}

function lastNDatesInclusive(referenceDateKey, days) {
  const result = [];

  for (let delta = days - 1; delta >= 0; delta -= 1) {
    result.push(shiftLocalDateKey(referenceDateKey, -delta));
  }

  return result;
}

function sortDateKeys(dateKeys) {
  return [...dateKeys].sort((a, b) => a.localeCompare(b));
}

function uniqueDateKeys(dateKeys) {
  return [...new Set(dateKeys.filter(Boolean))];
}

function calculateLongestStreak(dateKeys) {
  const uniqueKeys = uniqueDateKeys(dateKeys);

  if (uniqueKeys.length === 0) {
    return 0;
  }

  const sorted = sortDateKeys(uniqueKeys);
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const expected = shiftLocalDateKey(previous, 1);

    if (sorted[i] === expected) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function calculateCurrentStreak(dateKeySet, referenceDateKey) {
  if (dateKeySet.size === 0) {
    return { currentDays: 0, lastSuccessDate: null };
  }

  let probe = referenceDateKey;

  while (probe && !dateKeySet.has(probe)) {
    probe = shiftLocalDateKey(probe, -1);

    if (!probe) {
      return { currentDays: 0, lastSuccessDate: null };
    }

    if (probe < "1900-01-01") {
      return { currentDays: 0, lastSuccessDate: null };
    }
  }

  if (!probe) {
    return { currentDays: 0, lastSuccessDate: null };
  }

  const lastSuccessDate = probe;
  let currentDays = 0;

  while (dateKeySet.has(probe)) {
    currentDays += 1;
    probe = shiftLocalDateKey(probe, -1);
  }

  return { currentDays, lastSuccessDate };
}

function collectCompletionDateKeys(store, goalId, timeZone) {
  const completions = store
    .listCompletionsForGoal(goalId)
    .filter((completion) => completion.state === "completed");

  return completions
    .map((completion) => {
      const completedAt = new Date(completion.completed_at);

      if (Number.isNaN(completedAt.getTime())) {
        return null;
      }

      return toLocalDateKey(completedAt, timeZone);
    })
    .filter(Boolean);
}

export function recalculateStreak(store, goalId, now, timeZone) {
  const todayKey = toLocalDateKey(now, timeZone);
  const completionDateKeys = uniqueDateKeys(collectCompletionDateKeys(store, goalId, timeZone));
  const completionSet = new Set(completionDateKeys);

  const { currentDays, lastSuccessDate } = calculateCurrentStreak(completionSet, todayKey);
  const longestDays = calculateLongestStreak(completionDateKeys);

  const streak = store.upsertStreak(goalId, {
    current_days: currentDays,
    longest_days: longestDays,
    last_success_date: lastSuccessDate
  });

  return streak;
}

function resolveGoalTimezone(store, goal) {
  if (goal?.user_id && typeof store.getUser === "function") {
    const goalOwner = store.getUser(goal.user_id);

    if (goalOwner?.timezone) {
      return goalOwner.timezone;
    }
  }

  if (store.state?.user?.timezone) {
    return store.state.user.timezone;
  }

  return "UTC";
}

export function markTaskCompletedAndRefreshStreak(store, taskId, now = new Date()) {
  const completion = store.markTaskCompleted(taskId, now);

  if (!completion) {
    throw new Error("Task not found");
  }

  const task = store.getTask(taskId);
  const goal = store.getGoal(task.goal_id);

  if (!goal) {
    throw new Error("Goal not found for task");
  }

  recalculateStreak(store, goal.id, now, resolveGoalTimezone(store, goal));

  return completion;
}

function buildAdherence(store, goalId, localDateKey) {
  const windowDateKeys = new Set(lastNDatesInclusive(localDateKey, 7));

  const relevantTasks = store
    .listTasks(goalId)
    .filter((task) => task.required && windowDateKeys.has(task.scheduled_date));

  const tasksCompleted = relevantTasks.filter((task) => {
    const completion = store.getCompletion(task.id);
    return completion?.state === "completed";
  }).length;

  const tasksTotal = relevantTasks.length;
  const completionRate = tasksTotal === 0 ? 0 : Number((tasksCompleted / tasksTotal).toFixed(2));

  return {
    completion_rate_7d: completionRate,
    tasks_completed_7d: tasksCompleted,
    tasks_total_7d: tasksTotal
  };
}

export function getActiveGoalProgress(store, userId, now = new Date()) {
  const user = store.getUser(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const goal = store.getActiveGoal(userId);

  if (!goal) {
    throw new Error("No active goal found");
  }

  const plan = store.getActivePlan(goal.id);

  if (!plan) {
    throw new Error("No active plan found");
  }

  const localDateKey = toLocalDateKey(now, user.timezone);
  const adherence = buildAdherence(store, goal.id, localDateKey);
  const streak = recalculateStreak(store, goal.id, now, user.timezone);
  const milestones = store.getMilestones(plan.id);

  return {
    goal_id: goal.id,
    plan_id: plan.id,
    plan_version: plan.version,
    generated_at: now.toISOString(),
    adherence_7d: adherence.completion_rate_7d,
    adherence,
    streak: {
      current_days: streak.current_days,
      longest_days: streak.longest_days,
      last_success_date: streak.last_success_date
    },
    milestones_done: milestones.filter((milestone) => milestone.status === "confirmed").length,
    milestones: milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      target_week: milestone.target_week,
      success_criteria: milestone.success_criteria,
      status: milestone.status,
      user_confirmed_at: milestone.user_confirmed_at
    }))
  };
}

export function buildProgressScreenModel(progressPayload) {
  return {
    header: {
      title: "Progress",
      subtitle: `Plan v${progressPayload.plan_version}`
    },
    streak: progressPayload.streak,
    adherence: progressPayload.adherence,
    milestones: progressPayload.milestones
  };
}
