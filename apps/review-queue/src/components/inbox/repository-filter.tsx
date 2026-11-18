import type { ReviewRequest } from "@/lib/github/gh";
import { buildHref, type QueueQuery } from "./build-href";
import { ChoiceMenu } from "./choice-menu";

export type RepositorySearchParams = Promise<{
  repository?: string | string[];
  sort?: string | string[];
  bots?: string | string[];
}>;

function repositoryOf(request: ReviewRequest): string {
  return `${request.ref.owner}/${request.ref.repo}`;
}

export async function chosenRepository(
  searchParams: RepositorySearchParams | undefined,
): Promise<string | null> {
  const repository = (await searchParams)?.repository;
  return typeof repository === "string" ? repository : null;
}

export function isInRepository(request: ReviewRequest, repository: string | null): boolean {
  return repository === null || repositoryOf(request) === repository;
}

export function RepositoryFilter({
  requests,
  chosen,
  query,
}: {
  requests: ReviewRequest[];
  chosen: string | null;
  query: QueueQuery;
}) {
  const repositories = [...new Set(requests.map(repositoryOf))].sort();
  if (repositories.length < 2 && chosen === null) return null;
  const choices = [
    {
      label: "All repositories",
      href: buildHref("/", { ...query, repository: undefined }),
      isChosen: chosen === null,
    },
    ...repositories.map((repository) => ({
      label: repository,
      href: buildHref("/", { ...query, repository }),
      isChosen: repository === chosen,
    })),
  ];
  return <ChoiceMenu title="Repository" label="Filter by repository" choices={choices} />;
}
