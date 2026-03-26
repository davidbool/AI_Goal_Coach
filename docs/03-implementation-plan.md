# Implementation Work Plan

## Assumptions
- Documentation language is English.
- Team size is small startup team or solo founder.
- MVP-first delivery is the primary objective.

## Related Documents
- Product scope and UX: [01-product-and-scope.md](./01-product-and-scope.md)
- Technical design: [02-technical-spec.md](./02-technical-spec.md)

## Phase Plan (0-6)

| Phase | Objective | Main Tasks | Dependencies | Risks | Definition of Done |
|---|---|---|---|---|---|
| 0 | Lock decisions | Confirm MVP boundaries, active-goal policy, ambiguity policy, planning frames, adaptation split | Founder approval | Scope drift | Signed spec and API/data contract baseline |
| 1 | Foundation | Repo setup, CI, auth baseline, DB schema, one-active-goal constraint | Phase 0 | Rework from schema gaps | Goal CRUD + activation works in dev |
| 2 | Onboarding + Plan Generation | Specificity gate, clarification flow, onboarding answers, generation job, status polling UI | Phase 1 | AI output instability | User gets valid first plan from specific goal |
| 3 | Daily Execution Loop | Today tasks, complete/skip/edit, same-day soft adjustment, feedback messages | Phase 2 | UX friction | Daily loop usable in under 10 seconds |
| 4 | Progress + Full Adaptation | Streak/progress snapshots, milestone confirmation, daily full adaptation, plan versioning | Phase 3 | Over/under adaptation | Adaptation is stable and explainable |
| 5 | Notifications | Push token flow, reminder preferences, delayed-plan-ready notification, send caps | Phases 2-4 | Notification fatigue | Reliable reminders with quiet-hour respect |
| 6 | QA + Launch Prep | E2E checks, bug fixes, instrumentation validation, launch checklist | Phases 1-5 | Late defects | Release candidate approved |

## Build Order Recommendation
1. Goal lifecycle and one-active-goal enforcement.
2. Specificity gate and clarification flow.
3. Plan generation pipeline and generation states.
4. Daily task execution and same-day soft adjustment.
5. Full adaptation, streak, and progress.
6. Notifications and polish.

## First 2 Weeks Execution Plan

| Time | Focus | Deliverable |
|---|---|---|
| Days 1-2 | Foundation setup | Monorepo, CI, env setup, skeleton services |
| Days 3-4 | Data model | Core schema + migrations + one-active-goal index |
| Days 5-6 | Goal lifecycle APIs | Create/list/activate/pause/archive goals |
| Days 7-8 | Specificity + onboarding | Clarification flow + assessment endpoints/UI |
| Days 9-10 | Generation pipeline | Async generation + status states + retry |
| Days 11-12 | Daily loop | Today tasks + complete/skip/edit |
| Days 13-14 | Adaptation basics | Soft same-day adjustment + initial full adaptation |

## Risk Register and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Vague goals generate poor plans | Trust loss | Hard specificity gate before generation |
| AI structure inconsistency | Runtime failures | Strict schema validation + fallback |
| Too many moving parts | Delivery delay | Keep MVP modules lean and single-purpose |
| Plan drift from manual edits | Reduced plan quality | Manual lock + weekly-time drift guardrail |
| Adaptation feels abrupt | User frustration | Cap change rate and preserve short horizon |

## MVP Cuts If Timeline Slips
- Drop delayed-plan push notification and keep in-app polling.
- Keep milestone confirmation manual only.
- Remove preference learning from repeated task edits.
- Keep progress charts minimal.

## Open Decisions Needing Founder Input
- Max clarification rounds before forcing goal to remain draft.
- Active-goal switch frequency policy.
- Aggressive vs conservative adaptation default.

## Leanest Shippable Version
- Multi-goal records with one active goal.
- Specificity gate + clarification.
- Initial plan generation with loading/delayed/error states.
- Daily tasks with complete/skip/edit.
- Same-day soft adjustment and simple daily full adaptation.
- Basic streak/progress + notifications.

## Release Readiness Checklist
- One-active-goal constraint tested.
- Ambiguous goal gating tested.
- Generation states tested (`generating`, `delayed`, `failed`, `ready`).
- Same-day soft adjustment tested without plan version bump.
- Full adaptation tested with version bump.
- No social entities or invite endpoints in MVP implementation.
- Milestones user-confirmed in MVP.
