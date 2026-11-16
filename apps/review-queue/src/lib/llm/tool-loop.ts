import { type AssistLookup, type AssistPhase, DEFAULT_LOOKUP_BUDGET } from "@/lib/assist-protocol";
import {
  type ContentBlock,
  type LlmClient,
  type Message,
  type ModelRequest,
  type ToolResultBlock,
  type ToolSpec,
  type ToolUseBlock,
  streamTurn,
} from "./client";

export type ToolOutcome = { content: string; lookup: AssistLookup };

export type ToolBox = {
  specs: ToolSpec[];
  run: (name: string, input: unknown) => Promise<ToolOutcome>;
};

export type LoopChunk = { kind: "text"; text: string } | { kind: "phase"; phase: AssistPhase };

const ROUND_SEPARATOR = "\n\n";

type RoundOutcome = { text: string; toolUses: ToolUseBlock[] };

function isToolsUnsupported(error: unknown): boolean {
  return error instanceof Error && /does not support tools/i.test(error.message);
}

async function* streamRound(
  client: LlmClient,
  request: ModelRequest,
  signal: AbortSignal | undefined,
  separateFromEarlierText: boolean,
): AsyncGenerator<LoopChunk, RoundOutcome> {
  let text = "";
  const toolUses: ToolUseBlock[] = [];
  for await (const event of streamTurn(client, request, signal, "interactive")) {
    if (event.type === "phase") {
      yield { kind: "phase", phase: event.phase };
      continue;
    }
    if (event.type === "tool_use") {
      toolUses.push(event);
      continue;
    }
    if (separateFromEarlierText && text === "") yield { kind: "text", text: ROUND_SEPARATOR };
    text += event.text;
    yield { kind: "text", text: event.text };
  }
  return { text, toolUses };
}

async function* answerRound(
  client: LlmClient,
  request: ModelRequest,
  toolSpecs: ToolSpec[] | null,
  signal: AbortSignal | undefined,
  separateFromEarlierText: boolean,
): AsyncGenerator<LoopChunk, RoundOutcome> {
  if (toolSpecs === null)
    return yield* streamRound(client, request, signal, separateFromEarlierText);
  try {
    return yield* streamRound(
      client,
      { ...request, tools: toolSpecs },
      signal,
      separateFromEarlierText,
    );
  } catch (error) {
    if (!isToolsUnsupported(error)) throw error;
    return yield* streamRound(client, request, signal, separateFromEarlierText);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resultBlock(toolUseId: string, content: string, failed: boolean): ToolResultBlock {
  return failed
    ? { type: "tool_result", tool_use_id: toolUseId, content, is_error: true }
    : { type: "tool_result", tool_use_id: toolUseId, content };
}

async function runOne(
  toolUse: ToolUseBlock,
  tools: ToolBox,
): Promise<{ result: ToolResultBlock; lookup: AssistLookup | null }> {
  try {
    const outcome = await tools.run(toolUse.name, toolUse.input);
    return { result: resultBlock(toolUse.id, outcome.content, false), lookup: outcome.lookup };
  } catch (error) {
    return { result: resultBlock(toolUse.id, errorMessage(error), true), lookup: null };
  }
}

async function* runTools(
  toolUses: ToolUseBlock[],
  tools: ToolBox,
  signal: AbortSignal | undefined,
  round: number,
  budget: number,
): AsyncGenerator<LoopChunk, ToolResultBlock[]> {
  const results: ToolResultBlock[] = [];
  for (const toolUse of toolUses) {
    if (signal?.aborted) break;
    const { result, lookup } = await runOne(toolUse, tools);
    if (lookup) yield { kind: "phase", phase: { phase: "looking-up", round, budget, ...lookup } };
    results.push(result);
  }
  return results;
}

function assistantTurn(outcome: RoundOutcome): Message {
  const textBlocks: ContentBlock[] = outcome.text ? [{ type: "text", text: outcome.text }] : [];
  return { role: "assistant", content: [...textBlocks, ...outcome.toolUses] };
}

export async function* toolLoop(
  client: LlmClient,
  request: ModelRequest,
  tools: ToolBox,
  signal?: AbortSignal,
  lookupBudget = DEFAULT_LOOKUP_BUDGET,
): AsyncGenerator<LoopChunk> {
  let messages = request.messages;
  let hasShownText = false;
  let roundsUsed = 0;
  while (!signal?.aborted) {
    const canLookUp = roundsUsed < lookupBudget;
    const outcome: RoundOutcome = yield* answerRound(
      client,
      { ...request, messages },
      canLookUp ? tools.specs : null,
      signal,
      hasShownText,
    );
    hasShownText ||= outcome.text !== "";
    if (!canLookUp || outcome.toolUses.length === 0) return;
    roundsUsed += 1;
    const results = yield* runTools(outcome.toolUses, tools, signal, roundsUsed, lookupBudget);
    messages = [...messages, assistantTurn(outcome), { role: "user", content: results }];
    if (roundsUsed === lookupBudget) {
      yield { kind: "phase", phase: { phase: "budget-ended", budget: lookupBudget } };
    }
  }
}
