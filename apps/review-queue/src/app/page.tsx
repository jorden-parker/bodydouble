import { Suspense } from "react";
import { PageShell } from "@/components/common/page-shell";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import { OpenPullRequestForm } from "@/components/inbox/open-pull-request-form";
import { QueueScreen } from "@/components/inbox/queue-screen";
import type { RepositorySearchParams } from "@/components/inbox/repository-filter";

export default function QueuePage({ searchParams }: { searchParams?: RepositorySearchParams }) {
  return (
    <PageShell>
      <h1 className="sr-only">Queue</h1>
      <Suspense fallback={<InboxSkeleton />}>
        <QueueScreen searchParams={searchParams} />
      </Suspense>
      <OpenPullRequestForm />
    </PageShell>
  );
}
