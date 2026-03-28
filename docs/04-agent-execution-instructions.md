# Agent Execution Instructions

## Purpose
This document defines implementation instructions for each AI coding agent, with clear ownership and handoff rules for parallel MVP delivery.

## Scope
- MVP only
- Vertical slice ownership (not frontend/backend split)
- Contract-first development

## Global Rules (All Agents)
- Do not change shared contracts unilaterally.
- Do not change DB schema without Agent F approval.
- Keep changes inside owned folders unless cross-owner approval is given.
- Use shared fixtures only; do not invent private fixture formats.
- Keep social/invite features out of MVP code paths.

## Shared Contract Baseline (Must Be Respected)
- Goal statuses: `draft`, `active`, `paused`, `archived`
- Plan states: `needs_clarification`, `generating`, `delayed`, `ready`, `failed`
- Planning frames: `skill_mastery`, `fitness_performance`, `project_outcome`
- Core API endpoints are defined in technical spec and cannot break during parallel implementation.

## Agent A — Goal Intake and Specificity

### Mission
Build goal creation, ambiguity clarification, onboarding answers, and goal activation flow.

### Owns
- Goal lifecycle logic
- Specificity gate and clarification prompts
- Active-goal switching behavior

### Must Build
- Create/list/update-status/activate goal behavior
- Clarification answer submission and persistence
- Onboarding assessment capture
- Guard: no plan generation if specificity is insufficient

### Depends On
- Shared contract package
- Base DB schema

### Can Mock Initially
- Specificity score provider (mock classifier output)

### Definition of Done
- One-active-goal behavior is enforced
- Ambiguous goals are blocked and routed to clarification
- Contract tests pass for goal and clarification endpoints
- Handoff payload to Agent B is stable

## Agent B — Plan Generation and Plan State Lifecycle

### Mission
Build plan generation orchestration and lifecycle state transitions.

### Owns
- Plan generation endpoint
- Plan status endpoint
- Planning frame injection and validation
- Generation worker path

### Must Build
- `generate_plan` flow with schema validation
- Plan state transitions: `generating` -> `ready/delayed/failed`
- Persist plan, milestones, and initial tasks
- Fallback behavior for invalid AI output

### Depends On
- Agent A outputs (specificity + assessment)
- Shared job schema and contract package

### Can Mock Initially
- AI response body
- Queue execution (sync fallback)

### Definition of Done
- Plan generation is deterministic under fixture mode
- State transitions are correct and test-covered
- Generated payload passes schema validation
- Stable handoff to Agent C and Agent D

## Agent C — Daily Task Execution and Same-Day Soft Adjustment

### Mission
Build the daily loop: today tasks, completion actions, manual edits, and same-day soft adjustment.

### Owns
- Today task read model
- Task complete/skip/edit flows
- Same-day soft adjustment behavior
- Manual lock policy enforcement

### Must Build
- Active-goal today list endpoint behavior
- Complete/skip/edit APIs and state updates
- Soft adjustment that changes remaining tasks for same day only
- Guarantee: no plan version bump from same-day soft adjustment

### Depends On
- Agent B generated task structure
- Shared contract package

### Can Mock Initially
- Upstream generated plan/task feed

### Definition of Done
- Daily loop works end-to-end in fixture mode
- Manual lock policy works in current 7-day horizon
- Soft adjustment constraints are enforced
- Stable completion data handoff to Agent D

## Agent D — Progress, Streaks, Milestones, and Full Adaptation

### Mission
Build progress computation and full adaptation pipeline.

### Owns
- Progress snapshots and streak metrics
- Milestone confirmation flow
- Full adaptation trigger and processing

### Must Build
- Progress summary endpoint behavior
- User-confirm milestone flow
- Full adaptation logic based on adherence thresholds
- Guarantee: full adaptation creates `Plan.version + 1`

### Depends On
- Agent C completion events
- Agent B plan models

### Can Mock Initially
- Scheduler trigger source

### Definition of Done
- Progress/streak data matches fixtures
- Milestone confirmation updates state correctly
- Adaptation rules and plan-version bump are test-covered
- Stable handoff to Agent E reminder eligibility inputs

## Agent E — Notifications and Reminder Delivery

### Mission
Build notification preferences and reminder delivery gating.

### Owns
- Device token registration
- Reminder preference updates
- Reminder eligibility and send flow

### Must Build
- Register token and update preference behavior
- Quiet hours and daily cap enforcement
- Reminder sends for daily nudge and delayed-plan-ready state
- `send_reminder` payload validation

### Depends On
- Agent C task completion state
- Agent D progress state
- Agent B plan state

### Can Mock Initially
- Push provider API client

### Definition of Done
- Reminder eligibility is deterministic under fixtures
- Quiet hours and cap guardrails are validated
- Reminder jobs pass payload schema checks

## Agent F — Shared Contracts, Schema Governance, and Integration

### Mission
Own cross-module contracts and keep integration branch stable.

### Owns
- Shared types and endpoint schemas
- DB migration baseline and schema governance
- CI contract checks
- Merge and integration coordination

### Must Build
- Contract validation pipeline
- Schema-change approval workflow
- Integration smoke tests across M1->M2->M3->M4->M5

### Depends On
- All agents for feature branch outputs

### Can Mock Initially
- None (governance/integration role)

### Definition of Done
- Shared contracts are versioned and stable
- Integration branch remains green
- No contract-breaking merge without controlled version update

## Handoff Criteria by Module

| Module | Required Before Handoff | Handoff Target |
|---|---|---|
| M1 | Goal + specificity + onboarding endpoints pass contract tests | Agent B, Agent E |
| M2 | Plan generation and status lifecycle stable | Agent C, Agent D, Agent E |
| M3 | Daily actions and soft adjustment stable | Agent D, Agent E |
| M4 | Progress + adaptation + milestone confirm stable | Agent E |
| M5 | Reminder eligibility and delivery stable | Final integration |

## Shared Fixture Strategy
- Use one canonical seed dataset with deterministic IDs and timestamps.
- Include one active goal, one ambiguous draft goal, and one paused goal.
- Include adherence bands: `<60%`, `60-85%`, `>85%`.
- Include frame fixtures for all planning frames.
- Include reminder fixtures for allow/block (quiet-hours, cap).

## Integration and Merge Rules
- Merge windows run twice daily.
- Contract tests and smoke tests are required before merge.
- Cross-owner code changes require owner approval.
- Additive contract changes are preferred; breaking changes require explicit version bump.
