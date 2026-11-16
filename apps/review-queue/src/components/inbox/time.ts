const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatDuration(milliseconds: number): string {
  if (milliseconds < HOUR_MS) return `${Math.max(1, Math.round(milliseconds / MINUTE_MS))} min`;
  if (milliseconds < 2 * DAY_MS) return `${Math.round(milliseconds / HOUR_MS)} h`;
  return `${Math.round(milliseconds / DAY_MS)} d`;
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const elapsed = now - Date.parse(iso);
  if (elapsed < MINUTE_MS) return "just now";
  return `${formatDuration(elapsed)} ago`;
}
