# Current-Cycle iOS Simulator Validation Checklist

## Purpose
- Keep the current functionality-validation pass separate from the later launch-hardening smoke checklist.
- Use the iOS simulator as the acceptance gate for copy, state transitions, and contract/UI alignment.
- Fix any contract or state mismatch found here before moving on to hardening work.

## Validation Environment
- Validation date: 2026-03-28
- Device: iPhone 17 Pro simulator on iOS 26.4
- Mobile runtime: Expo Go with the local `mobile` app bundle
- API base URL: `http://127.0.0.1:3000`
- Deterministic bootstrap scenarios reused: `starter`, `active_goal_ready`, `no_active_goal`, `no_tasks_today`
- Deterministic generation mocks reused: `ready`, `delay`, `fail`

## Acceptance Gate
- A simulator pass is required for the current cycle before any launch-hardening checklist work.
- Copy must match the intended state and contract-backed outcome for every listed flow.
- The visible surface must stay aligned with the latest backend contract and seeded demo data.
- Any simulator-found mismatch is a blocker until fixed and rechecked.

## Simulator Findings Fixed During This Pass
- `Goal activation/switch gating`: specific goals without a ready plan could be activated, which let the UI reach an active-dashboard state without a valid active plan. Activation now requires `plan_state=ready`, and the mobile activation affordances match that contract.
- `Milestone progress indexing`: the in-memory store seeded milestones but indexed them incorrectly, which made progress payloads return an empty milestone list. The milestone index now stores IDs correctly, and seeded progress surfaces milestone data again.

## Flow Coverage
| Flow | Setup | Expected result | Outcome |
| --- | --- | --- | --- |
| Welcome and guest bootstrap | Fresh guest session, `starter` seed | Welcome screen loads, guest bootstrap lands on Step 1 goal studio | Pass |
| Specific goal path | `starter` + `Learn React by building 2 projects by 2026-10-01` | Specific goal skips clarification and advances to assessment | Pass |
| Ambiguous goal clarification path | `starter` + `be happier` | Clarification screen appears with follow-up prompts, then advances after answers | Pass |
| Generation ready | Specific goal + assessment + `ready` mock | Plan-ready screen appears with estimate, milestones, and first tasks | Pass |
| Generation delayed | Specific goal + assessment + `delay` mock | Delayed waiting-room copy appears with `generating -> delayed` timeline, later resolves to ready | Pass |
| Generation failed | Specific goal + assessment + `fail` mock | Failure screen appears, goal and assessment stay saved, retry CTA remains available | Pass |
| Active dashboard | `active_goal_ready` | Dashboard hero, today task cards, reminders, momentum, milestones, and library all align with seeded state | Pass |
| No tasks today | `no_tasks_today` | Empty-state copy and refresh/lighten actions appear without contract drift | Pass |
| No active goal | `no_active_goal` | Goal studio becomes the primary surface and dashboard bootstrap is not required | Pass |
| Complete | `active_goal_ready` + complete first task | First task becomes `completed` and dashboard metrics refresh | Pass |
| Skip | `active_goal_ready` + skip first task | First task becomes `skipped` and remaining task stays actionable | Pass |
| Edit | `active_goal_ready` + edit first task | Edit form loads, save updates title/duration/flexibility, task becomes preserved for future adaptation | Pass |
| Soft adjust | `active_goal_ready` + soften today | Remaining tasks are softened with same-day adjustment data | Pass |
| Full adapt | Edited task + full adaptation | Plan advances to `v2` and the manual edit stays preserved through adaptation | Pass |
| Milestone confirm | `active_goal_ready` + confirm pending milestone | Pending milestone flips to `confirmed` and `milestones_done` increments | Pass |
| Create another goal | Active dashboard -> create-another-goal intake | Intake screen keeps protective copy that the active goal stays in place until switching | Pass |
| Switch goal | Active ready goal + second ready draft | Second goal activates, previous active goal pauses, no unplanned goal can be switched into focus | Pass |
| Reminders card load/save behavior | `active_goal_ready` + save updated preferences | Reminder settings load from bootstrap, save patches server state, draft resyncs, dirty state clears | Pass |

## Current-Cycle Exit Criteria
- All flows above pass on the iOS simulator with the current deterministic scenarios and mocks.
- Copy on each surface matches the current contract-backed state.
- Bootstrap, goal activation, progress, milestones, and reminders stay aligned with backend payloads.
- Launch hardening work starts only after this checklist stays green.

## Follow-Up Notes
- A dev-only `SafeAreaView` deprecation warning is still visible in Expo logs. It did not block the current simulator acceptance gate because it did not change copy, state transitions, or contract alignment.
