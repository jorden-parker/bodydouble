const BUMP_TITLE = /\bbump\s+(\S+)\s+from\s+(\S+)\s+to\s+(\S+)/i;

type BumpKind = "patch" | "minor" | "major";

type Bump = { packageName: string; from: string; to: string; kind: BumpKind };

export type BumpCounts = Record<BumpKind | "other", number>;

function splitVersion(version: string): number[] {
  return version.replace(/^v/, "").split(".").map(Number);
}

function bumpKindOf(from: string, to: string): BumpKind {
  const [fromMajor, fromMinor = 0] = splitVersion(from);
  const [toMajor, toMinor = 0] = splitVersion(to);
  if (fromMajor !== toMajor) return "major";
  if (fromMinor !== toMinor) return "minor";
  return "patch";
}

export function bumpFrom(title: string): Bump | null {
  const match = BUMP_TITLE.exec(title);
  if (!match) return null;
  const [, packageName, from, to] = match;
  return { packageName, from, to, kind: bumpKindOf(from, to) };
}

export function bumpCounts(titles: string[]): BumpCounts {
  const counts: BumpCounts = { patch: 0, minor: 0, major: 0, other: 0 };
  for (const title of titles) {
    const bump = bumpFrom(title);
    counts[bump?.kind ?? "other"] += 1;
  }
  return counts;
}
