import { VALID_GOAL_STATUSES } from "./constants.js";

export function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(`${field} must be a non-empty string`);
  }
}

export function assertArray(value, field) {
  if (!Array.isArray(value)) {
    throw badRequest(`${field} must be an array`);
  }
}

export function assertWeeklyMinutes(value) {
  if (!Number.isInteger(value) || value < 30 || value > 1260) {
    throw badRequest("weekly_minutes_available must be an integer between 30 and 1260");
  }
}

export function assertOptionalISODate(value, field) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`${field} must be an ISO date in YYYY-MM-DD format`);
  }

  const asDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(asDate.getTime())) {
    throw badRequest(`${field} is not a valid date`);
  }
}

export function assertGoalStatusPatch(status) {
  if (!VALID_GOAL_STATUSES.has(status)) {
    throw badRequest(`status must be one of: ${Array.from(VALID_GOAL_STATUSES).join(", ")}`);
  }
}

export function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

export function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}
