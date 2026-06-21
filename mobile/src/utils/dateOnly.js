const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const toLocalDateString = (date = new Date()) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateOnlyToUtcMs = (value) => {
  const match = DATE_ONLY_RE.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day);
  const parsed = new Date(utcMs);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  return utcMs;
};

export const calendarDaysSince = (dateString, now = new Date()) => {
  const startMs = dateOnlyToUtcMs(dateString);
  const todayString = toLocalDateString(now);
  const todayMs = dateOnlyToUtcMs(todayString);
  if (startMs === null || todayMs === null) return null;
  return Math.floor((todayMs - startMs) / DAY_MS);
};
