"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { TallyMark } from "@/components/neon/tally-mark";

const PAGES = [
  { href: "/", label: "Dashboard" },
  { href: "/tickets", label: "Tickets" },
  { href: "/work", label: "Work log" },
  { href: "/settings", label: "Settings" },
];

export function AppBar() {
  const pathname = usePathname();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 h-14 flex-none border-b border-line-soft bg-background">
        <div className="mx-auto flex h-full w-full max-w-[1200px] items-center gap-2 px-4 sm:gap-6 sm:px-6">
          <Link
            href="/"
            aria-label="Tally home"
            className="flex min-h-11 flex-none items-center gap-2 rounded-md text-foreground no-underline"
          >
            <TallyMark size="small" />
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">Tally</span>
          </Link>
          <nav aria-label="Main" className="app-nav flex h-full min-w-0 flex-1 items-stretch">
            {PAGES.map(({ href, label }) => {
              const isCurrent = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "inline-flex flex-none items-center px-2 text-[0.8125rem] font-medium sm:px-3 whitespace-nowrap text-muted-foreground no-underline transition-colors hover:text-foreground sm:text-sm",
                    isCurrent && "app-tab-current text-foreground",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
    </>
  );
}
