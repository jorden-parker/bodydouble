export type QueueKeyAction = "next" | "previous" | "snooze" | "archive" | "refresh";

export type KeyPress = { key: string; hasModifier: boolean; isTyping: boolean };

const QUEUE_KEYS = new Map<string, QueueKeyAction>([
  ["j", "next"],
  ["k", "previous"],
  ["s", "snooze"],
  ["e", "archive"],
  ["r", "refresh"],
]);

export function queueKeyAction(press: KeyPress): QueueKeyAction | null {
  if (press.hasModifier || press.isTyping) return null;
  return QUEUE_KEYS.get(press.key) ?? null;
}

export function nextRowIndex(current: number, count: number, step: number): number {
  return Math.min(Math.max(current + step, 0), count - 1);
}
