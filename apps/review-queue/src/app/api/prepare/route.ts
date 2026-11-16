import { z } from "zod";
import { logServerError } from "@/lib/log";
import { jsonError } from "@/lib/http";
import { parsePullRequestRef } from "@/lib/pr-ref";
import { loadReview } from "@/lib/review/prepare";
import { prepareReview } from "@/lib/review/preparation";
import { currentLlmConfig, reviewDeps, sessionStore } from "@/lib/review/services";

const PreparationRequestSchema = z.object({ key: z.string() });

export async function POST(request: Request): Promise<Response> {
  const body = PreparationRequestSchema.safeParse(await request.json().catch(() => null));
  const ref = body.success ? parsePullRequestRef(body.data.key) : null;
  if (!ref) return jsonError("Bad pull request reference", 400);
  try {
    const status = await prepareReview(
      ref,
      {
        store: sessionStore(),
        config: await currentLlmConfig(),
        load: (target) => loadReview(target, reviewDeps()),
        fetchImpl: fetch,
      },
      request.signal,
    );
    return Response.json({ status });
  } catch (error) {
    logServerError(`prepare ${body.data?.key ?? "request"}`, error);
    return jsonError("Preparation failed", 502);
  }
}
