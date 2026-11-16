export type Speed = { tokensPerSecond: number; isMeasured: boolean };
export type Speeds = { reading: Speed; writing: Speed };

type Sample = { tokens: number; seconds: number };
type SpeedState = { reading: Sample[]; writing: Sample[]; lastAnsweredAt: number | null };
export type SpeedMeter = {
  observe: (event: { type?: string; usage?: { output_tokens?: number } }) => void;
};

const DEFAULT_READING_TOKENS_PER_SECOND = 170;
const DEFAULT_WRITING_TOKENS_PER_SECOND = 13;
const WINDOW_SIZE = 10;
const KEEP_AWAKE_MS = 5 * 60_000;
export const COLD_LOAD_SECONDS = 15;

const globals = globalThis as { reviewQueueSpeeds?: SpeedState };

function speedState(): SpeedState {
  globals.reviewQueueSpeeds ??= { reading: [], writing: [], lastAnsweredAt: null };
  return globals.reviewQueueSpeeds;
}

function summarizeSamples(samples: Sample[], fallback: number): Speed {
  if (samples.length === 0) return { tokensPerSecond: fallback, isMeasured: false };
  const tokens = samples.reduce((total, sample) => total + sample.tokens, 0);
  const seconds = samples.reduce((total, sample) => total + sample.seconds, 0);
  return { tokensPerSecond: tokens / seconds, isMeasured: true };
}

export function readMeasuredSpeeds(): Speeds {
  const state = speedState();
  return {
    reading: summarizeSamples(state.reading, DEFAULT_READING_TOKENS_PER_SECOND),
    writing: summarizeSamples(state.writing, DEFAULT_WRITING_TOKENS_PER_SECOND),
  };
}

function keepRecent(samples: Sample[], sample: Sample): Sample[] {
  return [...samples, sample].slice(-WINDOW_SIZE);
}

function recordSample(kind: "reading" | "writing", tokens: number, seconds: number): void {
  if (tokens <= 0 || seconds <= 0) return;
  const state = speedState();
  state[kind] = keepRecent(state[kind], { tokens, seconds });
}

export function isModelAwake(now: number = Date.now()): boolean {
  const { lastAnsweredAt } = speedState();
  return lastAnsweredAt !== null && now - lastAnsweredAt < KEEP_AWAKE_MS;
}

export function startSpeedMeter(
  processedTokens: number,
  isCold: boolean,
  now: () => number = () => performance.now(),
): SpeedMeter {
  const startedAt = now();
  let outputTokens = 0;
  let firstBlockAt: number | null = null;
  return {
    observe(event) {
      if (event.type === "content_block_start") firstBlockAt ??= now();
      if (event.type === "message_delta") outputTokens = event.usage?.output_tokens ?? outputTokens;
      if (event.type !== "message_stop" || firstBlockAt === null) return;
      speedState().lastAnsweredAt = Date.now();
      if (!isCold) recordSample("reading", processedTokens, (firstBlockAt - startedAt) / 1000);
      recordSample("writing", outputTokens, (now() - firstBlockAt) / 1000);
    },
  };
}
