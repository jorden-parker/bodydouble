import { ArrowRight, Coffee } from "lucide-react";
import { Otter } from "@/components/neon/otter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HomeSessions } from "./home-sessions";
import { isPondClear, loadInbox } from "./inbox-data";

function PondClear() {
  return (
    <section
      aria-labelledby="pond-clear-heading"
      className="grid justify-items-center gap-4 rounded-xl border border-line-soft bg-surface p-8 text-center"
    >
      <Otter size="large" isFloating />
      <div className="grid justify-items-center gap-2">
        <h2 id="pond-clear-heading" className="text-heading text-balance">
          Nothing waiting for review
        </h2>
        <p className="max-w-prose text-sm text-fg-muted">Enjoy the break.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <a href="#pr">
            Open any PR by URL <ArrowRight />
          </a>
        </Button>
        <Badge variant="amber">
          <Coffee />
          Stretch counts as productive
        </Badge>
      </div>
    </section>
  );
}

export async function InboxResume() {
  const inbox = await loadInbox();
  const isClear = isPondClear(inbox);
  return (
    <>
      {isClear && <PondClear />}
      <HomeSessions
        inProgress={inbox.inProgress}
        archived={inbox.archived}
        isResumePrimary={!isClear}
      />
    </>
  );
}
