import { z } from "zod";
import type { FileDiff, Hotspot, Step } from "@/lib/types";
import {
  askForJson,
  CODE_NAME_RULE,
  diffText,
  fenced,
  fencedDescription,
  fencedTitle,
  jsonObjectIn,
  type LlmConfig,
  type ModelRequest,
  UNTRUSTED_DATA_RULE,
} from "./client";
import { reviewGuidance } from "./review-guidance";

export type OrientationInput = {
  title: string;
  body: string;
  diffs: FileDiff[];
  steps: Step[];
  hotspots: Hotspot[];
  isDependencyUpdate?: boolean;
};

export type StepSummary = { stepId: string; what: string };

const PROMPT_CHAR_BUDGET = 48_000;
const MAX_TOKENS = 3000;
const SUMMARY_MAX_TOKENS = 900;
const STEP_LIST_LIMIT = 80;
const HOTSPOT_LIST_LIMIT = 40;

const SuggestedHotspot = z.object({
  path: z.string(),
  line: z.number().int().nullable().optional(),
  title: z.string(),
  why: z.string(),
});

export type SuggestedHotspot = z.infer<typeof SuggestedHotspot>;

const StepOrderEntrySchema = z.object({ id: z.string(), why: z.string() });

type StepOrderEntry = z.infer<typeof StepOrderEntrySchema>;

const OrientationSchema = z.object({
  summary: z.string(),
  intent: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  stepOrder: z.array(StepOrderEntrySchema),
  hotspotNotes: z.array(z.object({ id: z.string(), note: z.string() })).default([]),
  extraHotspots: z.array(SuggestedHotspot).default([]),
});

export const OrientationRecordSchema = OrientationSchema.extend({ model: z.string() });

export type Orientation = z.infer<typeof OrientationRecordSchema>;

const JSON_SHAPE = `{"summary": "2-3 plain sentences on what the PR does",
 "intent": "one sentence: the problem it solves",
 "risk": "low" | "medium" | "high",
 "stepOrder": [{"id": "step id from the steps list", "why": "one short sentence: why read it at this point"}],
 "hotspotNotes": [{"id": "hotspot id from the list", "note": "one sentence: what specifically to check"}],
 "extraHotspots": [{"path": "file in the diff", "line": 12, "title": "short", "why": "one sentence"}]}`;

const BASE_PROMPT = `You help a reviewer with ADHD review a pull request. Be brief, concrete and calm.
Reply with ONLY a JSON object, no prose and no code fences, matching:
${JSON_SHAPE}
List every step shown in stepOrder, in the order the reviewer should read them.
Only add extraHotspots for things that look genuinely odd or risky, or clear design problems, and are not already listed. At most 5.
${UNTRUSTED_DATA_RULE}
${CODE_NAME_RULE}`;

const SUMMARY_PROMPT = `You help a reviewer with ADHD review a pull request from short summaries of its steps. Be brief, concrete and calm.
Reply with ONLY a JSON object, no prose and no code fences, matching:
${JSON_SHAPE}
List every step shown in stepOrder, in the order the reviewer should read them. Keep each "why" under 12 words.
You see the step summaries and no code, so return an empty extraHotspots list.
${UNTRUSTED_DATA_RULE}
${CODE_NAME_RULE}`;

function systemPrompt(input: OrientationInput): string {
  const paths = input.diffs.map((diff) => diff.path);
  return [BASE_PROMPT, reviewGuidance(paths, input.isDependencyUpdate)].join("\n\n");
}

function summarySystemPrompt(input: OrientationInput): string {
  return input.isDependencyUpdate
    ? [SUMMARY_PROMPT, reviewGuidance([], true)].join("\n\n")
    : SUMMARY_PROMPT;
}

function firstOf<T>(items: T[], limit: number, noun: string, describe: (item: T) => string) {
  const listed = items.slice(0, limit).map(describe);
  const hidden = items.length - listed.length;
  return hidden > 0 ? [...listed, `(${hidden} more ${noun} not listed)`] : listed;
}

function stepLine(step: Step): string {
  return `${step.id} | ${step.title} | ${step.role} | ${step.changedLines} lines`;
}

function hotspotLine(hotspot: Hotspot): string {
  return `${hotspot.id} | ${hotspot.title} | ${hotspot.path}:${hotspot.line ?? ""}`;
}

function promptHeader(input: OrientationInput, stepsHeading: string, steps: string[]): string[] {
  const hotspots = firstOf(input.hotspots, HOTSPOT_LIST_LIMIT, "hotspots", hotspotLine);
  return [
    "# PR",
    fencedTitle(input.title),
    fencedDescription(input.body),
    stepsHeading,
    fenced("pr_steps", steps.join("\n")),
    "## Hotspots already found",
    fenced("pr_hotspots", hotspots.join("\n")),
  ];
}

export function buildPrompt(input: OrientationInput): string {
  const steps = firstOf(input.steps, STEP_LIST_LIMIT, "steps", stepLine);
  const header = [...promptHeader(input, "## Steps", steps), "## Diff"].join("\n");
  const room = Math.max(0, PROMPT_CHAR_BUDGET - header.length);
  const diff = diffText(input.diffs);
  const clipped = diff.length > room ? `${diff.slice(0, room)}\n[diff truncated]` : diff;
  return `${header}\n${fenced("pr_diff", clipped)}`;
}

function buildSummaryPrompt(input: OrientationInput, summaries: StepSummary[]): string {
  const whatById = new Map(
    summaries.map((summary) => [summary.stepId, summary.what.replace(/\s+/g, " ")]),
  );
  const steps = firstOf(
    input.steps,
    STEP_LIST_LIMIT,
    "steps",
    (step) => `${stepLine(step)} | ${whatById.get(step.id) ?? ""}`,
  );
  return promptHeader(input, "## Steps, each with a summary of its changes", steps).join("\n");
}

function completeStepOrder(order: StepOrderEntry[], steps: Step[]): StepOrderEntry[] {
  const known = new Set(steps.map((step) => step.id));
  const chosen = new Map<string, StepOrderEntry>();
  for (const entry of order) {
    if (known.has(entry.id) && !chosen.has(entry.id)) chosen.set(entry.id, entry);
  }
  const missing = steps.filter((step) => !chosen.has(step.id));
  return [...chosen.values(), ...missing.map((step) => ({ id: step.id, why: "" }))];
}

function shownLineKeys(diffs: FileDiff[]): Set<string> {
  return new Set(
    diffs.flatMap((diff) =>
      diff.hunks.flatMap((hunk) => hunk.lines.map((line) => `${diff.path}:${line.newLine}`)),
    ),
  );
}

function keepKnown(orientation: z.infer<typeof OrientationSchema>, input: OrientationInput) {
  const hotspotIds = new Set(input.hotspots.map((hotspot) => hotspot.id));
  const paths = new Set(input.diffs.map((diff) => diff.path));
  const shownLines = shownLineKeys(input.diffs);
  return {
    ...orientation,
    stepOrder: completeStepOrder(orientation.stepOrder, input.steps),
    hotspotNotes: orientation.hotspotNotes.filter((note) => hotspotIds.has(note.id)),
    extraHotspots: orientation.extraHotspots
      .filter((hotspot) => paths.has(hotspot.path))
      .slice(0, 5)
      .map((hotspot) =>
        shownLines.has(`${hotspot.path}:${hotspot.line}`) ? hotspot : { ...hotspot, line: null },
      ),
  };
}

function parseOrientation(text: string, input: OrientationInput) {
  return keepKnown(OrientationSchema.parse(jsonObjectIn(text)), input);
}

async function askForOrientation(
  request: ModelRequest,
  input: OrientationInput,
  config: LlmConfig,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<Orientation> {
  const orientation = await askForJson(
    { config, fetchImpl },
    request,
    (text) => parseOrientation(text, input),
    signal,
    "background",
  );
  return { ...orientation, model: config.model };
}

export async function orient(
  input: OrientationInput,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<Orientation> {
  return askForOrientation(
    {
      system: systemPrompt(input),
      maxTokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildPrompt(input) }],
    },
    input,
    config,
    fetchImpl,
    signal,
  );
}

export async function orientFromSummaries(
  input: OrientationInput,
  summaries: StepSummary[],
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<Orientation> {
  return askForOrientation(
    {
      system: summarySystemPrompt(input),
      maxTokens: SUMMARY_MAX_TOKENS,
      messages: [{ role: "user", content: buildSummaryPrompt(input, summaries) }],
    },
    input,
    config,
    fetchImpl,
    signal,
  );
}
