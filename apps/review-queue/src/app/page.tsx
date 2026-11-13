import { Suspense } from "react";
import { Panel, Panels } from "@/components/neon/panels";
import { InboxList } from "@/components/inbox/inbox-list";
import { InboxResume } from "@/components/inbox/inbox-resume";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import { OpenPullRequestForm } from "@/components/inbox/open-pull-request-form";

const PANEL_CLASS = "rounded-lg border border-line-soft bg-surface p-s-5 shadow-lift";

export default function InboxPage() {
  return (
    <Panels label="Inbox sections" className="grid-cols-[5fr_6fr]">
      <Panel title="Pick Up Where You Left Off" className={`${PANEL_CLASS} grid-rows-1`}>
        <Suspense fallback={<InboxSkeleton />}>
          <InboxResume />
        </Suspense>
      </Panel>
      <Panel title="Waiting for You" className={PANEL_CLASS}>
        <Suspense fallback={<InboxSkeleton />}>
          <InboxList />
        </Suspense>
        <OpenPullRequestForm />
      </Panel>
    </Panels>
  );
}
