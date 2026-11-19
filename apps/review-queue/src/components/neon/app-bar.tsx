"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { modelChipOf } from "@/components/common/model-chip";
import { useModelStatus } from "@/components/common/use-model-status";
import { postModelStart } from "@/components/review/api";
import { Button } from "@/components/ui/button";
import { Otter } from "./otter";

const NAVIGATION_LINKS = [
  { label: "Queue", href: "/" },
  { label: "Settings", href: "/settings" },
];

function ModelBadge() {
  const [status, setStatus] = useModelStatus();
  const [isStartRequested, setIsStartRequested] = useState(false);
  const chip = modelChipOf(status);
  if (!chip || !status) return null;
  const canStart =
    !isStartRequested &&
    (chip.state === "down" || chip.state === "failed") &&
    status.start.command !== null;
  const requestStart = () => {
    setIsStartRequested(true);
    postModelStart()
      .then(setStatus, () => undefined)
      .finally(() => setIsStartRequested(false));
  };
  return (
    <span
      title={status.start.failure ?? undefined}
      className="ml-auto flex items-center gap-1.5 self-center whitespace-nowrap rounded-full border border-line-soft px-2.5 py-0.5 text-xs text-muted-foreground"
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          chip.state === "ready" || chip.state === "busy" ? "bg-primary" : "bg-muted-foreground/40",
        )}
      />
      <span aria-live="polite">
        {chip.name} {isStartRequested ? "starting" : chip.stateWord}
      </span>
      {status.start.failure && <span className="sr-only">{status.start.failure}</span>}
      {canStart && (
        <Button
          variant="outline"
          size="xs"
          className="-mr-1.5 h-6 rounded-full text-xs"
          title={`Runs ${status.start.command}`}
          onClick={requestStart}
        >
          Start
        </Button>
      )}
    </span>
  );
}

export function AppBar() {
  const pathname = usePathname();

  return (
    <header className="app-bar">
      <div className="app-bar__inner">
        <Link href="/" className="app-bar__brand">
          <Otter size="small" />
          <span>Review Queue</span>
        </Link>
        <nav aria-label="Main" className="app-bar__nav">
          {NAVIGATION_LINKS.map((link) => {
            const isCurrent = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn("app-bar__link", isCurrent && "is-current")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <ModelBadge />
      </div>
    </header>
  );
}
