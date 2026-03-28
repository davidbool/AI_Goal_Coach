import { shiftLocalDateKey, toLocalDateKey } from "../../utils/dateTime.js";

async function listTasksForPlan(store, planId) {
  if (typeof store.listTasksForPlan === "function") {
    return store.listTasksForPlan(planId);
  }

  if (Array.isArray(store.state?.tasks)) {
    return store.state.tasks.filter((task) => task.plan_id === planId);
  }

  return [];
}

async function getTaskCount(store) {
  if (typeof store.countTasks === "function") {
    return store.countTasks();
  }

  if (Array.isArray(store.state?.tasks)) {
    return store.state.tasks.length;
  }

  return 0;
}

async function persistAdaptedTask(store, task) {
  if (typeof store.createAdaptedTask === "function") {
    return store.createAdaptedTask(task);
  }

  if (Array.isArray(store.state?.tasks)) {
    store.state.tasks.push(task);
    return task;
  }

  throw new Error("Task persistence is not available on store");
}

async function cloneTasksIntoNewPlan(store, oldPlanId, newPlanId, now, timeZone) {
  const today = toLocalDateKey(now, timeZone);
  const inSevenDays = shiftLocalDateKey(today, 6);

  const sourceTasks = await listTasksForPlan(store, oldPlanId);
  const nextTaskIndex = (await getTaskCount(store)) + 1;
  let createdCount = 0;

  for (const task of sourceTasks) {
    if (task.scheduled_date < today) {
      continue;
    }

    const isLockedInHorizon = task.manual_lock && task.scheduled_date <= inSevenDays;

    const clonedTask = {
      ...task,
      id: `task-adapted-${nextTaskIndex + createdCount}`,
      plan_id: newPlanId
    };

    if (!isLockedInHorizon) {
      clonedTask.source = "adapted";
      clonedTask.adjustment_source = "full_adaptation";
    }

    await persistAdaptedTask(store, clonedTask);

    createdCount += 1;
  }

  return createdCount;
}

export async function triggerFullAdaptation(store, userId, now = new Date(), triggeredBy = "manual") {
  if (!["manual", "daily_scheduler"].includes(triggeredBy)) {
    throw new Error("Invalid trigger source");
  }

  const user = await store.getUser(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const goal = await store.getActiveGoal(userId);

  if (!goal) {
    throw new Error("No active goal found");
  }

  const activePlan = await store.getActivePlan(goal.id);

  if (!activePlan) {
    throw new Error("No active plan found");
  }

  const job = await store.createAdaptJob(goal.id, userId, activePlan.id, activePlan.version, now);
  const newPlan = await store.createNextPlanVersion(goal.id, activePlan, now, {
    based_on_plan_id: activePlan.id,
    adaptation_source: "full_adaptation",
    triggered_by: triggeredBy
  });

  const tasksCloned = await cloneTasksIntoNewPlan(
    store,
    activePlan.id,
    newPlan.id,
    now,
    user.timezone
  );

  return {
    endpoint: "/adapt",
    adapt_job_id: job.id,
    goal_id: goal.id,
    previous_plan_id: activePlan.id,
    previous_plan_version: activePlan.version,
    new_plan_id: newPlan.id,
    new_plan_version: newPlan.version,
    tasks_cloned: tasksCloned
  };
}
