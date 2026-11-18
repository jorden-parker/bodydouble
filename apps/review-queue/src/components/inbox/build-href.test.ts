import { describe, expect, it } from "vitest";
import { buildHref } from "./build-href";

describe("buildHref", () => {
  it("adds only the query values that are set", () => {
    expect(buildHref("/dependabot", { repository: "acme/app", sort: undefined })).toBe(
      "/dependabot?repository=acme%2Fapp",
    );
  });

  it("returns the bare path when no value is set", () => {
    expect(buildHref("/", { repository: undefined, sort: undefined })).toBe("/");
  });
});
