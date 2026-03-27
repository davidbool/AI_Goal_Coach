export function confirmMilestoneForActiveGoal(store, userId, milestoneId, now = new Date()) {
  const goal = store.getActiveGoal(userId);

  if (!goal) {
    throw new Error("No active goal found");
  }

  const activePlan = store.getActivePlan(goal.id);

  if (!activePlan) {
    throw new Error("No active plan found");
  }

  const milestone = store.getMilestone(milestoneId);

  if (!milestone) {
    throw new Error("Milestone not found");
  }

  if (milestone.plan_id !== activePlan.id) {
    throw new Error("Milestone does not belong to active plan");
  }

  if (milestone.status === "confirmed") {
    return milestone;
  }

  return store.confirmMilestone(milestoneId, now);
}
