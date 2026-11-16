"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { modelChipOf } from "@/components/common/model-chip";
import { useModelStatus } from "@/components/common/use-model-status";
import { Otter } from "./otter";

const NAVIGATION_LINKS = [
  { label: "Queue", href: "/" },
  { label: "Dependabot", href: "/dependabot" },
  { label: "Smartling", href: "/smartling" },
  { label: "Settings", href: "/settings" },
];

function ModelBadge() {
  const chip = modelChipOf(useModelStatus());
  if (!chip) return null;
  return (
    <span className="ml-auto flex items-center gap-1.5 self-center whitespace-nowrap rounded-full border border-line-soft px-2.5 py-0.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          chip.state === "ready" || chip.state === "busy" ? "bg-primary" : "bg-muted-foreground/40",
        )}
      />
      {chip.name} {chip.stateWord}
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
