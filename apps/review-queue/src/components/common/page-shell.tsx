import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

type PageShellProps = { children: ReactNode; isNarrow?: boolean };

export function PageShell({ children, isNarrow = false }: PageShellProps) {
  return (
    <main id="main" className={cn("page-shell", isNarrow && "page-shell--narrow")}>
      <div className="flex flex-col gap-8">{children}</div>
    </main>
  );
}

type PageHeaderProps = {
  title: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({ title, lede, action, backHref, backLabel }: PageHeaderProps) {
  return (
    <div className="page-band">
      <header className="page-band__inner">
        {backHref && (
          <Button variant="ghost" size="sm" asChild className="-ml-3 w-fit">
            <Link href={backHref}>
              <ArrowLeft /> {backLabel}
            </Link>
          </Button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="min-w-0 text-title text-balance">{title}</h1>
          {action}
        </div>
        {lede && <p className="max-w-prose text-sm text-fg-muted">{lede}</p>}
      </header>
    </div>
  );
}
