import { describe, expect, it } from "vitest";
import { addedHunk, removedHunk } from "@/test/diff-builders";
import { linesInRange, orderedRange, targetCommentLine, targetPath } from "./assist-protocol";

const HUNKS = [addedHunk(["a1", "a2", "a3"], 1), addedHunk(["b1", "b2"], 20)];

describe("orderedRange", () => {
  it("orders a selection made bottom-up", () => {
    const range = orderedRange(
      { path: "a.ts", hunk: 1, line: 0 },
      { path: "a.ts", hunk: 0, line: 2 },
    );
    expect(range).toEqual({ path: "a.ts", from: { hunk: 0, line: 2 }, to: { hunk: 1, line: 0 } });
  });

  it("refuses a selection across files", () => {
    expect(
      orderedRange({ path: "a.ts", hunk: 0, line: 0 }, { path: "b.ts", hunk: 0, line: 0 }),
    ).toBeNull();
  });
});

describe("linesInRange", () => {
  it("slices across hunks", () => {
    const lines = linesInRange(HUNKS, { hunk: 0, line: 1 }, { hunk: 1, line: 0 });
    expect(lines.map((line) => line.text)).toEqual(["a2", "a3", "b1"]);
  });
});

function lines(from: [number, number], to: [number, number], path = "src/a.ts") {
  return {
    kind: "lines" as const,
    range: { path, from: { hunk: from[0], line: from[1] }, to: { hunk: to[0], line: to[1] } },
  };
}

const WHOLE_FILE = { kind: "file" as const, path: "src/a.ts" };

describe("targetPath", () => {
  it("is the path of a line range", () => {
    expect(targetPath(lines([0, 0], [0, 0], "src/b.ts"))).toBe("src/b.ts");
  });

  it("is the path of a whole file", () => {
    expect(targetPath(WHOLE_FILE)).toBe("src/a.ts");
  });
});

describe("targetCommentLine", () => {
  it("is the last new-side line", () => {
    expect(targetCommentLine(HUNKS, lines([0, 0], [1, 1]))).toBe(21);
  });

  it("is null when only removed lines are selected", () => {
    expect(targetCommentLine([removedHunk(["gone"])], lines([0, 0], [0, 0]))).toBeNull();
  });

  it("is null for a whole file", () => {
    expect(targetCommentLine(HUNKS, WHOLE_FILE)).toBeNull();
  });
});
