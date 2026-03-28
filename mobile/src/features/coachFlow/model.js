function addDays(days) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function formatLocalDatePrefix(localDateKey) {
  return localDateKey ? `Local date: ${localDateKey}. ` : "";
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createEmptySnapshot() {
  return {
    user: null,
    localDateKey: null,
    goals: [],
    activeGoal: null,
    today: null,
    progress: null
  };
}

export function normalizeBootstrap(bootstrap = {}) {
  return {
    user: bootstrap.user ?? null,
    localDateKey: bootstrap.local_date_key ?? null,
    goals: bootstrap.goals ?? [],
    activeGoal: bootstrap.active_goal ?? null,
    today: bootstrap.today ?? null,
    progress: bootstrap.progress ?? null
  };
}

export function createDefaultAssessment() {
  return {
    currentLevel: "beginner",
    weeklyMinutesAvailable: "180",
    targetDate: addDays(84)
  };
}

export function createEmptyComposer() {
  return {
    stage: "idle",
    title: "",
    goalId: null,
    specificity: null,
    clarificationFields: [],
    assessment: createDefaultAssessment(),
    planState: "idle",
    plan: null,
    timeline: []
  };
}

export function toClarificationFields(questions = []) {
  return questions.map((questionText, index) => ({
    id: `clarification-${index + 1}`,
    questionText,
    answerText: ""
  }));
}

export function pushTimeline(timeline, nextValue) {
  if (!nextValue) {
    return timeline;
  }

  if (timeline[timeline.length - 1] === nextValue) {
    return timeline;
  }

  return [...timeline, nextValue];
}

export function createGenerationComposerState(composer, goalId, planState) {
  return {
    ...composer,
    stage: "generating",
    goalId,
    planState,
    plan: null,
    timeline: [planState]
  };
}

export function syncComposerWithPlanStatus(composer, status) {
  const nextTimeline = pushTimeline(composer.timeline, status.plan_state);

  if (status.plan_state === "ready") {
    return {
      ...composer,
      stage: "plan_ready",
      planState: status.plan_state,
      plan: status.plan,
      timeline: nextTimeline
    };
  }

  if (status.plan_state === "failed") {
    return {
      ...composer,
      stage: "generation_failed",
      planState: status.plan_state,
      plan: null,
      timeline: nextTimeline
    };
  }

  return {
    ...composer,
    stage: "generating",
    planState: status.plan_state,
    plan: status.plan ?? composer.plan,
    timeline: nextTimeline
  };
}

export function humanizeToken(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

export function formatEstimate(estimate) {
  if (!estimate) {
    return "Custom pacing";
  }

  return `${estimate.min_weeks}-${estimate.max_weeks} weeks`;
}

export function getTaskMinutes(task) {
  return task.est_minutes ?? task.estMinutes ?? 0;
}

export function isGoalActivatable(goal) {
  return goal?.specificity_state === "specific" && goal?.status !== "active" && goal?.status !== "archived";
}

export function createGoalSummary(goal) {
  const goalStatus = humanizeToken(goal.status);
  const planStatus = goal.plan_state ? humanizeToken(goal.plan_state) : "No plan yet";
  const specificity = goal.specificity_state === "specific" ? "Specific" : "Needs clarity";

  return `${goalStatus} · ${planStatus} · ${specificity}`;
}

export function getFlowSurface(snapshot, composer) {
  if (composer.stage !== "idle") {
    return composer.stage === "intake" ? "goal_studio" : composer.stage;
  }

  if (snapshot.activeGoal) {
    return "dashboard";
  }

  return "goal_studio";
}

export function getGoalStudioPresentation(hasActiveGoal) {
  if (hasActiveGoal) {
    return {
      heroCopy:
        "Your current active goal stays in place until you choose to switch. Draft another coaching track without disturbing today's focus.",
      libraryCopy: "Pick up an existing goal, switch focus, or reuse wording from an older draft.",
      emptyLibraryCopy: "No other saved goals yet. Drafts and paused goals will appear here as you build them."
    };
  }

  return {
    heroCopy:
      "Pick a goal with an outcome and a timeframe. If it is still fuzzy, the app will coach it into focus before building a plan.",
    libraryCopy: "Pick up an existing goal or reuse wording from an older draft.",
    emptyLibraryCopy: "No saved goals yet. Your first goal will show up here as soon as you create it."
  };
}

const generationStateContent = {
  generating: {
    title: "Building your first plan",
    heroCopy: "We are turning your goal into a realistic weekly path and a gentle first day.",
    detailCopy:
      "We are generating milestones, a pacing estimate, and the first tasks for this goal."
  },
  delayed: {
    title: "Still building your plan",
    heroCopy:
      "The first draft is taking longer than usual. You can keep checking from here, and the saved goal will stay ready for you either way.",
    detailCopy:
      "The backend has moved into a delayed state, so this screen should be treated like a calm waiting room instead of a blocker."
  },
  ready: {
    title: "Your first coaching arc is ready.",
    heroCopy:
      "Review the first weeks, then activate the plan when you are ready to make it your active focus.",
    detailCopy:
      "The first pass is ready to review, including milestones, a timeline estimate, and the opening tasks."
  },
  failed: {
    title: "We hit a snag building this draft.",
    heroCopy:
      "We could not finish this draft. Your goal and assessment are still saved, so you can try again without losing work.",
    detailCopy:
      "Nothing from the intake flow was lost. Retry when you want another attempt with the same inputs."
  }
};

export function getGenerationStateContent(planState) {
  return generationStateContent[planState] ?? generationStateContent.generating;
}

export function getDashboardPresentation({ localDateKey, today }) {
  const prefix = formatLocalDatePrefix(localDateKey);

  if (!today) {
    return {
      state: "bootstrap_pending",
      heroCopy: `${prefix}Today's task surface is still syncing from the latest snapshot.`,
      emptyTitle: "Today's focus is still loading",
      emptyCopy:
        "Refresh to pull a fresh snapshot. This can happen right after activation or while the bootstrap response catches up.",
      refreshLabel: "Refresh today"
    };
  }

  if ((today.tasks ?? []).length === 0) {
    return {
      state: "no_tasks_today",
      heroCopy: `${prefix}Today is intentionally clear, so recovery can count as progress too.`,
      emptyTitle: "Today is intentionally clear",
      emptyCopy:
        "Rest counts too. You can refresh for a newer snapshot or soften the plan again if you want extra breathing room.",
      refreshLabel: "Refresh today"
    };
  }

  return {
    state: "tasks_ready",
    heroCopy: `${prefix}Focus on the next few actions, not the entire mountain.`,
    emptyTitle: "",
    emptyCopy: "",
    refreshLabel: "Refresh"
  };
}
