import { describe, expect, it } from "vitest";
import { formatDuration } from "./time";

describe("formatDuration", () => {
  it("writes minutes, hours and days with a non-breaking space before the unit", () => {
    expect(formatDuration(5 * 60_000)).toBe("5 min");
    expect(formatDuration(5 * 3_600_000)).toBe("5 h");
    expect(formatDuration(3 * 24 * 3_600_000)).toBe("3 d");
  });

  it("never shows less than one minute", () => {
    expect(formatDuration(0)).toBe("1 min");
  });
});
