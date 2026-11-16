import { Suspense } from "react";
import { PageHeader, PageShell } from "@/components/common/page-shell";
import { DependabotList } from "@/components/inbox/dependabot-list";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import type { RepositorySearchParams } from "@/components/inbox/repository-filter";

export default function DependabotPage({
  searchParams,
}: {
  searchParams?: RepositorySearchParams;
}) {
  return (
    <PageShell>
      <PageHeader
        title="Dependabot"
        lede="Dependency updates from your repositories, for support cover."
      />
      <section aria-label="Open pull requests" className="flex min-w-0 flex-col gap-4">
        <Suspense fallback={<InboxSkeleton />}>
          <DependabotList searchParams={searchParams} />
        </Suspense>
      </section>
    </PageShell>
  );
}
