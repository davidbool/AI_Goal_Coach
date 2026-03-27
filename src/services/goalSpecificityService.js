import { SpecificityState } from "../contracts/constants.js";

const AMBIGUOUS_REGEX = /\b(be happier|improve my life|be more disciplined|be successful|do better)\b/i;

const QUESTION_BANK = {
  action: "What concrete action will you repeat each week?",
  measurable_target: "What measurable target will show this goal is achieved?",
  timeframe: "By what date or timeframe do you want to reach it?",
  scope: "What specific scope should we focus on first?"
};

export class GoalSpecificityService {
  constructor({ aiClient, threshold = 0.6 }) {
    this.aiClient = aiClient;
    this.threshold = threshold;
  }

  evaluate(goalText, clarificationAnswers = []) {
    const aiResult = this.aiClient.scoreSpecificity(goalText, clarificationAnswers);
    let score = aiResult.score;
    const hasClarifications = clarificationAnswers.length > 0;

    if (!hasClarifications && goalText.trim().split(/\s+/).length < 4) {
      score -= 0.1;
    }

    if (!hasClarifications && AMBIGUOUS_REGEX.test(goalText)) {
      score -= 0.2;
    }

    score = Math.max(0, Math.min(1, score));

    const state = score >= this.threshold ? SpecificityState.SPECIFIC : SpecificityState.NEEDS_CLARIFICATION;

    return {
      state,
      score,
      missing_elements: aiResult.missing_elements,
      clarification_questions: state === SpecificityState.SPECIFIC ? [] : this.buildQuestions(aiResult.missing_elements)
    };
  }

  buildQuestions(missingElements) {
    const unique = Array.from(new Set(missingElements));

    if (unique.length === 0) {
      return [
        "What exact result do you want, and how will you measure it?",
        "What timeline should this plan target?"
      ];
    }

    return unique.slice(0, 3).map((key) => QUESTION_BANK[key] ?? QUESTION_BANK.scope);
  }
}
