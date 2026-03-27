# M3 Daily Execution Loop

This module covers:
- Today task loading (`GET /goals/active/tasks/today`)
- Task actions (`complete`, `skip`, `edit`)
- Optimistic UI updates with rollback on sync errors
- Same-day soft adjustment (`POST /goals/active/soft-adjust`)
- Gentle, non-judgmental feedback messages

## Quick Start

```js
import { M3ApiClient, DailyExecutionLoop, createTodayScreenController } from "./index.js";

const api = new M3ApiClient({ baseUrl: "/v1", fetchImpl: fetch });
const loop = new DailyExecutionLoop({ api });
const today = createTodayScreenController(loop);

await today.load();
await today.complete("task-1");
await today.edit("task-2", { title: "Review one key insight", estMinutes: 8 });
await today.skip("task-3");
await today.softAdjust();

console.log(today.render());
```

## Notes

- `editTask` marks tasks as `manualLock = true`.
- `softAdjust` updates only remaining pending tasks.
- `softAdjust` rejects any response that bumps `planVersion`.
