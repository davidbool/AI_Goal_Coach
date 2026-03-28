export async function confirmMilestoneForActiveGoal(store, userId, milestoneId, now = new Date()) {
  if (!milestoneId) {
    throw new Error("Milestone id is required");
  }

  const goal = await store.getActiveGoal(userId);

  if (!goal) {
    throw new Error("No active goal found");
  }

  if (goal.user_id && goal.user_id !== userId) {
    throw new Error("Goal does not belong to user");
  }

  const activePlan = await store.getActivePlan(goal.id);

  if (!activePlan) {
    throw new Error("No active plan found");
  }

  const milestone = await store.getMilestone(milestoneId);

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
