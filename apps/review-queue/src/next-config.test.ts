import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("next config", () => {
  it("sends the old Dependabot and Smartling pages to the filtered queue", async () => {
    expect(await nextConfig.redirects?.()).toEqual([
      { source: "/dependabot", destination: "/?bots=dependabot", permanent: false },
      { source: "/smartling", destination: "/?bots=smartling", permanent: false },
    ]);
  });
});
