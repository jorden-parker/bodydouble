import { describe, expect, it } from "vitest";
import { recordPrompt } from "./prompt-reuse";

describe("recordPrompt", () => {
  it("counts the characters the server still holds from the previous prompt to the same server", () => {
    expect(recordPrompt("reuse-test-server", "tools system messages one")).toBe(0);
    expect(recordPrompt("reuse-test-server", "tools system messages two")).toBe(
      "tools system messages ".length,
    );
  });

  it("starts from nothing for a different server", () => {
    expect(recordPrompt("reuse-test-other", "tools system messages one")).toBe(0);
  });
});
