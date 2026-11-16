import { Suspense } from "react";
import { PageHeader, PageShell } from "@/components/common/page-shell";
import { SmartlingList } from "@/components/inbox/bot-pull-request-list";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import type { RepositorySearchParams } from "@/components/inbox/repository-filter";

export default function SmartlingPage({ searchParams }: { searchParams?: RepositorySearchParams }) {
  return (
    <PageShell>
      <PageHeader title="Smartling" lede="Translation updates from your repositories." />
      <section aria-label="Open pull requests" className="flex min-w-0 flex-col gap-4">
        <Suspense fallback={<InboxSkeleton />}>
          <SmartlingList searchParams={searchParams} />
        </Suspense>
      </section>
    </PageShell>
  );
}
