import { describe, expect, it } from "vitest";
import { bumpCounts, bumpFrom } from "./bump";

describe("bumpFrom", () => {
  it("reads the package, the versions and whether the bump is patch, minor or major", () => {
    expect(bumpFrom("Bump vite from 5.4.1 to 5.4.2")).toEqual({
      packageName: "vite",
      from: "5.4.1",
      to: "5.4.2",
      kind: "patch",
    });
    expect(bumpFrom("Bump lodash from 4.17.20 to 4.18.0")?.kind).toBe("minor");
    expect(bumpFrom("Bump react from 18.3.1 to 19.0.0")?.kind).toBe("major");
  });

  it("returns null for a title that is not a version bump", () => {
    expect(bumpFrom("Update translations")).toBeNull();
  });
});

describe("bumpCounts", () => {
  it("counts patch, minor and major bumps and the titles that are not bumps as other", () => {
    expect(
      bumpCounts([
        "Bump vite from 5.4.1 to 5.4.2",
        "Bump vite from 5.4.2 to 5.4.3",
        "Bump lodash from 4.17.20 to 4.18.0",
        "Bump react from 18.3.1 to 19.0.0",
        "Update translations",
      ]),
    ).toEqual({ patch: 2, minor: 1, major: 1, other: 1 });
  });
});
