import type { FileDiff } from "@/lib/types";
import {
  askModel,
  CODE_NAME_RULE,
  diffText,
  fenced,
  fencedTitle,
  type LlmConfig,
  type ModelRequest,
  UNTRUSTED_DATA_RULE,
} from "./client";

export const CHANGES_CHAR_BUDGET = 6_000;

const MAX_TOKENS = 250;

const SYSTEM_PROMPT = `You help a reviewer with ADHD who is coming back to a pull request after its author pushed new commits. Say what the new commits changed since their last look, in one calm plain paragraph of at most 3 sentences. No lists, no headings.
${UNTRUSTED_DATA_RULE}
${CODE_NAME_RULE}`;

export async function summarizeChanges(
  input: { title: string; files: FileDiff[] },
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<string> {
  const request: ModelRequest = {
    system: SYSTEM_PROMPT,
    maxTokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          "# PR",
          fencedTitle(input.title),
          "## Changes since the reviewer last looked",
          fenced("pr_diff", diffText(input.files)),
        ].join("\n"),
      },
    ],
  };
  const reply = await askModel({ config, fetchImpl }, request, signal, "background");
  return reply.trim();
}
