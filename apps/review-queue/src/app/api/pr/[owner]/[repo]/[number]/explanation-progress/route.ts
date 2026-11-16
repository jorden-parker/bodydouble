import { explanationProgress } from "@/lib/review/explanation-service";
import { withPreparedReview } from "@/lib/review/route-context";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";

export const GET = withPreparedReview(async (_request, prepared) =>
  Response.json(explanationProgress(prepared.data, sessionStore(), await currentLlmConfig())),
);
