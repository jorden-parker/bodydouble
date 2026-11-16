import { describe, expect, it } from "vitest";
import type { Runner } from "@/lib/exec";
import { fetchLogin, MAX_SEARCH_PAGES, searchAll } from "./search";

describe("fetchLogin", () => {
  it("asks GitHub once per runner", async () => {
    let userCalls = 0;
    const run: Runner = async () => {
      userCalls += 1;
      return "jorden-parker\n";
    };

    const logins = await Promise.all([fetchLogin(run), fetchLogin(run)]);
    await fetchLogin(run);

    expect(logins).toEqual(["jorden-parker", "jorden-parker"]);
    expect(userCalls).toBe(1);
  });

  it("asks again after a failed lookup", async () => {
    let userCalls = 0;
    const run: Runner = async () => {
      userCalls += 1;
      if (userCalls === 1) throw new Error("gh api user failed");
      return "jorden-parker\n";
    };

    await expect(fetchLogin(run)).rejects.toThrow("gh api user failed");
    expect(await fetchLogin(run)).toBe("jorden-parker");
  });
});

describe("searchAll", () => {
  it("stops after the page limit even when GitHub reports more pages", async () => {
    let pageCalls = 0;
    const run: Runner = async () => {
      pageCalls += 1;
      return JSON.stringify({
        data: {
          search: { pageInfo: { hasNextPage: true, endCursor: `cursor-${pageCalls}` }, nodes: [1] },
        },
      });
    };

    const nodes = await searchAll<number>(run, "query", {});

    expect(pageCalls).toBe(MAX_SEARCH_PAGES);
    expect(nodes).toHaveLength(MAX_SEARCH_PAGES);
  });
});
