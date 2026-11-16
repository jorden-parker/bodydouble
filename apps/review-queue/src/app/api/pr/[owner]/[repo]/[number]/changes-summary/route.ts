import { jsonError } from "@/lib/http";
import { prKey } from "@/lib/pr-ref";
import { changesSummaryFor } from "@/lib/review/changes-summary-service";
import { withPreparedReview } from "@/lib/review/route-context";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";

export const GET = withPreparedReview(async (request, prepared) => {
  const baseline = sessionStore().getSession(prKey(prepared.data.pr.ref)).baselineHeadSha;
  if (!baseline) return jsonError("Nothing has changed since you last looked", 404);
  return Response.json(
    await changesSummaryFor(
      prepared,
      baseline,
      sessionStore(),
      await currentLlmConfig(),
      fetch,
      request.signal,
    ),
  );
});
