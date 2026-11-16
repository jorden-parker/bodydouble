import { describe, expect, it } from "vitest";
import type { AssistTarget } from "@/lib/assist-protocol";
import { addedHunk } from "@/test/diff-builders";
import { targetChipOf } from "./target-chip";

const NBSP = " ";
const HUNKS = [addedHunk(["a", "b", "c", "d", "e", "f"], 56)];
const RANGE = { path: "src/store.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 5 } };

describe("targetChipOf", () => {
  it("names the path and the lines of a selection", () => {
    const target: AssistTarget = { kind: "lines", range: RANGE };
    expect(targetChipOf(target, HUNKS, null)).toEqual({ path: "src/store.ts", text: "L56–61" });
  });

  it("names a single line by its number", () => {
    const target: AssistTarget = {
      kind: "lines",
      range: { ...RANGE, to: { hunk: 0, line: 0 } },
    };
    expect(targetChipOf(target, HUNKS, null).text).toBe("L56");
  });

  it("names a whole file", () => {
    expect(targetChipOf({ kind: "file", path: "src/store.ts" }, HUNKS, null)).toEqual({
      path: "src/store.ts",
      text: "whole file",
    });
  });

  it("names a step check by the step's number and the check's", () => {
    const target: AssistTarget = { kind: "check", stepId: "s3", check: 1, path: "src/store.ts" };
    expect(targetChipOf(target, [], 3)).toEqual({
      path: null,
      text: `Step${NBSP}3${NBSP}· check${NBSP}2`,
    });
  });
});
