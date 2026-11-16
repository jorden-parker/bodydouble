import { json, postJson } from "@/lib/json-response";
import { prPath } from "@/lib/pr-ref";
import type { SessionAction } from "@/lib/review/session-actions";
import type { PullRequestRef } from "@/lib/types";

export function postSessionAction(ref: PullRequestRef, action: SessionAction): Promise<unknown> {
  return postJson(`/api${prPath(ref)}/session`, action);
}

export function postRefresh(): Promise<{ refreshedAt: string }> {
  return postJson("/api/inbox/refresh", {});
}

export async function postPreparation(
  key: string,
  signal: AbortSignal,
): Promise<{ status: "prepared" | "busy" | "off" }> {
  const response = await fetch("/api/prepare", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
    signal,
  });
  return json(response);
}
