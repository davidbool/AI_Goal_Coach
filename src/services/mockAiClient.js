import { PlanningFrame } from "../contracts/constants.js";

const METRIC_HINTS = [
  "minutes",
  "hours",
  "times",
  "sessions",
  "km",
  "miles",
  "chapters",
  "pages",
  "projects",
  "tasks",
  "sales",
  "%"
];

const TIME_HINTS = [
  "day",
  "week",
  "month",
  "year",
  "by",
  "before",
  "within",
  "deadline"
];

const ACTION_HINTS = [
  "build",
  "learn",
  "practice",
  "ship",
  "write",
  "run",
  "train",
  "launch",
  "read",
  "study",
  "complete"
];

const AMBIGUOUS_PHRASES = [
  "be happier",
  "improve my life",
  "be more disciplined",
  "do better",
  "get better",
  "be successful"
];

export class MockAiClient {
  scoreSpecificity(goalText, clarificationAnswers) {
    const aggregate = [goalText, ...clarificationAnswers].join(" ").toLowerCase();

    let score = 0.15;
    const missing = [];

    const hasMetric = /\d/.test(aggregate) || METRIC_HINTS.some((hint) => aggregate.includes(hint));
    const hasTime = /\d{4}-\d{2}-\d{2}/.test(aggregate) || TIME_HINTS.some((hint) => aggregate.includes(hint));
    const hasAction = ACTION_HINTS.some((hint) => aggregate.includes(hint));
    const hasAmbiguousPhrase = AMBIGUOUS_PHRASES.some((phrase) => aggregate.includes(phrase));

    if (hasAction) {
      score += 0.25;
    } else {
      missing.push("action");
    }

    if (hasMetric) {
      score += 0.35;
    } else {
      missing.push("measurable_target");
    }

    if (hasTime) {
      score += 0.25;
    } else {
      missing.push("timeframe");
    }

    if (goalText.trim().split(/\s+/).length >= 6) {
      score += 0.1;
    } else {
      missing.push("scope");
    }

    if (hasAmbiguousPhrase) {
      score -= 0.25;
    }

    score = Math.max(0, Math.min(1, score));

    return {
      score,
      missing_elements: Array.from(new Set(missing))
    };
  }

  classifyFrame(goalText) {
    const normalized = goalText.toLowerCase();

    if (/(run|marathon|fitness|workout|gym|strength|weight)/.test(normalized)) {
      return PlanningFrame.FITNESS_PERFORMANCE;
    }

    if (/(project|launch|ship|startup|business|product|deliver)/.test(normalized)) {
      return PlanningFrame.PROJECT_OUTCOME;
    }

    return PlanningFrame.SKILL_MASTERY;
  }

  generatePlanDraft({ goalText, assessment, frameType }) {
    const lowerGoal = goalText.toLowerCase();
    const weeklyMinutes = assessment.weekly_minutes_available;

    let outcome = "ready";
    let resolveMs = 220;

    if (lowerGoal.includes("[mock-fail]") || lowerGoal.includes("fail")) {
      outcome = "failed";
      resolveMs = 240;
    } else if (lowerGoal.includes("[mock-delay]") || lowerGoal.includes("delay")) {
      outcome = "ready";
      resolveMs = 1200;
    }

    const velocityFactor = Math.max(1, Math.round(600 / weeklyMinutes));
    const minWeeks = Math.max(4, velocityFactor * 2);
    const maxWeeks = minWeeks + 4;

    const firstTasks = [
      {
        title: "Set up this week and block focused time",
        est_minutes: 30,
        difficulty: 2,
        required: true
      },
      {
        title: "Complete first focused practice session",
        est_minutes: 45,
        difficulty: 3,
        required: true
      },
      {
        title: "Log what worked and what to adjust",
        est_minutes: 20,
        difficulty: 1,
        required: true
      }
    ];

    const milestones = [
      {
        title: "Foundation established",
        target_week: 2,
        success_criteria: "Complete at least 5 focused sessions"
      },
      {
        title: "Consistency checkpoint",
        target_week: Math.max(4, Math.floor((minWeeks + maxWeeks) / 2)),
        success_criteria: "Sustain weekly target minutes for 3 weeks"
      },
      {
        title: "Outcome milestone",
        target_week: maxWeeks,
        success_criteria: "Hit the measurable outcome target"
      }
    ];

    return {
      outcome,
      resolve_ms: resolveMs,
      payload:
        outcome === "failed"
          ? null
          : {
              frame_type: frameType,
              feasibility: minWeeks <= 8 ? "realistic" : "stretched",
              estimate: {
                min_weeks: minWeeks,
                max_weeks: maxWeeks,
                confidence: 0.68
              },
              milestones,
              tasks: firstTasks
            }
    };
  }
}
