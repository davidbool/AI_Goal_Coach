# Launch Smoke Checklist

## Purpose
- Validate the MVP release candidate before launch.
- Confirm the core user journey, notifications, and observability hooks behave as expected.

## Current Validation Mode
- The current product validation cycle is iOS only.
- Minimal auth is intentional during current functionality validation.
- Mock-first AI behavior is intentional during current functionality validation.
- Current-cycle simulator validation now lives in `docs/07-current-cycle-ios-simulator-validation-checklist.md`.
- The checklist below applies when the team moves from functionality validation into launch hardening.

## Preflight
- `npm test` passes locally and in CI.
- `npm run prisma:validate` passes.
- Production auth is set to required mode: `GOAL_COACH_AUTH_MODE=required`.
- Error and request logs are wired to the deployment log sink.
- Authenticated access to `/v1/ops/metrics` is available for on-call verification.

## Smoke Flow
1. Health check
   Expected: `GET /health` returns `200` with `{ "ok": true }`.
2. Auth guard
   Expected: `GET /v1/goals` without `Authorization: Bearer <userId>` returns `401`.
3. Goal creation
   Expected: creating a specific goal succeeds and listing goals shows the new draft goal for the authenticated user only.
4. Ambiguous goal clarification
   Expected: a vague goal returns `needs_clarification` with follow-up questions.
5. Assessment and generation
   Expected: submitting assessment and generating a plan moves the goal through `generating` and then `ready` or `delayed`.
6. Delayed plan ready notification
   Expected: if generation enters `delayed`, the eventual `ready` transition emits one `delayed_plan_ready` reminder at most once.
7. Activation and today tasks
   Expected: activating the goal makes `/v1/goals/active/tasks/today` return today's tasks and plan version.
8. Daily loop actions
   Expected: complete, skip, edit, and soft-adjust all succeed with contract-safe payloads.
9. Progress and milestones
   Expected: progress endpoint returns streak/adherence metrics and milestone confirmation is idempotent.
10. Full adaptation
    Expected: `/v1/goals/active/adapt` creates a new plan version and preserves current locked task edits.
11. Notifications
    Expected: token registration, preference updates, and daily reminders respect quiet hours and push caps.
    Run this step on a physical iPhone development build because Expo Go and the iOS simulator cannot provide a live remote push token.
12. Observability
    Expected: every API response includes `x-request-id`, failed requests include `error.request_id`, and `/v1/ops/metrics` shows request, error, plan, and reminder counters increasing.

## Release Sign-Off
- Core happy path completed end-to-end by a human tester.
- At least one forced failure path verified with a visible `request_id`.
- Metrics snapshot reviewed after smoke run.
- No launch blockers remain open for auth, notifications, or data isolation.
