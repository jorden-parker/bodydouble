import { Suspense } from "react";
import { PageHeader, PageShell } from "@/components/common/page-shell";
import { InboxList } from "@/components/inbox/inbox-list";
import { InboxResume } from "@/components/inbox/inbox-resume";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import { OpenPullRequestForm } from "@/components/inbox/open-pull-request-form";
import type { RepositorySearchParams } from "@/components/inbox/repository-filter";

export default function InboxPage({ searchParams }: { searchParams?: RepositorySearchParams }) {
  return (
    <PageShell>
      <PageHeader title="Inbox" lede="One PR at a time. Pick one, follow the path, take breaks." />
      <div className="grid gap-8 lg:grid-cols-[5fr_6fr] lg:gap-6">
        <section aria-label="Pick up where you left off" className="flex min-w-0 flex-col gap-6">
          <Suspense fallback={<InboxSkeleton />}>
            <InboxResume />
          </Suspense>
        </section>
        <section aria-label="Waiting for you" className="flex min-w-0 flex-col gap-6">
          <Suspense fallback={<InboxSkeleton />}>
            <InboxList searchParams={searchParams} />
          </Suspense>
          <OpenPullRequestForm />
        </section>
      </div>
    </PageShell>
  );
}
