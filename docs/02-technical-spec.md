# Technical Specification

## Assumptions
- Documentation language is English.
- MVP architecture prioritizes speed and maintainability over completeness.
- One active goal per user is enforced by data constraint.

## Related Documents
- Product scope and UX policy: [01-product-and-scope.md](./01-product-and-scope.md)
- Delivery phases and timeline: [03-implementation-plan.md](./03-implementation-plan.md)
- Agent ownership and handoff instructions: [04-agent-execution-instructions.md](./04-agent-execution-instructions.md)

## System Architecture
- Mobile client: onboarding UI, daily tasks, progress, notifications UX.
- API service: auth, goal/task lifecycle, validation, deterministic logic.
- Worker: asynchronous plan generation, adaptation jobs, reminder jobs.
- Data layer: relational database with strict goal/task relationships.

### Text Diagram
```text
[Mobile App]
  -> [API]
      -> [Postgres]
      -> [Redis Queue]
[Worker]
  -> [OpenAI Responses API]
  -> [Postgres]
  -> [Push Provider]
```

## Responsibilities by Layer

| Layer | Responsibilities |
|---|---|
| Client | Goal input, clarification UI, generation states, task actions, progress views |
| API | Goal status transitions, specificity gate, frame classification orchestration, CRUD, metrics |
| Worker | AI generation, scheduled adaptation, reminder dispatch |
| AI Integration | Structured output generation, scoring support, fallback behavior |

## Data Model (MVP)

| Entity | Key Fields | Notes |
|---|---|---|
| User | id, timezone, locale | One user has many goals |
| Goal | id, user_id, title, status, plan_state, specificity_state, active_at | `status`: draft/active/paused/archived |
| GoalClarification | id, goal_id, question_text, answer_text, created_at | Stores clarification rounds |
| GoalAssessment | id, goal_id, current_level, weekly_minutes, target_date | Onboarding answers |
| Plan | id, goal_id, version, frame_type, estimate_min_weeks, estimate_max_weeks, confidence | New version for full replans |
| Milestone | id, plan_id, title, target_week, success_criteria, status, user_confirmed_at | User-confirmed in MVP |
| Task | id, plan_id, goal_id, scheduled_date, title, est_minutes, difficulty, required, dimension_tag, source, manual_lock, adjustment_source | `adjustment_source` tracks soft/full changes |
| TaskCompletion | id, task_id, state, actual_minutes, completed_at | completion/skipped/partial |
| ProgressSnapshot | id, goal_id, date, adherence_7d, streak_current, streak_longest, milestones_done | Active goal metrics |
| Streak | id, goal_id, current_days, longest_days, last_success_date | Goal-level streak state |
| NotificationPreference | id, user_id, reminder_time_local, quiet_hours_start, quiet_hours_end, max_push_per_day | Reminder policy |

### One Active Goal Constraint
Use a partial unique index:
```sql
CREATE UNIQUE INDEX goals_one_active_per_user
ON goals (user_id)
WHERE status = 'active';
```

## Goal Specificity Detection (Hybrid)
Where it lives:
- API domain service: `GoalSpecificityService`.

How it works:
- Rule-based checks catch common vague patterns.
- AI classifier returns specificity score + missing elements.
- If below threshold, goal enters `needs_clarification` flow.

## Minimal Planning Frame Layer
Where it lives:
- Lightweight config module, not a large template database.

Frames:
- `skill_mastery`: learning, practice, feedback, assessment.
- `fitness_performance`: training_load, recovery, progression, measurement.
- `project_outcome`: planning, production, review, milestone_delivery.

Usage:
- Classify goal into one frame.
- Inject frame + required dimensions into AI prompt context.
- Validate generated milestones/tasks for structural coverage.
- Reuse frame during adaptation to keep plan consistency.

## AI Planning Design

### Input Data
- Goal text
- Clarification answers
- Current level
- Weekly available time
- Optional target date
- Recent adherence (for replans)
- Planning frame type

### Output Structure
- Feasibility status
- Estimate range
- Milestones
- Weekly structure
- 7-14 day tasks
- Coach feedback

### Structured JSON Schema (Simplified)
```json
{
  "type": "object",
  "required": ["feasibility", "estimate", "milestones", "weekly_structure", "tasks", "frame_type"],
  "properties": {
    "frame_type": {"type": "string", "enum": ["skill_mastery", "fitness_performance", "project_outcome"]},
    "feasibility": {"type": "string", "enum": ["realistic", "stretched", "unrealistic"]},
    "estimate": {"type": "object"},
    "milestones": {"type": "array"},
    "weekly_structure": {"type": "object"},
    "tasks": {"type": "array"}
  }
}
```

## Adaptation Model

### Full Adaptation
- Runs daily and on manual trigger.
- Uses rolling completion thresholds.
- Can create `Plan.version + 1` for upcoming horizon.

### Same-Day Soft Adjustment
- Triggered by repeated skips or explicit user action.
- Modifies only remaining tasks for the current day.
- No new plan version.
- Records `adjustment_source = same_day_soft`.

## User-Edited Task Policy
- Manual edits lock the specific scheduled task instance (`manual_lock = true`).
- Full adaptation does not overwrite locked tasks in the current 7-day horizon.
- Repeated manual edits become soft preference signals for future generation.
- Drift guardrail checks weekly planned minutes against user budget.

## API Surface (MVP)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /v1/goals | Create goal |
| GET | /v1/goals | List goals |
| POST | /v1/goals/:goalId/activate | Activate selected goal |
| PATCH | /v1/goals/:goalId/status | Pause/archive/draft transitions |
| POST | /v1/goals/:goalId/clarifications | Submit clarification answers |
| POST | /v1/goals/:goalId/assessment | Submit onboarding answers |
| POST | /v1/goals/:goalId/plans/generate | Trigger generation |
| GET | /v1/goals/:goalId/plans/status | Read generation state |
| GET | /v1/goals/active/tasks/today | Read today tasks |
| POST | /v1/tasks/:taskId/complete | Complete task |
| POST | /v1/tasks/:taskId/skip | Skip task |
| PATCH | /v1/tasks/:taskId | Edit task |
| POST | /v1/goals/active/soft-adjust | Same-day adjustment |
| POST | /v1/goals/active/adapt | Full replan trigger |
| POST | /v1/milestones/:milestoneId/confirm | User-confirm milestone |
| GET | /v1/goals/active/progress | Progress summary |
| POST | /v1/notifications/token | Register push token |
| PATCH | /v1/notifications/preferences | Update reminder settings |

## Non-Functional Requirements (MVP)
- Performance: non-AI API p95 under 400ms.
- Plan generation: delayed fallback state after threshold.
- Reliability: retry queue for AI and notification jobs.
- Security: row-level data isolation, encrypted transport/storage.
- Observability: logs, error tracking, queue metrics, product analytics.
- Maintainability: shared contracts and minimal abstractions.
