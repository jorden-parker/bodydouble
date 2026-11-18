import { describe, expect, it } from "vitest";
import { CommandError, type Runner } from "@/lib/exec";
import { fetchLogin, MAX_SEARCH_PAGES, searchAll, type Search } from "./search";

function searchFor(label: string): Search {
  return { label, search: `is:pr ${label}`, fields: "url" };
}

function page(nodes: unknown[], endCursor: string | null = null) {
  return { pageInfo: { hasNextPage: endCursor !== null, endCursor }, nodes };
}

function argValue(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

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
  it("sends the searches started together as one request", async () => {
    const requests: string[][] = [];
    const run: Runner = async (_command, args) => {
      requests.push(args);
      return JSON.stringify({ data: { search0: page(["mine"]), search1: page(["theirs"]) } });
    };

    const found = await Promise.all([
      searchAll<string>(run, searchFor("mine")),
      searchAll<string>(run, searchFor("theirs")),
    ]);

    expect(found).toEqual([["mine"], ["theirs"]]);
    expect(requests).toHaveLength(1);
    expect(argValue(requests[0], "search0")).toBe("is:pr mine");
    expect(argValue(requests[0], "search1")).toBe("is:pr theirs");
    expect(argValue(requests[0], "query")).toContain("search1: search(query: $search1");
  });

  it("reads the next pages of every unfinished search in one request too", async () => {
    const requests: string[][] = [];
    const run: Runner = async (_command, args) => {
      requests.push(args);
      const isFirstRequest = requests.length === 1;
      return JSON.stringify({
        data: isFirstRequest
          ? { search0: page(["a1"], "cursor-a"), search1: page(["b1"], "cursor-b") }
          : { search0: page(["a2"]), search1: page(["b2"]) },
      });
    };

    const found = await Promise.all([
      searchAll<string>(run, searchFor("mine")),
      searchAll<string>(run, searchFor("theirs")),
    ]);

    expect(found).toEqual([
      ["a1", "a2"],
      ["b1", "b2"],
    ]);
    expect(requests).toHaveLength(2);
    expect(argValue(requests[1], "after0")).toBe("cursor-a");
    expect(argValue(requests[1], "after1")).toBe("cursor-b");
  });

  it("keeps the searches GitHub answered and names the one it could not", async () => {
    const run: Runner = async (command, args) => {
      throw new CommandError(
        command,
        args,
        "gh: Something went wrong",
        JSON.stringify({
          data: { search0: page(["mine"]), search1: null },
          errors: [{ message: "Something went wrong", path: ["search1"] }],
        }),
      );
    };

    const [mine, theirs] = await Promise.allSettled([
      searchAll<string>(run, searchFor("mine")),
      searchAll<string>(run, searchFor("theirs")),
    ]);

    expect(mine).toEqual({ status: "fulfilled", value: ["mine"] });
    expect(theirs).toMatchObject({
      status: "rejected",
      reason: {
        message:
          "The search for theirs failed, so that part was not refreshed. Something went wrong",
      },
    });
  });

  it("says nothing was refreshed when GitHub does not answer at all", async () => {
    const run: Runner = async (command, args) => {
      throw new CommandError(command, args, "gh: API rate limit exceeded for user ID 1", "");
    };

    const outcomes = await Promise.allSettled([
      searchAll<string>(run, searchFor("mine")),
      searchAll<string>(run, searchFor("theirs")),
    ]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(["rejected", "rejected"]);
    expect(outcomes[0]).toMatchObject({
      reason: {
        message:
          "The request failed, so nothing from GitHub was refreshed and the last sync is still shown. gh: API rate limit exceeded for user ID 1",
      },
    });
  });

  it("sends the searches apart once GitHub times the shared request out, and keeps doing so", async () => {
    const requestSizes: number[] = [];
    const run: Runner = async (command, args) => {
      const size = args.filter((arg) => /^search\d+=/.test(arg)).length;
      requestSizes.push(size);
      if (size > 1) throw new CommandError(command, args, "gh: HTTP 502", "");
      return JSON.stringify({ data: { search0: page([argValue(args, "search0")]) } });
    };
    const searchBoth = () =>
      Promise.all([
        searchAll<string>(run, searchFor("mine")),
        searchAll<string>(run, searchFor("theirs")),
      ]);

    expect(await searchBoth()).toEqual([["is:pr mine"], ["is:pr theirs"]]);
    expect(requestSizes).toEqual([2, 1, 1]);

    expect(await searchBoth()).toEqual([["is:pr mine"], ["is:pr theirs"]]);
    expect(requestSizes).toEqual([2, 1, 1, 1, 1]);
  });

  it("stops after the page limit even when GitHub reports more pages", async () => {
    let pageCalls = 0;
    const run: Runner = async () => {
      pageCalls += 1;
      return JSON.stringify({ data: { search0: page([1], `cursor-${pageCalls}`) } });
    };

    const nodes = await searchAll<number>(run, searchFor("mine"));

    expect(pageCalls).toBe(MAX_SEARCH_PAGES);
    expect(nodes).toHaveLength(MAX_SEARCH_PAGES);
  });
});
