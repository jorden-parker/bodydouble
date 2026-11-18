import { CommandError, type Runner } from "@/lib/exec";

export type Search = { label: string; search: string; fields: string };

type SearchPage<T> = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: T[];
};

type WaitingSearch = {
  search: Search;
  after: string | null;
  resolve: (page: SearchPage<never>) => void;
  reject: (failure: Error) => void;
};

type Answer = {
  data?: Record<string, SearchPage<never> | null> | null;
  errors?: { message: string; path?: (string | number)[] }[];
};

export const MAX_SEARCH_PAGES = 10;

const loginLookups = new WeakMap<Runner, Promise<string>>();
const waitingSearches = new WeakMap<Runner, WaitingSearch[]>();

async function lookUpLogin(run: Runner): Promise<string> {
  const output = await run("gh", ["api", "user", "-q", ".login"]);
  return output.trim();
}

export function fetchLogin(run: Runner): Promise<string> {
  const existing = loginLookups.get(run);
  if (existing) return existing;
  const lookup = lookUpLogin(run);
  loginLookups.set(run, lookup);
  lookup.catch(() => {
    if (loginLookups.get(run) === lookup) loginLookups.delete(run);
  });
  return lookup;
}

function aliasOf(index: number): string {
  return `search${index}`;
}

function buildField({ search, after }: WaitingSearch, index: number): string {
  const alias = aliasOf(index);
  const cursor = after === null ? "" : `, after: $after${index}`;
  return `${alias}: search(query: $${alias}, type: ISSUE, first: 100${cursor}) {
    pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest { ${search.fields} } }
  }`;
}

function buildArgs(waiting: WaitingSearch[]): string[] {
  const variables = waiting.flatMap(({ search, after }, index) => [
    [aliasOf(index), search.search],
    ...(after === null ? [] : [[`after${index}`, after]]),
  ]);
  const declarations = variables.map(([name]) => `$${name}: String!`).join(", ");
  const query = `query(${declarations}) {\n${waiting.map(buildField).join("\n")}\n}`;
  return [
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    ...variables.flatMap(([name, value]) => ["-f", `${name}=${value}`]),
  ];
}

function reasonOf(failure: unknown): string {
  if (failure instanceof CommandError) return failure.reason.trim();
  return failure instanceof Error ? failure.message : String(failure);
}

function answerPrintedBy(failure: unknown): Answer | null {
  if (!(failure instanceof CommandError)) return null;
  try {
    return JSON.parse(failure.printed) as Answer;
  } catch {
    return null;
  }
}

async function ask(run: Runner, waiting: WaitingSearch[]): Promise<Answer> {
  try {
    return JSON.parse(await run("gh", buildArgs(waiting))) as Answer;
  } catch (failure) {
    const printed = answerPrintedBy(failure);
    return printed?.data ? printed : { errors: [{ message: reasonOf(failure) }] };
  }
}

function describeFailure(answer: Answer, label: string, alias: string): string {
  const errors = answer.errors ?? [];
  if (!answer.data) {
    return `The request failed, so nothing from GitHub was refreshed and the last sync is still shown. ${errors[0]?.message ?? ""}`.trim();
  }
  const own = errors.find((error) => error.path?.[0] === alias) ?? errors[0];
  return `The search for ${label} failed, so that part was not refreshed. ${own?.message ?? ""}`.trim();
}

async function sendWaitingSearches(run: Runner): Promise<void> {
  const waiting = waitingSearches.get(run) ?? [];
  waitingSearches.delete(run);
  const answer = await ask(run, waiting);
  waiting.forEach(({ search, resolve, reject }, index) => {
    const alias = aliasOf(index);
    const page = answer.data?.[alias];
    if (page) resolve(page);
    else reject(new Error(describeFailure(answer, search.label, alias)));
  });
}

function fetchPage<T>(run: Runner, search: Search, after: string | null): Promise<SearchPage<T>> {
  return new Promise((resolve, reject) => {
    const waiting = waitingSearches.get(run) ?? [];
    if (waiting.length === 0) {
      waitingSearches.set(run, waiting);
      setTimeout(() => void sendWaitingSearches(run), 0);
    }
    waiting.push({ search, after, resolve, reject });
  });
}

export async function searchAll<T>(run: Runner, search: Search): Promise<T[]> {
  const nodes: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    const searchPage: SearchPage<T> = await fetchPage<T>(run, search, after);
    nodes.push(...searchPage.nodes);
    after = searchPage.pageInfo.hasNextPage ? searchPage.pageInfo.endCursor : null;
    if (after === null) break;
  }
  return nodes;
}
