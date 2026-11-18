import { CommandError, type Runner } from "@/lib/exec";
import { conditionalGet, type EtagCache } from "./conditional-get";
import { githubRun } from "./github-guard";
import type { PullRequestRef } from "@/lib/types";
import { parsePullRequestRef, prKey } from "@/lib/pr-ref";

export type ReviewRequest = {
  ref: PullRequestRef;
  title: string;
  url: string;
  author: string;
  updatedAt: string;
};

type PullRequestState = "open" | "closed" | "merged";

export type PullRequest = {
  ref: PullRequestRef;
  title: string;
  body: string;
  bodyHtml: string;
  url: string;
  author: string;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  state: PullRequestState;
  additions: number;
  deletions: number;
  changedFiles: number;
};

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export type ReviewSubmission = {
  event: ReviewEvent;
  body: string;
  commitId: string;
  comments: {
    path: string;
    line: number;
    side: "LEFT" | "RIGHT";
    startLine?: number;
    body: string;
  }[];
};

const RENDERED_BODY = "Accept: application/vnd.github.full+json";

export const REVIEW_REQUEST_LIMIT = 100;

const BOT_AUTHORS = {
  dependabot: "app/dependabot",
  smartling: "app/smartling-github-connector",
};

export type PullRequestAuthorship = keyof typeof BOT_AUTHORS | "others";

type GraphQlAnswer = {
  data?: Record<string, unknown> | null;
  errors?: { message: string; path?: (string | number)[] }[];
};

function answerPrintedBy(failure: unknown): GraphQlAnswer | null {
  if (!(failure instanceof CommandError)) return null;
  try {
    return JSON.parse(failure.printed) as GraphQlAnswer;
  } catch {
    return null;
  }
}

function reasonOf(failure: unknown): string {
  if (failure instanceof CommandError) return failure.reason.trim();
  return failure instanceof Error ? failure.message : String(failure);
}

async function askGraphQl(query: string, run: Runner): Promise<GraphQlAnswer> {
  try {
    return JSON.parse(await run("gh", ["api", "graphql", "-f", `query=${query}`])) as GraphQlAnswer;
  } catch (failure) {
    const printed = answerPrintedBy(failure);
    if (printed?.data) return printed;
    throw new Error(
      `GitHub did not answer, so the Queue could not be loaded. ${reasonOf(failure)}`,
    );
  }
}

function errorAt(answer: GraphQlAnswer, alias: string): string {
  const errors = answer.errors ?? [];
  return (errors.find((error) => error.path?.[0] === alias) ?? errors[0])?.message ?? "";
}

export async function getPullRequest(
  ref: PullRequestRef,
  cache: EtagCache,
  run: Runner = githubRun,
): Promise<PullRequest> {
  const path = `repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`;
  const pull = JSON.parse(await conditionalGet(path, cache, run, [RENDERED_BODY]));
  return {
    ref,
    title: pull.title,
    body: pull.body ?? "",
    bodyHtml: pull.body_html ?? "",
    url: pull.html_url,
    author: pull.user?.login ?? "",
    baseRef: pull.base.ref,
    baseSha: pull.base.sha,
    headRef: pull.head.ref,
    headSha: pull.head.sha,
    state: pull.merged ? "merged" : pull.state,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changed_files,
  };
}

export type LinkedIssue = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: "open" | "closed";
  url: string;
  bodyHtml: string;
};

type ClosingIssue = {
  number: number;
  title: string;
  state: "OPEN" | "CLOSED";
  url: string;
  bodyHTML: string;
  repository: { name: string; owner: { login: string } };
};

const LINKED_ISSUE_LIMIT = 3;

const CLOSING_ISSUES_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      closingIssuesReferences(first: ${LINKED_ISSUE_LIMIT}) {
        nodes { number title state url bodyHTML repository { name owner { login } } }
      }
    }
  }
}`;

function linkedIssueFromClosing(issue: ClosingIssue): LinkedIssue[] {
  const issueRef = parsePullRequestRef(
    `${issue.repository.owner.login}/${issue.repository.name}#${issue.number}`,
  );
  if (!issueRef) return [];
  return [
    {
      owner: issueRef.owner,
      repo: issueRef.repo,
      number: issueRef.number,
      title: issue.title,
      state: issue.state === "OPEN" ? "open" : "closed",
      url: issue.url,
      bodyHtml: issue.bodyHTML,
    },
  ];
}

export async function listLinkedIssues(
  ref: PullRequestRef,
  run: Runner = githubRun,
): Promise<LinkedIssue[]> {
  const output = await run("gh", [
    "api",
    "graphql",
    "-f",
    `query=${CLOSING_ISSUES_QUERY}`,
    "-F",
    `owner=${ref.owner}`,
    "-F",
    `repo=${ref.repo}`,
    "-F",
    `number=${ref.number}`,
  ]);
  const { nodes } = (
    JSON.parse(output) as {
      data: {
        repository: {
          pullRequest: { closingIssuesReferences: { nodes: (ClosingIssue | null)[] } };
        };
      };
    }
  ).data.repository.pullRequest.closingIssuesReferences;
  return nodes.flatMap((issue) => (issue ? linkedIssueFromClosing(issue) : []));
}

export type ChecksState = "passing" | "running" | "failing" | "none";

export type PullRequestFacts = {
  additions: number;
  deletions: number;
  changedFiles: number;
  headSha: string;
  checks: ChecksState;
  createdAt: string;
  isClosed: boolean;
};

type RawFacts = {
  additions: number;
  deletions: number;
  changedFiles: number;
  headRefOid: string;
  createdAt: string;
  closed: boolean;
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] };
};

const FACTS_FIELDS = `additions deletions changedFiles headRefOid createdAt closed
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }`;

const CHECK_STATES: Record<string, ChecksState> = {
  SUCCESS: "passing",
  PENDING: "running",
  EXPECTED: "running",
  FAILURE: "failing",
  ERROR: "failing",
};

function buildFactsField(ref: PullRequestRef, index: number): string {
  const repository = `repository(owner: ${JSON.stringify(ref.owner)}, name: ${JSON.stringify(ref.repo)})`;
  return `pr${index}: ${repository} { pullRequest(number: ${ref.number}) { ${FACTS_FIELDS} } }`;
}

function factsFromRaw(raw: RawFacts): PullRequestFacts {
  const state = raw.commits.nodes[0]?.commit.statusCheckRollup?.state;
  return {
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    headSha: raw.headRefOid,
    checks: state ? (CHECK_STATES[state] ?? "none") : "none",
    createdAt: raw.createdAt,
    isClosed: raw.closed,
  };
}

const FACTS_PER_CALL = 50;

async function listFactsOf(
  refs: PullRequestRef[],
  run: Runner,
): Promise<[string, PullRequestFacts][]> {
  const answer = await askGraphQl(`query { ${refs.map(buildFactsField).join(" ")} }`, run);
  const found = (answer.data ?? {}) as Record<string, { pullRequest: RawFacts | null } | null>;
  return refs.flatMap((ref, index) => {
    const raw = found[`pr${index}`]?.pullRequest;
    return raw ? [[prKey(ref), factsFromRaw(raw)]] : [];
  });
}

function inGroupsOf<Entry>(entries: Entry[], size: number): Entry[][] {
  return Array.from({ length: Math.ceil(entries.length / size) }, (_unused, index) =>
    entries.slice(index * size, (index + 1) * size),
  );
}

export async function listPullRequestFacts(
  refs: PullRequestRef[],
  run: Runner = githubRun,
): Promise<Record<string, PullRequestFacts>> {
  if (refs.length === 0) return {};
  const answers = await Promise.allSettled(
    inGroupsOf(refs, FACTS_PER_CALL).map((group) => listFactsOf(group, run)),
  );
  const answered = answers.flatMap((answer) => (answer.status === "fulfilled" ? answer.value : []));
  const failure = answers.find((answer) => answer.status === "rejected");
  if (failure && answered.length === 0) throw failure.reason;
  return Object.fromEntries(answered);
}

export type QueueListName = "waiting" | PullRequestAuthorship;

export type QueueLists = Record<QueueListName, ReviewRequest[] | Error>;

type ListedPullRequest = {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  repository: { nameWithOwner: string };
  author: { __typename: string; login: string } | null;
};

const LISTED_FIELDS =
  "number title url updatedAt repository { nameWithOwner } author { __typename login }";

const OPEN_PULL_REQUESTS = "is:pr is:open draft:false";

const LIST_LABELS: Record<QueueListName, string> = {
  waiting: "the pull requests waiting on your review",
  others: "the open pull requests of your repositories",
  dependabot: "the Dependabot pull requests",
  smartling: "the Smartling pull requests",
};

function queueSearches(repositories: string[]): Partial<Record<QueueListName, string>> {
  const waiting = `${OPEN_PULL_REQUESTS} review-requested:@me`;
  if (repositories.length === 0) return { waiting };
  const inRepositories = [
    OPEN_PULL_REQUESTS,
    ...repositories.map((repository) => `repo:${repository}`),
  ].join(" ");
  const notByBots = Object.values(BOT_AUTHORS).map((author) => `-author:${author}`);
  return {
    waiting,
    others: [inRepositories, ...notByBots].join(" "),
    dependabot: `${inRepositories} author:${BOT_AUTHORS.dependabot}`,
    smartling: `${inRepositories} author:${BOT_AUTHORS.smartling}`,
  };
}

function buildSearchField([name, search]: [string, string]): string {
  return `${name}: search(query: ${JSON.stringify(search)}, type: ISSUE, first: ${REVIEW_REQUEST_LIMIT}) {
    nodes { ... on PullRequest { ${LISTED_FIELDS} } }
  }`;
}

function buildRepositoryField(repository: string, index: number): string {
  const [owner, name] = repository.split("/");
  return `repository${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { id }`;
}

function authorOf(author: ListedPullRequest["author"]): string {
  if (!author) return "";
  return author.__typename === "Bot" ? `${author.login}[bot]` : author.login;
}

function refOf(listed: ListedPullRequest): PullRequestRef {
  const [owner, repo] = listed.repository.nameWithOwner.split("/");
  return { owner, repo, number: listed.number };
}

function toReviewRequest(listed: ListedPullRequest): ReviewRequest {
  return {
    ref: refOf(listed),
    title: listed.title,
    url: listed.url,
    author: authorOf(listed.author),
    updatedAt: listed.updatedAt,
  };
}

function listedAt(answer: GraphQlAnswer, name: QueueListName): ListedPullRequest[] | null {
  const found = answer.data?.[name] as { nodes: Partial<ListedPullRequest>[] } | null | undefined;
  if (!found) return null;
  return found.nodes.filter((node): node is ListedPullRequest => node.number !== undefined);
}

function describeMissingRepositories(missing: string[]): string {
  return `GitHub could not find ${missing.join(", ")}, or your login cannot see it, so the pull requests of your repositories are missing here. Fix the repository list in Settings.`;
}

function describeFailedList(answer: GraphQlAnswer, name: QueueListName): string {
  return `GitHub could not list ${LIST_LABELS[name]}, so they are missing here. ${errorAt(answer, name)}`.trim();
}

export async function loadQueue(
  repositories: string[],
  run: Runner = githubRun,
): Promise<QueueLists> {
  const searches = queueSearches(repositories);
  const fields = [
    ...Object.entries(searches).map(buildSearchField),
    ...repositories.map(buildRepositoryField),
  ];
  const answer = await askGraphQl(`query {\n${fields.join("\n")}\n}`, run);
  const missing = repositories.flatMap((repository, index) =>
    answer.data?.[`repository${index}`] ? [] : [repository],
  );
  const lists: QueueLists = { waiting: [], others: [], dependabot: [], smartling: [] };
  for (const name of Object.keys(searches) as QueueListName[]) {
    lists[name] =
      name !== "waiting" && missing.length > 0
        ? new Error(describeMissingRepositories(missing))
        : (listedAt(answer, name)?.map(toReviewRequest) ??
          new Error(describeFailedList(answer, name)));
  }
  return lists;
}

export async function viewerLogin(run: Runner = githubRun): Promise<string> {
  const user = JSON.parse(await run("gh", ["api", "user"]));
  if (typeof user.login !== "string" || user.login === "") {
    throw new Error("GitHub user response has no login");
  }
  return user.login;
}

export async function submitReview(
  ref: PullRequestRef,
  review: ReviewSubmission,
  run: Runner = githubRun,
): Promise<{ id: number; url: string }> {
  const payload = {
    event: review.event,
    body: review.body,
    commit_id: review.commitId,
    comments: review.comments.map(toGitHubComment),
  };
  const output = await run(
    "gh",
    [
      "api",
      "--method",
      "POST",
      `repos/${ref.owner}/${ref.repo}/pulls/${ref.number}/reviews`,
      "--input",
      "-",
    ],
    { input: JSON.stringify(payload) },
  );
  const created = JSON.parse(output) as { id: number; html_url: string };
  return { id: created.id, url: created.html_url };
}

function toGitHubComment({ startLine, ...comment }: ReviewSubmission["comments"][number]) {
  if (startLine === undefined) return comment;
  return { ...comment, start_line: startLine, start_side: comment.side };
}

export async function postReplyToReviewComment(
  ref: PullRequestRef,
  commentId: number,
  body: string,
  run: Runner = githubRun,
): Promise<{ id: number; url: string }> {
  const output = await run(
    "gh",
    ["api", "--method", "POST", `${pullPath(ref)}/comments/${commentId}/replies`, "--input", "-"],
    { input: JSON.stringify({ body }) },
  );
  const created = JSON.parse(output) as { id: number; html_url: string };
  return { id: created.id, url: created.html_url };
}

export type ReviewComment = {
  id: number;
  inReplyTo: number | null;
  path: string;
  line: number | null;
  side: "LEFT" | "RIGHT";
  author: string;
  body: string;
  url: string;
  createdAt: string;
};

export type PostedReview = {
  id: number;
  author: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body: string;
  url: string;
  submittedAt: string | null;
  commitId: string;
};

type RawUser = { login: string } | null;

type RawReviewComment = {
  id: number;
  in_reply_to_id?: number | null;
  path: string;
  line: number | null;
  side: "LEFT" | "RIGHT";
  user: RawUser;
  body: string;
  html_url: string;
  created_at: string;
};

type RawReview = {
  id: number;
  user: RawUser;
  state: PostedReview["state"];
  body: string;
  html_url: string;
  submitted_at: string | null;
  commit_id: string;
};

export const CONVERSATION_PAGE_SIZE = 100;
export const CONVERSATION_MAX_PAGES = 5;

function pullPath(ref: PullRequestRef): string {
  return `repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`;
}

function toReviewComment(raw: RawReviewComment): ReviewComment {
  return {
    id: raw.id,
    inReplyTo: raw.in_reply_to_id ?? null,
    path: raw.path,
    line: raw.line,
    side: raw.side,
    author: raw.user?.login ?? "",
    body: raw.body,
    url: raw.html_url,
    createdAt: raw.created_at,
  };
}

function toPostedReview(raw: RawReview): PostedReview {
  return {
    id: raw.id,
    author: raw.user?.login ?? "",
    state: raw.state,
    body: raw.body,
    url: raw.html_url,
    submittedAt: raw.submitted_at,
    commitId: raw.commit_id,
  };
}

async function listCommentPage(
  ref: PullRequestRef,
  page: number,
  cache: EtagCache,
  run: Runner,
): Promise<RawReviewComment[]> {
  const path = `${pullPath(ref)}/comments?per_page=${CONVERSATION_PAGE_SIZE}&page=${page}`;
  return JSON.parse(await conditionalGet(path, cache, run)) as RawReviewComment[];
}

export async function listReviewComments(
  ref: PullRequestRef,
  cache: EtagCache,
  run: Runner = githubRun,
): Promise<ReviewComment[]> {
  const rows: RawReviewComment[] = [];
  for (let page = 1; page <= CONVERSATION_MAX_PAGES; page += 1) {
    const batch = await listCommentPage(ref, page, cache, run);
    rows.push(...batch);
    if (batch.length < CONVERSATION_PAGE_SIZE) break;
  }
  return rows.map(toReviewComment);
}

export async function listReviews(
  ref: PullRequestRef,
  cache: EtagCache,
  run: Runner = githubRun,
): Promise<PostedReview[]> {
  const path = `${pullPath(ref)}/reviews?per_page=${CONVERSATION_PAGE_SIZE}`;
  const reviews = JSON.parse(await conditionalGet(path, cache, run)) as RawReview[];
  return reviews.map(toPostedReview);
}
