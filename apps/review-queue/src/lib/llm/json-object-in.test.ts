import { describe, expect, it } from "vitest";
import { jsonObjectIn } from "./client";

describe("jsonObjectIn", () => {
  it("reads a clean object surrounded by prose", () => {
    expect(jsonObjectIn('Here you go: {"what": "call f(x)"} Thanks.')).toEqual({
      what: "call f(x)",
    });
  });

  it("repairs the reply a small model ends with a stray bracket and no closing brace", () => {
    const reply = '{"what": "Adds a lookup.", "checks": ["Returns null.", "Stays internal.")]';
    expect(jsonObjectIn(reply)).toEqual({
      what: "Adds a lookup.",
      checks: ["Returns null.", "Stays internal."],
    });
  });

  it("closes a reply that was cut off inside a list", () => {
    expect(jsonObjectIn('{"what": "Adds a lookup.", "checks": ["Returns null.",')).toEqual({
      what: "Adds a lookup.",
      checks: ["Returns null."],
    });
  });

  it("closes a reply that was cut off inside a string", () => {
    expect(jsonObjectIn('{"what": "Adds a look')).toEqual({ what: "Adds a look" });
  });

  it("ignores prose after a repaired object", () => {
    expect(jsonObjectIn('{"checks": ["One.")]} Hope that helps (really).')).toEqual({
      checks: ["One."],
    });
  });

  it("fails when the reply holds no object at all", () => {
    expect(() => jsonObjectIn("I could not read the diff.")).toThrow("No JSON object in reply");
  });
});
