const globals = globalThis as { reviewQueuePrompts?: Map<string, string> };

function lastPrompts(): Map<string, string> {
  globals.reviewQueuePrompts ??= new Map();
  return globals.reviewQueuePrompts;
}

function commonPrefixLength(previous: string, next: string): number {
  const limit = Math.min(previous.length, next.length);
  let length = 0;
  while (length < limit && previous[length] === next[length]) length += 1;
  return length;
}

export function recordPrompt(serverKey: string, prompt: string): number {
  const prompts = lastPrompts();
  const reused = commonPrefixLength(prompts.get(serverKey) ?? "", prompt);
  prompts.set(serverKey, prompt);
  return reused;
}
