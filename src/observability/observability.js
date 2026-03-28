function incrementCounter(map, key, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
}

function ensureReminderReasonBucket(state, reason) {
  if (!state.reminders.by_reason[reason]) {
    state.reminders.by_reason[reason] = {
      sent: 0,
      blocked: 0
    };
  }

  return state.reminders.by_reason[reason];
}

function writeLog(logger, level, payload) {
  const target =
    (typeof logger?.[level] === "function" && logger[level].bind(logger)) ||
    (typeof logger?.log === "function" && logger.log.bind(logger)) ||
    null;

  if (!target) {
    return;
  }

  target(JSON.stringify(payload));
}

export function createObservability({ logger = console, clock = Date } = {}) {
  const startedAt = new clock();
  let requestSequence = 0;
  const state = {
    requests: {
      total: 0,
      by_status: {},
      by_route: {}
    },
    errors: {
      total: 0,
      by_status: {}
    },
    auth: {
      by_source: {}
    },
    plan_generation: {
      by_state: {}
    },
    reminders: {
      sent: 0,
      blocked: 0,
      by_reason: {},
      blocked_reasons: {}
    }
  };

  function nextRequestId() {
    requestSequence += 1;
    return `req-${requestSequence}`;
  }

  function recordRequest({
    request_id,
    method,
    route,
    status,
    duration_ms,
    auth_source = "unknown",
    user_id = null
  }) {
    state.requests.total += 1;
    incrementCounter(state.requests.by_status, String(status));
    incrementCounter(state.auth.by_source, auth_source);

    const routeKey = `${method} ${route}`;
    const routeBucket =
      state.requests.by_route[routeKey] ??
      (state.requests.by_route[routeKey] = {
        count: 0,
        by_status: {},
        total_duration_ms: 0
      });

    routeBucket.count += 1;
    incrementCounter(routeBucket.by_status, String(status));
    routeBucket.total_duration_ms += duration_ms;

    writeLog(logger, "info", {
      event: "request_completed",
      request_id,
      method,
      route,
      status,
      duration_ms,
      auth_source,
      user_id
    });
  }

  function recordError({ request_id, method, route, status, message, user_id = null }) {
    state.errors.total += 1;
    incrementCounter(state.errors.by_status, String(status));

    writeLog(logger, "error", {
      event: "request_failed",
      request_id,
      method,
      route,
      status,
      message,
      user_id
    });
  }

  function recordPlanState(stateName, metadata = {}) {
    incrementCounter(state.plan_generation.by_state, stateName);

    writeLog(logger, "info", {
      event: "plan_state_transition",
      state: stateName,
      ...metadata
    });
  }

  function recordReminder(result, metadata = {}) {
    const reason = metadata.reason ?? "unknown";
    const reminderBucket = ensureReminderReasonBucket(state, reason);

    if (result?.sent) {
      state.reminders.sent += 1;
      reminderBucket.sent += 1;
    } else {
      state.reminders.blocked += 1;
      reminderBucket.blocked += 1;
      incrementCounter(state.reminders.blocked_reasons, result?.blocked_reason ?? "unknown");
    }

    writeLog(logger, "info", {
      event: "reminder_evaluated",
      reason,
      sent: Boolean(result?.sent),
      blocked_reason: result?.blocked_reason ?? null,
      ...metadata
    });
  }

  function snapshot(now = new clock()) {
    const snapshotTime = now instanceof Date ? now : new Date(now);
    const byRoute = Object.fromEntries(
      Object.entries(state.requests.by_route).map(([routeKey, routeBucket]) => [
        routeKey,
        {
          count: routeBucket.count,
          by_status: { ...routeBucket.by_status },
          avg_duration_ms:
            routeBucket.count > 0
              ? Number((routeBucket.total_duration_ms / routeBucket.count).toFixed(2))
              : 0
        }
      ])
    );

    return {
      started_at: startedAt.toISOString(),
      uptime_ms: Math.max(0, snapshotTime.getTime() - startedAt.getTime()),
      requests: {
        total: state.requests.total,
        by_status: { ...state.requests.by_status },
        by_route: byRoute
      },
      errors: {
        total: state.errors.total,
        by_status: { ...state.errors.by_status }
      },
      auth: {
        by_source: { ...state.auth.by_source }
      },
      plan_generation: {
        by_state: { ...state.plan_generation.by_state }
      },
      reminders: {
        sent: state.reminders.sent,
        blocked: state.reminders.blocked,
        by_reason: Object.fromEntries(
          Object.entries(state.reminders.by_reason).map(([reason, bucket]) => [
            reason,
            { ...bucket }
          ])
        ),
        blocked_reasons: { ...state.reminders.blocked_reasons }
      }
    };
  }

  return {
    nextRequestId,
    recordRequest,
    recordError,
    recordPlanState,
    recordReminder,
    snapshot
  };
}
