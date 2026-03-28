import {
  GoalStatus,
  PlanState,
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
import { generateId, nowIso } from "../repositories/storeUtils.js";

export class GoalService {
  constructor({ store, specificityService, clock = Date }) {
    this.store = store;
    this.specificityService = specificityService;
    this.clock = clock;
  }

  async createGoal({ user_id, title }) {
    assertNonEmptyString(user_id, "user_id");
    assertNonEmptyString(title, "title");

    if (typeof this.store.ensureUser === "function") {
      await this.store.ensureUser(user_id);
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

    await this.store.createGoalRecord(goal);

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

  async listGoals(userId) {
    assertNonEmptyString(userId, "user_id");

    return this.store.listGoalsForUser(userId);
  }

  async getGoal(goalId) {
    const goal = await this.store.getGoal(goalId);

    if (!goal) {
      throw notFound(`Goal ${goalId} not found`);
    }

    return goal;
  }

  async submitClarifications(goalId, answers) {
    const goal = await this.getGoal(goalId);

    assertArray(answers, "answers");
    if (answers.length === 0) {
      throw conflict("At least one clarification answer is required");
    }

    const existing = await this.store.getClarifications(goal.id);

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
    await this.store.appendClarifications(goal.id, persisted);

    const answerTexts = merged.map((entry) => entry.answer_text);
    const evaluation = this.specificityService.evaluate(goal.title, answerTexts);

    goal.specificity_state = evaluation.state;
    goal.specificity_score = Number(evaluation.score.toFixed(2));
    goal.updated_at = nowIso(this.clock);
    await this.store.updateGoal(goal.id, {
      specificity_state: goal.specificity_state,
      specificity_score: goal.specificity_score,
      updated_at: goal.updated_at
    });

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

  async submitAssessment(goalId, payload) {
    const goal = await this.getGoal(goalId);

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

    await this.store.upsertAssessment(goal.id, assessment);
    goal.updated_at = nowIso(this.clock);
    await this.store.updateGoal(goal.id, {
      updated_at: goal.updated_at
    });

    return assessment;
  }

  async patchGoalStatus(goalId, status) {
    const goal = await this.getGoal(goalId);

    assertGoalStatusPatch(status);

    if (status === GoalStatus.ACTIVE) {
      return this.activateGoal(goalId);
    }

    return this.store.updateGoal(goal.id, {
      status,
      updated_at: nowIso(this.clock),
      active_at: status !== GoalStatus.ACTIVE ? null : goal.active_at
    });
  }

  async activateGoal(goalId) {
    const goal = await this.getGoal(goalId);

    if (goal.status === GoalStatus.ARCHIVED) {
      throw conflict("Archived goals cannot be activated");
    }

    if (goal.specificity_state !== SpecificityState.SPECIFIC) {
      throw conflict("Goal must pass specificity clarification before activation");
    }

    if (goal.plan_state !== PlanState.READY || !goal.active_plan_id) {
      throw conflict("Goal needs a ready plan before activation");
    }

    return this.store.activateGoal(goal.id, nowIso(this.clock));
  }

  async getClarifications(goalId) {
    await this.getGoal(goalId);
    return this.store.getClarifications(goalId);
  }

  async getAssessment(goalId) {
    await this.getGoal(goalId);
    return this.store.getAssessment(goalId);
  }
}
