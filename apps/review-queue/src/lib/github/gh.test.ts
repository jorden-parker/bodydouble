import { describe, expect, it } from "vitest";
import { CommandError, type RunOptions } from "@/lib/exec";
import {
  getPullRequest,
  listReviewComments,
  listLinkedIssues,
  loadQueue,
  listPullRequestFacts,
  listReviews,
  postReplyToReviewComment,
  submitReview,
  viewerLogin,
} from "./gh";

type Call = { command: string; args: string[]; options?: RunOptions };

function fakeRunner(output: string) {
  const calls: Call[] = [];
  const run = async (command: string, args: string[], options?: RunOptions) => {
    calls.push({ command, args, options });
    return output;
  };
  return { run, calls };
}

const REF = { owner: "acme", repo: "app", number: 7 };

const noCache = { getCached: () => null, setCached: () => {} };

describe("github", () => {
  it("reads PR metadata from the REST API", async () => {
    const body = JSON.stringify({
      title: "Add cache",
      body: null,
      body_html: "<p>Adds a cache</p>",
      html_url: "https://github.com/acme/app/pull/7",
      user: { login: "sam" },
      base: { ref: "main", sha: "base1" },
      head: { ref: "cache", sha: "abc" },
      state: "open",
      merged: false,
      additions: 10,
      deletions: 2,
      changed_files: 3,
    });
    const { run, calls } = fakeRunner(`HTTP/2.0 200 OK\r\nEtag: "e1"\r\n\r\n${body}`);
    const pr = await getPullRequest(REF, noCache, run);
    expect(calls[0].args).toEqual([
      "api",
      "-i",
      "repos/acme/app/pulls/7",
      "-H",
      "Accept: application/vnd.github.full+json",
    ]);
    expect(pr).toEqual({
      ref: REF,
      title: "Add cache",
      body: "",
      bodyHtml: "<p>Adds a cache</p>",
      url: "https://github.com/acme/app/pull/7",
      author: "sam",
      baseRef: "main",
      baseSha: "base1",
      headRef: "cache",
      headSha: "abc",
      state: "open",
      additions: 10,
      deletions: 2,
      changedFiles: 3,
    });
  });

  it("tells a merged pull request from one closed without merging", async () => {
    const stateOf = async (fields: { state: string; merged: boolean }) => {
      const body = JSON.stringify({
        base: { ref: "main", sha: "base1" },
        head: { ref: "cache", sha: "abc" },
        ...fields,
      });
      const { run } = fakeRunner(`HTTP/2.0 200 OK\r\n\r\n${body}`);
      return (await getPullRequest(REF, noCache, run)).state;
    };
    expect(await stateOf({ state: "closed", merged: true })).toBe("merged");
    expect(await stateOf({ state: "closed", merged: false })).toBe("closed");
    expect(await stateOf({ state: "open", merged: false })).toBe("open");
  });

  it("submits a review with line comments through the API", async () => {
    const created = { id: 42, html_url: "https://github.com/acme/app/pull/7#pullrequestreview-42" };
    const { run, calls } = fakeRunner(JSON.stringify(created));
    const posted = await submitReview(
      REF,
      {
        event: "COMMENT",
        body: "Looks good",
        commitId: "abc",
        comments: [{ path: "a.ts", line: 3, side: "RIGHT", body: "nit: rename" }],
      },
      run,
    );
    expect(posted).toEqual({ id: 42, url: created.html_url });
    expect(calls[0].args).toEqual([
      "api",
      "--method",
      "POST",
      "repos/acme/app/pulls/7/reviews",
      "--input",
      "-",
    ]);
    expect(JSON.parse(calls[0].options?.input ?? "")).toEqual({
      event: "COMMENT",
      body: "Looks good",
      commit_id: "abc",
      comments: [{ path: "a.ts", line: 3, side: "RIGHT", body: "nit: rename" }],
    });
  });

  it("posts a deleted-line comment on the old side and a range with its start", async () => {
    const created = { id: 43, html_url: "https://github.com/acme/app/pull/7#pullrequestreview-43" };
    const { run, calls } = fakeRunner(JSON.stringify(created));
    await submitReview(
      REF,
      {
        event: "COMMENT",
        body: "",
        commitId: "abc",
        comments: [
          { path: "a.ts", line: 6, side: "LEFT", body: "why removed?" },
          { path: "a.ts", line: 9, side: "RIGHT", startLine: 4, body: "one helper" },
        ],
      },
      run,
    );
    expect(JSON.parse(calls[0].options?.input ?? "").comments).toEqual([
      { path: "a.ts", line: 6, side: "LEFT", body: "why removed?" },
      {
        path: "a.ts",
        line: 9,
        side: "RIGHT",
        start_line: 4,
        start_side: "RIGHT",
        body: "one helper",
      },
    ]);
  });

  it("posts a reply to a review comment through the API", async () => {
    const created = { id: 77, html_url: "https://github.com/acme/app/pull/7#discussion_r77" };
    const { run, calls } = fakeRunner(JSON.stringify(created));
    const posted = await postReplyToReviewComment(REF, 5, "Thanks", run);
    expect(posted).toEqual({ id: 77, url: created.html_url });
    expect(calls[0].args).toEqual([
      "api",
      "--method",
      "POST",
      "repos/acme/app/pulls/7/comments/5/replies",
      "--input",
      "-",
    ]);
    expect(JSON.parse(calls[0].options?.input ?? "")).toEqual({ body: "Thanks" });
  });

  it("reads the signed-in login from the user endpoint", async () => {
    const { run, calls } = fakeRunner(JSON.stringify({ login: "jorden", id: 1 }));
    expect(await viewerLogin(run)).toBe("jorden");
    expect(calls[0].args).toEqual(["api", "user"]);
  });

  it("refuses a user response without a login", async () => {
    const { run } = fakeRunner(JSON.stringify({ id: 1 }));
    await expect(viewerLogin(run)).rejects.toThrow("no login");
  });

  it("passes a failed reply call on to the caller", async () => {
    const run = async () => {
      throw new Error("gh api failed");
    };
    await expect(postReplyToReviewComment(REF, 5, "Thanks", run)).rejects.toThrow("gh api failed");
  });

  it("lists inline review comments, including replies and outdated ones", async () => {
    const { run, calls } = fakeRunner(
      `HTTP/2.0 200 OK\r\n\r\n${JSON.stringify([
        {
          id: 1,
          in_reply_to_id: null,
          path: "a.ts",
          line: 3,
          side: "RIGHT",
          user: { login: "sam" },
          body: "Rename this",
          html_url: "https://github.com/acme/app/pull/7#discussion_r1",
          created_at: "2026-10-01T10:00:00Z",
          pull_request_review_id: 9,
        },
        {
          id: 2,
          in_reply_to_id: 1,
          path: "a.ts",
          line: null,
          original_line: 3,
          side: "LEFT",
          user: null,
          body: "Done",
          html_url: "https://github.com/acme/app/pull/7#discussion_r2",
          created_at: "2026-10-02T10:00:00Z",
          pull_request_review_id: 10,
        },
      ])}`,
    );
    expect(await listReviewComments(REF, noCache, run)).toEqual([
      {
        id: 1,
        inReplyTo: null,
        path: "a.ts",
        line: 3,
        side: "RIGHT",
        author: "sam",
        body: "Rename this",
        url: "https://github.com/acme/app/pull/7#discussion_r1",
        createdAt: "2026-10-01T10:00:00Z",
      },
      {
        id: 2,
        inReplyTo: 1,
        path: "a.ts",
        line: null,
        side: "LEFT",
        author: "",
        body: "Done",
        url: "https://github.com/acme/app/pull/7#discussion_r2",
        createdAt: "2026-10-02T10:00:00Z",
      },
    ]);
    expect(calls[0].args).toEqual([
      "api",
      "-i",
      "repos/acme/app/pulls/7/comments?per_page=100&page=1",
    ]);
  });

  it("lists reviews with their state and submission time", async () => {
    const { run, calls } = fakeRunner(
      `HTTP/2.0 200 OK\r\n\r\n${JSON.stringify([
        {
          id: 9,
          user: { login: "sam" },
          state: "CHANGES_REQUESTED",
          body: "Please split this",
          html_url: "https://github.com/acme/app/pull/7#pullrequestreview-9",
          submitted_at: "2026-10-01T11:00:00Z",
          commit_id: "abc",
        },
        {
          id: 10,
          user: { login: "kim" },
          state: "PENDING",
          body: "",
          html_url: "https://github.com/acme/app/pull/7#pullrequestreview-10",
          submitted_at: null,
          commit_id: "def",
        },
      ])}`,
    );
    expect(await listReviews(REF, noCache, run)).toEqual([
      {
        id: 9,
        author: "sam",
        state: "CHANGES_REQUESTED",
        body: "Please split this",
        url: "https://github.com/acme/app/pull/7#pullrequestreview-9",
        submittedAt: "2026-10-01T11:00:00Z",
        commitId: "abc",
      },
      {
        id: 10,
        author: "kim",
        state: "PENDING",
        body: "",
        url: "https://github.com/acme/app/pull/7#pullrequestreview-10",
        submittedAt: null,
        commitId: "def",
      },
    ]);
    expect(calls[0].args).toEqual(["api", "-i", "repos/acme/app/pulls/7/reviews?per_page=100"]);
  });
});

describe("listLinkedIssues", () => {
  const closingIssue = (
    owner: string,
    repo: string,
    number: number,
    title: string,
    state: "OPEN" | "CLOSED",
    bodyHTML: string,
  ) => ({
    number,
    title,
    state,
    url: `https://github.com/${owner}/${repo}/issues/${number}`,
    bodyHTML,
    repository: { name: repo, owner: { login: owner } },
  });

  const closingResponse = (nodes: unknown[]) =>
    JSON.stringify({
      data: { repository: { pullRequest: { closingIssuesReferences: { nodes } } } },
    });

  it("lists the issues a PR closes with their rendered bodies in one GitHub call", async () => {
    const { run, calls } = fakeRunner(
      closingResponse([
        closingIssue("acme", "app", 12, "Crash on save", "OPEN", "<p>It crashes</p>"),
        closingIssue("other", "lib", 30, "Lib", "CLOSED", ""),
      ]),
    );
    const issues = await listLinkedIssues(REF, run);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(0, 2)).toEqual(["api", "graphql"]);
    expect(calls[0].args).toEqual(expect.arrayContaining(["owner=acme", "repo=app", "number=7"]));
    expect(issues).toEqual([
      {
        owner: "acme",
        repo: "app",
        number: 12,
        title: "Crash on save",
        state: "open",
        url: "https://github.com/acme/app/issues/12",
        bodyHtml: "<p>It crashes</p>",
      },
      {
        owner: "other",
        repo: "lib",
        number: 30,
        title: "Lib",
        state: "closed",
        url: "https://github.com/other/lib/issues/30",
        bodyHtml: "",
      },
    ]);
  });

  it("skips a reference whose owner is not a safe name", async () => {
    const { run } = fakeRunner(closingResponse([closingIssue("..", "app", 5, "T", "OPEN", "")]));
    expect(await listLinkedIssues(REF, run)).toEqual([]);
  });

  it("drops an issue that cannot be read without failing the others", async () => {
    const { run } = fakeRunner(
      closingResponse([closingIssue("acme", "app", 12, "Crash", "OPEN", "<p>x</p>"), null]),
    );
    const issues = await listLinkedIssues(REF, run);
    expect(issues.map((issue) => issue.number)).toEqual([12]);
  });

  it("asks for at most three issues", async () => {
    const { run, calls } = fakeRunner(closingResponse([]));
    await listLinkedIssues(REF, run);
    expect(calls[0].args.join(" ")).toContain("closingIssuesReferences(first: 3)");
  });
});

const rawFacts = (overrides: object = {}) => ({
  additions: 212,
  deletions: 48,
  changedFiles: 9,
  headRefOid: "f".repeat(40),
  createdAt: "2026-11-01T09:00:00Z",
  closed: false,
  commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS" } } }] },
  ...overrides,
});

function failingWith(reason: string, printed: object | null) {
  return async (command: string, args: string[]): Promise<string> => {
    throw new CommandError(command, args, reason, printed === null ? "" : JSON.stringify(printed));
  };
}

describe("loadQueue", () => {
  const listed = (number: number, overrides: object = {}) => ({
    number,
    title: `PR ${number}`,
    url: `https://github.com/acme/app/pull/${number}`,
    updatedAt: "2026-10-01T00:00:00Z",
    repository: { nameWithOwner: "acme/app" },
    author: { __typename: "User", login: "sam" },
    ...overrides,
  });

  const everyList = (overrides: object = {}) => ({
    waiting: { nodes: [listed(7)] },
    others: { nodes: [listed(8)] },
    dependabot: {
      nodes: [
        listed(9, { title: "Bump lodash", author: { __typename: "Bot", login: "dependabot" } }),
      ],
    },
    smartling: { nodes: [] },
    repository0: { id: "R_1" },
    repository1: { id: "R_2" },
    ...overrides,
  });

  const REPOSITORIES = ["acme/app", "acme/lib"];

  it("loads every Queue list in one GitHub call", async () => {
    const { run, calls } = fakeRunner(JSON.stringify({ data: everyList() }));
    const lists = await loadQueue(REPOSITORIES, run);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(0, 3)).toEqual(["api", "graphql", "-f"]);
    const query = calls[0].args[3];
    expect(query).toContain(
      'waiting: search(query: "is:pr is:open draft:false review-requested:@me", type: ISSUE, first: 100)',
    );
    expect(query).toContain(
      'others: search(query: "is:pr is:open draft:false repo:acme/app repo:acme/lib -author:app/dependabot -author:app/smartling-github-connector"',
    );
    expect(query).toContain(
      'dependabot: search(query: "is:pr is:open draft:false repo:acme/app repo:acme/lib author:app/dependabot"',
    );
    expect(query).toContain(
      'smartling: search(query: "is:pr is:open draft:false repo:acme/app repo:acme/lib author:app/smartling-github-connector"',
    );
    expect(query).toContain('repository1: repository(owner: "acme", name: "lib") { id }');
    expect(lists.waiting).toEqual([
      {
        ref: REF,
        title: "PR 7",
        url: "https://github.com/acme/app/pull/7",
        author: "sam",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ]);
    expect(lists.others).toHaveLength(1);
    expect(lists.dependabot).toMatchObject([
      { ref: { owner: "acme", repo: "app", number: 9 }, author: "dependabot[bot]" },
    ]);
    expect(lists.smartling).toEqual([]);
  });

  it("leaves the slow size and checks fields out, so a long list cannot time the request out", async () => {
    const { run, calls } = fakeRunner(JSON.stringify({ data: everyList() }));
    await loadQueue(REPOSITORIES, run);
    expect(calls[0].args[3]).not.toMatch(/additions|statusCheckRollup|reviewDecision/);
  });

  it("searches only for review requests when no repositories are picked", async () => {
    const { run, calls } = fakeRunner(JSON.stringify({ data: { waiting: { nodes: [] } } }));
    const lists = await loadQueue([], run);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[3]).not.toContain("others:");
    expect(lists).toEqual({ waiting: [], others: [], dependabot: [], smartling: [] });
  });

  it("keeps the lists GitHub answered and explains the one it could not", async () => {
    const run = failingWith("gh: Something went wrong", {
      data: everyList({ others: null }),
      errors: [{ message: "Something went wrong", path: ["others"] }],
    });
    const lists = await loadQueue(REPOSITORIES, run);
    expect(lists.waiting).toHaveLength(1);
    expect(lists.dependabot).toHaveLength(1);
    expect(lists.others).toEqual(
      new Error(
        "GitHub could not list the open pull requests of your repositories, so they are missing here. Something went wrong",
      ),
    );
  });

  it("fails the repository lists, naming a repository GitHub cannot find", async () => {
    const run = failingWith("gh: Could not resolve to a Repository", {
      data: everyList({ repository1: null }),
      errors: [{ message: "Could not resolve to a Repository", path: ["repository1"] }],
    });
    const lists = await loadQueue(REPOSITORIES, run);
    const missing = new Error(
      "GitHub could not find acme/lib, or your login cannot see it, so the pull requests of your repositories are missing here. Fix the repository list in Settings.",
    );
    expect(lists.waiting).toHaveLength(1);
    expect(lists.others).toEqual(missing);
    expect(lists.dependabot).toEqual(missing);
    expect(lists.smartling).toEqual(missing);
  });

  it("says the Queue was not loaded when GitHub does not answer at all", async () => {
    const run = failingWith("gh: API rate limit exceeded for user ID 1", null);
    await expect(loadQueue(REPOSITORIES, run)).rejects.toThrow(
      "GitHub did not answer, so the Queue could not be loaded. gh: API rate limit exceeded for user ID 1",
    );
  });
});

describe("listPullRequestFacts", () => {
  it("keeps the facts GitHub returned when one PR cannot be found", async () => {
    const run = failingWith("gh: Could not resolve to a Repository", {
      data: { pr0: { pullRequest: rawFacts() }, pr1: null },
      errors: [{ message: "Could not resolve to a Repository", path: ["pr1"] }],
    });
    const facts = await listPullRequestFacts([REF, { owner: "gone", repo: "x", number: 1 }], run);
    expect(Object.keys(facts)).toEqual(["acme/app#7"]);
  });

  it("asks for at most 50 PRs per call and keeps the calls that answered", async () => {
    const refs = Array.from({ length: 230 }, (_unused, index) => ({ ...REF, number: index + 1 }));
    const sizes: number[] = [];
    const run = async (_command: string, args: string[]) => {
      const size = args[3].match(/pullRequest\(/g)?.length ?? 0;
      sizes.push(size);
      if (size === 30) throw new Error("gh: HTTP 502");
      return JSON.stringify({
        data: Object.fromEntries(
          Array.from({ length: size }, (_unused, index) => [
            `pr${index}`,
            { pullRequest: rawFacts() },
          ]),
        ),
      });
    };
    const facts = await listPullRequestFacts(refs, run);
    expect(sizes).toEqual([50, 50, 50, 50, 30]);
    expect(Object.keys(facts)).toHaveLength(200);
    expect(facts["acme/app#200"]).toBeDefined();
    expect(facts["acme/app#201"]).toBeUndefined();
  });

  it("fails when no call for facts is answered", async () => {
    const run = failingWith("gh: HTTP 502", null);
    await expect(listPullRequestFacts([REF], run)).rejects.toThrow("gh: HTTP 502");
  });

  it("does not ask for the review decision, which nothing shows", async () => {
    const { run, calls } = fakeRunner(
      JSON.stringify({ data: { pr0: { pullRequest: rawFacts() } } }),
    );
    const facts = await listPullRequestFacts([REF], run);
    expect(calls[0].args[3]).not.toContain("reviewDecision");
    expect(facts["acme/app#7"]).not.toHaveProperty("reviewDecision");
  });

  it("returns the facts of each PR, keyed by PR, in one GraphQL call", async () => {
    const { run, calls } = fakeRunner(
      JSON.stringify({
        data: {
          pr0: { pullRequest: rawFacts() },
          pr1: { pullRequest: rawFacts({ closed: true }) },
          pr2: null,
        },
      }),
    );
    const facts = await listPullRequestFacts(
      [REF, { owner: "acme", repo: "web", number: 3 }, { owner: "gone", repo: "x", number: 1 }],
      run,
    );
    expect(facts).toEqual({
      "acme/app#7": {
        additions: 212,
        deletions: 48,
        changedFiles: 9,
        headSha: "f".repeat(40),
        checks: "passing",
        createdAt: "2026-11-01T09:00:00Z",
        isClosed: false,
      },
      "acme/web#3": expect.objectContaining({ isClosed: true }),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(0, 3)).toEqual(["api", "graphql", "-f"]);
    expect(calls[0].args[3]).toContain(
      'pr0: repository(owner: "acme", name: "app") { pullRequest(number: 7) {',
    );
    expect(calls[0].args[3]).toMatch(/createdAt closed\b/);
  });

  it("maps the checks rollup to passing, running, failing or none", async () => {
    const states: [string | null, string][] = [
      ["SUCCESS", "passing"],
      ["PENDING", "running"],
      ["EXPECTED", "running"],
      ["FAILURE", "failing"],
      ["ERROR", "failing"],
      [null, "none"],
    ];
    for (const [state, checks] of states) {
      const rollup = state === null ? null : { state };
      const { run } = fakeRunner(
        JSON.stringify({
          data: {
            pr0: {
              pullRequest: rawFacts({
                commits: { nodes: [{ commit: { statusCheckRollup: rollup } }] },
              }),
            },
          },
        }),
      );
      const facts = await listPullRequestFacts([REF], run);
      expect(facts["acme/app#7"]?.checks).toBe(checks);
    }
  });

  it("skips the call when there are no PRs", async () => {
    const { run, calls } = fakeRunner("");
    expect(await listPullRequestFacts([], run)).toEqual({});
    expect(calls).toHaveLength(0);
  });
});
