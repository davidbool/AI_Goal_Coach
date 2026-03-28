import {
  GoalStatus,
  SpecificityState
} from "../contracts/constants.js";
import {
  assertArray,
  assertGoalStatusPatch,
  assertNonEmptyString,
  assertOptionalISODate,
  assertWeeklyMinutes,
  conflict,
  notFound
} from "../contracts/validators.js";
import {
  addGoalToUserIndex,
  generateId,
  getGoalsForUser,
  nowIso
} from "../repositories/inMemoryStore.js";

export class GoalService {
  constructor({ store, specificityService, clock = Date }) {
    this.store = store;
    this.specificityService = specificityService;
    this.clock = clock;
  }

  createGoal({ user_id, title }) {
    assertNonEmptyString(user_id, "user_id");
    assertNonEmptyString(title, "title");

    if (typeof this.store.ensureUser === "function") {
      this.store.ensureUser(user_id);
    }

    const now = nowIso(this.clock);
    const evaluation = this.specificityService.evaluate(title, []);

    const goal = {
      id: generateId("goal"),
      user_id,
      title: title.trim(),
      status: GoalStatus.DRAFT,
      specificity_state: evaluation.state,
      specificity_score: Number(evaluation.score.toFixed(2)),
      plan_state: null,
      active_at: null,
      created_at: now,
      updated_at: now
    };

    this.store.goals.set(goal.id, goal);
    addGoalToUserIndex(this.store, goal);
    this.store.clarificationsByGoal.set(goal.id, []);

    return {
      goal,
      specificity: {
        state: evaluation.state,
        score: Number(evaluation.score.toFixed(2)),
        missing_elements: evaluation.missing_elements,
        clarification_questions: evaluation.clarification_questions
      }
    };
  }

  listGoals(userId) {
    assertNonEmptyString(userId, "user_id");

    return getGoalsForUser(this.store, userId);
  }

  getGoal(goalId) {
    const goal = this.store.goals.get(goalId);

    if (!goal) {
      throw notFound(`Goal ${goalId} not found`);
    }

    return goal;
  }

  submitClarifications(goalId, answers) {
    const goal = this.getGoal(goalId);

    assertArray(answers, "answers");
    if (answers.length === 0) {
      throw conflict("At least one clarification answer is required");
    }

    const existing = this.store.clarificationsByGoal.get(goal.id) ?? [];

    const persisted = answers.map((item) => {
      assertNonEmptyString(item.question_text, "answers[].question_text");
      assertNonEmptyString(item.answer_text, "answers[].answer_text");

      return {
        id: generateId("clarification"),
        goal_id: goal.id,
        question_text: item.question_text.trim(),
        answer_text: item.answer_text.trim(),
        created_at: nowIso(this.clock)
      };
    });

    const merged = [...existing, ...persisted];
    this.store.clarificationsByGoal.set(goal.id, merged);

    const answerTexts = merged.map((entry) => entry.answer_text);
    const evaluation = this.specificityService.evaluate(goal.title, answerTexts);

    goal.specificity_state = evaluation.state;
    goal.specificity_score = Number(evaluation.score.toFixed(2));
    goal.updated_at = nowIso(this.clock);

    return {
      goal,
      persisted_answers: persisted,
      specificity: {
        state: evaluation.state,
        score: Number(evaluation.score.toFixed(2)),
        missing_elements: evaluation.missing_elements,
        clarification_questions: evaluation.clarification_questions
      }
    };
  }

  submitAssessment(goalId, payload) {
    const goal = this.getGoal(goalId);

    assertNonEmptyString(payload.current_level, "current_level");
    assertWeeklyMinutes(payload.weekly_minutes_available);
    assertOptionalISODate(payload.target_date, "target_date");

    const assessment = {
      id: generateId("assessment"),
      goal_id: goal.id,
      current_level: payload.current_level.trim(),
      weekly_minutes_available: payload.weekly_minutes_available,
      target_date: payload.target_date ?? null,
      created_at: nowIso(this.clock)
    };

    this.store.assessmentByGoal.set(goal.id, assessment);
    goal.updated_at = nowIso(this.clock);

    return assessment;
  }

  patchGoalStatus(goalId, status) {
    const goal = this.getGoal(goalId);

    assertGoalStatusPatch(status);

    if (status === GoalStatus.ACTIVE) {
      return this.activateGoal(goalId);
    }

    goal.status = status;
    goal.updated_at = nowIso(this.clock);
    if (status !== GoalStatus.ACTIVE) {
      goal.active_at = null;
    }

    return goal;
  }

  activateGoal(goalId) {
    const goal = this.getGoal(goalId);

    if (goal.status === GoalStatus.ARCHIVED) {
      throw conflict("Archived goals cannot be activated");
    }

    if (goal.specificity_state !== SpecificityState.SPECIFIC) {
      throw conflict("Goal must pass specificity clarification before activation");
    }

    const userGoals = getGoalsForUser(this.store, goal.user_id);

    for (const candidate of userGoals) {
      if (candidate.id === goal.id) {
        continue;
      }

      if (candidate.status === GoalStatus.ACTIVE) {
        candidate.status = GoalStatus.PAUSED;
        candidate.active_at = null;
        candidate.updated_at = nowIso(this.clock);
      }
    }

    goal.status = GoalStatus.ACTIVE;
    goal.active_at = nowIso(this.clock);
    goal.updated_at = goal.active_at;

    return goal;
  }

  getClarifications(goalId) {
    this.getGoal(goalId);
    return this.store.clarificationsByGoal.get(goalId) ?? [];
  }

  getAssessment(goalId) {
    this.getGoal(goalId);
    return this.store.assessmentByGoal.get(goalId) ?? null;
  }
}
