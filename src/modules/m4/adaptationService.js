import { shiftLocalDateKey, toLocalDateKey } from "../../utils/dateTime.js";

function cloneTasksIntoNewPlan(store, oldPlanId, newPlanId, now, timeZone) {
  const today = toLocalDateKey(now, timeZone);
  const inSevenDays = shiftLocalDateKey(today, 6);

  const sourceTasks = store.state.tasks.filter((task) => task.plan_id === oldPlanId);
  const nextTaskIndex = store.state.tasks.length + 1;
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

    store.state.tasks.push(clonedTask);

    createdCount += 1;
  }

  return createdCount;
}

export function triggerFullAdaptation(store, userId, now = new Date(), triggeredBy = "manual") {
  if (!["manual", "daily_scheduler"].includes(triggeredBy)) {
    throw new Error("Invalid trigger source");
  }

  const user = store.getUser(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const goal = store.getActiveGoal(userId);

  if (!goal) {
    throw new Error("No active goal found");
  }

  const activePlan = store.getActivePlan(goal.id);

  if (!activePlan) {
    throw new Error("No active plan found");
  }

  const job = store.createAdaptJob(goal.id, userId, activePlan.id, activePlan.version, now);
  const newPlan = store.createNextPlanVersion(goal.id, activePlan, now, {
    based_on_plan_id: activePlan.id,
    adaptation_source: "full_adaptation",
    triggered_by: triggeredBy
  });

  const tasksCloned = cloneTasksIntoNewPlan(store, activePlan.id, newPlan.id, now, user.timezone);

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
