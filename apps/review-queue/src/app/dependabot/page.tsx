import { Suspense } from "react";
import { Panel, Panels } from "@/components/neon/panels";
import { DependabotList } from "@/components/inbox/dependabot-list";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";

export default function DependabotPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mx-auto w-full max-w-[1680px] px-[clamp(var(--s-4),3vw,var(--s-7))] pt-s-5">
        <h1 className="font-display text-3xl font-bold tracking-tight">Dependabot</h1>
        <p className="text-fg-muted max-md:hidden">
          Dependency updates from your repositories, for support cover.
        </p>
      </header>
      <Panels label="Dependabot sections">
        <Panel
          title="Open Pull Requests"
          className="min-w-72 self-stretch rounded-2xl border border-line bg-surface p-s-5 shadow-lift"
        >
          <Suspense fallback={<InboxSkeleton />}>
            <DependabotList />
          </Suspense>
        </Panel>
      </Panels>
    </div>
  );
}
