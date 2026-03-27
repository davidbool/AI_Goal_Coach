# Product Description and Scope

## Assumptions
- Documentation language is English.
- The app supports multiple goals per user, but only one goal can be `active` in MVP.
- Social features are out of MVP and appear only in V1.1/later.

## Related Documents
- Technical implementation details: [02-technical-spec.md](./02-technical-spec.md)
- Execution phases and delivery plan: [03-implementation-plan.md](./03-implementation-plan.md)
- Agent ownership and handoff instructions: [04-agent-execution-instructions.md](./04-agent-execution-instructions.md)

## Product Summary
AI Goal Coach is a mobile app that helps users achieve long-term goals by converting them into realistic daily and weekly actions. It behaves like a gentle coach: supportive, adaptive, and focused on consistency over intensity.

## Positioning
- The product is an AI coach, not just a habit tracker.
- Tone is supportive and non-judgmental.
- Missed tasks are expected and handled with adaptation.
- Mild emotional cost is acceptable, harsh punishment is not.

## Scope Definition

| Scope Tier | Included |
|---|---|
| MVP | Goal setup, specificity clarification, onboarding questions, initial AI plan, daily task execution, same-day soft adjustment, daily full adaptation, streak/progress/milestones, notifications |
| V1.1 | Optional social invite/compare, richer check-ins, smarter reminder timing |
| Later | Deeper social features, domain packs, advanced forecasting |

## Active Goal Policy (MVP)
- Users may create and keep multiple goals in the system.
- Exactly one goal can be `active` at a time.
- Other goals can be `draft`, `paused`, or `archived`.
- Daily tasks, adaptation, streaks, and progress calculations run only for the active goal.
- Activating a new goal auto-pauses the previously active goal.

## Ambiguous Goal Policy
The app must not generate fake-precise plans for vague goals.

Examples of ambiguous goals:
- "be happier"
- "be more disciplined"
- "improve my life"

MVP policy:
- Detect low-specificity goals before plan generation.
- Ask follow-up clarification questions.
- Guide the user toward a measurable target.
- Generate timeline/milestones/tasks only after specificity is sufficient.
- If still vague after clarification rounds, keep goal as `draft` with a clear "needs clarification" state.

## User Flows

### 1) Onboarding + Clarification
1. User enters a goal statement.
2. System evaluates specificity.
3. If specific enough, continue to onboarding questions.
4. If not specific enough, ask short follow-up questions.
5. Save goal as `draft` until sufficient clarity is reached.

### 2) Plan Generation States
1. User submits onboarding answers.
2. Goal enters `generating` state.
3. App shows loading state with expected wait.
4. App polls status endpoint with backoff.
5. If delayed, app shows delayed fallback and allows background wait.
6. On success, app shows estimate, milestones, and today tasks.
7. On failure, app shows retry action and supportive message.

### 3) Daily Loop (10-second core behavior)
1. Open app.
2. See active goal today tasks.
3. Complete, skip, or edit tasks.
4. Receive supportive feedback.
5. Update streak and progress.

### 4) Same-Day Soft Adjustment
- Triggered after repeated skips or by user request.
- Lightens remaining tasks for the same day only.
- Does not create a new full plan version.

### 5) Full Daily Adaptation
- Runs daily (plus manual trigger).
- Updates upcoming tasks and challenge level.
- Creates a new plan version only when a full replan is needed.

### 6) Milestone Flow
- Milestones are primarily user-confirmed in MVP.
- Auto-detection is not required for MVP.

## Success Criteria (MVP)
- User can go from goal entry to first actionable tasks quickly.
- Daily loop is clear, fast, and motivating.
- Adaptation improves consistency without abrupt plan changes.
- Users understand why the plan changed.

## Product-Level MVP Cuts (If Needed)
- Remove social entirely from release scope.
- Keep milestone completion manual only.
- Keep one coach tone (no persona system).
- Keep charts simple (adherence + streak + milestone count).
