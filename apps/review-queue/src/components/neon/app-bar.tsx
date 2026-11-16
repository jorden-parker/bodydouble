"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Otter } from "./otter";

const NAVIGATION_LINKS = [
  { label: "Inbox", href: "/" },
  { label: "Dependabot", href: "/dependabot" },
  { label: "Settings", href: "/settings" },
];

export function AppBar() {
  const pathname = usePathname();

  return (
    <header className="app-bar">
      <Link href="/" className="flex shrink-0 min-h-11 items-center gap-s-3 text-fg no-underline">
        <Otter size="medium" />
        <span className="text-base font-semibold whitespace-nowrap max-sm:sr-only">
          Review <span className="text-neon-rq">Queue</span>
        </span>
      </Link>
      <nav aria-label="Main" className="flex gap-s-1">
        {NAVIGATION_LINKS.map((link) => {
          const isCurrent = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-md px-s-2 whitespace-nowrap text-sm font-medium text-fg-muted no-underline transition-colors hover:text-fg sm:px-s-3",
                isCurrent && "text-fg",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
