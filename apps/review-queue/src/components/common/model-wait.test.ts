import { describe, expect, it } from "vitest";
import { waitView } from "./model-wait";

const NBSP = " ";

describe("waitView", () => {
  it("says something true before the first record arrives", () => {
    expect(waitView(null, 0)).toEqual({
      label: "Sending to the model",
      detail: "Waiting for its first word",
      percent: null,
    });
  });

  it("says how many turns are ahead", () => {
    expect(waitView({ phase: "queued", ahead: 2 }, 0)).toMatchObject({
      label: "Queued",
      detail: `Behind 2${NBSP}turns`,
    });
    expect(waitView({ phase: "queued", ahead: 1 }, 0).detail).toBe(`Behind 1${NBSP}turn`);
  });

  it("shows the prompt size and the seconds left while reading, with progress", () => {
    const view = waitView(
      { phase: "reading", promptTokens: 4100, seconds: 25, isEstimate: false },
      5,
    );
    expect(view).toEqual({
      label: "Reading",
      detail: `4,100${NBSP}tokens${NBSP}· about${NBSP}20${NBSP}s`,
      percent: 20,
    });
  });

  it("names the lookup, the round and the budget", () => {
    expect(
      waitView(
        {
          phase: "looking-up",
          tool: "find_references",
          label: "Callers of `freshToken` (2)",
          paths: [],
          round: 2,
          budget: 4,
        },
        0,
      ),
    ).toEqual({
      label: "Looking up",
      detail: `Callers of freshToken (2)${NBSP}· round${NBSP}2${NBSP}of${NBSP}4`,
      percent: 50,
    });
  });

  it("says the lookups are used up while the answer is written", () => {
    expect(waitView({ phase: "budget-ended", budget: 4 }, 0)).toMatchObject({
      label: "Lookups done",
      detail: `All 4${NBSP}lookups used, writing the answer`,
    });
  });

  it("gives the writing speed, marks a guess, and the seconds left at most", () => {
    expect(
      waitView({ phase: "writing", tokensPerSecond: 13, isMeasured: false, maxSeconds: 30 }, 10),
    ).toEqual({
      label: "Writing",
      detail: `13${NBSP}tokens/s, a guess until measured${NBSP}· at most about${NBSP}20${NBSP}s${NBSP}left`,
      percent: 33,
    });
  });

  it("drops the guess once the speed has been measured", () => {
    expect(
      waitView({ phase: "writing", tokensPerSecond: 13, isMeasured: true, maxSeconds: 30 }, 0)
        .detail,
    ).toBe(`13${NBSP}tokens/s${NBSP}· at most about${NBSP}30${NBSP}s${NBSP}left`);
  });
});
