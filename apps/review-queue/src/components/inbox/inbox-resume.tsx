import { ArrowRight, Coffee } from "lucide-react";
import { Otter } from "@/components/neon/otter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HomeSessions } from "./home-sessions";
import { isPondClear, loadInbox } from "./inbox-data";

const RIPPLE_RINGS = [
  { className: "border-neon-blue", delay: "0s" },
  { className: "border-neon-pink", delay: "1.2s" },
  { className: "border-neon-amber", delay: "2.4s" },
];

function InboxHero() {
  return (
    <div className="grid shrink-0 items-center gap-s-4 sm:grid-cols-[auto_minmax(0,1fr)]">
      <Otter size="large" isFloating className="text-[clamp(3rem,8vh,4.5rem)]" />
      <div className="grid min-w-0 gap-s-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Review <span className="text-neon-rq">Queue</span>
        </h1>
        <p className="max-w-prose text-base text-fg-muted">
          One PR at a time. Pick one, follow the path, take breaks.
        </p>
      </div>
    </div>
  );
}

function PondClear() {
  return (
    <section
      aria-labelledby="pond-clear-heading"
      className="grid shrink-0 items-center justify-items-center gap-s-6 text-center sm:grid-cols-[auto_minmax(0,1fr)] sm:justify-items-start sm:text-left"
    >
      <div
        aria-hidden="true"
        className="relative grid size-[clamp(7rem,20vh,11rem)] place-items-center overflow-hidden"
      >
        {RIPPLE_RINGS.map((ring) => (
          <span
            key={ring.className}
            className={`absolute inset-1/4 animate-ping rounded-full border-2 ${ring.className}`}
            style={{ animationDelay: ring.delay, animationDuration: "3.6s" }}
          />
        ))}
        <Otter size="large" isFloating className="relative text-[clamp(4rem,10vh,6rem)]" />
      </div>
      <div className="grid justify-items-center gap-s-3 sm:justify-items-start">
        <h1
          id="pond-clear-heading"
          className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          Pond&rsquo;s Clear. Go Stretch.
        </h1>
        <p className="max-w-prose text-base text-fg-muted">
          Nothing is waiting for your review. Enjoy it.
        </p>
        <Button variant="neon" asChild>
          <a href="#pr">
            Open a PR by URL <ArrowRight />
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
    <div className="flex min-h-0 flex-col gap-s-5 sm:gap-s-7">
      {isClear ? <PondClear /> : <InboxHero />}
      <HomeSessions
        inProgress={inbox.inProgress}
        archived={inbox.archived}
        isResumePrimary={!isClear}
      />
    </div>
  );
}
