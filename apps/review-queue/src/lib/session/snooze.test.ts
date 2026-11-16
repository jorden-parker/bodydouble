import { describe, expect, it } from "vitest";
import { isSnoozed, tomorrowMidnight } from "./snooze";

const NOW = new Date(2026, 10, 16, 15).getTime();

describe("isSnoozed", () => {
  it("stays snoozed until the time passes", () => {
    expect(isSnoozed({ at: new Date(NOW + 1000).toISOString() }, "sha1", NOW)).toBe(true);
    expect(isSnoozed({ at: new Date(NOW - 1000).toISOString() }, "sha1", NOW)).toBe(false);
  });

  it("stays snoozed until the head moves off the commit it was snoozed on", () => {
    expect(isSnoozed({ headSha: "sha1" }, "sha1", NOW)).toBe(true);
    expect(isSnoozed({ headSha: "sha1" }, "sha2", NOW)).toBe(false);
  });
});

describe("tomorrowMidnight", () => {
  it("is the next local midnight", () => {
    expect(tomorrowMidnight(new Date(NOW))).toBe(new Date(2026, 10, 17).toISOString());
  });
});
