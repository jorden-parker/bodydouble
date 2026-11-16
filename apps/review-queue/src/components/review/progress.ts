import type { ReviewPayload } from "@/lib/review/prepare";

export function stepsDone(review: ReviewPayload, doneSteps: string[]): number {
  return review.steps.filter((step) => doneSteps.includes(step.id)).length;
}

export function minutesLeft(review: ReviewPayload, doneSteps: string[]): number {
  const total = review.steps.reduce((sum, step) => sum + step.changedLines, 0);
  const left = review.steps
    .filter((step) => !doneSteps.includes(step.id))
    .reduce((sum, step) => sum + step.changedLines, 0);
  if (total === 0 || left === 0) return 0;
  return Math.max(1, Math.round((review.estimateMinutes * left) / total));
}
