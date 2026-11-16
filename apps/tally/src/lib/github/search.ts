import type { Runner } from "@/lib/exec";

type SearchPage<T> = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: T[];
};

export const MAX_SEARCH_PAGES = 10;

const loginLookups = new WeakMap<Runner, Promise<string>>();

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

function buildArgs(
  query: string,
  variables: Record<string, string>,
  after: string | null,
): string[] {
  const fields = after === null ? variables : { ...variables, after };
  const args = Object.entries(fields).flatMap(([name, value]) => ["-f", `${name}=${value}`]);
  return ["api", "graphql", "-f", `query=${query}`, ...args];
}

async function fetchPage<T>(
  run: Runner,
  query: string,
  variables: Record<string, string>,
  after: string | null,
): Promise<SearchPage<T>> {
  const output = await run("gh", buildArgs(query, variables, after));
  return JSON.parse(output).data.search;
}

export async function searchAll<T>(
  run: Runner,
  query: string,
  variables: Record<string, string>,
): Promise<T[]> {
  const nodes: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    const searchPage: SearchPage<T> = await fetchPage<T>(run, query, variables, after);
    nodes.push(...searchPage.nodes);
    after = searchPage.pageInfo.hasNextPage ? searchPage.pageInfo.endCursor : null;
    if (after === null) break;
  }
  return nodes;
}
