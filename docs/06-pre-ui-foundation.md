# Pre-UI Foundation Track

## Purpose
This branch is the staging area for everything we want stable before building the first real mobile UI screens.

The goal is simple:
- keep screen work focused on UX and layout,
- keep network/state wiring predictable,
- avoid rediscovering API behavior while building the first flow.

## Definition Of Ready
- The app can load its initial signed-in state from one contract-safe bootstrap request.
- The mobile client has wrappers for the main MVP actions instead of raw per-screen `fetch` calls.
- Deterministic demo states exist for empty, ready, no-active-goal, and no-tasks-today scenarios.
- Core API contracts are covered for both happy-path and empty-state UI loading.
- Remaining work is mostly screen architecture and presentation, not backend uncertainty.

## Task Board
- [x] Freeze MVP boundaries, iOS-only validation mode, mock-first AI, and lightweight auth in docs.
- [x] Provide deterministic dev bootstrap scenarios for early UI work.
- [x] Add a unified initial app bootstrap endpoint for the first screen load.
- [x] Expand the mobile API layer so the first UI pass can call named app actions.
- [x] Add regression coverage for bootstrap happy-path and empty-state loading.
- [x] Build the first real mobile flow beyond the playground: intake -> clarification -> assessment -> generation.
- [x] Choose the first UI state container/navigation split so screen code does not sprawl.
- [x] Normalize loading, delayed, failed, and empty-state copy for the first UI pass.
- [ ] Decide which progress and notifications surfaces belong in the first UI pass versus a later pass.
- [ ] Keep production auth and live AI wiring deferred until the iOS core flow is behaviorally stable.

## Work Started On This Branch
1. `GET /v1/app/bootstrap` now returns the initial dashboard snapshot in one response.
2. The mobile playground now hydrates from that unified bootstrap payload.
3. The mobile API module now exposes the main goal/task/adaptation/notification actions the first UI will need.
4. The first mobile pass now routes through dedicated flow screens with a local router/state split instead of a single sprawl-heavy `App.js`.

## Immediate Next Build Order
1. Decide which progress and notifications surfaces belong in the first UI pass versus a later pass.
2. Validate the refactored flow against starter, delayed, and empty-state scenarios on the iOS simulator.
3. Keep production auth and live AI wiring deferred until the iOS core flow is behaviorally stable.
