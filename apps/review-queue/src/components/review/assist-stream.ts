import {
  ASSIST_ERROR_MARKER,
  ASSIST_RECORD_MARKER,
  type AssistFailureKind,
  type AssistLookup,
  type AssistPhase,
  type AssistRecord,
} from "@/lib/assist-protocol";

export type ParsedAssistStream = {
  text: string;
  lookups: AssistLookup[];
  failure: string | null;
  phase?: AssistPhase | null;
  failureKind?: AssistFailureKind | null;
  hasBudgetEnded: boolean;
};

const PHASE_NAMES: string[] = ["queued", "reading", "looking-up", "writing", "budget-ended"];

const FAILURE_KINDS: string[] = ["unavailable", "ended-early", "failed"];

function isLookupFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.tool === "string" &&
    typeof value.label === "string" &&
    Array.isArray(value.paths) &&
    value.paths.every((path) => typeof path === "string")
  );
}

function isRecord(value: unknown): value is AssistRecord {
  if (typeof value !== "object" || value === null) return false;
  const fields = value as Record<string, unknown>;
  if (fields.type === "failure") {
    return typeof fields.kind === "string" && FAILURE_KINDS.includes(fields.kind);
  }
  if (fields.type !== "phase" || typeof fields.phase !== "string") return false;
  if (!PHASE_NAMES.includes(fields.phase)) return false;
  return fields.phase !== "looking-up" || isLookupFields(fields);
}

function parseRecords(json: string): AssistRecord[] {
  try {
    const value: unknown = JSON.parse(json);
    return isRecord(value) ? [value] : [];
  } catch {
    return [];
  }
}

function splitFailure(raw: string): { body: string; failure: string | null } {
  const failureAt = raw.indexOf(ASSIST_ERROR_MARKER);
  if (failureAt === -1) return { body: raw, failure: null };
  return { body: raw.slice(0, failureAt), failure: raw.slice(failureAt + 1) };
}

function collectLookups(phases: AssistPhase[]): AssistLookup[] {
  return phases.flatMap((phase) =>
    phase.phase === "looking-up"
      ? [{ tool: phase.tool, label: phase.label, paths: phase.paths }]
      : [],
  );
}

export function parseAssistStream(raw: string): ParsedAssistStream {
  const { body, failure } = splitFailure(raw);
  const segments = body.split(ASSIST_RECORD_MARKER);
  const text = segments.filter((_, index) => index % 2 === 0).join("");
  const records = segments.flatMap((segment, index) =>
    index % 2 === 1 && index + 1 < segments.length ? parseRecords(segment) : [],
  );
  const phases = records.filter((record) => record.type === "phase");
  const failures = records.flatMap((record) => (record.type === "failure" ? [record.kind] : []));
  return {
    text,
    lookups: collectLookups(phases),
    failure,
    phase: phases.at(-1) ?? null,
    failureKind: failures.at(-1) ?? null,
    hasBudgetEnded: phases.some((phase) => phase.phase === "budget-ended"),
  };
}
