import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ReviewRequest } from "@/lib/github/gh";

export type RepositorySearchParams = Promise<{ repository?: string | string[] }>;

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
}: {
  requests: ReviewRequest[];
  chosen: string | null;
  basePath: string;
}) {
  const repositories = [...new Set(requests.map(repositoryOf))].sort();
  if (repositories.length < 2 && chosen === null) return null;
  const choices = [
    { label: "All repositories", href: basePath, isChosen: chosen === null },
    ...repositories.map((repository) => ({
      label: repository,
      href: `${basePath}?repository=${encodeURIComponent(repository)}`,
      isChosen: repository === chosen,
    })),
  ];
  return (
    <nav aria-label="Filter by repository" className="flex flex-wrap gap-2">
      {choices.map((choice) => (
        <Button key={choice.href} variant={choice.isChosen ? "soft" : "ghost"} size="sm" asChild>
          <Link href={choice.href} aria-current={choice.isChosen ? "true" : undefined}>
            {choice.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
