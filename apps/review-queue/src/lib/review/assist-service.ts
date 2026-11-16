import {
  ASSIST_ERROR_MARKER,
  ASSIST_RECORD_MARKER,
  type AssistFailureKind,
  type AssistRecord,
} from "@/lib/assist-protocol";
import { assistStream } from "@/lib/llm/assist";
import { type LlmConfig, LlmFailure } from "@/lib/llm/client";
import type { LoopChunk } from "@/lib/llm/tool-loop";
import { codeTools } from "./code-tools";
import { AssistRequestSchema, type AssistSource, assistInputFrom } from "./assist-request";
import { jsonError } from "@/lib/http";

function formatRecord(record: AssistRecord): string {
  return `${ASSIST_RECORD_MARKER}${JSON.stringify(record)}${ASSIST_RECORD_MARKER}`;
}

function encodedChunk(chunk: LoopChunk): string {
  if (chunk.kind === "phase") return formatRecord({ type: "phase", ...chunk.phase });
  return chunk.text.replaceAll(ASSIST_ERROR_MARKER, "").replaceAll(ASSIST_RECORD_MARKER, "");
}

function classifyFailure(error: unknown): AssistFailureKind {
  return error instanceof LlmFailure ? error.kind : "failed";
}

function explainFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function encodeFailure(error: unknown): string {
  const record = formatRecord({ type: "failure", kind: classifyFailure(error) });
  return `${record}${ASSIST_ERROR_MARKER}${explainFailure(error)}`;
}

function textStream(
  chunks: AsyncGenerator<LoopChunk>,
  signal: AbortSignal | undefined,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(encodedChunk(next.value)));
      } catch (error) {
        if (signal?.aborted) return;
        controller.enqueue(encoder.encode(encodeFailure(error)));
        controller.close();
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
}

export function assistResponse(
  source: AssistSource,
  body: unknown,
  config: LlmConfig,
  claudeConfig: LlmConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Response {
  if (!config.enabled) return jsonError("The model is off", 404);
  const request = AssistRequestSchema.safeParse(body);
  if (!request.success) return jsonError(request.error.message, 400);
  const input = assistInputFrom(source, request.data);
  if (!input.ok) return jsonError(input.error, 400);
  const turnConfig = request.data.shouldEscalate ? claudeConfig : config;
  const chunks = assistStream(
    input.input,
    request.data.history,
    turnConfig,
    fetchImpl,
    signal,
    codeTools(source.index, input.input.path),
  );
  return new Response(textStream(chunks, signal), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
