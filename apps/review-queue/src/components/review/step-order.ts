import type { Step } from "@/lib/types";
import type { OrientationState } from "./use-review";

export function orderedSteps(steps: Step[], stepOrder: string[] | null): Step[] {
  if (stepOrder === null) return steps;
  const rank = (step: Step) => {
    const index = stepOrder.indexOf(step.id);
    return index === -1 ? stepOrder.length : index;
  };
  return [...steps].sort((first, second) => rank(first) - rank(second));
}

export function suggestedOrderIds(orientation: OrientationState): string[] | null {
  if (orientation.status !== "ready") return null;
  return orientation.orientation.stepOrder.map((entry) => entry.id);
}

export function suggestedDifference(
  builtInIds: string[],
  suggestedIds: string[],
): { suggested: string; builtIn: string } | null {
  const index = suggestedIds.findIndex((id, position) => id !== builtInIds[position]);
  if (index === -1) return null;
  return { suggested: suggestedIds[index], builtIn: builtInIds[index] };
}

export function stepReasons(orientation: OrientationState): Record<string, string> {
  if (orientation.status !== "ready") return {};
  const reasoned = orientation.orientation.stepOrder.filter((entry) => entry.why);
  return Object.fromEntries(reasoned.map((entry) => [entry.id, entry.why]));
}
