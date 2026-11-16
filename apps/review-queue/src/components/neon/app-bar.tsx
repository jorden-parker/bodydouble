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
      </div>
    </header>
  );
}
