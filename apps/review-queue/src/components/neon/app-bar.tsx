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
        <Otter size="medium" isFloating />
        <span className="font-display text-xl font-semibold whitespace-nowrap max-sm:sr-only">
          Review <span className="text-neon-rq">Queue</span>
        </span>
      </Link>
      <nav aria-label="Main" className="ml-s-4 flex gap-s-1">
        {NAVIGATION_LINKS.map((link) => {
          const isCurrent = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-pill px-s-2 whitespace-nowrap text-[0.925rem] font-bold text-fg-muted no-underline hover:bg-surface-2 hover:text-fg sm:px-s-4",
                isCurrent && "bg-surface-2 text-fg shadow-[inset_0_-2px_0_var(--neon-pink)]",
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
