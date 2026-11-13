"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { TallyMark } from "@/components/neon/tally-mark";

const PAGES = [
  { href: "/", label: "Dashboard" },
  { href: "/tickets", label: "Tickets" },
  { href: "/work", label: "Work Log" },
  { href: "/settings", label: "Settings" },
];

export function AppBar() {
  const pathname = usePathname();
  return (
    <header className="flex flex-none items-center gap-3 border-b border-line-soft bg-background/85 px-3 py-2 backdrop-blur-md sm:gap-5 sm:px-7 sm:py-3">
      <Link
        href="/"
        aria-label="Tally home"
        className="flex min-h-11 min-w-11 items-center gap-3 rounded-md text-foreground no-underline"
      >
        <TallyMark size="medium" />
        <span className="hidden font-display text-xl font-semibold text-neon-tally sm:inline">
          Tally
        </span>
      </Link>
      <nav aria-label="Main" className="flex min-w-0 gap-1 sm:ml-4">
        {PAGES.map(({ href, label }) => {
          const isCurrent = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-pill px-2 text-[0.8125rem] font-bold whitespace-nowrap text-muted-foreground no-underline transition-colors hover:bg-surface-2 hover:text-foreground sm:px-4 sm:text-[0.925rem]",
                isCurrent &&
                  "bg-surface-2 text-foreground shadow-[inset_0_-2px_0_var(--neon-pink)]",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
