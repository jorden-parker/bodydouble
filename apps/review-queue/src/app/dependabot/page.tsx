import { Suspense } from "react";
import { PageHeader, PageShell } from "@/components/common/page-shell";
import { DependabotList } from "@/components/inbox/dependabot-list";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";

export default function DependabotPage() {
  return (
    <PageShell>
      <PageHeader
        title="Dependabot"
        lede="Dependency updates from your repositories, for support cover."
      />
      <section aria-label="Open pull requests" className="flex min-w-0 flex-col gap-4">
        <Suspense fallback={<InboxSkeleton />}>
          <DependabotList />
        </Suspense>
      </section>
    </PageShell>
  );
}
