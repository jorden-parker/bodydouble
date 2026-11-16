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
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
      >
        Skip to content
      </a>
      <header className="flex h-14 flex-none items-center gap-3 border-b border-line-soft bg-background px-4 sm:gap-5 sm:px-6">
        <Link
          href="/"
          aria-label="Tally home"
          className="flex min-h-11 min-w-11 items-center gap-3 rounded-md text-foreground no-underline"
        >
          <TallyMark size="medium" />
          <span className="hidden text-base font-semibold text-neon-tally sm:inline">Tally</span>
        </Link>
        <nav aria-label="Main" className="flex min-w-0 gap-1">
          {PAGES.map(({ href, label }) => {
            const isCurrent = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-colors hover:text-foreground sm:px-3",
                  isCurrent && "bg-surface-2 text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
