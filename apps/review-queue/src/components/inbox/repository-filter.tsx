import type { ReviewRequest } from "@/lib/github/gh";
import { buildHref, ChoiceLinks } from "./choice-links";

export type RepositorySearchParams = Promise<{
  repository?: string | string[];
  sort?: string | string[];
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

export function filterByRepository(
  requests: ReviewRequest[],
  repository: string | null,
): ReviewRequest[] {
  return requests.filter((request) => isInRepository(request, repository));
}

export function RepositoryFilter({
  requests,
  chosen,
  basePath,
  sortParameter,
}: {
  requests: ReviewRequest[];
  chosen: string | null;
  basePath: string;
  sortParameter?: string;
}) {
  const repositories = [...new Set(requests.map(repositoryOf))].sort();
  if (repositories.length < 2 && chosen === null) return null;
  const choices = [
    {
      label: "All repositories",
      href: buildHref(basePath, { sort: sortParameter }),
      isChosen: chosen === null,
    },
    ...repositories.map((repository) => ({
      label: repository,
      href: buildHref(basePath, { repository, sort: sortParameter }),
      isChosen: repository === chosen,
    })),
  ];
  return <ChoiceLinks label="Filter by repository" choices={choices} />;
}
