import type { ReactNode } from "react";
import { cn } from "cn";

export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border border-line-soft bg-surface p-6 max-sm:p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}
