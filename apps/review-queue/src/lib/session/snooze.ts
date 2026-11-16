import type { SnoozeUntil } from "./store";

export function isSnoozed(until: SnoozeUntil, headSha: string, now: number): boolean {
  if ("at" in until) return Date.parse(until.at) > now;
  return until.headSha === headSha;
}

export function tomorrowMidnight(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
}
