const TIME_FORMATTER_CACHE = new Map();
const LOCAL_DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function getFormatter(timeZone) {
  if (!TIME_FORMATTER_CACHE.has(timeZone)) {
    TIME_FORMATTER_CACHE.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      })
    );
  }

  return TIME_FORMATTER_CACHE.get(timeZone);
}

export function getLocalDateParts(date, timeZone) {
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

export function toLocalDateKey(date, timeZone) {
  const { year, month, day } = getLocalDateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseTimeHHMM(value) {
  if (typeof value !== "string") {
    throw new Error(`Invalid time format: ${value}`);
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`Invalid time format: ${value}`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time format: ${value}`);
  }

  return { hour, minute, totalMinutes: hour * 60 + minute };
}

export function shiftLocalDateKey(localDateKey, dayDelta) {
  if (typeof localDateKey !== "string") {
    throw new Error(`Invalid local date key: ${localDateKey}`);
  }

  const match = LOCAL_DATE_KEY_PATTERN.exec(localDateKey);
  if (!match) {
    throw new Error(`Invalid local date key: ${localDateKey}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + dayDelta);

  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
}

export function isWithinQuietHours(localHour, localMinute, quietHoursStart, quietHoursEnd) {
  const start = parseTimeHHMM(quietHoursStart).totalMinutes;
  const end = parseTimeHHMM(quietHoursEnd).totalMinutes;
  const current = localHour * 60 + localMinute;

  if (start === end) {
    return false;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

export function lastNDatesInclusive(localDateKey, count) {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Invalid count: ${count}`);
  }

  const dates = [];

  for (let i = 0; i < count; i += 1) {
    dates.push(shiftLocalDateKey(localDateKey, -i));
  }

  return dates;
}
